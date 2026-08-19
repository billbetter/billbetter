const fs = require('fs');
const path = require('path');
const names = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir)) {
    const p = path.join(dir, e);
    if (fs.statSync(p).isDirectory()) walk(p);
    else if (/\.(jsx?|tsx?)$/.test(p)) {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(/sdk\.functions\.invoke\s*\(\s*['"]([^'"]+)['"]/g);
      if (m) m.forEach(x => {
        const name = x.match(/invoke\s*\(\s*['"]([^'"]+)['"]/)[1];
        names.add(name);
      });
    }
  }
}
walk('src');
console.log(Array.from(names).sort().join('\n'));
