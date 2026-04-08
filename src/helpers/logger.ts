const PREFIX = '[BrowserStack Newman]';

function isDebugEnabled(): boolean {
  return process.env.BROWSERSTACK_NEWMAN_DEBUG === 'true' ||
    process.env.BROWSERSTACK_TEST_REPORTING_DEBUG === 'true';
}

export function debug(message: string): void {
  if (isDebugEnabled()) {
    console.log(`${PREFIX} [DEBUG] ${message}`);
  }
}

export function log(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

export function warn(message: string): void {
  console.warn(`${PREFIX} [WARN] ${message}`);
}

export function error(message: string): void {
  console.error(`${PREFIX} [ERROR] ${message}`);
}
