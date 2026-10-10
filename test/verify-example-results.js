const fs = require('fs');

const [filePath, expectedFramework] = process.argv.slice(2);

if (!filePath || !expectedFramework) {
  throw new Error('Usage: node test/verify-example-results.js <results-file> <framework>');
}

const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
const framework = String(data.metadata?.test_framework || '').toLowerCase();
const cases = data.results?.cases;

if (!framework.includes(expectedFramework.toLowerCase())) {
  throw new Error(`Expected ${expectedFramework} metadata, received ${framework || 'none'}.`);
}
if (!Array.isArray(cases) || cases.length !== 2) {
  throw new Error(`Expected two test cases, received ${cases?.length ?? 'none'}.`);
}
if (cases.some((test) => test.result !== 'pass')) {
  throw new Error('Expected every example test case to pass.');
}

console.log(`Verified two passing ${expectedFramework} results.`);
