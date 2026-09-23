const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  annotations,
  attachmentFiles,
  renderSummary,
  resultCounts,
  testCasesFrom
} = require('./report');

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

function emitWarning(message) {
  process.stdout.write(`::warning::${escapeMessage(message)}${os.EOL}`);
}

function appendSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const maxBytes = 950 * 1024;
  let content = markdown;
  if (Buffer.byteLength(content, 'utf8') > maxBytes) {
    content = Buffer.from(content, 'utf8').subarray(0, maxBytes).toString('utf8');
    content += '\n\n_Report truncated to stay within the GitHub job summary size limit._\n';
  }
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, content + os.EOL);
}

function safeSegment(value) {
  return String(value || 'test')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'test';
}

function uniqueDestination(directory, basename) {
  const ext = path.extname(basename);
  const stem = path.basename(basename, ext);
  let candidate = path.join(directory, basename);
  let index = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${stem}-${index}${ext}`);
    index += 1;
  }
  return candidate;
}

function stageAttachments(data) {
  const stagingRoot = fs.mkdtempSync(path.join(process.env.RUNNER_TEMP || os.tmpdir(), 'tesults-files-'));
  let copied = 0;

  for (const testCase of testCasesFrom(data)) {
    const files = attachmentFiles(testCase);
    if (!files.length) continue;

    const caseDir = path.join(stagingRoot, safeSegment(testCase.suite), safeSegment(testCase.name));
    fs.mkdirSync(caseDir, { recursive: true });

    for (const file of files) {
      try {
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) continue;
        const destination = uniqueDestination(caseDir, path.basename(file));
        fs.copyFileSync(file, destination);
        copied += 1;
      } catch (error) {
        emitWarning(`Unable to stage test attachment ${path.basename(file)}: ${error.message}`);
      }
    }
  }

  return { stagingRoot, copied };
}

function parseArtifactUrl(output) {
  const match = String(output || '').match(/Artifact download URL:\s*(https?:\/\/\S+)/i);
  return match ? match[1].trim() : undefined;
}

function uploadAttachments(data) {
  if (String(process.env.INPUT_UPLOAD_ATTACHMENTS || 'true').toLowerCase() === 'false') {
    return undefined;
  }

  const { stagingRoot, copied } = stageAttachments(data);
  if (!copied) {
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    return undefined;
  }

  const vendorDir = path.join(__dirname, '..', 'vendor');
  const uploaderParts = fs.existsSync(vendorDir)
    ? fs.readdirSync(vendorDir).filter((name) => /^upload-artifact\.part\d+$/.test(name)).sort()
    : [];
  if (!uploaderParts.length) {
    emitWarning('Captured test files could not be uploaded because the bundled GitHub artifact uploader is missing.');
    fs.rmSync(stagingRoot, { recursive: true, force: true });
    return undefined;
  }

  const uploader = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `tesults-upload-artifact-${crypto.randomUUID()}.mjs`);
  const uploaderHandle = fs.openSync(uploader, 'w');
  try {
    for (const part of uploaderParts) {
      fs.writeFileSync(uploaderHandle, fs.readFileSync(path.join(vendorDir, part)));
    }
  } finally {
    fs.closeSync(uploaderHandle);
  }

  const outputFile = path.join(process.env.RUNNER_TEMP || os.tmpdir(), `tesults-artifact-output-${crypto.randomUUID()}.txt`);
  fs.writeFileSync(outputFile, '');

  const artifactName = [
    'test-attachments',
    safeSegment(process.env.GITHUB_JOB || 'job'),
    crypto.randomUUID().slice(0, 8)
  ].join('-');

  const env = {
    ...process.env,
    GITHUB_OUTPUT: outputFile,
    INPUT_NAME: artifactName,
    INPUT_PATH: stagingRoot,
    'INPUT_IF-NO-FILES-FOUND': 'ignore',
    'INPUT_RETENTION-DAYS': '1',
    'INPUT_COMPRESSION-LEVEL': '6',
    INPUT_OVERWRITE: 'false',
    'INPUT_INCLUDE-HIDDEN-FILES': 'false',
    INPUT_ARCHIVE: 'true'
  };

  const result = spawnSync(process.execPath, [uploader], {
    env,
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024
  });

  const combined = `${result.stdout || ''}\n${result.stderr || ''}`;
  const artifactUrl = parseArtifactUrl(combined);

  if (result.status !== 0 || !artifactUrl) {
    emitWarning('Captured test files were found, but GitHub artifact upload did not complete successfully.');
    if (combined.trim()) console.log(combined.trim());
  } else {
    console.log(`Uploaded ${copied} captured test file${copied === 1 ? '' : 's'} to GitHub Actions artifacts.`);
  }

  fs.rmSync(stagingRoot, { recursive: true, force: true });
  fs.rmSync(outputFile, { force: true });
  fs.rmSync(uploader, { force: true });
  return artifactUrl;
}

function reportContext(attachmentUrl) {
  return {
    attachmentUrl,
    repository: process.env.GITHUB_REPOSITORY,
    serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
    sha: process.env.GITHUB_SHA,
    workspace: process.env.GITHUB_WORKSPACE
  };
}

function run() {
  const outputFile = process.env.STATE_tesults_output_file || process.env.TESULTS_OUTPUT_FILE;

  if (!outputFile || !fs.existsSync(outputFile)) {
    const message = 'No Tesults results file was produced. Make sure a Tesults framework reporter is installed and configured, and that this action appears before the test step.';
    emitError(message);
    appendSummary(`# Test Automation Reporting\n\n${message}\n`);
    process.exitCode = 1;
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    const attachmentUrl = uploadAttachments(data);
    appendSummary(renderSummary(data, reportContext(attachmentUrl)));

    for (const annotation of annotations(data, process.env.GITHUB_WORKSPACE, 10)) {
      emitError(`${annotation.title}: ${annotation.message}`, annotation.location);
    }

    const counts = resultCounts(data);
    console.log(
      `Test report: ${counts.total} total, ${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.other} other.`
    );
  } catch (error) {
    const message = `Unable to process test results: ${error.message}`;
    emitError(message);
    appendSummary(`# Test Automation Reporting\n\n${message}\n`);
    process.exitCode = 1;
  }
}

run();
