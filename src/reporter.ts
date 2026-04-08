import { EventEmitter } from 'events';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import semver from 'semver';

import { NewmanRunExecution, NewmanRunOptions } from 'newman';
import { PropertyBase, PropertyBaseDefinition } from 'postman-collection';

import {
  BrowserStackConfig,
  BuildStartPayload,
  PendingTest,
  TestRunEvent,
  LogCreatedEvent,
  CollectorEvent,
} from './types';
import { loadConfig, getCustomTags } from './config';
import { HttpClient } from './http-client';
import { EventQueue } from './event-queue';
import { getHostInfo } from './helpers/host';
import { getCiInfo } from './helpers/ci';
import { getGitMetaData } from './helpers/git';
import { debug, log, error as logError } from './helpers/logger';

function getPackageVersion(pkg: string): string | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkgJson = require(`${pkg}/package.json`) as { version: string };
    return pkgJson.version;
  } catch {
    return null;
  }
}

export class BrowserStackNewmanReporter {
  private config: BrowserStackConfig | null;
  private httpClient: HttpClient;
  private eventQueue: EventQueue | null = null;
  private jwt: string | null = null;
  private buildHashedId: string | null = null;
  private pendingTestMap: Map<string, PendingTest> = new Map();
  private enabled = true;
  private buildStartPromise: Promise<void> | null = null;
  private collectionFile = 'collection.json';
  private newmanVersion = 'unknown';

  constructor(
    emitter: EventEmitter,
    _options: Record<string, unknown>,
    collectionOptions: NewmanRunOptions,
  ) {
    this.config = loadConfig();
    this.httpClient = new HttpClient();

    if (!this.config) {
      this.enabled = false;
      this.addRunnerListeners(emitter);
      return;
    }

    // Check if test observability is explicitly disabled
    if (this.config.testObservability === false) {
      debug('testObservability is set to false. Reporter disabled.');
      this.enabled = false;
      this.addRunnerListeners(emitter);
      return;
    }

    // Extract collection file path (relative to cwd)
    this.collectionFile = this.resolveCollectionPath(collectionOptions);
    debug(`Resolved collection path: ${this.collectionFile}`);

    this.addRunnerListeners(emitter);
  }

  private resolveCollectionPath(options: NewmanRunOptions): string {
    try {
      // Newman may pass collection as string path, URL, or parsed object
      const collection = options.collection;

      // Direct string path
      if (typeof collection === 'string') {
        return path.relative(process.cwd(), path.resolve(collection));
      }

      // Check if collectionRunOptions has the source path
      // Newman stores the original source in different places depending on version
      const opts = options as unknown as Record<string, unknown>;

      // Try common locations where Newman stores the original file path
      if (typeof opts.collectionSource === 'string') {
        return path.relative(process.cwd(), path.resolve(opts.collectionSource));
      }

      // Check process.argv for the collection path (Newman CLI passes it as first non-flag arg after 'run')
      const argv = process.argv;
      const runIdx = argv.indexOf('run');
      if (runIdx !== -1 && runIdx + 1 < argv.length) {
        const candidate = argv[runIdx + 1];
        if (candidate && !candidate.startsWith('-') && (candidate.endsWith('.json') || candidate.endsWith('.postman_collection'))) {
          return path.relative(process.cwd(), path.resolve(candidate));
        }
      }

      // Fallback: try to get collection name from parsed object
      if (collection && typeof collection === 'object') {
        const col = collection as { info?: { name?: string } };
        if (col.info?.name) {
          return col.info.name;
        }
      }
    } catch {
      // ignore
    }
    return 'collection.json';
  }

  public static getParentTitles(item: PropertyBase<PropertyBaseDefinition>): string[] {
    let titles: string[] = [];
    const parent = item.parent();
    if (parent) {
      titles = titles.concat(BrowserStackNewmanReporter.getParentTitles(parent));
    }
    if ('name' in item) {
      titles.push(String((item as { name: string }).name));
    }
    return titles;
  }

