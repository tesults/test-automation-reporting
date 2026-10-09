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

Choose your framework below. Some frameworks use the Tesults integration for
their underlying test runner; they are fully supported by the action in the
same way as frameworks with a dedicated reporter.

| Framework | Integration and minimum version | Setup |
| --- | --- | --- |
| cargo-nextest | `tesults-test` 1.1.0 or later | [Instructions](#cargo-nextest) |
| colcon (ROS 2 workspace) | `colcon-tesults>=1.1.0` | [Instructions](#colcon) |
| CodeceptJS | `codeceptjs-tesults@^1.3.0` | [Instructions](#codeceptjs) |
| Cypress | `cypress-tesults-reporter@^1.5.0` (recommended) or `mocha-tesults-reporter@^1.5.0` | [Instructions](#cypress) |
| EXP | `exp-tf@^1.2.0` | [Instructions](#exp) |
| GoogleTest | `tesults-gtest` v1.0.3 or later with `tesults/cpp` v1.0.3 or later | [Instructions](#googletest) |
| Jasmine | `jasmine-tesults-reporter@^1.2.0` | [Instructions](#jasmine) |
| Jest | `jest-tesults-reporter@^1.3.0` | [Instructions](#jest) |
| JUnit 4 | JUnit Vintage with `com.tesults.junit5:tesults-junit5:1.3.0` or later | [Instructions](#junit-4) |
| JUnit 5 | `com.tesults.junit5:tesults-junit5:1.3.0` or later | [Instructions](#junit-5) |
| Mocha | `mocha-tesults-reporter@^1.5.0` | [Instructions](#mocha) |
| Nightwatch | `nightwatch-tesults@^1.3.0` | [Instructions](#nightwatch) |
| Playwright (Node.js) | `playwright-tesults-reporter@^1.6.1` | [Instructions](#playwright) |
| Playwright (Python) | `pytest-playwright` with `pytest-tesults>=1.9.0` | [Instructions](#playwright-for-python) |
| Playwright (Java) | JUnit 5 with `com.tesults.junit5:tesults-junit5:1.3.0` or later | [Instructions](#playwright-for-java) |
| Postman/Newman | `newman-reporter-tesults@^1.2.1` | [Instructions](#postmannewman) |
| Protractor | `mocha-tesults-reporter@^1.5.0` or `jasmine-tesults-reporter@^1.2.0` | [Instructions](#protractor) |
| pytest | `pytest-tesults>=1.9.0` | [Instructions](#pytest) |
| Robot Framework | `robot-tesults>=1.3.0` | [Instructions](#robot-framework) |
| ROS 2 C++ (GoogleTest) | `tesults-gtest` v1.0.3 or later with `tesults/cpp` v1.0.3 or later | [Instructions](#ros-2-cpp-googletest) |
| ROS 2 Python and `launch_testing` | `pytest-tesults>=1.9.0` | [Instructions](#ros-2-python-and-launch_testing) |
| ROS 2 Rust | `tesults-test` 1.1.0 or later | [Instructions](#ros-2-rust) |
| RSpec | `rspec_tesults_formatter` 1.2.0 or later | [Instructions](#rspec) |
| rstest | `rstest` with `tesults-test` 1.1.0 or later | [Instructions](#rstest) |
| Rust (`#[test]`) | `tesults-test` 1.1.0 or later | [Instructions](#rust) |
| Selenium | The supported test runner or framework used by the project | [Instructions](#selenium) |
| TestCafe | `testcafe-reporter-tesults@^1.3.0` | [Instructions](#testcafe) |
| TestNG | `com.tesults.testng:tesults-testng:1.3.0` or later | [Instructions](#testng) |
| Vitest | `vitest-tesults-reporter@^1.1.0` | [Instructions](#vitest) |
| Waffle | `mocha-tesults-reporter@^1.5.0` | [Instructions](#waffle) |
| WebdriverIO | `wdio-tesults-service@^1.5.0` | [Instructions](#webdriverio) |
| XCTest / XCUITest | `tesults-xctest-observer` 1.0.7 or later | [Instructions](#xctest-and-xcuitest) |

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

# colcon / ROS 2 workspace
python -m pip install "colcon-tesults>=1.1.0"

# pytest
python -m pip install "pytest-tesults>=1.9.0"

# Robot Framework
python -m pip install "robot-tesults>=1.3.0"

# RSpec
gem install rspec_tesults_formatter -v ">= 1.2.0"

# Rust, cargo-nextest, rstest, and ROS 2 Rust
cargo add --dev tesults-test@1.1.0
```

For XCTest and XCUITest, add the Swift package
`https://github.com/tesults/tesults-xctest-observer` to the test target in
Xcode and select version 1.0.7 or later.

For GoogleTest and ROS 2 C++ packages, add the C++ library and GoogleTest
listener with CMake FetchContent. Define the GoogleTest target first, then add:

```cmake
include(FetchContent)

FetchContent_Declare(
    tesults
    GIT_REPOSITORY https://github.com/tesults/cpp.git
    GIT_TAG        v1.0.3
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(tesults)

FetchContent_Declare(
    tesults_gtest
    GIT_REPOSITORY https://github.com/tesults/tesults-gtest.git
    GIT_TAG        v1.0.3
    GIT_SHALLOW    TRUE
)
FetchContent_MakeAvailable(tesults_gtest)

target_link_libraries(your_tests PRIVATE
    tesults::tesults
    tesults_gtest::tesults_gtest
)
```

The underlying C++ library requires libcurl and OpenSSL.

For JUnit 5 with Gradle, add the published listener to the test dependencies:

```groovy
dependencies {
    testImplementation 'com.tesults.junit5:tesults-junit5:1.3.0'
}
```

For Maven:

```xml
<dependency>
  <groupId>com.tesults.junit5</groupId>
  <artifactId>tesults-junit5</artifactId>
  <version>1.3.0</version>
  <scope>test</scope>
</dependency>
```

For TestNG with Gradle, add the published listener to the test dependencies:

```groovy
dependencies {
    testImplementation 'com.tesults.testng:tesults-testng:1.3.0'
}
```

For Maven:

```xml
<dependency>
  <groupId>com.tesults.testng</groupId>
  <artifactId>tesults-testng</artifactId>
  <version>1.3.0</version>
  <scope>test</scope>
</dependency>
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

#### colcon

For basic pass/fail reporting across a mixed ROS 2 workspace, install
`colcon-tesults` and run the workspace tests normally. No Tesults target token
or additional configuration is required:

```sh
colcon test
```

The extension collects the JUnit XML produced by packages in the workspace and
writes one report for the action. For richer framework-specific details, use
`tesults-gtest` for C++ packages or `pytest-tesults` for Python packages as
described below.

Configure either `colcon-tesults` or the framework-specific reporters for a
given action-enabled test job, not both. They otherwise write to the same
action-provided output file. See the
[Tesults colcon documentation](https://www.tesults.com/docs/colcon) for
additional setup options.

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

#### RSpec

Run RSpec with the Tesults formatter loaded; no Tesults target token is
required:

```sh
rspec --require rspec_tesults_formatter --format TesultsFormatter spec
```

If the formatter is already loaded from `.rspec`, keep your existing command
and configuration. The action sets `TESULTS_OUTPUT_FILE` automatically.

#### Rust

Replace Rust's built-in `#[test]` attribute with `#[tesults_test::test]` on
each test you want reported:

```rust
#[tesults_test::test]
fn it_adds() {
    assert_eq!(2 + 2, 4);
}
```

Run the tests normally. No Tesults target token is required:

```sh
cargo test
```

#### cargo-nextest

Use the same `#[tesults_test::test]` attribute shown above, then run the
existing nextest suite normally:

```sh
cargo nextest run
```

`tesults-test` merges the reports produced by nextest's parallel test
processes into the action-provided output file.

#### rstest

Keep `#[rstest]` first and place `#[tesults_test::test]` after the rstest case
attributes, immediately above the function:

```rust
use rstest::rstest;

#[rstest]
#[case(1, 2, 3)]
#[case(4, 5, 9)]
#[tesults_test::test]
fn it_adds(#[case] left: i32, #[case] right: i32, #[case] expected: i32) {
    assert_eq!(left + right, expected);
}
```

Run the suite with `cargo test` or `cargo nextest run`. Each generated rstest
case is included in the Action report.

#### GoogleTest

The listener registers itself automatically when the action supplies
`TESULTS_OUTPUT_FILE`; no target token or custom `main()` is required. Link the
test executable as shown above and run it normally, directly or through CTest:

```sh
cmake --build build
ctest --test-dir build --output-on-failure
```

Multiple GoogleTest executables can use the same action-provided output file;
their cases are merged safely. Keep any existing `TESULTS_TARGET` setting if
you also want to upload the run directly to Tesults.

#### JUnit 5

Enable JUnit Platform and automatic listener detection. No Tesults target token
is required:

```groovy
test {
    useJUnitPlatform()
    systemProperty 'junit.jupiter.extensions.autodetection.enabled', 'true'
}
```

For Maven Surefire, set the same
`junit.jupiter.extensions.autodetection.enabled=true` configuration parameter.
Keep any existing Tesults options; if `tesultsTarget` is also configured, the
listener writes the GitHub report and continues uploading the run to Tesults.

#### TestNG

The listener registers itself automatically. No Tesults target token is
required. For Gradle, keep your existing TestNG version and enable TestNG as
usual:

```groovy
test {
    useTestNG()
}
```

For Maven Surefire, run the existing TestNG suite normally with `mvn test`; no
additional listener configuration is required. Keep any existing Tesults
options. If `tesultsTarget` is also configured, the listener writes the GitHub
report and continues uploading results to Tesults using the existing behavior.
See the [Tesults TestNG documentation](https://www.tesults.com/docs/testng) for
the complete TestNG configuration options.

#### JUnit 4

Run existing JUnit 4 tests through JUnit Vintage, then use the JUnit 5 listener
configuration above. For the versions in the Tesults JUnit 4 documentation:

```groovy
dependencies {
    testImplementation 'junit:junit:4.13'
    testRuntimeOnly 'org.junit.vintage:junit-vintage-engine:5.6.2'
    testImplementation 'com.tesults.junit5:tesults-junit5:1.3.0'
}
```

JUnit 4 test classes should be in a package so Vintage supplies useful suite
names. See the [Tesults JUnit 4 documentation](https://www.tesults.com/docs/junit4)
for the migration route and additional configuration.

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

#### Playwright for Java

Playwright's Java integration uses JUnit 5. Add the Tesults JUnit 5 dependency
shown above, enable JUnit Platform and automatic listener detection, and run the
existing Playwright tests normally. No Tesults target token is required:

```groovy
test {
    useJUnitPlatform()
    systemProperty 'junit.jupiter.extensions.autodetection.enabled', 'true'
}
```

For Maven Surefire, use the JUnit 5 dependency and configuration parameter
shown above, then run `mvn test`. The action supplies `TESULTS_OUTPUT_FILE` to
the JUnit 5 listener automatically. See the
[Tesults Playwright documentation](https://www.tesults.com/docs/playwright) for
the framework-specific setup.

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

#### ROS 2 C++ (GoogleTest)

ROS 2 C++ tests created with `ament_add_gtest()` use GoogleTest's supplied
`main()`, so the listener's automatic environment registration is the right
integration path. Add the two FetchContent declarations shown above, then link
the generated test target:

```cmake
ament_add_gtest(your_tests test/your_tests.cpp)
target_link_libraries(your_tests PRIVATE
    tesults::tesults
    tesults_gtest::tesults_gtest
)
```

Run the package tests normally after the action step:

```sh
colcon test --packages-select your_cpp_package
```

No Tesults target token is required. The action-provided output file also
merges results from multiple GoogleTest executables in the package. See the
[Tesults ROS 2 documentation](https://www.tesults.com/docs/ros2) for additional
ROS 2 setup details.

#### ROS 2 Rust

Rust packages in ROS 2 use the same `tesults-test` integration. Add the crate
and replace `#[test]` with `#[tesults_test::test]` as shown in the Rust section,
then run the package's existing Cargo or colcon test command. For example:

```sh
colcon test --packages-select your_rust_package
```

Use either `tesults-test` for rich Rust results or `colcon-tesults` for basic
workspace-wide JUnit reporting in a given action-enabled job, not both. See the
[Tesults ROS 2 documentation](https://www.tesults.com/docs/ros2) for additional
ROS 2 setup details.

#### XCTest and XCUITest

Add `tesults-xctest-observer` 1.0.7 or later to the XCTest or XCUITest target
using Swift Package Manager, then register the observer when the tests start:

```swift
import XCTest
import tesults_xctest_observer

XCTestObservationCenter.shared.addTestObserver(TesultsXCTestObserver())
```

If the project already registers the observer through its test target's
`NSPrincipalClass`, keep that startup setup and omit the target token as shown
above. Run the suite normally with Xcode or `xcodebuild test`; the action
supplies `TESULTS_OUTPUT_FILE` automatically.

To keep uploading the same run directly to Tesults as well, retain the
existing `target` argument. Version 1.0.7 writes the action report and
continues the existing upload in the same test run. See the
[Tesults XCTest documentation](https://www.tesults.com/docs/xctest) for test
startup configuration and attachment APIs.

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
