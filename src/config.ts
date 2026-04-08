import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { BrowserStackConfig } from './types';
import { debug, error as logError, warn } from './helpers/logger';

function substituteEnvironmentVariables(obj: unknown): unknown {
  if (typeof obj === 'string') {
    const matches = obj.match(/\$\{(.*?)\}/g);
    if (matches) {
      for (const match of matches) {
        const envName = match.substring(2, match.length - 1);
        const envValue = process.env[envName];
        if (envValue !== undefined) {
          obj = (obj as string).replace(match, envValue);
        }
      }
    }
    return obj;
  }

  if (typeof obj === 'object' && obj !== null) {
    const record = obj as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      const updatedKey = substituteEnvironmentVariables(key) as string;
      record[updatedKey] = substituteEnvironmentVariables(record[key]);
      if (key !== updatedKey) {
        delete record[key];
      }
    }
  }

  return obj;
}

export function findConfigFile(): string | null {
  // Check environment variable
  const envPath = process.env.BROWSERSTACK_CONFIG_FILE;
  if (envPath && fs.existsSync(path.resolve(envPath))) {
    return path.resolve(envPath);
  }

  // Traverse from cwd to root
  let filePath = process.cwd();
  while (filePath) {
    const ymlPath = path.join(filePath, 'browserstack.yml');
    const yamlPath = path.join(filePath, 'browserstack.yaml');

    if (fs.existsSync(ymlPath)) return ymlPath;
    if (fs.existsSync(yamlPath)) return yamlPath;

    const parent = path.dirname(filePath);
    if (parent === filePath) break;
    filePath = parent;
  }

  return null;
}

export function loadConfig(): BrowserStackConfig | null {
  const configPath = findConfigFile();
  if (!configPath) {
    warn('browserstack.yml not found. Reporter will be disabled.');
    return null;
  }

  debug(`Loading config from ${configPath}`);

  try {
    const raw = fs.readFileSync(configPath, 'utf8');
    let parsed = yaml.load(raw) as Record<string, unknown>;

    if (!parsed || typeof parsed !== 'object') {
      logError('browserstack.yml is empty or invalid.');
      return null;
    }

    // Substitute environment variables
    parsed = substituteEnvironmentVariables(parsed) as Record<string, unknown>;

    // Normalize testReporting -> testObservability
    if (parsed.testReporting !== undefined && parsed.testObservability === undefined) {
      parsed.testObservability = parsed.testReporting;
    }

    // Also check env vars for credentials
    const config = parsed as BrowserStackConfig;
    if (!config.userName && process.env.BROWSERSTACK_USERNAME) {
      config.userName = process.env.BROWSERSTACK_USERNAME;
    }
    if (!config.accessKey && process.env.BROWSERSTACK_ACCESS_KEY) {
      config.accessKey = process.env.BROWSERSTACK_ACCESS_KEY;
    }

    // Validate mandatory fields
    if (!config.userName || !config.accessKey) {
      logError('Missing userName or accessKey in browserstack.yml. Reporter will be disabled.');
      return null;
    }

    return config;
  } catch (e) {
    logError(`Failed to parse browserstack.yml: ${e}`);
    return null;
  }
}

export function getCustomTags(config: BrowserStackConfig): string[] {
  const tags: string[] = [];

  if (config.customTag) {
    tags.push(String(config.customTag));
  }

  if (process.env.CUSTOM_TAG) {
    tags.push(process.env.CUSTOM_TAG);
  }

  // Collect CUSTOM_TAG_1, CUSTOM_TAG_2, etc.
  for (const [key, value] of Object.entries(process.env)) {
    if (/^CUSTOM_TAG_\d+$/.test(key) && value) {
      tags.push(value);
    }
  }

  // Also include buildTag if present
  if (config.buildTag) {
    if (Array.isArray(config.buildTag)) {
      tags.push(...config.buildTag.map(String));
    } else {
      tags.push(String(config.buildTag));
    }
  }

  return tags;
}
