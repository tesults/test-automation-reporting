const assert = require('assert');
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createCheckRun } = require('../src/post');

const root = path.join(__dirname, '..');

function commandValues(file) {
  if (!fs.existsSync(file)) return {};
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).reduce((values, line) => {
    const separator = line.indexOf('=');
    if (separator > 0) values[line.slice(0, separator)] = line.slice(separator + 1);
    return values;
  }, {});
}

function runNode(script, environment) {
  return spawnSync(process.execPath, [path.join(root, 'src', script)], {
    encoding: 'utf8',
    env: { ...process.env, ...environment }
  });
}

(async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tesults-action-'));
  try {
    const setupEnvironmentFile = path.join(temporary, 'setup-env');
    const setupStateFile = path.join(temporary, 'setup-state');
    const finalStateFile = path.join(temporary, 'final-state');
    const outputFile = path.join(temporary, 'outputs');
    const summaryFile = path.join(temporary, 'summary.md');
    for (const file of [setupEnvironmentFile, setupStateFile, finalStateFile, outputFile, summaryFile]) {
      fs.writeFileSync(file, '');
    }

    const setup = runNode('main.js', {
      GITHUB_ENV: setupEnvironmentFile,
      GITHUB_STATE: setupStateFile,
      GITHUB_WORKSPACE: temporary,
      RUNNER_TEMP: temporary,
      'INPUT_MODE': 'setup'
    });
    assert.strictEqual(setup.status, 0, setup.stderr);
    assert.ok(setup.stdout.includes('Test automation reporting is ready.'));

    const setupEnvironment = commandValues(setupEnvironmentFile);
    const setupState = commandValues(setupStateFile);
    assert.ok(setupEnvironment.TESULTS_OUTPUT_FILE);
    assert.ok(setupEnvironment.TESULTS_STARTED_AT);
    assert.ok(setupEnvironment.TESULTS_REPORT_COMPLETE_FILE);
    assert.strictEqual(setupState.tesults_output_file, setupEnvironment.TESULTS_OUTPUT_FILE);

    fs.writeFileSync(setupEnvironment.TESULTS_OUTPUT_FILE, JSON.stringify({
      target: '',
      results: {
        cases: [
          { suite: 'consumer', name: 'passes', result: 'pass', duration: 20 },
          { suite: 'consumer', name: 'fails', result: 'fail', duration: 30, reason: 'expected true' }
        ]
      },
      metadata: { test_framework: 'test' }
    }));

    const finalize = runNode('main.js', {
      ...setupEnvironment,
      GITHUB_OUTPUT: outputFile,
      GITHUB_STATE: finalStateFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      RUNNER_TEMP: temporary,
      'INPUT_MODE': 'finalize',
      'INPUT_REPORT-TITLE': 'Consumer tests',
      'INPUT_REPORT-DETAIL': 'failures',
      'INPUT_COLLAPSED': 'never',
      'INPUT_MAX-ANNOTATIONS': '0',
      'INPUT_FAIL-ON-TEST-FAILURE': 'true',
      'INPUT_FAIL-ON-EMPTY': 'true',
      'INPUT_STORE-ATTACHMENTS': 'false',
      'INPUT_CHECK-RUN': 'false'
    });
    assert.strictEqual(finalize.status, 1, finalize.stderr);
    assert.ok(finalize.stdout.includes('Test report: 2 total, 1 passed, 1 failed'));
    assert.ok(fs.existsSync(setupEnvironment.TESULTS_REPORT_COMPLETE_FILE));

    const outputs = commandValues(outputFile);
    assert.deepStrictEqual(outputs, {
      conclusion: 'failure',
      passed: '1',
      failed: '1',
      flaky: '0',
      other: '0',
      skipped: '0',
      total: '2',
      time: '50',
      url: '',
      'check-run-url': '',
      'summary-file': summaryFile
    });
    const summary = fs.readFileSync(summaryFile, 'utf8');
    assert.ok(summary.startsWith('## Consumer tests · 2 tests · 50 ms'));
    assert.ok(summary.includes('### Failures'));
    assert.ok(!summary.includes('All test results'));

    const finalizePostState = commandValues(finalStateFile);
    const finalizePost = runNode('post.js', {
      STATE_tesults_skip_post: finalizePostState.tesults_skip_post
    });
    assert.strictEqual(finalizePost.status, 0, finalizePost.stderr);
    assert.ok(finalizePost.stdout.includes('Skipping post-job reporting'));

    const setupPost = runNode('post.js', {
      STATE_tesults_report_complete_file: setupState.tesults_report_complete_file
    });
    assert.strictEqual(setupPost.status, 0, setupPost.stderr);
    assert.ok(setupPost.stdout.includes('Skipping duplicate post-job reporting'));
    assert.ok(!fs.existsSync(setupEnvironment.TESULTS_REPORT_COMPLETE_FILE));

    fs.writeFileSync(outputFile, '');
    fs.writeFileSync(summaryFile, '');
    const empty = runNode('post.js', {
      GITHUB_OUTPUT: outputFile,
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: path.join(temporary, 'missing.json'),
      STATE_tesults_started_at: String(Date.now()),
      'INPUT_FAIL-ON-EMPTY': 'false',
      'INPUT_STORE-ATTACHMENTS': 'false'
    });
    assert.strictEqual(empty.status, 0, empty.stderr);
    assert.ok(empty.stdout.includes('::warning::No test results were produced.'));
    assert.strictEqual(commandValues(outputFile).conclusion, 'success');

    const projectDirectory = path.join(temporary, 'project');
    fs.mkdirSync(projectDirectory);
    const junitStartedAt = Date.now() - 100;
    fs.writeFileSync(path.join(projectDirectory, 'results.xml'), [
      '<testsuite name="nested">',
      '  <testcase classname="nested" name="works" time="0.01" />',
      '</testsuite>'
    ].join('\n'));
    fs.writeFileSync(summaryFile, '');
    const nestedResults = runNode('post.js', {
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: path.join(temporary, 'missing.json'),
      STATE_tesults_started_at: String(junitStartedAt),
      'INPUT_JUNIT-XML': 'results.xml',
      'INPUT_WORKING-DIRECTORY': 'project',
      'INPUT_STORE-ATTACHMENTS': 'false'
    });
    assert.strictEqual(nestedResults.status, 0, nestedResults.stderr);
    assert.ok(nestedResults.stdout.includes('Using configured JUnit XML results.'));
    assert.ok(fs.readFileSync(summaryFile, 'utf8').includes('works'));

    fs.writeFileSync(summaryFile, '');
    const noJobSummary = runNode('post.js', {
      GITHUB_STEP_SUMMARY: summaryFile,
      GITHUB_WORKSPACE: temporary,
      STATE_tesults_output_file: setupEnvironment.TESULTS_OUTPUT_FILE,
      'INPUT_USE-ACTIONS-SUMMARY': 'false',
      'INPUT_STORE-ATTACHMENTS': 'false'
    });
    assert.strictEqual(noJobSummary.status, 0, noJobSummary.stderr);
    assert.strictEqual(fs.readFileSync(summaryFile, 'utf8'), '');

    const outsideWorkspace = runNode('post.js', {
      GITHUB_WORKSPACE: temporary,
      'INPUT_WORKING-DIRECTORY': '../outside'
    });
    assert.strictEqual(outsideWorkspace.status, 1, outsideWorkspace.stderr);
    assert.ok(outsideWorkspace.stdout.includes('working-directory must be inside the GitHub workspace'));

    const originalFetch = global.fetch;
    const originalEnvironment = {
      GITHUB_API_URL: process.env.GITHUB_API_URL,
      GITHUB_REPOSITORY: process.env.GITHUB_REPOSITORY,
      GITHUB_RUN_ID: process.env.GITHUB_RUN_ID,
      GITHUB_SERVER_URL: process.env.GITHUB_SERVER_URL,
      GITHUB_SHA: process.env.GITHUB_SHA
    };
    let request;
    try {
      process.env.GITHUB_API_URL = 'https://api.github.test';
      process.env.GITHUB_REPOSITORY = 'tesults/example';
      process.env.GITHUB_RUN_ID = '123';
      process.env.GITHUB_SERVER_URL = 'https://github.test';
      process.env.GITHUB_SHA = 'abcdef';
      global.fetch = async (url, options) => {
        request = { url, options };
        return {
          ok: true,
          json: async () => ({ html_url: 'https://github.test/tesults/example/runs/456' })
        };
      };

      const checkUrl = await createCheckRun(
        { checkRun: true, checkName: 'Browser tests', token: 'secret' },
        '## Test results',
        { total: 2, passed: 1, failed: 1, flaky: 0, other: 0 },
        [{
          title: 'Checkout failed',
          message: 'Expected true',
          location: { file: path.join('tests', 'checkout.js'), line: 8, col: 3 }
        }]
      );
      assert.strictEqual(checkUrl, 'https://github.test/tesults/example/runs/456');
      assert.strictEqual(request.url, 'https://api.github.test/repos/tesults/example/check-runs');
      const body = JSON.parse(request.options.body);
      assert.strictEqual(body.name, 'Browser tests');
      assert.strictEqual(body.conclusion, 'failure');
      assert.strictEqual(body.details_url, 'https://github.test/tesults/example/actions/runs/123');
      assert.strictEqual(body.output.annotations.length, 1);
      assert.strictEqual(body.output.annotations[0].path, 'tests/checkout.js');

      await createCheckRun(
        { checkRun: true, checkName: 'Optional tests', token: 'secret' },
        '# Optional tests\n\nNo results were produced.',
        { total: 0, passed: 0, failed: 0, flaky: 0, other: 0 },
        [],
        'failure'
      );
      assert.strictEqual(JSON.parse(request.options.body).conclusion, 'failure');
    } finally {
      global.fetch = originalFetch;
      for (const [name, value] of Object.entries(originalEnvironment)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }

  console.log('All action configuration tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
