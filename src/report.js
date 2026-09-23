const path = require('path');

const TESULTS_URL = 'https://www.tesults.com/?utm_source=github&utm_medium=action&utm_campaign=test-automation-reporting&utm_content=job-summary';

const STANDARD_FIELDS = new Set([
  'name', 'result', 'suite', 'desc', 'reason', 'params', 'files', 'steps',
  'start', 'end', 'duration', 'rawResult'
]);

function casesFrom(data) {
  if (!data || !data.results || !Array.isArray(data.results.cases)) {
    throw new Error('The results file is not valid Tesults JSON: results.cases is missing.');
  }
  return data.results.cases;
}

function testCasesFrom(data) {
  return casesFrom(data).filter((testCase) => testCase.suite !== '[build]');
}

function retryCases(testCase) {
  return Array.isArray(testCase && testCase._Retries) ? testCase._Retries : [];
}

function isFlaky(testCase) {
  return testCase.result === 'pass' && retryCases(testCase).some((attempt) => attempt && attempt.result === 'fail');
}

function resultCounts(data) {
  const cases = testCasesFrom(data);
  return {
    total: cases.length,
    passed: cases.filter((testCase) => testCase.result === 'pass').length,
    failed: cases.filter((testCase) => testCase.result === 'fail').length,
    flaky: cases.filter(isFlaky).length,
    other: cases.filter((testCase) => testCase.result !== 'pass' && testCase.result !== 'fail').length
  };
}

function stripAnsi(value) {
  return String(value ?? '')
    .replace(/[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g, '')
    .replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/gi, '')
    .replace(/\r/g, '');
}

function markdownText(value) {
  return stripAnsi(value)
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .trim();
}

