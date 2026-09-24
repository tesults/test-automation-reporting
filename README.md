# Test Automation Reporting for GitHub Actions

Get clear test results directly in your GitHub Actions job summary.

See what passed, what failed, what was flaky, and why, without digging through raw CI logs. The action is free to use and does not require a Tesults account.

## What you get

- Pass, fail, and flaky test counts
- Failures shown first
- Clean error messages
- Clickable source locations
- Retry history
- Test steps
- Standard output and error
- Screenshots, logs, traces, and other captured files
- Failure annotations in GitHub
- A compact view of all test results

## Quick start with Playwright

Playwright is supported today. Support for additional test frameworks is coming soon.

### 1. Install the reporter

```sh
npm install --save-dev playwright-tesults-reporter@^1.6.1
```

### 2. Add it to your Playwright config

Keep any reporters you already use:

```js
// playwright.config.js
module.exports = {
  reporter: [
    ['line'],
    ['playwright-tesults-reporter']
  ]
};
```

### 3. Add the action before your test step

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run Playwright tests
  run: npm run test:e2e
```

That is it. Keep running your tests exactly as you do today.

No Tesults account or token is required.

## Screenshots and other files

Captured files are listed in the report by default without creating persistent GitHub artifact storage.

If you want those files to remain downloadable after the runner is gone, opt in:

```yaml
- uses: tesults/test-automation-reporting@v1
  with:
    store-attachments: true
```

GitHub may charge for artifact storage above your included allowance. Attachment storage is therefore off by default. When enabled, files are retained for 1 day.

## More powerful test reporting

This action is designed to make a single GitHub Actions run easier to understand.

Need consolidated results across systems, test history, regression and flaky analysis, or AI failure intelligence? [Tesults](https://www.tesults.com/?i=ga) provides the enhanced reporting layer.

## License

MIT.
