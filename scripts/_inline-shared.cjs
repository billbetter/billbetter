/**
 * The JS mirror of scripts/deploy-functions.py's inline_shared.
 *
 * Edge functions are deployed by textually inlining their `../_shared/*.ts`
 * imports into one file and POSTing that as the body -- there is no bundler and
 * no module resolution at runtime. So a test that wants to exercise the code we
 * actually ship has to flatten it the same way.
 *
 * This lives in one file because there are now two suites doing it, and a copy
 * that drifts from deploy-functions.py is worse than no test: it passes against
 * a bundle nobody deploys. If the rules in deploy-functions.py change, they
 * change here too, once.
 *
 * Two rules, both load-bearing:
 *
 *   1. Multi-line imports are collapsed to one line FIRST. The matcher works
 *      line by line, and Prettier wraps any import whose braces exceed the
 *      print width -- so several _shared/email-*.ts files import
 *      notification-layout.ts across four lines. Without this step those
 *      imports are left untouched in the output and the flattened module fails
 *      to resolve them.
 *   2. A file already inlined is skipped, not re-inlined. Everything lands in
 *      ONE top-level scope, so a second copy is a duplicate declaration --
 *      a SyntaxError, and a BOOT_ERROR on a deploy that still prints Done.
 */
const fs = require("fs");
const path = require("path");

const IMPORT_RE = /^import\s+(?:type\s+)?\{[^}]+\}\s+from\s+['"](?:\.\.\/_shared|\.)\/([^'"]+)['"]\s*;?\s*$/;

// Mirrors _collapse_multiline_imports: same pattern, same normalisation.
const MULTILINE_IMPORT_RE = /^(import\s+(?:type\s+)?\{)([^}]*?)(\}\s+from\s+['"][^'"]+['"]\s*;?)\s*$/gm;
function collapseMultilineImports(source) {
  return source.replace(MULTILINE_IMPORT_RE, (_m, open, names, close) =>
    `${open} ${names.split(/\s+/).filter(Boolean).join(" ")} ${close}`);
}

/**
 * Flatten one edge function's source, resolving _shared imports recursively.
 *
 * @param {string} source   contents of the function's index.ts
 * @param {string} sharedDir  absolute path to supabase/functions/_shared
 */
function inlineShared(source, sharedDir, visited = new Set()) {
  return collapseMultilineImports(source).split("\n").map((line) => {
    const m = IMPORT_RE.exec(line.trim());
    if (!m) return line;
    if (visited.has(m[1])) return "";
    visited.add(m[1]);
    const p = path.join(sharedDir, m[1]);
    if (!fs.existsSync(p)) return line;
    return inlineShared(fs.readFileSync(p, "utf8"), sharedDir, visited);
  }).join("\n");
}

module.exports = { inlineShared, collapseMultilineImports };
