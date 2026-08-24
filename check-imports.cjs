const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src');
const missing = [];

function resolveImport(source, fromFile) {
  if (source.startsWith('@/')) {
    return path.join(srcDir, source.slice(2));
  }
  if (source.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), source);
  }
  return null;
}

/**
 * Strip comments so an `import` inside a docblock EXAMPLE is not reported as a
 * real one. pages.config.js documents its own format with a worked example
 * containing `import HomePage from './pages/HomePage';` -- that file does not
 * exist and is not supposed to.
 */
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function checkFile(file) {
  const content = stripComments(fs.readFileSync(file, 'utf8'));
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"];?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const source = match[1];
    if (source.startsWith('@/') || source.startsWith('.')) {
      const resolved = resolveImport(source, file);
      if (!resolved) continue;
      const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '.css'];
      const isFile = (p) => fs.existsSync(p) && fs.statSync(p).isFile();
      // A directory import resolves via its index file, which in this repo is
      // .ts (src/utils) or .jsx (src/components/marketing) as often as .js.
      // Only checking index.js made both look missing -- 39 false positives,
      // which is how this check came to be ignored.
      const isDirWithIndex =
        fs.existsSync(resolved) &&
        fs.statSync(resolved).isDirectory() &&
        extensions.some((ext) => ext && isFile(path.join(resolved, 'index' + ext)));
      if (!extensions.some((ext) => isFile(resolved + ext)) && !isDirWithIndex) {
        missing.push(`${source} (imported by ${path.relative('.', file)})`);
      }
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (/\.(jsx?|tsx?)$/.test(full)) {
      checkFile(full);
    }
  }
}

walk(srcDir);

// A check that always exits 0 is not a guard. This one printed MISSING lines
// for months and no caller could tell.
if (missing.length) {
  console.error(`${missing.length} unresolved import(s):
`);
  for (const m of missing) console.error(`  MISSING  ${m}`);
  process.exit(1);
}
console.log('Import check passed: every relative and @/ import resolves.');
