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

### Direct integrations

- EXP with `exp-tf@^1.2.0`
- Playwright with `playwright-tesults-reporter@^1.6.1`
- Jest with `jest-tesults-reporter@^1.3.0`
- Vitest with `vitest-tesults-reporter@^1.1.0`
- Mocha with `mocha-tesults-reporter@^1.5.0`
- Jasmine with `jasmine-tesults-reporter@^1.2.0`
- WebdriverIO with `wdio-tesults-service@^1.5.0`
- Cypress with `cypress-tesults-reporter@^1.5.0`
- TestCafe with `testcafe-reporter-tesults@^1.3.0`
- Nightwatch with `nightwatch-tesults@^1.3.0`
- CodeceptJS with `codeceptjs-tesults@^1.3.0`
- Postman/Newman with `newman-reporter-tesults@^1.2.1`
- pytest with `pytest-tesults>=1.9.0`
- Robot Framework with `robot-tesults>=1.3.0`

### Supported through existing integrations

- Waffle through `mocha-tesults-reporter@^1.5.0`
- Protractor through `mocha-tesults-reporter@^1.5.0` or `jasmine-tesults-reporter@^1.2.0`
- Selenium through the supported test runner or framework used by the project
- Cypress through `mocha-tesults-reporter@^1.5.0` as an alternative to the recommended Cypress integration
- Playwright for Python through its official pytest plugin and `pytest-tesults>=1.9.0`
- ROS 2 Python package tests and `launch_testing` through `pytest-tesults>=1.9.0` when run with pytest

## Quick start

### 1. Install the reporter

Choose the reporter for your test framework:

```sh
# EXP
npm install --save-dev exp-tf@^1.2.0

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

# TestCafe
npm install --save-dev testcafe-reporter-tesults@^1.3.0

# Nightwatch
npm install --save-dev nightwatch-tesults@^1.3.0

# CodeceptJS
npm install --save-dev codeceptjs-tesults@^1.3.0

# Postman/Newman
npm install --save-dev newman-reporter-tesults@^1.2.1

# pytest
python -m pip install "pytest-tesults>=1.9.0"

# Robot Framework
python -m pip install "robot-tesults>=1.3.0"
```

### 2. Add it to your test configuration

Keep any reporters you already use:

#### EXP

Run EXP with the absolute path to your tests:

```sh
npx exp dir=/full/path/to/tests
```

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

#### Waffle

Waffle tests use Mocha. Install the Mocha reporter shown above and add it to your existing Waffle test command:

```sh
NODE_ENV=test npx mocha --reporter mocha-tesults-reporter
```

See the [Tesults Waffle documentation](https://www.tesults.com/docs/waffle) for additional Waffle configuration.

#### Protractor

Protractor can use either the Mocha or Jasmine integration.

For Mocha, install the Mocha reporter shown above and reference it from `mochaOpts`:

```js
// conf.js
const tesultsReporter = require('mocha-tesults-reporter');

exports.config = {
  framework: 'mocha',
  mochaOpts: {
    reporter: tesultsReporter
  }
};
```

For Jasmine, install the Jasmine reporter shown above and register it during preparation:

```js
// conf.js
exports.config = {
  framework: 'jasmine',
  onPrepare: function () {
    const tesultsReporter = require('jasmine-tesults-reporter');
    jasmine.getEnv().addReporter(tesultsReporter);
  }
};
```

Keep the rest of your existing Protractor configuration. See the [Tesults Protractor documentation](https://www.tesults.com/docs/protractor) for framework-specific options.

#### Selenium

Selenium does not require a separate Tesults reporter. Configure the supported runner or test framework that executes your Selenium tests—for example WebdriverIO, Nightwatch, CodeceptJS, Mocha, Jasmine, or Jest—using its instructions above.

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

Projects already using Cypress through Mocha can use `mocha-tesults-reporter` instead. The dedicated Cypress integration is recommended for Cypress-specific results and captured files.

#### TestCafe

Add the Tesults reporter to your existing TestCafe command:

```sh
npx testcafe chrome:headless 'path/to/test/file.js' --reporter tesults
```

#### Nightwatch

Add the Tesults reporter to your existing Nightwatch command:

```sh
npx nightwatch tests --reporter nightwatch-tesults
```

#### CodeceptJS

Enable the Tesults plugin without a target token:

```js
// codecept.conf.js
exports.config = {
  plugins: {
    tesults: {
      require: 'codeceptjs-tesults',
      enabled: true
    }
  }
};
```

#### Postman/Newman

Run the collection with the Tesults Newman reporter:

```sh
npx newman run your_collection.json -r tesults
```

#### pytest

The pytest plugin registers itself when installed. Run pytest normally; no
Tesults target token is required:

```sh
python -m pytest
```

Parallel runs with `pytest-xdist` are also supported:

```sh
python -m pip install pytest-xdist
python -m pytest -n 2
```

#### Robot Framework

Load the Tesults listener when running Robot Framework; no Tesults target token
is required:

```sh
python -m robot --listener TesultsListener tests
```

Keep any existing listener arguments. For example, captured files can continue
to use the reporter's `files` option:

```sh
python -m robot --listener TesultsListener:files=path/to/files tests
```

On Windows, use Robot Framework's `;` listener-argument separator when a value
contains a drive-letter path.

#### Playwright for Python

Playwright's official Python plugin uses pytest, so install the pytest Tesults
plugin alongside it:

```sh
python -m pip install pytest-playwright "pytest-tesults>=1.9.0"
python -m playwright install
python -m pytest
```

See the [Tesults Playwright documentation](https://www.tesults.com/docs/playwright)
for the framework-specific setup.

#### ROS 2 Python and launch_testing

ROS 2 Python package tests and `launch_testing` use pytest. Install the pytest
plugin in the ROS 2 environment and select pytest when running the package:

```sh
python -m pip install "pytest-tesults>=1.9.0"
colcon test --packages-select your_python_package --python-testing pytest
```

For workspaces containing multiple independently tested packages, use a
separate action-enabled job for each package-scoped test invocation so each job
produces its own report. See the [Tesults ROS 2 documentation](https://www.tesults.com/docs/ros2)
for additional ROS 2 setup details.

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
