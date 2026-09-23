# Test Automation Reporting for GitHub Actions

Free GitHub-native test automation reporting powered by the Tesults JSON Standard.

The action does **not** run your tests and does not require a Tesults account. Your framework's Tesults reporter collects the test results, and this action publishes those results in GitHub.

## Playwright

### 1. Install the Tesults reporter

```sh
npm install --save-dev playwright-tesults-reporter
```

### 2. Add the reporter to Playwright

Keep any reporters you already use and add `playwright-tesults-reporter`:

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

**The order matters:** put the Tesults action before the step that runs the tests. You do not need to change your existing test command.

The action supplies `TESULTS_OUTPUT_FILE` to the reporter. After the tests finish, the action reads the standard Tesults JSON output and publishes the result to the GitHub job summary with failure annotations.

## How it works

```text
Playwright
    |
    v
playwright-tesults-reporter
    |
    v
Tesults JSON Standard
    |
    v
tesults/test-automation-reporting
    |
    v
GitHub summary and annotations
```

The action itself is framework-neutral. Jest, Vitest, and other Tesults integrations can use the same action once their reporters support local Tesults JSON output.

## Existing Tesults customers

The same reporter can write the local results file for this action and upload to Tesults in the same test run. There is no need to configure a second reporter instance.

## Current status

The initial release supports Playwright. More Tesults framework integrations are planned.

## Tesults

[Tesults](https://www.tesults.com) provides persistent test history, trends, flaky test detection, failure analysis, release tracking, notifications, and team-wide test reporting.
