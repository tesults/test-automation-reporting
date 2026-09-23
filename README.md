# Test Automation Reporting for GitHub Actions

Turn your automated test run into a clear, useful GitHub report — without changing the command that runs your tests and without requiring a Tesults account.

The report is designed for the person debugging the run: failures first, clean error messages, source links, retries, steps, stdout/stderr, screenshots and other captured files.

## What you get

- Clear pass/fail/flaky counts
- Failure messages without terminal color-code noise
- Clickable source locations
- Retry history
- Nested test steps
- Standard output and standard error when available — shown inline when short and collapsed when long
- Screenshots, logs, traces, and other test files grouped with readable names and uploaded as a GitHub Actions artifact
- Failure annotations on the relevant source file
- A compact all-tests view

## Playwright

### 1. Install the Tesults Playwright reporter

```sh
npm install --save-dev playwright-tesults-reporter@^1.6.1
```

### 2. Add it to your Playwright config

Keep the reporters you already use:

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

### 3. Add the action before your existing test step

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run Playwright tests
  run: npm run test:e2e
```

That is all. Keep your normal Playwright command.

The order matters: the action runs once before your tests to provide an output location, then its post step automatically creates the report after the tests finish.

## Screenshots and other files

Files captured by the framework reporter — such as screenshots, logs, traces, and text evidence — are collected after the test run and uploaded to GitHub Actions artifacts. The report lists the captured files and links to the artifact.

To keep files on the runner only and disable artifact upload:

```yaml
- uses: tesults/test-automation-reporting@v1
  with:
    upload-attachments: false
```

## How it works

```text
Your test framework
        ↓
Tesults framework reporter
        ↓
Tesults JSON Standard
        ↓
tesults/test-automation-reporting
        ↓
GitHub job summary + annotations + artifacts
```

The action is framework-neutral. Playwright is supported first; other Tesults framework integrations can use the same action as they add local Tesults JSON output.

The data format is the [Tesults JSON Standard](https://www.tesults.com/docs/tesults-json-data-standard), which supports test names and results as well as descriptions, failure reasons, parameters, files, nested steps, timing data, raw results, and custom fields.

## Existing Tesults customers

The same framework reporter can produce this GitHub report and upload the run to Tesults at the same time. You do not need a second reporter instance.

## About Tesults

This action is free and does not require a Tesults account.

[Tesults](https://www.tesults.com/?utm_source=github&utm_medium=action&utm_campaign=test-automation-reporting&utm_content=readme) is for the cross-run and cross-system view: test history, automated regression detection, flaky-test analysis, AI failure intelligence, release tracking, notifications, and consolidated test results across your systems.

## License

MIT. Attachment upload includes the MIT-licensed GitHub `actions/upload-artifact` v7.0.1 runtime; see `vendor/upload-artifact-LICENSE`.
