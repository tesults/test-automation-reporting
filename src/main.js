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

function input(name, fallback = '') {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  return value === undefined ? fallback : String(value);
}

function reportComplete(markerFile) {
  if (!markerFile) return;
  fs.mkdirSync(path.dirname(markerFile), { recursive: true });
  fs.writeFileSync(markerFile, 'complete');
}

async function run() {
  const mode = input('MODE', 'setup').trim().toLowerCase() || 'setup';
  if (!['setup', 'finalize'].includes(mode)) {
    throw new Error('mode must be setup or finalize.');
  }

  if (mode === 'finalize') {
    appendCommandFile(process.env.GITHUB_STATE, 'tesults_skip_post', 'true');
    const markerFile = process.env.TESULTS_REPORT_COMPLETE_FILE;
    try {
      await require('./post').run();
    } finally {
      reportComplete(markerFile);
    }
    return;
  }

  const outputFile = process.env.TESULTS_OUTPUT_FILE || path.join(
    process.env.RUNNER_TEMP || os.tmpdir(),
    `tesults-results-${crypto.randomUUID()}.json`
  );
  const markerFile = path.join(
    process.env.RUNNER_TEMP || os.tmpdir(),
    `tesults-report-complete-${crypto.randomUUID()}`
  );
  const startedAt = Date.now();

  if (fs.existsSync(outputFile)) {
    fs.rmSync(outputFile, { force: true });
  }
  if (fs.existsSync(markerFile)) {
    fs.rmSync(markerFile, { force: true });
  }

  appendCommandFile(process.env.GITHUB_ENV, 'TESULTS_OUTPUT_FILE', outputFile);
  appendCommandFile(process.env.GITHUB_ENV, 'TESULTS_STARTED_AT', startedAt);
  appendCommandFile(process.env.GITHUB_ENV, 'TESULTS_REPORT_COMPLETE_FILE', markerFile);
  appendCommandFile(process.env.GITHUB_STATE, 'tesults_output_file', outputFile);
  appendCommandFile(process.env.GITHUB_STATE, 'tesults_started_at', startedAt);
  appendCommandFile(process.env.GITHUB_STATE, 'tesults_report_complete_file', markerFile);

  console.log('Test automation reporting is ready.');
  console.log('Run your tests normally. The configured reporter or JUnit XML logger will provide results for this action.');
}

run().catch((error) => {
  process.stdout.write(`::error::Unable to run test automation reporting: ${error.message}${os.EOL}`);
  process.exitCode = 1;
});
