const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  configuredTesultsData,
  findTesultsResultFiles
} = require('../src/results');

const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tesults-imported-results-'));
try {
  const linuxDirectory = path.join(temporary, 'results-linux');
  const windowsDirectory = path.join(temporary, 'results-windows');
  fs.mkdirSync(linuxDirectory);
  fs.mkdirSync(windowsDirectory);

  const linuxFile = path.join(linuxDirectory, 'tesults-results.json');
  const windowsFile = path.join(windowsDirectory, 'tesults-results.json');
  fs.writeFileSync(linuxFile, JSON.stringify({
    target: '',
    results: { cases: [{ suite: 'linux', name: 'works', result: 'pass', duration: 10 }] },
    metadata: { test_framework: 'playwright' }
  }));
  fs.writeFileSync(windowsFile, JSON.stringify({
    target: '',
    results: { cases: [{ suite: 'windows', name: 'fails', result: 'fail', duration: 20 }] },
    metadata: { test_framework: 'playwright' }
  }));

  assert.deepStrictEqual(
    findTesultsResultFiles(temporary, 'results-*/**/*.json'),
    [linuxFile, windowsFile]
  );
  assert.deepStrictEqual(
    findTesultsResultFiles(temporary, 'results-linux\nresults-windows'),
    [linuxFile, windowsFile]
  );
  assert.deepStrictEqual(findTesultsResultFiles(temporary, '../*.json'), []);

  const data = configuredTesultsData(temporary, 'results-*/**/*.json');
  assert.strictEqual(data.results.cases.length, 2);
  assert.strictEqual(data.results.cases[0].suite, 'linux');
  assert.strictEqual(data.results.cases[1].suite, 'windows');
  assert.deepStrictEqual(data.metadata, {
    integration_name: 'test-automation-reporting',
    integration_version: '1.5.0',
    test_framework: 'playwright'
  });

  const invalidFile = path.join(temporary, 'invalid.json');
  fs.writeFileSync(invalidFile, '{invalid');
  assert.throws(
    () => configuredTesultsData(temporary, 'invalid.json'),
    /Unable to parse Tesults results file invalid\.json/
  );
} finally {
  fs.rmSync(temporary, { recursive: true, force: true });
}

console.log('All imported Tesults JSON tests passed.');
