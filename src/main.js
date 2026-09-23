const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

function appendCommandFile(filePath, name, value) {
  if (!filePath) {
    throw new Error(`GitHub did not provide the ${name} command file.`);
  }
  fs.appendFileSync(filePath, `${name}=${value}${os.EOL}`);
}

const outputFile = process.env.TESULTS_OUTPUT_FILE || path.join(
  process.env.RUNNER_TEMP || os.tmpdir(),
  `tesults-results-${crypto.randomUUID()}.json`
);

if (fs.existsSync(outputFile)) {
  fs.rmSync(outputFile, { force: true });
}

appendCommandFile(process.env.GITHUB_ENV, 'TESULTS_OUTPUT_FILE', outputFile);
appendCommandFile(process.env.GITHUB_STATE, 'tesults_output_file', outputFile);

console.log('Test automation reporting is ready.');
console.log('Run your tests normally. The configured framework reporter will write results for this action.');
