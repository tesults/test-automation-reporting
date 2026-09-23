const path = require('path');

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

function markdownText(value) {
  return String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function codeBlock(value) {
  return String(value ?? '').replace(/```/g, '``\\`');
}

function reasonText(testCase) {
  if (testCase.reason === undefined || testCase.reason === null) {
    return '';
  }

  if (typeof testCase.reason === 'object') {
    return testCase.reason.stack || testCase.reason.message || JSON.stringify(testCase.reason, null, 2);
  }

  const raw = String(testCase.reason);
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed.stack || parsed.message || raw;
    }
  } catch {
    // The reason is already plain text.
  }
  return raw;
}

function retryCount(testCase) {
  return Array.isArray(testCase._Retries) ? testCase._Retries.length : 0;
}

function renderSteps(steps, depth = 0) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return '';
  }

  let markdown = '';
  for (const step of steps) {
    const indent = '  '.repeat(depth);
    const marker = step.result === 'fail' ? '[FAIL]' : step.result === 'pass' ? '[PASS]' : '-';
    markdown += `${indent}- ${marker} ${markdownText(step.name || 'Step')}\n`;
    markdown += renderSteps(step.steps, depth + 1);
  }
  return markdown;
}

function renderSummary(data) {
  const cases = testCasesFrom(data);
  const counts = resultCounts(data);
  const framework = data.metadata && data.metadata.test_framework
    ? String(data.metadata.test_framework)
    : undefined;

  let markdown = '# Test Automation Reporting by Tesults\n\n';
  if (framework) {
    markdown += `**Framework:** ${markdownText(framework)}\n\n`;
  }

  markdown += '| Total | Passed | Failed | Other |\n';
  markdown += '| ---: | ---: | ---: | ---: |\n';
  markdown += `| ${counts.total} | ${counts.passed} | ${counts.failed} | ${counts.other} |\n\n`;

  const failed = cases.filter((testCase) => testCase.result === 'fail');
  if (failed.length > 0) {
    markdown += '## Failures\n\n';
    for (const testCase of failed.slice(0, 50)) {
      markdown += `### ${markdownText(testCase.name || 'Unnamed test')}\n\n`;
      if (testCase.suite) {
        markdown += `**Suite:** ${markdownText(testCase.suite)}  \n`;
      }
      if (testCase.duration !== undefined) {
        markdown += `**Duration:** ${testCase.duration} ms  \n`;
      }
      const retries = retryCount(testCase);
      if (retries > 0) {
        markdown += `**Previous attempts:** ${retries}  \n`;
      }
      if (Array.isArray(testCase.files) && testCase.files.length > 0) {
        markdown += `**Attachments:** ${testCase.files.length}  \n`;
      }
      markdown += '\n';

      const reason = reasonText(testCase);
      if (reason) {
        markdown += `\`\`\`text\n${codeBlock(reason).slice(0, 8000)}\n\`\`\`\n\n`;
      }

      const steps = renderSteps(testCase.steps);
      if (steps) {
        markdown += '**Steps**\n\n';
        markdown += steps + '\n';
      }
    }

    if (failed.length > 50) {
      markdown += `_Only the first 50 of ${failed.length} failures are shown._\n\n`;
    }
  } else if (cases.length > 0) {
    markdown += '## Tests\n\n';
    markdown += '<details><summary>Show test results</summary>\n\n';
    markdown += '| Test | Suite | Result | Duration |\n';
    markdown += '| --- | --- | --- | ---: |\n';
    for (const testCase of cases.slice(0, 200)) {
      const duration = testCase.duration === undefined ? '' : `${testCase.duration} ms`;
      markdown += `| ${markdownText(testCase.name || 'Unnamed test')} | ${markdownText(testCase.suite || '')} | ${markdownText(testCase.result || 'unknown')} | ${duration} |\n`;
    }
    markdown += '\n</details>\n';
  }

  return markdown;
}

function parseLocation(testCase, workspace) {
  const raw = testCase && testCase._Location;
  if (!raw) {
    return undefined;
  }

  let location = raw;
  if (typeof raw === 'string') {
    try {
      location = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }

  if (!location || typeof location !== 'object' || !location.file) {
    return undefined;
  }

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

function annotations(data, workspace, max = 10) {
  const failed = testCasesFrom(data).filter((testCase) => testCase.result === 'fail');
  return failed.slice(0, max).map((testCase) => ({
    title: testCase.name || 'Test failed',
    message: reasonText(testCase) || 'Test failed',
    location: parseLocation(testCase, workspace)
  }));
}

module.exports = {
  annotations,
  casesFrom,
  reasonText,
  renderSummary,
  resultCounts,
  testCasesFrom
};