function codeBlock(value) {
  return stripAnsi(value).replace(/```/g, '``\\`').trim();
}

function parsedValue(value) {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function errorInfo(value) {
  const parsed = parsedValue(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const message = stripAnsi(parsed.message || '').trim();
    const stack = stripAnsi(parsed.stack || '').trim();
    return {
      message: message || (stack ? stack.split('\n')[0] : ''),
      detail: stack || message || stripAnsi(JSON.stringify(parsed, null, 2)).trim()
    };
  }

  const text = stripAnsi(parsed ?? '').trim();
  const firstLine = text.split('\n').find((line) => line.trim()) || '';
  return { message: firstLine.trim(), detail: text };
}

function reasonText(testCase) {
  return errorInfo(testCase && testCase.reason).detail;
}

function outputText(value) {
  const parsed = parsedValue(value);

  function flatten(item) {
    if (item === undefined || item === null) return '';
    if (typeof item === 'string') return item;
    if (Buffer.isBuffer(item)) return item.toString('utf8');
    if (Array.isArray(item)) return item.map(flatten).filter(Boolean).join('');
    if (item && item.type === 'Buffer' && Array.isArray(item.data)) {
      try {
        return Buffer.from(item.data).toString('utf8');
      } catch {
        return JSON.stringify(item);
      }
    }
    if (typeof item === 'object') {
      if (typeof item.text === 'string') return item.text;
      if (typeof item.message === 'string') return item.message;
      return JSON.stringify(item, null, 2);
    }
    return String(item);
  }

  return stripAnsi(flatten(parsed)).trim();
}

function retryCount(testCase) {
  return retryCases(testCase).length;
}

function formatDuration(milliseconds) {
  const value = Number(milliseconds);
  if (!Number.isFinite(value) || value < 0) return '';
  if (value < 1000) return `${Math.round(value)} ms`;
  if (value < 60000) return `${(value / 1000).toFixed(value < 10000 ? 1 : 0)} s`;
  const minutes = Math.floor(value / 60000);
  const seconds = Math.round((value % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function statusIcon(result) {
  if (result === 'pass') return '✅';
  if (result === 'fail') return '❌';
  return '⚪';
}

function shouldHideStep(step) {
  const name = String(step && step.name || '').trim();
  const category = String(step && step._Category || '').toLowerCase();
  if (/^(before|after) hooks?$/i.test(name)) return true;
  if (category === 'hook' || category === 'fixture') return true;
  return false;
}

function renderSteps(steps, depth = 0) {
  if (!Array.isArray(steps) || steps.length === 0) return '';

  let markdown = '';
  for (const step of steps) {
    if (shouldHideStep(step)) continue;
    const indent = '  '.repeat(depth);
    const duration = formatDuration(step.duration);
    const suffix = duration ? ` <sub>${duration}</sub>` : '';
    markdown += `${indent}- ${statusIcon(step.result)} ${markdownText(step.name || 'Step')}${suffix}\n`;
    markdown += renderSteps(step.steps, depth + 1);
  }
  return markdown;
}

function parseLocationValue(raw) {
  if (!raw) return undefined;
  let location = raw;
  if (typeof raw === 'string') {
    try {
      location = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!location || typeof location !== 'object' || !location.file) return undefined;
  return location;
}

function parseLocation(testCase, workspace) {
  const location = parseLocationValue(testCase && testCase._Location);
  if (!location) return undefined;

  let file = String(location.file);
  if (workspace && path.isAbsolute(file)) {
    const relative = path.relative(workspace, file);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
      file = relative;
    }
  }

  return {
    file,
    line: Number.isInteger(location.line) && location.line > 0 ? location.line : undefined,
    col: Number.isInteger(location.column) && location.column > 0 ? location.column : undefined
  };
}

function sourceReference(testCase, context = {}) {
  const location = parseLocation(testCase, context.workspace);
  if (!location) return '';

  const display = `${location.file}${location.line ? `:${location.line}` : ''}`;
  if (!context.serverUrl || !context.repository || !context.sha || path.isAbsolute(location.file)) {
    return `\`${markdownText(display)}\``;
  }

  const normalized = location.file.split(path.sep).join('/');
  const url = `${context.serverUrl}/${context.repository}/blob/${context.sha}/${encodeURI(normalized)}${location.line ? `#L${location.line}` : ''}`;
  return `[\`${markdownText(display)}\`](${url})`;
}

function attachmentFiles(testCase) {
  const files = [];
  const add = (candidate) => {
    if (typeof candidate === 'string' && candidate.trim()) files.push(candidate);
  };
  if (Array.isArray(testCase && testCase.files)) testCase.files.forEach(add);
  for (const retry of retryCases(testCase)) {
    if (Array.isArray(retry && retry.files)) retry.files.forEach(add);
  }
  return [...new Set(files)];
}

function isImageFile(file) {
  return /\.(png|jpe?g|gif|webp|bmp)$/i.test(file || '');
}

function renderAttachments(testCase, attachmentUrl) {
  const files = attachmentFiles(testCase);
  if (!files.length) return '';

  const screenshots = files.filter(isImageFile);
  const others = files.filter((file) => !isImageFile(file));
  let markdown = '';

  if (screenshots.length) {
    markdown += '**Screenshots**\n\n';
    for (const file of screenshots.slice(0, 20)) {
      markdown += `- 🖼️ ${markdownText(path.basename(file))}\n`;
    }
    markdown += '\n';
  }

  if (others.length) {
    markdown += '**Attachments**\n\n';
    for (const file of others.slice(0, 30)) {
      markdown += `- 📎 ${markdownText(path.basename(file))}\n`;
    }
    markdown += '\n';
  }

  if (attachmentUrl) {
    markdown += `[Download captured files from this run](${attachmentUrl})\n\n`;
  } else {
    markdown += '_Captured files are listed above. GitHub artifact upload was unavailable for this run._\n\n';
  }

  return markdown;
}

function renderOutputs(testCase) {
  const stdout = outputText(testCase && testCase['_Standard output']);
  const stderr = outputText(testCase && testCase['_Standard error']);
  let markdown = '';

  if (stdout) {
    markdown += '<details><summary>Standard output</summary>\n\n';
    markdown += `\`\`\`text\n${codeBlock(stdout).slice(0, 12000)}\n\`\`\`\n\n</details>\n\n`;
  }
  if (stderr) {
    markdown += '<details><summary>Standard error</summary>\n\n';
    markdown += `\`\`\`text\n${codeBlock(stderr).slice(0, 12000)}\n\`\`\`\n\n</details>\n\n`;
  }
  return markdown;
}

function renderDescriptionAndParams(testCase) {
  let markdown = '';
  if (testCase.desc) {
    markdown += `${markdownText(testCase.desc)}\n\n`;
  }

  if (testCase.params && typeof testCase.params === 'object' && !Array.isArray(testCase.params)) {
    markdown += '**Parameters**\n\n';
    for (const [key, value] of Object.entries(testCase.params)) {
      markdown += `- **${markdownText(key)}:** ${markdownText(typeof value === 'object' ? JSON.stringify(value) : value)}\n`;
    }
    markdown += '\n';
  }

  const custom = Object.entries(testCase).filter(([key]) => !STANDARD_FIELDS.has(key) && !key.startsWith('_'));
  if (custom.length) {
    markdown += '<details><summary>Additional details</summary>\n\n';
    for (const [key, value] of custom.slice(0, 25)) {
      markdown += `- **${markdownText(key)}:** ${markdownText(typeof value === 'object' ? JSON.stringify(value) : value)}\n`;
    }
    markdown += '\n</details>\n\n';
  }

  return markdown;
}

function renderRetrySummary(testCase) {
  const retries = retryCases(testCase);
  if (!retries.length) return '';

  const attempts = [...retries, testCase];
  const labels = attempts.map((attempt, index) => `${statusIcon(attempt.result)} Attempt ${index + 1}`).join(' → ');
  return `**Attempts:** ${labels}\n\n`;
}

function renderFailure(testCase, context) {
  const info = errorInfo(testCase.reason);
  let markdown = `### ❌ ${markdownText(testCase.name || 'Unnamed test')}\n\n`;
  const meta = [];
  if (testCase.suite) meta.push(markdownText(testCase.suite));
  const source = sourceReference(testCase, context);
  if (source) meta.push(source);
  const duration = formatDuration(testCase.duration);
  if (duration) meta.push(duration);
  if (meta.length) markdown += `${meta.join(' · ')}\n\n`;

  markdown += renderDescriptionAndParams(testCase);
  markdown += renderRetrySummary(testCase);

  if (info.message) {
    markdown += `**Failure**\n\n${markdownText(info.message)}\n\n`;
  }

  if (info.detail && info.detail !== info.message) {
    markdown += '<details><summary>Full error details</summary>\n\n';
    markdown += `\`\`\`text\n${codeBlock(info.detail).slice(0, 16000)}\n\`\`\`\n\n</details>\n\n`;
  }

  const steps = renderSteps(testCase.steps);
  if (steps) {
    markdown += '<details open><summary>Steps</summary>\n\n';
    markdown += steps + '\n</details>\n\n';
  }

  markdown += renderOutputs(testCase);
  markdown += renderAttachments(testCase, context.attachmentUrl);
  return markdown;
}

function renderFlaky(testCase, context) {
  let markdown = `### ⚠️ ${markdownText(testCase.name || 'Unnamed test')}\n\n`;
  const source = sourceReference(testCase, context);
  const duration = formatDuration(testCase.duration);
  const meta = [testCase.suite ? markdownText(testCase.suite) : '', source, duration].filter(Boolean);
  if (meta.length) markdown += `${meta.join(' · ')}\n\n`;
  markdown += `Passed after ${retryCount(testCase)} ${retryCount(testCase) === 1 ? 'retry' : 'retries'}.\n\n`;
  markdown += renderRetrySummary(testCase);
  markdown += renderOutputs(testCase);
  markdown += renderAttachments(testCase, context.attachmentUrl);
  return markdown;
}

function renderTestTable(cases, context) {
  let markdown = '| Test | Suite | Result | Duration |\n';
  markdown += '| --- | --- | --- | ---: |\n';
  for (const testCase of cases.slice(0, 200)) {
    const source = sourceReference(testCase, context);
    const name = source
      ? `${markdownText(testCase.name || 'Unnamed test')}<br><sub>${source}</sub>`
      : markdownText(testCase.name || 'Unnamed test');
    markdown += `| ${name} | ${markdownText(testCase.suite || '')} | ${statusIcon(testCase.result)} ${markdownText(testCase.result || 'unknown')} | ${formatDuration(testCase.duration)} |\n`;
  }
  return markdown;
}

function renderSummary(data, context = {}) {
  const cases = testCasesFrom(data);
  const counts = resultCounts(data);
  const framework = data.metadata && data.metadata.test_framework
    ? String(data.metadata.test_framework)
    : 'Test';
  const frameworkName = framework.charAt(0).toUpperCase() + framework.slice(1);
  const overallIcon = counts.failed > 0 ? '❌' : counts.flaky > 0 ? '⚠️' : '✅';

  let markdown = `# ${overallIcon} ${markdownText(frameworkName)} Test Results\n\n`;
  const summaryParts = [
    `**${counts.total}** total`,
    `✅ **${counts.passed}** passed`,
    `❌ **${counts.failed}** failed`
  ];
  if (counts.flaky > 0) summaryParts.push(`⚠️ **${counts.flaky}** flaky`);
  if (counts.other > 0) summaryParts.push(`⚪ **${counts.other}** other`);
  markdown += summaryParts.join(' · ') + '\n\n';

  const failed = cases.filter((testCase) => testCase.result === 'fail');
  const flaky = cases.filter(isFlaky);

  if (failed.length) {
    markdown += '## Failures\n\n';
    for (const testCase of failed.slice(0, 50)) {
      markdown += renderFailure(testCase, context);
    }
    if (failed.length > 50) {
      markdown += `_Showing the first 50 of ${failed.length} failures._\n\n`;
    }
  }

  if (flaky.length) {
    markdown += '## Flaky tests\n\n';
    for (const testCase of flaky.slice(0, 25)) {
      markdown += renderFlaky(testCase, context);
    }
  }

  if (!failed.length && !flaky.length && cases.length) {
    markdown += 'All tests passed.\n\n';
  }

  if (cases.length) {
    markdown += '<details><summary>All test results</summary>\n\n';
    markdown += renderTestTable(cases, context);
    markdown += '\n</details>\n\n';
  }

  markdown += '---\n\n';
  markdown += `_Report generated by [Tesults](${TESULTS_URL}). Need history across runs? Tesults adds automated regression detection, flaky-test analysis, AI failure intelligence, release tracking, and consolidated results across your test systems._\n`;

  return markdown;
}

function annotations(data, workspace, max = 10) {
  const failed = testCasesFrom(data).filter((testCase) => testCase.result === 'fail');
  return failed.slice(0, max).map((testCase) => {
    const info = errorInfo(testCase.reason);
    return {
      title: stripAnsi(testCase.name || 'Test failed'),
      message: info.message || 'Test failed',
      location: parseLocation(testCase, workspace)
    };
  });
}

module.exports = {
  TESULTS_URL,
  annotations,
  attachmentFiles,
  casesFrom,
  errorInfo,
  formatDuration,
  isFlaky,
  outputText,
  parseLocation,
  reasonText,
  renderSummary,
  resultCounts,
  stripAnsi,
  testCasesFrom
};
