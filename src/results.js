const fs = require('fs');
const path = require('path');
const { version: INTEGRATION_VERSION } = require('../package.json');

const MAX_RESULT_FILES = 100;
const MAX_RESULT_BYTES = 50 * 1024 * 1024;
const MAX_TOTAL_RESULT_BYTES = 200 * 1024 * 1024;
const SKIP_DIRECTORIES = new Set(['.git', '.gradle', '.idea', 'node_modules']);

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative);
}

function patternFrom(root, value) {
  let pattern = String(value || '').trim();
  if (!pattern) return undefined;

  if (path.isAbsolute(pattern)) {
    const relative = path.relative(root, pattern);
    if (!isInside(root, pattern)) return undefined;
    pattern = relative;
  }

  return pattern.replace(/\\/g, '/').replace(/^\.\//, '');
}

function jsonFilesBelow(directory, files) {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory() && !entry.isSymbolicLink()) {
      if (!SKIP_DIRECTORIES.has(entry.name)) jsonFilesBelow(candidate, files);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      files.push(candidate);
    }
  }
}

function findTesultsResultFiles(root, input) {
  if (!root || !fs.existsSync(root)) return [];

  const patterns = String(input || '')
    .split(/\r?\n/)
    .map((value) => patternFrom(root, value))
    .filter(Boolean)
    .map((pattern) => {
      const candidate = path.join(root, ...pattern.split('/'));
      try {
        if (fs.statSync(candidate).isDirectory()) {
          return `${pattern.replace(/\/$/, '')}/**/*.json`;
        }
      } catch {
        // A glob normally does not exist as a literal path.
      }
      return pattern;
    });

  if (!patterns.length) return [];

  const candidates = [];
  jsonFilesBelow(root, candidates);
  return [...new Set(candidates.filter((file) => {
    const relative = path.relative(root, file).split(path.sep).join('/');
    return patterns.some((pattern) => path.posix.matchesGlob(relative, pattern));
  }))].sort();
}

function configuredTesultsData(root, input) {
  const files = findTesultsResultFiles(root, input);
  if (!files.length) return undefined;
  if (files.length > MAX_RESULT_FILES) {
    throw new Error(`More than ${MAX_RESULT_FILES} Tesults results files matched.`);
  }

  const cases = [];
  const frameworks = new Set();
  let totalBytes = 0;
  for (const file of files) {
    const relative = path.relative(root, file) || path.basename(file);
    const stats = fs.statSync(file);
    if (stats.size > MAX_RESULT_BYTES) {
      throw new Error(`Tesults results file is larger than 50 MB: ${relative}`);
    }
    totalBytes += stats.size;
    if (totalBytes > MAX_TOTAL_RESULT_BYTES) {
      throw new Error('Tesults results files are larger than 200 MB in total.');
    }

    let data;
    try {
      data = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      throw new Error(`Unable to parse Tesults results file ${relative}: ${error.message}`);
    }
    if (!data || !data.results || !Array.isArray(data.results.cases)) {
      throw new Error(`Tesults results file is invalid: ${relative}`);
    }

    cases.push(...data.results.cases);
    if (data.metadata && data.metadata.test_framework) {
      frameworks.add(String(data.metadata.test_framework));
    }
  }

  return {
    target: '',
    results: { cases },
    metadata: {
      integration_name: 'test-automation-reporting',
      integration_version: INTEGRATION_VERSION,
      test_framework: frameworks.size === 1 ? [...frameworks][0] : 'tesults-json'
    }
  };
}

module.exports = {
  configuredTesultsData,
  findTesultsResultFiles,
  isInside
};
