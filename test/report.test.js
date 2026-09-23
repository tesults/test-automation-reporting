const assert = require('assert');
const path = require('path');
const {
  annotations,
  outputText,
  renderSummary,
  resultCounts,
  stripAnsi
} = require('../src/report');

const workspace = path.resolve('/workspace');
const data = {
  target: '',
  results: {
    cases: [
      {
        suite: 'checkout',
        name: 'completes purchase',
        result: 'pass',
        duration: 120
      },
      {
        suite: 'checkout',
        name: 'shows payment error',
        result: 'fail',
        duration: 1080,
        desc: 'Declined cards show a useful error.',
        reason: JSON.stringify({
          message: '\u001b[31mExpected error message\u001b[39m',
          stack: '\u001b[31mError: Expected error message\u001b[39m\n    at test.js:12:4'
        }),
        _Location: JSON.stringify({
          file: path.join(workspace, 'tests', 'checkout.spec.js'),
          line: 12,
          column: 4
        }),
        _Retries: [{ result: 'fail', files: ['/tmp/first-attempt.png'] }],
        files: ['/tmp/screenshot.png', '/tmp/trace.zip'],
        '_Standard output': JSON.stringify(['console line\n']),
        '_Standard error': JSON.stringify([{ type: 'Buffer', data: Array.from(Buffer.from('stderr line\n')) }]),
        params: { card: 'declined' },
        steps: [
          { name: 'Before Hooks', result: 'pass', _Category: 'hook' },
          {
            name: 'submit payment',
            result: 'fail',
            duration: 25,
            steps: [{ name: 'expect.toBe', result: 'fail' }]
          }
        ]
      },
      {
        suite: '[build]',
        name: 'build-123',
        result: 'pass'
      }
    ]
  },
  metadata: {
    test_framework: 'playwright'
  }
};

assert.deepStrictEqual(resultCounts(data), { total: 2, passed: 1, failed: 1, other: 0 });
assert.strictEqual(stripAnsi('\u001b[2mhello\u001b[22m'), 'hello');
assert.strictEqual(outputText(JSON.stringify(['a', 'b'])), 'ab');

const summary = renderSummary(data, workspace);
assert.ok(summary.includes('# ❌ Playwright Test Results'));
assert.ok(summary.includes('**2 tests** · ✅ 1 passed · ❌ 1 failed'));
assert.ok(summary.includes('shows payment error'));
assert.ok(summary.includes('`tests/checkout.spec.js:12:4`'));
assert.ok(summary.includes('Expected error message'));
assert.ok(!summary.includes('\u001b['));
assert.ok(summary.includes('1 retry (❌ → ❌)'));
assert.ok(summary.includes('<summary>Logs</summary>'));
assert.ok(summary.includes('console line'));
assert.ok(summary.includes('stderr line'));
assert.ok(summary.includes('screenshot.png'));
assert.ok(summary.includes('trace.zip'));
assert.ok(summary.includes('first-attempt.png'));
assert.ok(summary.includes('<summary>Test steps</summary>'));
assert.ok(summary.includes('❌ submit payment'));
assert.ok(!summary.includes('Before Hooks'));
assert.ok(summary.includes('<summary>Parameters</summary>'));
assert.ok(summary.includes('Need history and intelligence across runs?'));
assert.ok(summary.includes('utm_campaign=test-automation-reporting'));

const reportAnnotations = annotations(data, workspace);
assert.strictEqual(reportAnnotations.length, 1);
assert.strictEqual(reportAnnotations[0].message, 'Expected error message');
assert.strictEqual(reportAnnotations[0].location.file, path.join('tests', 'checkout.spec.js'));
assert.strictEqual(reportAnnotations[0].location.line, 12);
assert.strictEqual(reportAnnotations[0].location.col, 4);
assert.ok(!reportAnnotations[0].message.includes('\u001b['));

const passing = {
  results: { cases: [{ suite: 'smoke', name: 'loads', result: 'pass', duration: 15 }] },
  metadata: { test_framework: 'playwright' }
};
const passingSummary = renderSummary(passing, workspace);
assert.ok(passingSummary.includes('# ✅ Playwright Test Results'));
assert.ok(passingSummary.includes('All tests passed.'));
assert.ok(passingSummary.includes('<summary>View test details</summary>'));

console.log('All tests passed.');
