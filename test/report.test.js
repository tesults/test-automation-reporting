const assert = require('assert');
const path = require('path');
const {
  annotations,
  renderSummary,
  resultCounts
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
        duration: 80,
        reason: JSON.stringify({
          message: 'Expected error message',
          stack: 'Error: Expected error message\n    at test.js:12:4'
        }),
        _Location: JSON.stringify({
          file: path.join(workspace, 'tests', 'checkout.spec.js'),
          line: 12,
          column: 4
        }),
        _Retries: [{ result: 'fail' }],
        files: ['/tmp/screenshot.png'],
        steps: [
          {
            name: 'submit payment',
            result: 'fail'
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

const counts = resultCounts(data);
assert.deepStrictEqual(counts, {
  total: 2,
  passed: 1,
  failed: 1,
  other: 0
});

const summary = renderSummary(data);
assert.ok(summary.includes('Test Automation Reporting by Tesults'));
assert.ok(summary.includes('playwright'));
assert.ok(summary.includes('shows payment error'));
assert.ok(summary.includes('Expected error message'));
assert.ok(summary.includes('Previous attempts: 1'));
assert.ok(summary.includes('Attachments: 1'));
assert.ok(summary.includes('submit payment'));

const reportAnnotations = annotations(data, workspace);
assert.strictEqual(reportAnnotations.length, 1);
assert.strictEqual(reportAnnotations[0].location.file, path.join('tests', 'checkout.spec.js'));
assert.strictEqual(reportAnnotations[0].location.line, 12);
assert.strictEqual(reportAnnotations[0].location.col, 4);

console.log('All tests passed.');
