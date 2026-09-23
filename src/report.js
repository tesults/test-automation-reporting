const path = require('path');

const TESULTS_URL = 'https://www.tesults.com/?utm_source=github&utm_medium=action&utm_campaign=test-automation-reporting';
const ANSI_PATTERN = /[\u001B\u009B][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[-a-zA-Z\d\/#&.:=?%@~_]+)*)?\u0007)|(?:(?:\d{1,4}(?:[;:]\d{0,4})*)?[\dA-PR-TZcf-nq-uy=><~]))/g;

function casesFrom(data) {
  if (!data || !data.results || !Array.isArray(data.results.cases)) {
    throw new Error('The results file is not valid Tesults JSON: results.cases is missing.');
  }
  return data.results.cases;
}

function testCasesFrom(data) {
  return casesFrom(data).filter((testCase) => testCase.suite !== '[build]');
}

function resultCounts(data) {
  const cases = testCasesFrom(data);
  return {
    total: cases.length,
    passed: cases.filter((testCase) => testCase.result === 'pass').length,
    failed: cases.filter((testCase) => testCase.result === 'fail').length,
    other: cases.filter((testCase) => testCase.result !== 'pass' && testCase.result !== 'fail').length
  };
}

function stripAnsi(value) {
  return String(value ?? '').replace(ANSI_PATTERN, '');
}

function markdownText(value) {
  return stripAnsi(value).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
}

function codeBlock(value) {
  return stripAnsi(value).replace(/```/g, '``\\`').trim();
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function bufferText(value) {
  if (value && typeof value === 'object' && value.type === 'Buffer' && Array.isArray(value.data)) {
    try {
      return Buffer.from(value.data).toString('utf8');
    } catch {
      return JSON.stringify(value);
    }
  }
  if (typeof value === 'string') return value;
  if (value === undefined || value === null) return '';
  return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

function outputText(value) {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) {
    return stripAnsi(parsed.map(bufferText).join(''));
  }
  return stripAnsi(bufferText(parsed));
}

function errorObject(testCase) {
  const raw = testCase && testCase.reason;
  if (raw === undefined || raw === null) return {};
  const parsed = parseJson(raw);
  if (parsed && typeof parsed === 'object') {
    const message = stripAnsi(parsed.message || '');
    const stack = stripAnsi(parsed.stack || parsed.value || message || JSON.stringify(parsed, null, 2));
    return { message, stack };
  }
  const text = stripAnsi(parsed);
  const firstMeaningful = text.split(/\r?\n/).find((line) => line.trim()) || text;
  return { message: firstMeaningful.trim(), stack: text.trim() };
}

function reasonText(testCase) {
  const error = errorObject(testCase);
  return error.stack || error.message || '';
}

function conciseReason(testCase) {
  const error = errorObject(testCase);
  if (error.message) return error.message;
  const text = error.stack || '';
  return text.split(/\r?\n/).find((line) => line.trim()) || 'Test failed';
}

function retryCases(testCase) {
  return Array.isArray(testCase && testCase._Retries) ? testCase._Retries : [];
}

function retrySummary(testCase) {
  const previous = retryCases(testCase);
  if (previous.length === 0) return '';
  const results = previous.map((attempt) => attempt.result || 'unknown').concat(testCase.result || 'unknown');
  const icons = results.map((result) => result === 'pass' ? '✅' : result === 'fail' ? '❌' : '⚠️');
  const label = previous.length === 1 ? '1 retry' : `${previous.length} retries`;
  return `${label} (${icons.join(' → ')})`;
}

function formatDuration(duration) {
  if (duration === undefined || duration === null || Number.isNaN(Number(duration))) return '';
  const ms = Number(duration);
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1).replace(/\.0$/, '')} s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.round((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

function frameworkName(data) {
  const raw = data && data.metadata && data.metadata.test_framework;
  if (!raw) return 'Test';
  const text = String(raw);
  const known = { playwright: 'Playwright', jest: 'Jest', vitest: 'Vitest', cypress: 'Cypress', pytest: 'Pytest' };
  return known[text.toLowerCase()] || text.charAt(0).toUpperCase() + text.slice(1);
}

function statusIcon(result) {
  if (result === 'pass') return '✅';
  if (result === 'fail') return '❌';
  return '⚠️';
}

function parseLocation(testCase, workspace) {
  const raw = testCase && testCase._Location;
  if (!raw) return undefined;
  const location = parseJson(raw);
  if (!location || typeof location !== 'object' || !location.file) return undefined;

  let file = String(location.file);
  if (workspace && path.isAbsolute(file)) {
    const relative = path.relative(workspace, file);
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) file = relative;
  }

  return {
    file,
    line: Number.isInteger(location.line) && location.line > 0 ? location.line : undefined,
    col: Number.isInteger(location.column) && location.column > 0 ? location.column : undefined
  };
}

function formatLocation(testCase, workspace) {
  const location = parseLocation(testCase, workspace);
  if (!location) return '';
  let value = location.file;
  if (location.line) value += `:${location.line}`;
  if (location.col) value += `:${location.col}`;
  return value;
}

function isNoiseStep(step) {
  const category = String(step && step._Category || '').toLowerCase();
  const name = String(step && step.name || '').trim().toLowerCase();
  if (step && step.result === 'fail') return false;
  return category === 'hook' || name === 'before hooks' || name === 'after hooks' || name === 'worker cleanup';
}

function renderSteps(steps, depth = 0) {
  if (!Array.isArray(steps) || steps.length === 0) return '';
  let markdown = '';
  for (const step of steps) {
    if (isNoiseStep(step)) continue;
    const indent = '  '.repeat(depth);
    markdown += `${indent}- ${statusIcon(step.result)} ${markdownText(step.name || 'Step')}`;
    const duration = formatDuration(step.duration);
    if (duration) markdown += ` _(${duration})_`;
    markdown += '\n';
    markdown += renderSteps(step.steps, depth + 1);
  }
  return markdown;
}

function allFiles(testCase) {
  const files = [];
  const add = (candidate, attemptLabel) => {
    if (!candidate) return;
    const value = String(candidate);
    if (!files.some((item) => item.path === value && item.attempt === attemptLabel)) {
      files.push({ path: value, attempt: attemptLabel });
    }
  };
  retryCases(testCase).forEach((attempt, index) => {
    if (Array.isArray(attempt.files)) attempt.files.forEach((file) => add(file, `attempt ${index + 1}`));
  });
  if (Array.isArray(testCase.files)) testCase.files.forEach((file) => add(file, retryCases(testCase).length ? 'final attempt' : 'test'));
  return files;
}

function fileIcon(filePath) {
  const ext = path.extname(String(filePath)).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) return '🖼️';
  if (['.log', '.txt', '.json', '.xml'].includes(ext)) return '📄';
  if (['.zip', '.gz', '.tar', '.tgz'].includes(ext)) return '📦';
  return '📎';
}

function renderAttachments(testCase) {
  const files = allFiles(testCase);
  if (files.length === 0) return '';
  let markdown = '<details><summary>Attachments';
  markdown += ` (${files.length})</summary>\n\n`;
  for (const file of files.slice(0, 50)) {
    markdown += `- ${fileIcon(file.path)} \`${markdownText(path.basename(file.path))}\``;
    if (file.attempt && retryCases(testCase).length) markdown += ` — ${file.attempt}`;
    markdown += '\n';
  }
  if (files.length > 50) markdown += `- _${files.length - 50} more attachments not shown_\n`;
  markdown += '\n> Files are captured by the test reporter. Persist them with GitHub workflow artifacts if you need to download them after the run.\n\n';
  markdown += '</details>\n\n';
  return markdown;
}

function renderLogs(testCase) {
  const stdout = outputText(testCase['_Standard output']);
  const stderr = outputText(testCase['_Standard error']);
  if (!stdout && !stderr) return '';
  let markdown = '<details><summary>Logs</summary>\n\n';
  if (stdout) markdown += `**stdout**\n\n\`\`\`text\n${codeBlock(stdout).slice(0, 12000)}\n\`\`\`\n\n`;
  if (stderr) markdown += `**stderr**\n\n\`\`\`text\n${codeBlock(stderr).slice(0, 12000)}\n\`\`\`\n\n`;
  markdown += '</details>\n\n';
  return markdown;
}

function renderDescription(testCase) {
  if (!testCase.desc) return '';
  return `${markdownText(testCase.desc)}\n\n`;
}

function renderParams(testCase) {
  if (testCase.params === undefined || testCase.params === null || testCase.params === '') return '';
  const params = typeof testCase.params === 'string' ? testCase.params : JSON.stringify(testCase.params, null, 2);
  return `<details><summary>Parameters</summary>\n\n\`\`\`json\n${codeBlock(params).slice(0, 8000)}\n\`\`\`\n\n</details>\n\n`;
}

function renderFailure(testCase, workspace) {
  let markdown = `### ❌ ${markdownText(testCase.name || 'Unnamed test')}\n\n`;
  const meta = [];
  const location = formatLocation(testCase, workspace);
  if (location) meta.push(`\`${markdownText(location)}\``);
  if (testCase.suite) meta.push(markdownText(testCase.suite));
  const duration = formatDuration(testCase.duration);
  if (duration) meta.push(duration);
  const retry = retrySummary(testCase);
  if (retry) meta.push(retry);
  if (meta.length) markdown += `${meta.join(' · ')}\n\n`;

  markdown += renderDescription(testCase);

  const error = errorObject(testCase);
  if (error.message) markdown += `**Failure**\n\n${codeBlock(error.message)}\n\n`;
  if (error.stack && error.stack !== error.message) {
    markdown += `<details><summary>Full error details</summary>\n\n\`\`\`text\n${codeBlock(error.stack).slice(0, 12000)}\n\`\`\`\n\n</details>\n\n`;
  }

  const steps = renderSteps(testCase.steps);
  if (steps) markdown += `<details><summary>Test steps</summary>\n\n${steps}\n</details>\n\n`;
  markdown += renderLogs(testCase);
  markdown += renderAttachments(testCase);
  markdown += renderParams(testCase);
  return markdown;
}

function renderTestsTable(cases) {
  let markdown = '<details><summary>View test details</summary>\n\n';
  markdown += '| Test | Suite | Result | Duration |\n';
  markdown += '| --- | --- | :---: | ---: |\n';
  for (const testCase of cases.slice(0, 200)) {
    markdown += `| ${markdownText(testCase.name || 'Unnamed test')} | ${markdownText(testCase.suite || '')} | ${statusIcon(testCase.result)} ${markdownText(testCase.result || 'unknown')} | ${formatDuration(testCase.duration)} |\n`;
  }
  if (cases.length > 200) markdown += `\n_Only the first 200 of ${cases.length} tests are shown._\n`;
  markdown += '\n</details>\n\n';
  return markdown;
}

function renderFooter() {
  return `---\n\n**Need history and intelligence across runs?**  \n[Tesults](${TESULTS_URL}) adds automated regression detection, flaky-test analysis, AI failure intelligence, release tracking, notifications, and consolidated results across your test systems.\n`;
}

function renderSummary(data, workspace = process.env.GITHUB_WORKSPACE) {
  const cases = testCasesFrom(data);
  const counts = resultCounts(data);
  const framework = frameworkName(data);
  const overall = counts.failed > 0 ? 'fail' : counts.other > 0 ? 'other' : 'pass';

  let markdown = `# ${statusIcon(overall)} ${markdownText(framework)} Test Results\n\n`;
  markdown += `**${counts.total} ${counts.total === 1 ? 'test' : 'tests'}** · ✅ ${counts.passed} passed · ❌ ${counts.failed} failed`;
  if (counts.other > 0) markdown += ` · ⚠️ ${counts.other} other`;
  markdown += '\n\n';

  const failed = cases.filter((testCase) => testCase.result === 'fail');
  if (failed.length > 0) {
    markdown += '## Failures\n\n';
    for (const testCase of failed.slice(0, 50)) markdown += renderFailure(testCase, workspace);
    if (failed.length > 50) markdown += `_Only the first 50 of ${failed.length} failures are shown._\n\n`;
    const nonFailed = cases.filter((testCase) => testCase.result !== 'fail');
    if (nonFailed.length > 0) markdown += renderTestsTable(cases);
  } else if (cases.length > 0) {
    markdown += counts.other === 0 ? 'All tests passed.\n\n' : 'No failed tests were reported.\n\n';
    markdown += renderTestsTable(cases);
  } else {
    markdown += 'No test cases were reported.\n\n';
  }

  markdown += renderFooter();
  return markdown;
}

function annotations(data, workspace, max = 10) {
  const failed = testCasesFrom(data).filter((testCase) => testCase.result === 'fail');
  return failed.slice(0, max).map((testCase) => ({
    title: testCase.name || 'Test failed',
    message: conciseReason(testCase) || 'Test failed',
    location: parseLocation(testCase, workspace)
  }));
}

module.exports = {
  TESULTS_URL,
  annotations,
  casesFrom,
  conciseReason,
  formatDuration,
  outputText,
  reasonText,
  renderSummary,
  resultCounts,
  stripAnsi,
  testCasesFrom
};