  private addRunnerListeners(runner: EventEmitter): void {
    // --- start: create build ---
    runner.on('start', () => {
      if (!this.enabled || !this.config) return;
      this.buildStartPromise = this.startBuild();
    });

    // --- beforeItem: TestRunStarted ---
    runner.on('beforeItem', (_err: Error | undefined, exec: NewmanRunExecution) => {
      if (!this.enabled) return;

      try {
        const { item } = exec;
        const parent = item.parent();
        const allTitles = parent ? BrowserStackNewmanReporter.getParentTitles(parent) : [];
        // Strip the collection root name (first element) — it's always the same
        // and creates a redundant top-level in TRA. Keep only folder scopes.
        const scopes = allTitles.length > 1 ? allTitles.slice(1) : allTitles;
        const identifier = [...scopes, item.name].join(' > ');
        const uuid = uuidv4();
        const now = new Date();

        const pending: PendingTest = {
          uuid,
          name: item.name,
          scopes,
          identifier,
          location: this.collectionFile,
          startedAt: now.toISOString(),
          startTimestamp: now.getTime(),
          errors: [],
        };

        this.pendingTestMap.set(item.id, pending);

        // Enqueue TestRunStarted
        const event: TestRunEvent = {
          event_type: 'TestRunStarted',
          test_run: {
            uuid,
            name: item.name,
            framework: 'newman',
            identifier,
            scopes,
            location: this.collectionFile,
            file_name: this.collectionFile,
            vc_filepath: this.collectionFile,
            started_at: pending.startedAt,
            finished_at: null,
            duration_in_ms: null,
            result: 'pending',
          },
        };

        this.safeEnqueue(event);
      } catch (e) {
        debug(`Error in beforeItem handler: ${e}`);
      }
    });

    // --- assertion: buffer errors ---
    runner.on('assertion', (err: Error | undefined, exec: NewmanRunExecution) => {
      if (!this.enabled || !err) return;

      try {
        const { item } = exec;
        const pending = this.pendingTestMap.get(item.id);
        if (pending) {
          pending.errors.push({
            message: err.message,
            stack: err.stack,
            name: err.name,
          });
        }
      } catch (e) {
        debug(`Error in assertion handler: ${e}`);
      }
    });

    // --- request: LogCreated (HTTP) ---
    runner.on('request', (_err: Error | undefined, exec: NewmanRunExecution) => {
      if (!this.enabled) return;

      try {
        const { item } = exec;
        const pending = this.pendingTestMap.get(item.id);
        if (!pending) return;

        const response = (exec as unknown as { response?: { code?: number; responseTime?: number } }).response;
        const request = (exec as unknown as { request?: { url?: { toString(): string; getHost?(): string; getPath?(): string }; method?: string } }).request;

        if (!request) return;

        let hostname = '';
        let urlPath = '';

        if (request.url) {
          if (typeof request.url.getHost === 'function') {
            hostname = request.url.getHost();
          }
          if (typeof request.url.getPath === 'function') {
            urlPath = request.url.getPath();
          }
          if (!hostname || !urlPath) {
            const urlStr = request.url.toString();
            try {
              const parsed = new URL(urlStr);
              hostname = hostname || parsed.hostname;
              urlPath = urlPath || parsed.pathname + parsed.search;
            } catch {
              // ignore parse errors
            }
          }
        }

        const logEvent: LogCreatedEvent = {
          event_type: 'LogCreated',
          logs: [{
            test_run_uuid: pending.uuid,
            timestamp: new Date().toISOString(),
            level: null,
            message: null,
            kind: 'HTTP',
            http_response: {
              host: hostname,
              path: urlPath,
              method: request.method ?? 'GET',
              headers: {},
              status_code: response?.code ?? 0,
              duration_ms: response?.responseTime ?? 0,
            },
          }],
        };

        debug(`[HTTP LOG] ${JSON.stringify(logEvent)}`);
        this.safeEnqueue(logEvent);
      } catch (e) {
        debug(`Error in request handler: ${e}`);
      }
    });

    // --- console: LogCreated (TEST_LOG) ---
    // Newman console event has shape: { cursor, level, messages } — no item property
    runner.on('console', (_err: Error | undefined, exec: unknown) => {
      if (!this.enabled) return;

      try {
        const data = exec as { cursor?: { ref?: string }; level?: string; messages?: string[] };

        // Find the current pending test by cursor ref or fallback to the most recent one
        let pending: PendingTest | undefined;
        if (data.cursor?.ref) {
          pending = this.pendingTestMap.get(data.cursor.ref);
        }
        if (!pending) {
          // Fallback: get the last added pending test
          const entries = Array.from(this.pendingTestMap.values());
          pending = entries[entries.length - 1];
        }
        if (!pending) return;

        const message = data.messages ? data.messages.join(', ') : '';

        const logEvent: LogCreatedEvent = {
          event_type: 'LogCreated',
          logs: [{
            test_run_uuid: pending.uuid,
            timestamp: new Date().toISOString(),
            level: this.normalizeLogLevel(data.level),
            message: message,
            kind: 'TEST_LOG',
            http_response: {},
          }],
        };

        debug(`[TEST_LOG] ${JSON.stringify(logEvent)}`);
        this.safeEnqueue(logEvent);
      } catch (e) {
        debug(`Error in console handler: ${e}`);
      }
    });

    // --- item: TestRunFinished ---
    runner.on('item', (_err: Error | undefined, exec: NewmanRunExecution) => {
      if (!this.enabled) return;

      try {
        const { item } = exec;
        const pending = this.pendingTestMap.get(item.id);
        if (!pending) return;

        const now = new Date();
        const durationMs = now.getTime() - pending.startTimestamp;
        const hasFailed = pending.errors.length > 0;

        const event: TestRunEvent = {
          event_type: 'TestRunFinished',
          test_run: {
            uuid: pending.uuid,
            name: pending.name,
            framework: 'newman',
            identifier: pending.identifier,
            scopes: pending.scopes,
            location: pending.location,
            file_name: pending.location,
            vc_filepath: pending.location,
            started_at: pending.startedAt,
            finished_at: now.toISOString(),
            duration_in_ms: Math.max(0, durationMs),
            result: hasFailed ? 'failed' : 'passed',
            failure_reason: hasFailed ? pending.errors[0]!.message : null,
            failure_type: hasFailed ? this.getFailureType(pending.errors[0]!) : null,
            failure: hasFailed
              ? pending.errors.map(err => ({
                  backtrace: err.stack ? err.stack.split('\n') : [err.message],
                  expanded: [],
                }))
              : null,
          },
        };

        this.safeEnqueue(event);
        this.pendingTestMap.delete(item.id);
      } catch (e) {
        debug(`Error in item handler: ${e}`);
      }
    });

    // --- beforeDone: drain queue and stop build ---
    runner.on('beforeDone', () => {
      if (!this.enabled) return;

      void (async () => {
        try {
          if (this.buildStartPromise) {
            await this.buildStartPromise;
          }
          if (this.eventQueue) {
            await this.eventQueue.shutdown();
          }
          if (this.buildHashedId && this.jwt) {
            await this.httpClient.stopBuild(this.buildHashedId, this.jwt, {
              finished_at: new Date().toISOString(),
            });
            log(`Build report: https://observability.browserstack.com/builds/${this.buildHashedId}`);
          }
        } catch (e) {
          debug(`Error in beforeDone handler: ${e}`);
        }
      })();
    });

    // --- done: preventExit for older Newman ---
    runner.on('done', () => {
      this.preventExit();
    });
  }

