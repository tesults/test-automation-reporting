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

## Supported frameworks

- Playwright with `playwright-tesults-reporter@^1.6.1`
- Jest with `jest-tesults-reporter@^1.3.0`
- Vitest with `vitest-tesults-reporter@^1.1.0`
- Mocha with `mocha-tesults-reporter@^1.5.0`
- Jasmine with `jasmine-tesults-reporter@^1.2.0`
- WebdriverIO with `wdio-tesults-service@^1.5.0`
- Cypress with `cypress-tesults-reporter@^1.5.0`
- Nightwatch with `nightwatch-tesults@^1.3.0`

## Quick start

### 1. Install the reporter

Choose the reporter for your test framework:

```sh
# Playwright
npm install --save-dev playwright-tesults-reporter@^1.6.1

# Jest
npm install --save-dev jest-tesults-reporter@^1.3.0

# Vitest
npm install --save-dev vitest-tesults-reporter@^1.1.0

# Mocha
npm install --save-dev mocha-tesults-reporter@^1.5.0

# Jasmine
npm install --save-dev jasmine-tesults-reporter@^1.2.0

# WebdriverIO
npm install --save-dev wdio-tesults-service@^1.5.0

# Cypress
npm install --save-dev cypress-tesults-reporter@^1.5.0

# Nightwatch
npm install --save-dev nightwatch-tesults@^1.3.0
```

### 2. Add it to your test configuration

Keep any reporters you already use:

#### Playwright

```js
// playwright.config.js
module.exports = {
  reporter: [
    ['line'],
    ['playwright-tesults-reporter']
  ]
};
```

#### Jest

```js
// jest.config.js
module.exports = {
  testLocationInResults: true,
  reporters: [
    'default',
    ['jest-tesults-reporter', {}]
  ]
};
```

#### Vitest

```js
// vitest.config.js
import { defineConfig } from 'vitest/config';
import TesultsReporter from 'vitest-tesults-reporter';

export default defineConfig({
  test: {
    includeTaskLocation: true,
    reporters: [
      'default',
      new TesultsReporter()
    ]
  }
});
```

#### Mocha

Create `.mocharc.json`:

```json
{
  "reporter": "mocha-tesults-reporter"
}
```

#### Jasmine

Register the reporter in a Jasmine spec helper:

```js
// spec/helpers/tesults.js
const tesultsReporter = require('jasmine-tesults-reporter');

jasmine.getEnv().addReporter(tesultsReporter);
```

#### WebdriverIO

```js
// wdio.conf.js
exports.config = {
  services: [
    ['tesults', {}]
  ]
};
```

#### Cypress

Cypress uses the reporter's module API. Create a runner such as `cypress-run.js`:

```js
const cypress = require('cypress');
const tesults = require('cypress-tesults-reporter');

async function run() {
  const results = await cypress.run();

  if (results.failures) {
    throw new Error(results.message);
  }

  await tesults.results(results, {});
  process.exitCode = results.totalFailed > 0 ? 1 : 0;
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
```

Run this file from your test script, for example with `node cypress-run.js`.

#### Nightwatch

Add the Tesults reporter to your existing Nightwatch command:

```sh
npx nightwatch tests --reporter nightwatch-tesults
```

### 3. Add the action before your test step

```yaml
- name: Set up test automation reporting
  uses: tesults/test-automation-reporting@v1

- name: Run tests
  run: npm test
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
