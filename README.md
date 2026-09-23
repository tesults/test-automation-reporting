# Test Automation Reporting for GitHub Actions

Turn your automated test results into a useful GitHub-native report: clear pass/fail summaries, readable failures, source annotations, retries, test steps, logs, screenshots, and attachments.

It is free to use and does **not** require a Tesults account.

## Playwright

### 1. Install the reporter

```sh
npm install --save-dev playwright-tesults-reporter@^1.6.1
```

### 2. Add it to your Playwright reporters

Keep the reporters you already use and add `playwright-tesults-reporter`:

```js
// playwright.config.js
module.exports = {
  reporter: [
    ['line'],
    ['playwright-tesults-reporter']
  ]
};
```

No Tesults target token is required for GitHub reporting.

### 3. Add the action before your test step

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run Playwright tests
  run: npm run test:e2e
```

That's it. Keep your existing test command.

The order matters: the action must run before the tests so it can provide the output path used by the reporter. When the job finishes, the action turns the reporter's Tesults JSON output into the GitHub job summary and source annotations.

## What the report includes

When the data is available from the test framework, the GitHub report can show:

- pass, fail, and other result counts
- concise failure messages with full error details collapsed underneath
- source file and line annotations
- retry history
- nested test steps
- stdout and stderr
- test descriptions and parameters
- screenshots, traces, logs, and other attachments captured by the reporter

Runner-local files disappear when the job ends. If you need to download screenshots, traces, logs, or other files after the run, persist them with GitHub workflow artifacts. The report identifies the captured files without creating links that will go dead when the runner is removed.

## How it works

```text
Playwright
    ↓
playwright-tesults-reporter
    ↓
Tesults JSON Standard
    ↓
tesults/test-automation-reporting
    ↓
GitHub summary + source annotations
```

The action is framework-neutral. Playwright is supported today; other Tesults framework integrations can use the same action as their reporters add local Tesults JSON output.

## Using Tesults as well

The same reporter can create this free GitHub report and upload the same test run to Tesults. You do not need a second reporter configuration.

[Tesults](https://www.tesults.com/?utm_source=github&utm_medium=action&utm_campaign=test-automation-reporting) adds history across runs, automated regression detection, flaky-test analysis, AI failure intelligence, release tracking, notifications, and consolidated test results across your systems.
