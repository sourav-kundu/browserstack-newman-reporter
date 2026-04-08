// --- Configuration ---

export interface BrowserStackConfig {
  userName: string;
  accessKey: string;
  projectName?: string;
  buildName?: string;
  buildIdentifier?: string;
  buildDescription?: string;
  testObservability?: boolean;
  testReporting?: boolean;
  customTag?: string;
  buildTag?: string | string[];
  [key: string]: unknown;
}

// --- Host / CI / Git ---

export interface HostInfo {
  hostname: string;
  platform: string;
  type: string;
  version: string;
  arch: string;
}

export interface CiInfo {
  name?: string;
  build_url?: string | null;
  job_name?: string | null;
  build_number?: string | null;
}

export interface GitMetaData {
  name: string;
  sha: string | null;
  short_sha: string | null;
  branch: string | null;
  tag: string | null;
  committer: string | null;
  committer_date: string | null;
  author: string | null;
  author_date: string | null;
  commit_message: string | null;
  root: string | null;
  common_git_dir: string | null;
  worktree_git_dir: string | null;
  last_tag: string | null;
  commits_since_last_tag: string | null;
  remotes: Array<{ name: string; url: string }>;
}

// --- Build Lifecycle ---

export interface BuildStartPayload {
  format: 'json';
  project_name: string;
  name: string;
  build_identifier: string;
  description: string;
  started_at: string;
  tags: string[];
  host_info: HostInfo;
  ci_info: CiInfo;
  build_run_identifier: string | undefined;
  failed_tests_rerun: string | boolean;
  version_control: GitMetaData | Record<string, never>;
  observability_version: {
    frameworkName: string;
    frameworkVersion: string;
    sdkVersion: string;
  };
  product_map: {
    observability: boolean;
    automate: boolean;
    app_automate: boolean;
    accessibility: boolean;
    percy: boolean;
  };
}

export interface BuildStartResponse {
  build_hashed_id: string;
  jwt: string;
  allow_screenshots: boolean;
}

export interface BuildStopPayload {
  finished_at: string;
}

// --- Test Events ---

export interface TestRun {
  uuid: string;
  name: string;
  framework: 'newman';
  identifier: string;
  scopes: string[];
  location: string;
  file_name: string;
  vc_filepath: string;
  started_at: string;
  finished_at: string | null;
  duration_in_ms: number | null;
  result: 'pending' | 'passed' | 'failed' | 'skipped';
  failure_reason?: string | null;
  failure_type?: string | null;
  failure?: FailureEntry[] | null;
}

export interface FailureEntry {
  backtrace: string[];
  expanded: string[];
}

export interface TestRunEvent {
  event_type: 'TestRunStarted' | 'TestRunFinished';
  test_run: TestRun;
}

// --- Log Events ---

export interface HttpResponseLog {
  host: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  status_code: number;
  duration_ms: number;
}

export interface LogEntry {
  test_run_uuid: string;
  timestamp: string;
  level: string | null;
  message: string | null;
  kind: 'TEST_LOG' | 'HTTP';
  http_response: HttpResponseLog | Record<string, never>;
}

export interface LogCreatedEvent {
  event_type: 'LogCreated';
  logs: LogEntry[];
}

// --- Union type for all collector events ---

export type CollectorEvent = TestRunEvent | LogCreatedEvent;

// --- Internal state ---

export interface PendingTest {
  uuid: string;
  name: string;
  scopes: string[];
  identifier: string;
  location: string;
  startedAt: string;
  startTimestamp: number;
  errors: TestAssertionError[];
}

export interface TestAssertionError {
  message: string;
  stack?: string;
  name?: string;
}
