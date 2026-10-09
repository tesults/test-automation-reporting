const fs = require('fs');
const path = require('path');
const { version: INTEGRATION_VERSION } = require('../package.json');

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

function casesFromSuite(body, suiteName, defaultSuite) {
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
      suite: attributes.classname || suiteName || defaultSuite,
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

function parseJUnitXml(xml, defaultSuite = 'JUnit XML') {
  const cases = [];
  const expression = /<testsuite\b([^>]*?)>([\s\S]*?)<\/testsuite\s*>/gi;
  let match;

  while ((match = expression.exec(String(xml || ''))) !== null) {
    const attributes = attributesFrom(match[1]);
    cases.push(...casesFromSuite(match[2], attributes.name, defaultSuite));
  }

  if (cases.length === 0) {
    cases.push(...casesFromSuite(String(xml || ''), defaultSuite, defaultSuite));
  }

  return cases;
}

function xmlFilesBelow(directory, files, skipKnownDirectories = false) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!skipKnownDirectories || !SKIP_DIRECTORIES.has(entry.name)) {
        xmlFilesBelow(candidate, files, skipKnownDirectories);
      }
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.xml')) {
      files.push(candidate);
    }
  }
}

function recentFiles(files, startedAt) {
  const earliestMtime = Number(startedAt);
  if (!Number.isFinite(earliestMtime)) return files.sort();

  return files.filter((file) => {
    try {
      return fs.statSync(file).mtimeMs >= earliestMtime - 2000;
    } catch {
      return false;
    }
  }).sort();
}

function patternFrom(workspace, value) {
  let pattern = String(value || '').trim();
  if (!pattern) return undefined;

  if (path.isAbsolute(pattern)) {
    const relative = path.relative(workspace, pattern);
    if (relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
      return undefined;
    }
    pattern = relative;
  }

  return pattern.replace(/\\/g, '/').replace(/^\.\//, '');
}

function findConfiguredJUnitFiles(workspace, input, startedAt) {
  if (!workspace || !fs.existsSync(workspace)) return [];

  const patterns = String(input || '')
    .split(/\r?\n/)
    .map((value) => patternFrom(workspace, value))
    .filter(Boolean)
    .map((pattern) => {
      const candidate = path.join(workspace, ...pattern.split('/'));
      try {
        if (fs.statSync(candidate).isDirectory()) {
          return `${pattern.replace(/\/$/, '')}/**/*.xml`;
        }
      } catch {
        // A pattern normally does not exist as a literal path.
      }
      return pattern;
    });

  if (!patterns.length) return [];

  const candidates = [];
  xmlFilesBelow(workspace, candidates, true);
  const files = candidates.filter((file) => {
    const relative = path.relative(workspace, file).split(path.sep).join('/');
    return patterns.some((pattern) => path.posix.matchesGlob(relative, pattern));
  });

  return recentFiles([...new Set(files)], startedAt);
}

function junitDataFromFiles(files, testFramework, defaultSuite) {
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
      cases.push(...parseJUnitXml(fs.readFileSync(file, 'utf8'), defaultSuite));
    } catch {
      // Ignore an individual malformed file so other result files can still be
      // reported.
    }
  }

  if (cases.length === 0) return undefined;
  return {
    target: '',
    results: { cases },
    metadata: {
      integration_name: 'test-automation-reporting',
      integration_version: INTEGRATION_VERSION,
      test_framework: testFramework
    }
  };
}

function configuredJUnitData(workspace, input, startedAt) {
  return junitDataFromFiles(
    findConfiguredJUnitFiles(workspace, input, startedAt),
    'junit-xml',
    'JUnit XML'
  );
}

function findAndroidJUnitFiles(workspace, startedAt) {
  const files = [];

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

  return recentFiles(files, startedAt);
}

function androidJUnitData(workspace, startedAt) {
  return junitDataFromFiles(
    findAndroidJUnitFiles(workspace, startedAt),
    'espresso',
    'Espresso'
  );
}

module.exports = {
  androidJUnitData,
  configuredJUnitData,
  findAndroidJUnitFiles,
  findConfiguredJUnitFiles,
  parseJUnitXml
};
