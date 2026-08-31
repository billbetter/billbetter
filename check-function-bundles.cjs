/**
 * Flatten every Edge Function the way it is deployed, and refuse a bundle that
 * would not boot.
 *
 * -- Why this exists --------------------------------------------------------
 *
 * scripts/deploy-functions.py does not bundle. It textually inlines each
 * `../_shared/*.ts` import into ONE file and POSTs that. Everything therefore
 * lands in a single top-level scope, so two files declaring the same name is a
 * duplicate declaration: a SyntaxError, a BOOT_ERROR at runtime, and -- this is
 * the part that hurts -- a deploy that still prints `Done.` The upload
 * succeeded. Only the first real request finds out, as a 500.
 *
 * That is not hypothetical. It nearly shipped twice in one afternoon, both
 * times from the same innocent move: adding a helper to a function while the
 * same helper was being added to _shared/stripe.ts.
 *
 * -- What it checks, and why it checks it this way --------------------------
 *
 * The gate is esbuild PARSING the flattened source, not a scan for repeated
 * names. Measured, because it matters which one is right:
 *
 *     duplicate const      -> esbuild errors   (a real SyntaxError)
 *     duplicate function   -> esbuild errors   (a real SyntaxError)
 *     duplicate interface  -> esbuild allows   (TS declaration merging, legal)
 *     duplicate type       -> esbuild allows   (a type error, not a boot error)
 *
 * A name scan would have failed the last two and been wrong both times. So
 * parsing decides, and the name scan runs only to say WHICH symbol collided --
 * esbuild's own message points at a line number in a 600-line flattened file
 * that exists nowhere on disk, which is not much help on its own.
 *
 * An unresolved `_shared` import is the second failure. The flattener leaves a
 * line it cannot match exactly as it found it, so the bundle uploads carrying
 * a specifier no runtime can resolve. Same symptom: a clean deploy, a dead
 * function.
 *
 * Usage: node check-function-bundles.cjs   (also runs as part of `npm run check`)
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

// The same flattener the edge-function test suites use, which is itself the
// mirror of deploy-functions.py. One copy, so it cannot drift into passing
// against a bundle nobody deploys.
const { inlineShared } = require("./scripts/_inline-shared.cjs");

const FUNCTIONS_DIR = path.resolve("supabase", "functions");
const SHARED_DIR = path.join(FUNCTIONS_DIR, "_shared");

// `var` is deliberately absent: redeclaring it is legal and harmless.
// `interface` and `type` are absent because merging is legal TypeScript.
const DECL_RE =
  /^(?:export\s+)?(?:const|let|function|class)\s+([A-Za-z_$][\w$]*)/gm;

function duplicateNames(source) {
  const seen = new Map();
  for (const m of source.matchAll(DECL_RE)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
}

const failures = [];
let checked = 0;

const entries = fs
  .readdirSync(FUNCTIONS_DIR)
  .filter((d) => d !== "_shared")
  .map((d) => [d, path.join(FUNCTIONS_DIR, d, "index.ts")])
  .filter(([, p]) => fs.existsSync(p));

for (const [slug, entry] of entries) {
  checked++;
  const flat = inlineShared(fs.readFileSync(entry, "utf8"), SHARED_DIR);

  const unresolved = flat
    .split("\n")
    .filter((l) => /^import\s.*_shared/.test(l))
    .map((l) => l.trim());
  if (unresolved.length) {
    failures.push(
      `${slug}: ${unresolved.length} _shared import(s) the flattener could not ` +
        `inline, which would upload as-is:\n      ${unresolved.join("\n      ")}`,
    );
  }

  try {
    esbuild.transformSync(flat, {
      loader: "ts",
      format: "esm",
      target: "es2022",
    });
  } catch (err) {
    const dupes = duplicateNames(flat);
    const why = dupes.length
      ? `declared more than once after inlining: ${dupes.join(", ")}`
      : "see the parse error below";
    const detail = (err.errors || [])
      .map((e) => `      ${e.text}`)
      .join("\n") || `      ${err.message.split("\n")[0]}`;
    failures.push(`${slug}: flattened bundle does not parse -- ${why}\n${detail}`);
  }
}

// A check that always exits 0 is not a guard.
if (failures.length) {
  console.error(
    `${failures.length} function bundle(s) would deploy successfully and then fail to boot:\n`,
  );
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error(
    "\nEach of these uploads fine and reports Done. The failure only appears " +
      "on the first request, as a 500.",
  );
  process.exit(1);
}

console.log(
  `Function bundle check passed: ${checked} functions flatten, parse, and ` +
    `resolve every _shared import.`,
);