  private async startBuild(): Promise<void> {
    if (!this.config) return;

    try {
      const hostInfo = getHostInfo();
      const ciInfo = getCiInfo();
      const gitMeta = await getGitMetaData();

      this.newmanVersion = getPackageVersion('newman') ?? 'unknown';
      const sdkVersion = getPackageVersion('newman-reporter-browserstack') ?? '1.0.0';

      const payload: BuildStartPayload = {
        format: 'json',
        project_name: (this.config.projectName as string) ?? '',
        name: (this.config.buildName as string) ?? path.basename(path.resolve(process.cwd())),
        build_identifier: (this.config.buildIdentifier as string) ?? '',
        description: (this.config.buildDescription as string) ?? '',
        started_at: new Date().toISOString(),
        tags: getCustomTags(this.config),
        host_info: hostInfo,
        ci_info: ciInfo,
        build_run_identifier: process.env.BROWSERSTACK_BUILD_RUN_IDENTIFIER,
        failed_tests_rerun: process.env.BROWSERSTACK_RERUN ?? false,
        version_control: gitMeta,
        observability_version: {
          frameworkName: 'newman',
          frameworkVersion: this.newmanVersion,
          sdkVersion: sdkVersion,
        },
        product_map: {
          observability: true,
          automate: false,
          app_automate: false,
          accessibility: false,
          percy: false,
        },
      };

      const response = await this.httpClient.startBuild(
        payload,
        this.config.userName,
        this.config.accessKey,
      );

      this.jwt = response.jwt;
      this.buildHashedId = response.build_hashed_id;
      this.eventQueue = new EventQueue(this.jwt, this.httpClient);

      log(`Build started: https://observability.browserstack.com/builds/${this.buildHashedId}`);
    } catch (e) {
      logError(`Failed to start build: ${e}`);
      this.enabled = false;
    }
  }

  private safeEnqueue(event: CollectorEvent): void {
    if (!this.eventQueue) {
      // Build hasn't started yet — wait for it then enqueue
      if (this.buildStartPromise) {
        void this.buildStartPromise.then(() => {
          if (this.eventQueue) {
            this.eventQueue.enqueue(event);
          }
        });
      }
      return;
    }
    this.eventQueue.enqueue(event);
  }

  private normalizeLogLevel(level?: string): string {
    if (!level) return 'INFO';
    const upper = level.toUpperCase();
    // Newman uses 'log' for console.log — map to INFO (matching BStack agent logPatcher)
    if (upper === 'LOG') return 'INFO';
    if (['INFO', 'WARN', 'ERROR', 'DEBUG', 'TRACE'].includes(upper)) return upper;
    return 'INFO';
  }

  private getFailureType(err: { name?: string; message: string }): string {
    if (err.name === 'AssertionError' || err.name === 'AssertionError') return 'AssertionError';
    if (err.name === 'TypeError') return 'TypeError';
    if (err.name === 'ReferenceError') return 'ReferenceError';
    if (err.message.toLowerCase().includes('timeout')) return 'TimeoutError';
    if (err.message.toLowerCase().includes('assert')) return 'AssertionError';
    return 'UnhandledError';
  }

  private preventExit(): void {
    const newmanVersion = getPackageVersion('newman');
    if (!newmanVersion || semver.lt(newmanVersion, '5.3.2')) {
      const originalExit = process.exit;
      const mutableProcess: Record<'exit', (code?: number) => void> = process as unknown as Record<'exit', (code?: number) => void>;
      mutableProcess.exit = (code?: number) => {
        process.exitCode = code;
        process.exit = originalExit;
      };
    }
  }
}
