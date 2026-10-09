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
  testCasesFrom,
  totalDuration
} = require('./report');
const { androidJUnitData, configuredJUnitData } = require('./junit');

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

function input(name, fallback = '') {
  const value = process.env[`INPUT_${name.toUpperCase()}`];
  return value === undefined ? fallback : String(value);
}

function booleanInput(name, fallback) {
  const value = input(name, String(fallback)).trim().toLowerCase();
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${name} must be true or false.`);
}

function choiceInput(name, choices, fallback) {
  const value = input(name, fallback).trim().toLowerCase() || fallback;
  if (!choices.includes(value)) {
    throw new Error(`${name} must be one of: ${choices.join(', ')}.`);
  }
  return value;
}

function integerInput(name, fallback, minimum, maximum) {
  const raw = input(name, String(fallback)).trim();
  const value = Number(raw);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}.`);
  }
  return value;
}

function appendOutput(name, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${String(value)}${os.EOL}`);
}

function setReportOutputs(counts, duration, conclusion, checkRunUrl = '') {
  appendOutput('conclusion', conclusion);
  appendOutput('passed', counts.passed);
  appendOutput('failed', counts.failed);
  appendOutput('flaky', counts.flaky);
  appendOutput('other', counts.other);
  appendOutput('skipped', counts.other);
  appendOutput('total', counts.total);
  appendOutput('time', duration);
  appendOutput('url', checkRunUrl);
  appendOutput('check-run-url', checkRunUrl);
  appendOutput('summary-file', process.env.GITHUB_STEP_SUMMARY || '');
}

function workspaceDirectory() {
  const root = path.resolve(process.env.GITHUB_WORKSPACE || process.cwd());
  const configured = input('WORKING-DIRECTORY').trim();
  if (!configured) return root;

  const directory = path.resolve(root, configured);
  const relative = path.relative(root, directory);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error('working-directory must be inside the GitHub workspace.');
  }
  return directory;
}

function reportSettings() {
  return {
    checkName: input('CHECK-NAME', 'Test results').trim() || 'Test results',
    checkRun: booleanInput('CHECK-RUN', false),
    collapsed: choiceInput('COLLAPSED', ['auto', 'always', 'never'], 'auto'),
    failOnEmpty: booleanInput('FAIL-ON-EMPTY', true),
    failOnTestFailure: booleanInput('FAIL-ON-TEST-FAILURE', false),
    junitInput: input('JUNIT-XML').trim(),
    maxAnnotations: integerInput('MAX-ANNOTATIONS', 10, 0, 50),
    reportDetail: choiceInput('REPORT-DETAIL', ['all', 'failures', 'summary'], 'all'),
    reportTitle: input('REPORT-TITLE', 'Test results').trim() || 'Test results',
    storeAttachments: booleanInput('STORE-ATTACHMENTS', false),
    token: input('TOKEN').trim(),
    useActionsSummary: booleanInput('USE-ACTIONS-SUMMARY', true),
    workingDirectory: workspaceDirectory()
  };
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
  if (!booleanInput('STORE-ATTACHMENTS', false)) {
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

function truncateUtf8(value, maximumBytes) {
  const content = String(value || '');
  if (Buffer.byteLength(content, 'utf8') <= maximumBytes) return content;
  return Buffer.from(content, 'utf8').subarray(0, maximumBytes).toString('utf8');
}

function checkAnnotations(reportAnnotations) {
  return reportAnnotations.filter((annotation) => annotation.location && annotation.location.file).map((annotation) => {
    const line = annotation.location.line || 1;
    const result = {
      path: annotation.location.file.split(path.sep).join('/'),
      start_line: line,
      end_line: line,
      annotation_level: 'failure',
      title: truncateUtf8(annotation.title || 'Test failed', 255),
      message: truncateUtf8(annotation.message || 'Test failed', 60000)
    };
    if (annotation.location.col) {
      result.start_column = annotation.location.col;
      result.end_column = annotation.location.col;
    }
    return result;
  });
}

async function createCheckRun(settings, markdown, counts, reportAnnotations, conclusionOverride) {
  if (!settings.checkRun) return '';
  if (!settings.token) throw new Error('token is required when check-run is true.');
  if (!process.env.GITHUB_REPOSITORY || !process.env.GITHUB_SHA) {
    throw new Error('GITHUB_REPOSITORY and GITHUB_SHA are required to create a Check Run.');
  }

  const apiUrl = process.env.GITHUB_API_URL || 'https://api.github.com';
  const url = `${apiUrl}/repos/${process.env.GITHUB_REPOSITORY}/check-runs`;
  const conclusion = conclusionOverride || (counts.failed > 0 ? 'failure' : 'success');
  const annotationsForCheck = checkAnnotations(reportAnnotations);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'tesults-test-automation-reporting',
      'X-GitHub-Api-Version': '2022-11-28'
    },
    body: JSON.stringify({
      name: settings.checkName,
      head_sha: process.env.GITHUB_SHA,
      status: 'completed',
      conclusion,
      details_url: process.env.GITHUB_RUN_ID
        ? `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
        : undefined,
      output: {
        title: truncateUtf8(`${counts.total} tests · ${counts.failed} failed · ${counts.flaky} flaky`, 255),
        summary: truncateUtf8(markdown, 65000),
        annotations: annotationsForCheck
      }
    })
  });

  if (!response.ok) {
    const detail = truncateUtf8(await response.text(), 2000);
    throw new Error(`GitHub Checks API returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const result = await response.json();
  return String(result.html_url || '');
}

function actionRef() {
  if (process.env.GITHUB_ACTION_REF) return process.env.GITHUB_ACTION_REF;

  const parts = path.resolve(__dirname).split(path.sep);
  const actionsIndex = parts.lastIndexOf('_actions');
  if (actionsIndex >= 0 && parts.length > actionsIndex + 3) {
    return parts[actionsIndex + 3];
  }

  return 'v1';
}

function reportContext(attachmentUrl, settings) {
  return {
    attachmentUrl,
    collapsed: settings.collapsed,
    reportDetail: settings.reportDetail,
    reportTitle: settings.reportTitle,
    storeAttachments: settings.storeAttachments,
    actionRepository: process.env.GITHUB_ACTION_REPOSITORY || 'tesults/test-automation-reporting',
    actionRef: actionRef(),
    repository: process.env.GITHUB_REPOSITORY,
    serverUrl: process.env.GITHUB_SERVER_URL || 'https://github.com',
    sha: process.env.GITHUB_SHA,
    workspace: process.env.GITHUB_WORKSPACE
  };
}

function emptyCounts() {
  return { total: 0, passed: 0, failed: 0, flaky: 0, other: 0 };
}

function emptyMessage(settings) {
  return settings.junitInput
    ? `No current-run JUnit XML test results matched: ${settings.junitInput}`
    : 'No test results were produced. Make sure a supported framework reporter is installed and configured, or run Espresso with an Android Gradle test task, and ensure this action appears before the test step.';
}

function errorSummary(settings, message) {
  return `# ${settings.reportTitle}\n\n${message}\n`;
}

async function run() {
  let settings;
  try {
    settings = reportSettings();
  } catch (error) {
    const message = `Unable to configure test reporting: ${error.message}`;
    emitError(message);
    appendSummary(`# Test Automation Reporting\n\n${message}\n`);
    setReportOutputs(emptyCounts(), 0, 'failure');
    process.exitCode = 1;
    return;
  }

  const outputFile = process.env.STATE_tesults_output_file || process.env.TESULTS_OUTPUT_FILE;
  const startedAt = process.env.STATE_tesults_started_at || process.env.TESULTS_STARTED_AT;
  let data;

  if (outputFile && fs.existsSync(outputFile)) {
    try {
      data = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
    } catch (error) {
      const message = `Unable to process test results: ${error.message}`;
      emitError(message);
      if (settings.useActionsSummary) appendSummary(errorSummary(settings, message));
      setReportOutputs(emptyCounts(), 0, 'failure');
      process.exitCode = 1;
      return;
    }
  } else {
    if (settings.junitInput) {
      data = configuredJUnitData(
        settings.workingDirectory,
        settings.junitInput,
        startedAt
      );
      if (data) {
        console.log('Using configured JUnit XML results.');
      }
    } else {
      data = androidJUnitData(
        settings.workingDirectory,
        startedAt
      );
      if (data) {
        console.log('Using Android instrumentation JUnit XML results.');
      }
    }

    if (!data) {
      const message = emptyMessage(settings);
      if (settings.failOnEmpty) emitError(message);
      else emitWarning(message);
      const markdown = errorSummary(settings, message);
      if (settings.useActionsSummary) appendSummary(markdown);
      const conclusion = settings.failOnEmpty ? 'failure' : 'success';
      let checkRunUrl = '';
      if (settings.checkRun) {
        try {
          checkRunUrl = await createCheckRun(
            settings,
            markdown,
            emptyCounts(),
            [],
            conclusion
          );
          console.log(`Created GitHub Check Run: ${checkRunUrl}`);
        } catch (error) {
          emitError(`Unable to create GitHub Check Run: ${error.message}`);
          process.exitCode = 1;
        }
      }
      setReportOutputs(emptyCounts(), 0, conclusion, checkRunUrl);
      if (settings.failOnEmpty) process.exitCode = 1;
      return;
    }
  }

  try {
    const attachmentUrl = uploadAttachments(data);
    const markdown = renderSummary(data, reportContext(attachmentUrl, settings));
    if (settings.useActionsSummary) appendSummary(markdown);

    const reportAnnotations = annotations(
      data,
      process.env.GITHUB_WORKSPACE,
      settings.maxAnnotations
    );
    for (const annotation of reportAnnotations) {
      emitError(`${annotation.title}: ${annotation.message}`, annotation.location);
    }

    const counts = resultCounts(data);
    const duration = totalDuration(testCasesFrom(data));
    const conclusion = counts.failed > 0 ? 'failure' : 'success';
    let checkRunUrl = '';
    if (settings.checkRun) {
      try {
        checkRunUrl = await createCheckRun(settings, markdown, counts, reportAnnotations);
        console.log(`Created GitHub Check Run: ${checkRunUrl}`);
      } catch (error) {
        emitError(`Unable to create GitHub Check Run: ${error.message}`);
        process.exitCode = 1;
      }
    }

    setReportOutputs(counts, duration, conclusion, checkRunUrl);
    console.log(
      `Test report: ${counts.total} total, ${counts.passed} passed, ${counts.failed} failed, ${counts.flaky} flaky, ${counts.other} other.`
    );

    if (settings.failOnTestFailure && counts.failed > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    const message = `Unable to process test results: ${error.message}`;
    emitError(message);
    if (settings.useActionsSummary) appendSummary(errorSummary(settings, message));
    setReportOutputs(emptyCounts(), 0, 'failure');
    process.exitCode = 1;
  }
}

if (require.main === module) {
  if (String(process.env.STATE_tesults_skip_post || '').toLowerCase() === 'true') {
    console.log('Test report was finalized during the workflow. Skipping post-job reporting.');
  } else if (
    process.env.STATE_tesults_report_complete_file &&
    fs.existsSync(process.env.STATE_tesults_report_complete_file)
  ) {
    fs.rmSync(process.env.STATE_tesults_report_complete_file, { force: true });
    console.log('Test report was finalized during the workflow. Skipping duplicate post-job reporting.');
  } else {
    run().catch((error) => {
      emitError(`Unable to process test results: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

module.exports = {
  checkAnnotations,
  createCheckRun,
  reportSettings,
  run,
  setReportOutputs,
  workspaceDirectory
};
