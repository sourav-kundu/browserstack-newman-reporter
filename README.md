# BrowserStack Newman Reporter

A [Newman](https://github.com/postmanlabs/newman) reporter that automatically sends test results to [BrowserStack Test Reporting & Analytics (TRA)](https://www.browserstack.com/test-reporting). Get real-time visibility into your API test runs with detailed test execution data, HTTP request logs, and console output — all on the BrowserStack dashboard.

## Features

- Automatic test result reporting (pass/fail/skip) with timing data
- HTTP request & response logging for every API call
- Console log capture (`console.log`, `console.warn`, `console.error` from test scripts)
- Hierarchical test organization matching your Postman collection folder structure
- Git metadata, CI environment, and host info sent with each build
- Event batching for efficient reporting (up to 1000 events per batch)
- Zero test code changes required — just add `-r browserstack` to your Newman command
- Supports 25+ CI providers (GitHub Actions, Jenkins, GitLab, CircleCI, etc.)

## Installation

```bash
npm install newman-reporter-browserstack --save-dev
```

## Quick Start

### 1. Create `browserstack.yml` in your project root

```yaml
userName: ${BROWSERSTACK_USERNAME}
accessKey: ${BROWSERSTACK_ACCESS_KEY}
projectName: My API Tests
buildName: API Regression Suite
testObservability: true
```

### 2. Set your BrowserStack credentials

```bash
export BROWSERSTACK_USERNAME=your_username
export BROWSERSTACK_ACCESS_KEY=your_access_key
```

You can find your credentials at [browserstack.com/accounts/settings](https://www.browserstack.com/accounts/settings).

### 3. Run Newman with the BrowserStack reporter

```bash
newman run ./your-collection.json -r browserstack,cli
```

That's it! Your test results will appear on the [BrowserStack Test Reporting dashboard](https://observability.browserstack.com).

## Configuration

### `browserstack.yml` Reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `userName` | Yes | — | BrowserStack username (supports `${ENV_VAR}` substitution) |
| `accessKey` | Yes | — | BrowserStack access key (supports `${ENV_VAR}` substitution) |
| `projectName` | No | `""` | Project name shown on dashboard |
| `buildName` | No | Current directory name | Build name shown on dashboard |
| `buildIdentifier` | No | `""` | Build identifier for versioning |
| `buildDescription` | No | `""` | Build description |
| `testObservability` | No | `true` | Set to `false` to disable reporting |
| `customTag` | No | — | Custom tag for the build |
| `buildTag` | No | — | Array of build tags |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BROWSERSTACK_USERNAME` | BrowserStack username (overrides yml) |
| `BROWSERSTACK_ACCESS_KEY` | BrowserStack access key (overrides yml) |
| `BROWSERSTACK_CONFIG_FILE` | Custom path to browserstack.yml |
| `BROWSERSTACK_NEWMAN_DEBUG` | Set to `true` for debug logging |
| `BROWSERSTACK_ENV` | Environment override (`staging`, `preprod`) |

### Config File Location

The reporter searches for `browserstack.yml` or `browserstack.yaml` in the following order:

1. Path specified in `BROWSERSTACK_CONFIG_FILE` environment variable
2. Current working directory, then parent directories up to the filesystem root

## Usage Examples

### Basic CLI Usage

```bash
# Run with BrowserStack + CLI reporters
newman run ./collection.json -r browserstack,cli

# Run a specific folder
newman run ./collection.json -r browserstack,cli --folder "User API"

# Run with iteration data
newman run ./collection.json -r browserstack,cli -d ./data.json
```

### Programmatic Usage

```javascript
const newman = require('newman');

newman.run({
  collection: require('./collection.json'),
  reporters: ['browserstack', 'cli'],
}, (err) => {
  if (err) throw err;
  console.log('Collection run complete');
});
```

### CI/CD Integration (GitHub Actions)

```yaml
name: API Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - run: npx newman run ./collection.json -r browserstack,cli
        env:
          BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
          BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
```

## What Gets Reported

### Test Results
Every request in your Postman collection is reported as a test with:
- **Status**: passed, failed, or skipped
- **Duration**: execution time in milliseconds
- **Failure details**: assertion error messages and stack traces
- **Hierarchy**: folder structure from your collection maps to test suites

### HTTP Logs
Every HTTP request Newman makes is captured with:
- Request method (GET, POST, PUT, DELETE, etc.)
- Host and path
- Response status code
- Response time in milliseconds

### Console Logs
All `console.log()`, `console.warn()`, `console.error()`, and `console.info()` calls from your test scripts are captured and reported.

### Build Metadata
Each build includes:
- Git info (branch, commit hash, author, remotes)
- CI environment detection (GitHub Actions, Jenkins, GitLab, etc.)
- Host info (OS, platform, architecture)

## Debug Mode

Enable debug logging to see all events being sent:

```bash
BROWSERSTACK_NEWMAN_DEBUG=true newman run ./collection.json -r browserstack,cli
```

This shows:
- Config loading
- Build creation with build ID
- Every event being queued (TestRunStarted, TestRunFinished, LogCreated)
- Batch send confirmations
- Build stop confirmation
- Build report URL

## Requirements

- Node.js >= 14
- Newman >= 5.3.0
- BrowserStack account with Test Reporting enabled

## How It Works

The reporter hooks into Newman's event lifecycle:

```
start          → Creates build on BrowserStack (POST /api/v1/builds)
beforeItem     → Sends TestRunStarted event for each request
request        → Captures HTTP request/response as log event
console        → Captures console output as log event
assertion      → Buffers assertion errors
item           → Sends TestRunFinished event with pass/fail result
beforeDone     → Drains event queue, stops build
```

Events are batched (up to 1000 per batch, flushed every 2 seconds) and sent to BrowserStack's collector endpoint with Bearer JWT authentication.

## License

MIT
