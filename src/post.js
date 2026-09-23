const fs = require('fs');
const os = require('os');
const { annotations, renderSummary, resultCounts } = require('./report');

function escapeMessage(value) {
  return String(value)
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

function escapeProperty(value) {
  return escapeMessage(value)
    .replace(/:/g, '%3A')
    .replace(/,/g, '%2C');
}

function emitError(message, location) {
  const properties = [];
  if (location && location.file) properties.push(`file=${escapeProperty(location.file)}`);
  if (location && location.line) properties.push(`line=${location.line}`);
  if (location && location.col) properties.push(`col=${location.col}`);
  const propertyText = properties.length ? ` ${properties.join(',')}` : '';
  process.stdout.write(`::error${propertyText}::${escapeMessage(message)}${os.EOL}`);
}

function appendSummary(markdown) {
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + os.EOL);
}

function errorSummary(message) {
  return `# ❌ Test Results\n\n${message}\n\n---\n\n[Tesults](https://www.tesults.com/?utm_source=github&utm_medium=action&utm_campaign=test-automation-reporting)\n`;
}

const outputFile = process.env.STATE_tesults_output_file || process.env.TESULTS_OUTPUT_FILE;

if (!outputFile || !fs.existsSync(outputFile)) {
  const message = 'No Tesults results file was produced. Make sure a Tesults framework reporter is installed and configured, and that this action appears before the test step.';
  emitError(message);
  appendSummary(errorSummary(message));
  process.exitCode = 1;
} else {
  try {
    const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    appendSummary(renderSummary(data, process.env.GITHUB_WORKSPACE));

    for (const annotation of annotations(data, process.env.GITHUB_WORKSPACE, 10)) {
      emitError(`${annotation.title}: ${annotation.message}`, annotation.location);
    }

    const counts = resultCounts(data);
    console.log(`Tesults test report: ${counts.total} total, ${counts.passed} passed, ${counts.failed} failed, ${counts.other} other.`);
  } catch (error) {
    const message = `Unable to process Tesults results: ${error.message}`;
    emitError(message);
    appendSummary(errorSummary(message));
    process.exitCode = 1;
  }
}
