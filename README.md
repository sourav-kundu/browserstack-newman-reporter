# BrowserStack Newman Reporter

[![npm version](https://img.shields.io/npm/v/@beeingsourav/newman-reporter-browserstack)](https://www.npmjs.com/package/@beeingsourav/newman-reporter-browserstack)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

A [Newman](https://github.com/postmanlabs/newman) reporter that automatically sends test results to [BrowserStack Test Reporting & Analytics (TRA)](https://www.browserstack.com/test-reporting). Get real-time visibility into your API test runs with detailed test execution data, HTTP request logs, and console output — all on the BrowserStack dashboard.

## Features

- Automatic test result reporting (pass/fail/skip) with timing data
- HTTP request & response logging for every API call
- Console log capture (`console.log`, `console.warn`, `console.error` from test scripts)
- Hierarchical test organization matching your Postman collection folder structure
- Git metadata, CI environment, and host info sent with each build
- Event batching for efficient reporting (up to 1000 events per batch)
- Zero test code changes required — just add the reporter to your Newman command
- Supports 25+ CI providers (GitHub Actions, Jenkins, GitLab, CircleCI, etc.)

## Prerequisites

- **Node.js** >= 14
- **Newman** >= 5.3.0
- A **BrowserStack account** with Test Reporting enabled. [Sign up for free](https://www.browserstack.com/users/sign_up).
- Your BrowserStack **username** and **access key**, available at [browserstack.com/accounts/settings](https://www.browserstack.com/accounts/settings).

## Installation

```bash
npm install @beeingsourav/newman-reporter-browserstack --save-dev
```

You also need Newman installed:

```bash
npm install newman --save-dev
```

## Quick Start

Follow these 3 steps to get test reporting working:

### Step 1: Create `browserstack.yml`

Create a file named `browserstack.yml` in your project root:

```yaml
userName: ${BROWSERSTACK_USERNAME}
accessKey: ${BROWSERSTACK_ACCESS_KEY}
projectName: My API Tests
buildName: API Regression Suite
testObservability: true
```

> The `${...}` syntax references environment variables, so your credentials are never hardcoded.

### Step 2: Set your BrowserStack credentials

**macOS / Linux:**
```bash
export BROWSERSTACK_USERNAME=your_username
export BROWSERSTACK_ACCESS_KEY=your_access_key
```

**Windows (PowerShell):**
```powershell
$env:BROWSERSTACK_USERNAME = "your_username"
$env:BROWSERSTACK_ACCESS_KEY = "your_access_key"
```

**Windows (cmd):**
```cmd
set BROWSERSTACK_USERNAME=your_username
set BROWSERSTACK_ACCESS_KEY=your_access_key
```

### Step 3: Run Newman with the BrowserStack reporter

```bash
npx newman run ./your-collection.json -r @beeingsourav/newman-reporter-browserstack,cli
```

That's it! Once the run completes, you'll see a link in the console:

```
[BrowserStack Newman] Build report: https://observability.browserstack.com/builds/<build-id>
```

Open that URL to view your test results on the BrowserStack dashboard.

## Complete Example

Here's a full end-to-end example starting from scratch:

```bash
# 1. Create a new project
mkdir my-api-tests && cd my-api-tests
npm init -y

# 2. Install dependencies
npm install newman @beeingsourav/newman-reporter-browserstack --save-dev

# 3. Create browserstack.yml
cat > browserstack.yml << 'EOF'
userName: ${BROWSERSTACK_USERNAME}
accessKey: ${BROWSERSTACK_ACCESS_KEY}
projectName: My API Tests
buildName: API Regression Suite
testObservability: true
EOF

# 4. Set credentials
export BROWSERSTACK_USERNAME=your_username
export BROWSERSTACK_ACCESS_KEY=your_access_key

# 5. Run your Postman collection
npx newman run ./your-collection.json -r @beeingsourav/newman-reporter-browserstack,cli
```

For a working sample project, see [newman-sample-api-tests](https://github.com/sourav-kundu/newman-sample-api-tests).

## Configuration

### `browserstack.yml` Reference

| Field | Required | Default | Description |
|-------|----------|---------|-------------|
| `userName` | Yes | — | BrowserStack username (supports `${ENV_VAR}` substitution) |
| `accessKey` | Yes | — | BrowserStack access key (supports `${ENV_VAR}` substitution) |
| `projectName` | No | `""` | Project name shown on the TRA dashboard |
| `buildName` | No | Current directory name | Build name shown on the TRA dashboard |
| `buildIdentifier` | No | `""` | Build identifier for versioning (e.g., `#${BUILD_NUMBER}`) |
| `buildDescription` | No | `""` | Build description |
| `testObservability` | No | `true` | Set to `false` to disable reporting |
| `customTag` | No | — | Custom tag for the build |
| `buildTag` | No | — | Array of build tags |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BROWSERSTACK_USERNAME` | BrowserStack username (overrides yml) |
| `BROWSERSTACK_ACCESS_KEY` | BrowserStack access key (overrides yml) |
| `BROWSERSTACK_CONFIG_FILE` | Custom path to `browserstack.yml` |
| `BROWSERSTACK_NEWMAN_DEBUG` | Set to `true` for verbose debug logging |
| `BROWSERSTACK_ENV` | Environment override (`staging`, `preprod`) |

### Config File Discovery

The reporter searches for `browserstack.yml` (or `browserstack.yaml`) in this order:

1. Path specified in `BROWSERSTACK_CONFIG_FILE` environment variable
2. Current working directory, then each parent directory up to the filesystem root

## Usage

### CLI Usage

```bash
# Run with BrowserStack + CLI reporters
npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli

# Run a specific folder from the collection
npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli --folder "User API"

# Run with iteration data file
npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli -d ./data.json

# Run with environment variables file
npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli -e ./environment.json
```

### Programmatic Usage

```javascript
const newman = require('newman');

newman.run({
  collection: require('./collection.json'),
  reporters: ['@beeingsourav/newman-reporter-browserstack', 'cli'],
}, (err) => {
  if (err) throw err;
  console.log('Collection run complete');
});
```

### npm Scripts

Add a test script to your `package.json`:

```json
{
  "scripts": {
    "test": "newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli"
  },
  "devDependencies": {
    "newman": "^6.0.0",
    "@beeingsourav/newman-reporter-browserstack": "^1.0.0"
  }
}
```

Then run:

```bash
npm test
```

## CI/CD Integration

### GitHub Actions

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
      - run: npm test
        env:
          BROWSERSTACK_USERNAME: ${{ secrets.BROWSERSTACK_USERNAME }}
          BROWSERSTACK_ACCESS_KEY: ${{ secrets.BROWSERSTACK_ACCESS_KEY }}
```

### Jenkins

```groovy
pipeline {
    agent any
    environment {
        BROWSERSTACK_USERNAME = credentials('browserstack-username')
        BROWSERSTACK_ACCESS_KEY = credentials('browserstack-access-key')
    }
    stages {
        stage('Test') {
            steps {
                sh 'npm install'
                sh 'npm test'
            }
        }
    }
}
```

### GitLab CI

```yaml
api-tests:
  image: node:20
  script:
    - npm install
    - npm test
  variables:
    BROWSERSTACK_USERNAME: $BROWSERSTACK_USERNAME
    BROWSERSTACK_ACCESS_KEY: $BROWSERSTACK_ACCESS_KEY
```

### CircleCI

```yaml
version: 2.1
jobs:
  test:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run: npm install
      - run:
          command: npm test
          environment:
            BROWSERSTACK_USERNAME: ${BROWSERSTACK_USERNAME}
            BROWSERSTACK_ACCESS_KEY: ${BROWSERSTACK_ACCESS_KEY}
```

## What Gets Reported

### Test Results
Every request in your Postman collection is reported as a test with:
- **Status**: passed, failed, or skipped
- **Duration**: execution time in milliseconds
- **Failure details**: assertion error messages and stack traces
- **Hierarchy**: folder structure from your collection maps to test suites on the dashboard

### HTTP Logs
Every HTTP request Newman makes is captured with:
- Request method (GET, POST, PUT, DELETE, etc.)
- Host and path
- Response status code
- Response time in milliseconds

### Console Logs
All `console.log()`, `console.warn()`, `console.error()`, and `console.info()` calls from your Postman test scripts are captured and shown in the test detail view.

### Build Metadata
Each build automatically includes:
- **Git info**: branch, commit hash, author, commit message, remotes
- **CI environment**: auto-detected from 25+ CI providers
- **Host info**: OS, platform, architecture

## Debug Mode

Enable debug logging to see all events being sent to BrowserStack:

```bash
BROWSERSTACK_NEWMAN_DEBUG=true npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli
```

Debug output includes:
- Config file loading path
- Build creation with build hashed ID
- Every event being queued (TestRunStarted, TestRunFinished, LogCreated)
- Batch send confirmations with event counts
- Build stop confirmation
- Build report URL

Example debug output:
```
[BrowserStack Newman] [DEBUG] Loading config from /path/to/browserstack.yml
[BrowserStack Newman] [DEBUG] Starting build at https://collector-observability.browserstack.com/api/v1/builds
[BrowserStack Newman] [DEBUG] Build created: abc123def456
[BrowserStack Newman] Build started: https://observability.browserstack.com/builds/abc123def456
[BrowserStack Newman] [DEBUG] [HTTP LOG] {"event_type":"LogCreated","logs":[...]}
[BrowserStack Newman] [DEBUG] [TEST_LOG] {"event_type":"LogCreated","logs":[...]}
[BrowserStack Newman] [DEBUG] Sending batch of 20 events
[BrowserStack Newman] [DEBUG] Batch of 20 events sent successfully
[BrowserStack Newman] [DEBUG] Stopping build abc123def456
[BrowserStack Newman] [DEBUG] Build stopped successfully
[BrowserStack Newman] Build report: https://observability.browserstack.com/builds/abc123def456
```

## How It Works

The reporter hooks into Newman's event lifecycle:

```
Newman Event    Action                                          BrowserStack API
─────────────── ─────────────────────────────────────────────── ──────────────────────────
start           Load config, gather git/CI/host metadata        POST /api/v1/builds
beforeItem      Generate test UUID, record start time           → TestRunStarted event
request         Capture HTTP method, URL, status, duration      → LogCreated (HTTP) event
console         Capture console.log/warn/error output           → LogCreated (TEST_LOG) event
assertion       Buffer assertion errors (no API call)           —
item            Calculate duration, determine pass/fail         → TestRunFinished event
beforeDone      Drain event queue                               POST /api/v1/batch
                Stop build                                      PUT /api/v1/builds/<id>/stop
```

Events are batched (up to 1000 per batch, flushed every 2 seconds) for efficient network usage.

## Troubleshooting

### Reporter not loading

Ensure the package is installed and the full scoped name is used:
```bash
npx newman run ./collection.json -r @beeingsourav/newman-reporter-browserstack,cli
```

### "Missing userName or accessKey" error

Check that:
1. `browserstack.yml` exists in your project root (or a parent directory)
2. Environment variables `BROWSERSTACK_USERNAME` and `BROWSERSTACK_ACCESS_KEY` are set
3. The yml file uses `${BROWSERSTACK_USERNAME}` syntax (not the literal values)

### "browserstack.yml not found" warning

The reporter searches from the current working directory upward. Make sure you're running Newman from the correct directory, or set `BROWSERSTACK_CONFIG_FILE` to the absolute path.

### No test results appearing on dashboard

1. Enable debug mode: `BROWSERSTACK_NEWMAN_DEBUG=true`
2. Check that you see "Build created" and "Batch sent successfully" in the output
3. Verify the build report URL is printed at the end
4. Ensure `testObservability: true` is set in your `browserstack.yml`

### Newman exits before events are sent

If you're using Newman < 5.3.2, the reporter includes a compatibility fix for premature exit. Upgrade to Newman >= 5.3.2 for best results:
```bash
npm install newman@latest --save-dev
```

## Sample Project

See [newman-sample-api-tests](https://github.com/sourav-kundu/newman-sample-api-tests) for a complete working example with 100+ tests covering:
- CRUD operations across multiple API resources
- Schema validation
- Error handling (4xx, 5xx status codes)
- Performance testing
- Console logging
- Nested folder hierarchies

## Contributing

1. Clone the repository
2. Install dependencies: `npm install`
3. Build: `npm run build`
4. Link locally for testing: `npm link`

## License

MIT
