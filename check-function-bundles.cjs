/**
 * Flatten every Edge Function the way it is deployed, and refuse a bundle that
 * would fail once it is live.
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
 * THREE gates, in the order a broken deploy tends to fail.
 *
 * 1. PARSE. esbuild parsing the flattened source, not a scan for repeated
 *    names. Measured, because it matters which one is right:
 *
 *        duplicate const      -> esbuild errors   (a real SyntaxError)
 *        duplicate function   -> esbuild errors   (a real SyntaxError)
 *        duplicate interface  -> esbuild allows   (TS declaration merging, legal)
 *        duplicate type       -> esbuild allows   (a type error, not a boot error)
 *
 *    A name scan would have failed the last two and been wrong both times. So
 *    parsing decides, and the name scan runs only to say WHICH symbol collided
 *    -- esbuild's own message points at a line number in a 600-line flattened
 *    file that exists nowhere on disk, which is not much help on its own.
 *
 * 2. UNRESOLVED _shared IMPORT. The flattener leaves a line it cannot match
 *    exactly as it found it, so the bundle uploads carrying a specifier no
 *    runtime can resolve. Same symptom: a clean deploy, a dead function.
 *
 * 3. UNDEFINED IDENTIFIER. Added after a real miss on 2026-09-07: an edge
 *    function called `loadOwnedForSend()` without importing it. Gates 1 and 2
 *    both passed -- the source parses perfectly and there was no _shared import
 *    line to leave unresolved, because the import was never written. The
 *    function deployed, printed Done, and threw a ReferenceError on the first
 *    live request.
 *
 *    Parsing cannot catch that; only something that resolves names can. So the
 *    flattened source is type-erased with esbuild (which is exactly what the
 *    runtime sees) and run through eslint's `no-undef` against the Deno global
 *    set. Anything referenced but neither declared in the flattened scope nor
 *    imported from a remote specifier nor a runtime global is a ReferenceError
 *    waiting for its first caller.
 *
 *    Deliberately NOT `deno check`: it is the more thorough tool, but it needs
 *    a Deno binary nobody here installs and it would try to fetch every remote
 *    import over the network. This gate uses only esbuild and eslint, both
 *    already devDependencies, so `npm run check` keeps working offline on a
 *    clean clone. It catches the missing-import class, which is the one that
 *    has actually bitten. It does not replace real type checking.
 *
 * Usage: node check-function-bundles.cjs   (also runs as part of `npm run check`)
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");
const { Linter } = require("eslint");
const globals = require("globals");

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

/**
 * What actually exists at runtime in a Supabase Edge Function.
 *
 * Deliberately NOT `globals.browser`: that set includes `name`, `status`,
 * `location`, `event`, `origin` and friends, so forgetting to import a helper
 * called any of those would be silently waved through. This list is the Deno
 * runtime surface these functions really touch, and nothing else -- a name
 * missing from it fails loudly and gets added on purpose.
 */
const RUNTIME_GLOBALS = {
  ...globals.es2022,
  Deno: "readonly",
  EdgeRuntime: "readonly",
  fetch: "readonly",
  Request: "readonly",
  Response: "readonly",
  Headers: "readonly",
  FormData: "readonly",
  Blob: "readonly",
  File: "readonly",
  URL: "readonly",
  URLSearchParams: "readonly",
  ReadableStream: "readonly",
  WritableStream: "readonly",
  TransformStream: "readonly",
  AbortController: "readonly",
  AbortSignal: "readonly",
  TextEncoder: "readonly",
  TextDecoder: "readonly",
  crypto: "readonly",
  btoa: "readonly",
  atob: "readonly",
  console: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
  setInterval: "readonly",
  clearInterval: "readonly",
  queueMicrotask: "readonly",
  structuredClone: "readonly",
  performance: "readonly",
  EventTarget: "readonly",
  Event: "readonly",
  CustomEvent: "readonly",
  addEventListener: "readonly",
  removeEventListener: "readonly",
  caches: "readonly",
  navigator: "readonly",
  globalThis: "readonly",
  DOMException: "readonly",
};

const linter = new Linter();

function duplicateNames(source) {
  const seen = new Map();
  for (const m of source.matchAll(DECL_RE)) {
    seen.set(m[1], (seen.get(m[1]) || 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([name]) => name);
}

/**
 * Names referenced by the flattened bundle that nothing defines.
 *
 * Runs on the type-erased output rather than the TypeScript source, so a name
 * used only in a type position is not reported -- those are erased before the
 * runtime ever sees them, exactly as they are here.
 */
function undefinedNames(flat) {
  let erased;
  try {
    erased = esbuild.transformSync(flat, {
      loader: "ts",
      format: "esm",
      target: "es2022",
    }).code;
  } catch {
    return []; // gate 1 already reported this; do not report it twice
  }

  const messages = linter.verify(erased, {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: RUNTIME_GLOBALS,
    },
    rules: { "no-undef": "error" },
  });

  // One entry per distinct name, with how many call sites reference it.
  const counts = new Map();
  for (const m of messages) {
    const name = /'([^']+)'/.exec(m.message)?.[1];
    if (name) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()].map(([name, n]) => ({ name, count: n }));
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

  let parsed = true;
  try {
    esbuild.transformSync(flat, {
      loader: "ts",
      format: "esm",
      target: "es2022",
    });
  } catch (err) {
    parsed = false;
    const dupes = duplicateNames(flat);
    const why = dupes.length
      ? `declared more than once after inlining: ${dupes.join(", ")}`
      : "see the parse error below";
    const detail = (err.errors || [])
      .map((e) => `      ${e.text}`)
      .join("\n") || `      ${err.message.split("\n")[0]}`;
    failures.push(`${slug}: flattened bundle does not parse -- ${why}\n${detail}`);
  }

  if (parsed) {
    const undef = undefinedNames(flat);
    if (undef.length) {
      const detail = undef
        .map(
          ({ name, count }) =>
            `      ${name}  (referenced ${count}x, defined nowhere in the bundle)`,
        )
        .join("\n");
      failures.push(
        `${slug}: uses ${undef.length} name(s) nothing defines -- a missing ` +
          `import, or a helper that was renamed on one side only:\n${detail}`,
      );
    }
  }
}

// A check that always exits 0 is not a guard.
if (failures.length) {
  console.error(
    `${failures.length} function bundle(s) would deploy successfully and then fail:\n`,
  );
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error(
    "\nEach of these uploads fine and reports Done. The failure only appears " +
      "on a real request, as a 500.",
  );
  process.exit(1);
}

console.log(
  `Function bundle check passed: ${checked} functions flatten, parse, resolve ` +
    `every _shared import, and reference no undefined name.`,
);
