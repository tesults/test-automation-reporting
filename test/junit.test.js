const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  androidJUnitData,
  configuredJUnitData,
  findAndroidJUnitFiles,
  findConfiguredJUnitFiles,
  parseJUnitXml
} = require('../src/junit');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="com.example.CheckoutTest" tests="4" failures="1" errors="1" skipped="1" time="1.26">
  <testcase name="opens checkout" classname="com.example.CheckoutTest" time="0.125" />
  <testcase name="shows decline" classname="com.example.CheckoutTest" time="0.5">
    <failure message="Expected &lt;approved&gt; but was &quot;declined&quot;"><![CDATA[java.lang.AssertionError: decline
 at com.example.CheckoutTest.showsDecline(CheckoutTest.java:42)]]></failure>
    <system-out><![CDATA[opening checkout
submitting payment]]></system-out>
    <system-err>gateway &amp; card error</system-err>
  </testcase>
  <testcase name="crashes" classname="com.example.CheckoutTest" time="0.625">
    <error message="Process crashed" />
  </testcase>
  <testcase name="requires camera" classname="com.example.CheckoutTest" time="0">
    <skipped message="Camera unavailable" />
  </testcase>
</testsuite>`;

const cases = parseJUnitXml(xml);
assert.strictEqual(cases.length, 4);
assert.deepStrictEqual(cases[0], {
  suite: 'com.example.CheckoutTest',
  name: 'opens checkout',
  result: 'pass',
  duration: 125
});
assert.strictEqual(cases[1].result, 'fail');
assert.strictEqual(cases[1].duration, 500);
assert.ok(cases[1].reason.includes('Expected <approved> but was "declined"'));
assert.ok(cases[1].reason.includes('CheckoutTest.java:42'));
assert.strictEqual(cases[1]['_Standard output'], 'opening checkout\nsubmitting payment');
assert.strictEqual(cases[1]['_Standard error'], 'gateway & card error');
assert.strictEqual(cases[2].result, 'fail');
assert.strictEqual(cases[2].reason, 'Process crashed');
assert.strictEqual(cases[3].result, 'unknown');
assert.strictEqual(cases[3].reason, 'Camera unavailable');

const wrapped = parseJUnitXml(`<testsuites>${xml}<testsuite name="Second"><testcase name="works" /></testsuite></testsuites>`);
assert.strictEqual(wrapped.length, 5);
assert.strictEqual(wrapped[4].suite, 'Second');
assert.strictEqual(parseJUnitXml('<testcase name="works" />')[0].suite, 'JUnit XML');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tesults-android-junit-'));
try {
  const resultsDirectory = path.join(
    temporary,
    'app',
    'build',
    'outputs',
    'androidTest-results',
    'connected',
    'pixel'
  );
  fs.mkdirSync(resultsDirectory, { recursive: true });
  const resultFile = path.join(resultsDirectory, 'TEST-pixel.xml');
  fs.writeFileSync(resultFile, xml);

  const unrelatedDirectory = path.join(temporary, 'other-results');
  fs.mkdirSync(unrelatedDirectory);
  fs.writeFileSync(path.join(unrelatedDirectory, 'TEST-unrelated.xml'), xml);

  const configuredDirectory = path.join(temporary, 'tests', 'TestResults');
  fs.mkdirSync(configuredDirectory, { recursive: true });
  const configuredFile = path.join(configuredDirectory, 'xunit.xml');
  fs.writeFileSync(configuredFile, `<testsuites><testsuite name="Example.Tests">
    <testcase name="Example.Tests.Passes" classname="Example.Tests" time="0.025" />
    <testcase name="Example.Tests.Fails" classname="Example.Tests" time="0.05">
      <failure message="Assert.Equal() Failure">Expected: 2\nActual: 1</failure>
    </testcase>
  </testsuite></testsuites>`);

  const files = findAndroidJUnitFiles(temporary, Date.now() - 1000);
  assert.deepStrictEqual(files, [resultFile]);

  const data = androidJUnitData(temporary, Date.now() - 1000);
  assert.strictEqual(data.target, '');
  assert.strictEqual(data.results.cases.length, 4);
  assert.deepStrictEqual(data.metadata, {
    integration_name: 'test-automation-reporting',
    integration_version: '1.3.0',
    test_framework: 'espresso'
  });

  assert.strictEqual(androidJUnitData(temporary, Date.now() + 10000), undefined);

  const configuredFiles = findConfiguredJUnitFiles(
    temporary,
    '**/TestResults/**/*.xml',
    Date.now() - 1000
  );
  assert.deepStrictEqual(configuredFiles, [configuredFile]);
  assert.deepStrictEqual(
    findConfiguredJUnitFiles(temporary, 'tests/TestResults', Date.now() - 1000),
    [configuredFile]
  );
  assert.deepStrictEqual(
    findConfiguredJUnitFiles(
      temporary,
      'tests/TestResults/xunit.xml\ntests/TestResults/**/*.xml',
      Date.now() - 1000
    ),
    [configuredFile]
  );
  assert.deepStrictEqual(findConfiguredJUnitFiles(temporary, '../*.xml'), []);

  const configuredData = configuredJUnitData(
    temporary,
    '**/TestResults/**/*.xml',
    Date.now() - 1000
  );
  assert.strictEqual(configuredData.results.cases.length, 2);
  assert.strictEqual(configuredData.results.cases[0].suite, 'Example.Tests');
  assert.strictEqual(configuredData.results.cases[0].duration, 25);
  assert.strictEqual(configuredData.results.cases[1].result, 'fail');
  assert.ok(configuredData.results.cases[1].reason.includes('Expected: 2'));
  assert.deepStrictEqual(configuredData.metadata, {
    integration_name: 'test-automation-reporting',
    integration_version: '1.3.0',
    test_framework: 'junit-xml'
  });
  assert.strictEqual(
    configuredJUnitData(temporary, '**/TestResults/**/*.xml', Date.now() + 10000),
    undefined
  );

  const summaryFile = path.join(temporary, 'summary.md');
  fs.writeFileSync(summaryFile, '');
  const postResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'post.js')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: path.join(temporary, 'missing-results.json'),
      STATE_tesults_started_at: String(Date.now() - 1000),
      'INPUT_JUNIT-XML': '',
      'INPUT_STORE-ATTACHMENTS': 'false'
    }
  });
  assert.strictEqual(postResult.status, 0, postResult.stderr);
  assert.ok(postResult.stdout.includes('Using Android instrumentation JUnit XML results.'));
  assert.ok(postResult.stdout.includes('Test report: 4 total, 1 passed, 2 failed, 0 flaky, 1 other.'));
  const summary = fs.readFileSync(summaryFile, 'utf8');
  assert.ok(summary.includes('## Test results · 4 tests'));
  assert.ok(summary.includes('shows decline'));
  assert.ok(summary.includes('requires camera'));

  fs.writeFileSync(summaryFile, '');
  const configuredResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'post.js')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: path.join(temporary, 'missing-results.json'),
      STATE_tesults_started_at: String(Date.now() - 1000),
      'INPUT_JUNIT-XML': '**/TestResults/**/*.xml',
      'INPUT_STORE-ATTACHMENTS': 'false'
    }
  });
  assert.strictEqual(configuredResult.status, 0, configuredResult.stderr);
  assert.ok(configuredResult.stdout.includes('Using configured JUnit XML results.'));
  assert.ok(configuredResult.stdout.includes('Test report: 2 total, 1 passed, 1 failed'));
  const configuredSummary = fs.readFileSync(summaryFile, 'utf8');
  assert.ok(configuredSummary.includes('Example.Tests.Passes'));
  assert.ok(configuredSummary.includes('Example.Tests.Fails'));
  assert.ok(!configuredSummary.includes('shows decline'));

  fs.writeFileSync(summaryFile, '');
  const noMatchResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'post.js')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: path.join(temporary, 'missing-results.json'),
      STATE_tesults_started_at: String(Date.now() - 1000),
      'INPUT_JUNIT-XML': '**/missing/**/*.xml',
      'INPUT_STORE-ATTACHMENTS': 'false'
    }
  });
  assert.strictEqual(noMatchResult.status, 1, noMatchResult.stderr);
  assert.ok(noMatchResult.stdout.includes('No current-run JUnit XML test results matched'));
  assert.ok(!noMatchResult.stdout.includes('Using Android instrumentation JUnit XML results.'));

  const reporterOutput = path.join(temporary, 'reporter-results.json');
  fs.writeFileSync(reporterOutput, JSON.stringify({
    target: '',
    results: { cases: [{ suite: 'reporter', name: 'JSON wins', result: 'pass' }] },
    metadata: { test_framework: 'existing-reporter' }
  }));
  fs.writeFileSync(summaryFile, '');
  const priorityResult = spawnSync(process.execPath, [path.join(__dirname, '..', 'src', 'post.js')], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: reporterOutput,
      STATE_tesults_started_at: String(Date.now() - 1000),
      'INPUT_JUNIT-XML': '**/TestResults/**/*.xml',
      'INPUT_STORE-ATTACHMENTS': 'false'
    }
  });
  assert.strictEqual(priorityResult.status, 0, priorityResult.stderr);
  assert.ok(!priorityResult.stdout.includes('Using configured JUnit XML results.'));
  assert.ok(!priorityResult.stdout.includes('Using Android instrumentation JUnit XML results.'));
  assert.ok(priorityResult.stdout.includes('Test report: 1 total, 1 passed'));
  const prioritySummary = fs.readFileSync(summaryFile, 'utf8');
  assert.ok(prioritySummary.includes('JSON wins'));
  assert.ok(!prioritySummary.includes('shows decline'));
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('All JUnit XML tests passed.');
