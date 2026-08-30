/**
 * Prove localDataEngine strips unknown columns, warns about it, and does not
 * strip anything real.
 *
 * -- Why this is worth a test -------------------------------------------
 *
 * PostgREST rejects an ENTIRE insert or patch for one unknown key. That is how
 * typing in the booking-URL field broke saving for every other setting on the
 * Settings page: one stray key in `{ ...formData }` and the whole PATCH 400s
 * with `42703 column BusinessSettings.booking_slug does not exist`.
 *
 * The strip has to satisfy two things that pull against each other:
 *   - it must drop unknown keys, or the save fails
 *   - it must NOT drop silently, or a typo'd column name becomes a setting that
 *     never saves and never complains -- the same bug, quieter
 *
 * So this asserts both: the key is gone AND it was named in a console.error.
 *
 * The module is bundled with esbuild rather than imported directly, because it
 * reaches for `import.meta.env` and a browser supabase client that cannot exist
 * in bare Node.
 *
 * Usage: node scripts/test-strip-unknown-columns.cjs
 */
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.dirname(__dirname);

const results = [];
function check(label, cond, detail = "") {
  results.push(Boolean(cond));
  console.log(
    `  ${cond ? "PASS" : "FAIL"}  ${label}${!cond && detail ? " -- " + detail : ""}`,
  );
}

async function main() {
  // Bundle only what we need: the generated column map plus a copy of the
  // stripper lifted from the real module by evaluating that module with its
  // browser-only dependencies stubbed.
  const built = await esbuild.build({
    stdin: {
      contents: `
        import { ENTITY_COLUMNS } from "./src/api/entityColumns.js";
        export { ENTITY_COLUMNS };
      `,
      resolveDir: ROOT,
      loader: "js",
    },
    bundle: true,
    write: false,
    format: "cjs",
    platform: "node",
  });
  // Wrapped in a module factory: eval'ing the bundle at this scope would
  // redeclare the same const the bundle itself declares.
  const loadBundle = new Function(
    "module",
    "exports",
    built.outputFiles[0].text + ";\nreturn module.exports;",
  );
  const mod = { exports: {} };
  const { ENTITY_COLUMNS } = loadBundle(mod, mod.exports);

  // The function under test, read from the real source so it cannot drift.
  const fs = require("fs");
  const src = fs.readFileSync(
    path.join(ROOT, "src", "api", "localDataEngine.js"),
    "utf8",
  );
  const m = src.match(
    /function stripUnknownColumns\(entityName, payload\) \{[\s\S]*?\n\}/,
  );
  if (!m) {
    console.log("  FAIL  could not find stripUnknownColumns in localDataEngine.js");
    process.exit(1);
  }

  const warnings = [];
  const sandboxConsole = { error: (msg) => warnings.push(String(msg)) };
  // `import.meta.env.DEV` is Vite-only syntax; swap it for a plain flag so the
  // same source runs here.
  const fnSource = m[0].replace(/import\.meta\.env\.DEV/g, "IS_DEV");
   
  const stripUnknownColumns = new Function(
    "ENTITY_COLUMNS",
    "console",
    "IS_DEV",
    `${fnSource}; return stripUnknownColumns;`,
  )(ENTITY_COLUMNS, sandboxConsole, true);

  console.log("stripUnknownColumns, against the generated schema:\n");

  check(
    "the generated map knows BusinessSettings",
    Array.isArray(ENTITY_COLUMNS.BusinessSettings),
    String(Object.keys(ENTITY_COLUMNS).length) + " tables",
  );
  check(
    "booking_slug really is absent from the schema",
    !ENTITY_COLUMNS.BusinessSettings.includes("booking_slug"),
  );

  // The exact shape that broke the Settings page.
  const payload = {
    business_name: "Northline Electric",
    phone: "+1 416 555 0134",
    currency: "CAD",
    booking_slug: "northline", // not a column
    available_hours: { mon: {} }, // not a column
    totally_made_up: 1, // not a column
  };
  const out = stripUnknownColumns("BusinessSettings", payload);

  check("real columns survive", out.business_name === "Northline Electric" &&
    out.phone === "+1 416 555 0134" && out.currency === "CAD", JSON.stringify(out));
  check("booking_slug is dropped", !("booking_slug" in out));
  check("available_hours is dropped", !("available_hours" in out));
  check("totally_made_up is dropped", !("totally_made_up" in out));
  check("nothing else was invented", Object.keys(out).length === 3, JSON.stringify(out));

  const warned = warnings.join("\n");
  check("it warned rather than stripping silently", warnings.length === 1, warned);
  for (const key of ["booking_slug", "available_hours", "totally_made_up"]) {
    check(`the warning names ${key}`, warned.includes(key), warned);
  }
  check("the warning says the values were not saved", /NOT saved/i.test(warned), warned);

  // A clean payload must not warn at all -- a stripper that cries wolf on every
  // save teaches people to ignore it.
  warnings.length = 0;
  const clean = stripUnknownColumns("BusinessSettings", {
    business_name: "X",
    currency: "CAD",
  });
  check("a clean payload passes through untouched",
    Object.keys(clean).length === 2 && warnings.length === 0, JSON.stringify(warnings));

  // An unknown TABLE must pass through rather than being emptied -- otherwise a
  // stale generated file would silently discard real data.
  const unknownTable = stripUnknownColumns("NotATable", { anything: 1 });
  check("an unlisted table is left alone", unknownTable.anything === 1);

  // --- listSelect: the narrow half of the pdf_url fix -------------------
  const lm = src.match(/function listSelect\(entityName, filters\) \{[\s\S]*?\n\}/);
  if (!lm) {
    check("listSelect found in localDataEngine.js", false);
  } else {
    const listSelect = new Function(
      "ENTITY_COLUMNS",
      "LIST_EXCLUDED_COLUMNS",
      `${lm[0]}; return listSelect;`,
    )(ENTITY_COLUMNS, { Invoice: ["pdf_url"], Quote: ["pdf_url"] });

    console.log("\nlistSelect, the narrow pdf_url fix:\n");
    const invList = listSelect("Invoice", undefined);
    check("a list query does NOT ask for pdf_url", !invList.split(",").includes("pdf_url"));
    check("it still asks for the columns the list renders",
      ["invoice_number", "client_name", "total", "status", "public_token"]
        .every((c) => invList.split(",").includes(c)), invList);
    check("a quote list also drops pdf_url",
      !listSelect("Quote", undefined).split(",").includes("pdf_url"));
    // Fetching ONE document by id must still return everything: InvoiceDetail
    // and QuoteDetail both use filter({ id }), and the send flow reads pdf_url
    // off that result to attach the PDF.
    check("filtering by id returns every column", listSelect("Invoice", { id: "x" }) === "*");
    check("an unlisted table is untouched", listSelect("Client", undefined) === "*");
  }

  const ok = results.every(Boolean);
  console.log("\n" + (ok ? "ALL PASS" : "FAILURES ABOVE"));
  process.exit(ok ? 0 : 1);
}

main();
