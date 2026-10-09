const fs = require('fs');
const path = require('path');

const SKIP_DIRECTORIES = new Set(['.git', '.gradle', '.idea', 'node_modules']);
const MAX_XML_BYTES = 20 * 1024 * 1024;

function decodeXml(value) {
  return String(value || '').replace(
    /&(?:#(\d+)|#x([0-9a-f]+)|amp|lt|gt|quot|apos);/gi,
    (entity, decimal, hexadecimal) => {
      if (decimal) return String.fromCodePoint(Number.parseInt(decimal, 10));
      if (hexadecimal) return String.fromCodePoint(Number.parseInt(hexadecimal, 16));
      return {
        '&amp;': '&',
        '&lt;': '<',
        '&gt;': '>',
        '&quot;': '"',
        '&apos;': "'"
      }[entity.toLowerCase()] || entity;
    }
  );
}

function attributesFrom(value) {
  const attributes = {};
  const expression = /([:\w.-]+)\s*=\s*(["'])([\s\S]*?)\2/g;
  let match;
  while ((match = expression.exec(value)) !== null) {
    attributes[match[1]] = decodeXml(match[3]);
  }
  return attributes;
}

function textFromXml(value) {
  let text = '';
  const expression = /<!\[CDATA\[([\s\S]*?)\]\]>|<[^>]+>|([^<]+)/g;
  let match;
  while ((match = expression.exec(String(value || ''))) !== null) {
    if (match[1] !== undefined) text += match[1];
    else if (match[2] !== undefined) text += decodeXml(match[2]);
  }
  return text.replace(/\r/g, '').trim();
}

function childFrom(body, name) {
  const expression = new RegExp(
    `<${name}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${name}\\s*>)`,
    'i'
  );
  const match = expression.exec(body);
  if (!match) return undefined;
  return {
    attributes: attributesFrom(match[1]),
    text: textFromXml(match[2])
  };
}

function failureReason(element) {
  if (!element) return '';
  const message = String(element.attributes.message || '').trim();
  const detail = String(element.text || '').trim();
  if (!message) return detail;
  if (!detail || detail === message) return message;
  return `${message}\n${detail}`;
}

function casesFromSuite(body, suiteName) {
  const cases = [];
  const expression = /<testcase\b([^>]*?)(?:\/\s*>|>([\s\S]*?)<\/testcase\s*>)/gi;
  let match;

  while ((match = expression.exec(body)) !== null) {
    const attributes = attributesFrom(match[1]);
    const caseBody = match[2] || '';
    const failure = childFrom(caseBody, 'failure') || childFrom(caseBody, 'error');
    const skipped = childFrom(caseBody, 'skipped');
    const durationSeconds = Number(attributes.time);
    const testCase = {
      suite: attributes.classname || suiteName || 'Espresso',
      name: attributes.name || 'Unnamed test',
      result: failure ? 'fail' : skipped ? 'unknown' : 'pass'
    };

    if (Number.isFinite(durationSeconds) && durationSeconds >= 0) {
      testCase.duration = Math.round(durationSeconds * 1000);
    }

    const reason = failureReason(failure || skipped);
    if (reason) testCase.reason = reason;

    const standardOutput = childFrom(caseBody, 'system-out');
    const standardError = childFrom(caseBody, 'system-err');
    if (standardOutput && standardOutput.text) testCase['_Standard output'] = standardOutput.text;
    if (standardError && standardError.text) testCase['_Standard error'] = standardError.text;

    cases.push(testCase);
  }

  return cases;
}

function parseJUnitXml(xml) {
  const cases = [];
  const expression = /<testsuite\b([^>]*?)>([\s\S]*?)<\/testsuite\s*>/gi;
  let match;

  while ((match = expression.exec(String(xml || ''))) !== null) {
    const attributes = attributesFrom(match[1]);
    cases.push(...casesFromSuite(match[2], attributes.name));
  }

  if (cases.length === 0) {
    cases.push(...casesFromSuite(String(xml || ''), 'Espresso'));
  }

  return cases;
}

function xmlFilesBelow(directory, files) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      xmlFilesBelow(candidate, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      files.push(candidate);
    }
  }
}

function findAndroidJUnitFiles(workspace, startedAt) {
  const files = [];
  const earliestMtime = Number(startedAt);

  function visit(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink() || SKIP_DIRECTORIES.has(entry.name)) continue;
      const candidate = path.join(directory, entry.name);

      if (entry.name === 'build') {
        const resultDirectory = path.join(candidate, 'outputs', 'androidTest-results');
        if (fs.existsSync(resultDirectory)) xmlFilesBelow(resultDirectory, files);
        continue;
      }

      visit(candidate);
    }
  }

  if (workspace && fs.existsSync(workspace)) visit(workspace);

  return files.filter((file) => {
    if (!Number.isFinite(earliestMtime)) return true;
    try {
      return fs.statSync(file).mtimeMs >= earliestMtime - 2000;
    } catch {
      return false;
    }
  }).sort();
}

function androidJUnitData(workspace, startedAt) {
  const files = findAndroidJUnitFiles(workspace, startedAt);
  const cases = [];

  for (const file of files) {
    let stats;
    try {
      stats = fs.statSync(file);
    } catch {
      continue;
    }
    if (stats.size > MAX_XML_BYTES) continue;

    try {
      cases.push(...parseJUnitXml(fs.readFileSync(file, 'utf8')));
    } catch {
      // Ignore an individual malformed file so other device and module results
      // can still be reported.
    }
  }

  if (cases.length === 0) return undefined;
  return {
    target: '',
    results: { cases },
    metadata: {
      integration_name: 'test-automation-reporting',
      integration_version: '1.1.0',
      test_framework: 'espresso'
    }
  };
}

module.exports = {
  androidJUnitData,
  findAndroidJUnitFiles,
  parseJUnitXml
};
