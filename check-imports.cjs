const fs = require('fs');
const path = require('path');

const srcDir = path.resolve('src');

function resolveImport(source, fromFile) {
  if (source.startsWith('@/')) {
    return path.join(srcDir, source.slice(2));
  }
  if (source.startsWith('.')) {
    return path.resolve(path.dirname(fromFile), source);
  }
  return null;
}

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const importRegex = /import\s+(?:[^'"]+\s+from\s+)?['"]([^'"]+)['"];?/g;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const source = match[1];
    if (source.startsWith('@/') || source.startsWith('.')) {
      const resolved = resolveImport(source, file);
      if (!resolved) continue;
      const extensions = ['', '.js', '.jsx', '.ts', '.tsx', '.json', '.css'];
      const exists = extensions.some(ext => {
        const p = resolved + ext;
        return fs.existsSync(p) && fs.statSync(p).isFile();
      }) || fs.existsSync(resolved) && fs.statSync(resolved).isDirectory() && fs.existsSync(path.join(resolved, 'index.js'));
      if (!exists) {
        console.log(`MISSING: ${source} (imported by ${path.relative('.', file)})`);
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
console.log('Import check complete.');
