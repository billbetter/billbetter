/**
 * Read receipts: what the app claims about a client's behaviour.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Not money, but trust in the product, and it fails in a direction the
 * contractor cannot check:
 *
 *   Reporting an open that did not happen. The contractor rings a client to
 *   say "I can see you've read it" about a page nobody loaded. That is worse
 *   than showing nothing at all, and there is no way for them to discover the
 *   mistake before they are on the phone.
 *
 *   Reporting no open when there was one. A row can carry first_viewed_at
 *   with view_count still 0 -- the two are written by separate branches of one
 *   patch and the counter is deliberately allowed to lag -- so anything that
 *   trusts the counter alone reports "not opened" about a document it watched
 *   somebody open.
 *
 *   Inventing a second visit. last_viewed_at is bumped on every hit including
 *   debounced ones, so a single visit whose page re-rendered leaves two
 *   stamps. Calling that a return visit manufactures client interest.
 *
 *   The waited-for arithmetic in the email. Clock skew between the send and
 *   the view can make the gap negative, and "opened -2 hours after you sent
 *   it" is the kind of sentence that makes somebody stop trusting the rest of
 *   the message.
 *
 * Usage: node scripts/test-read-receipts.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

let passed = 0,
  failed = 0;
function check(label, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(
      `  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`,
    );
  }
}

/** Load an ESM module from the repo, resolving `@/` the way vite does. */
async function load(rel) {
  const plugin = {
    name: "alias",
    setup(build) {
      build.onResolve({ filter: /^@\// }, (args) => {
        const base = path.join(ROOT, "src", args.path.slice(2));
        for (const ext of ["", ".js", ".jsx"]) {
          if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
            return { path: base + ext };
          }
        }
        return { path: base };
      });
    },
  };
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [plugin],
  });
  const tmp = path.join(
    os.tmpdir(),
    `${path.basename(rel)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`,
  );
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

/**
 * The Deno template is TypeScript importing another _shared file. Strip the
 * types and stub the layout so the pure arithmetic can be exercised from node
 * without a Deno runtime.
 */
async function loadTemplate() {
  const src = path.join(
    ROOT,
    "supabase/functions/_shared/email-document-viewed.ts",
  );
  const plugin = {
    name: "stub-layout",
    setup(build) {
      build.onResolve({ filter: /notification-layout\.ts$/ }, () => ({
        path: "layout",
        namespace: "stub",
      }));
      build.onResolve({ filter: /notification-types\.ts$/ }, () => ({
        path: "types",
        namespace: "stub",
      }));
      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
        contents:
          args.path === "layout"
            ? `export const BRAND = { primary: "#0369A1" };
               export const money = (v) => "$" + Number(v || 0).toFixed(2);
               export const niceDate = (v) => (v ? String(v) : "");
               export const esc = (v) => String(v ?? "");
               // Echo the layout back so assertions can read the parts.
               export const renderNotification = (o) => JSON.stringify(o);`
            : `export const __types = true;`,
        loader: "js",
      }));
    },
  };
  const result = await esbuild.build({
    entryPoints: [src],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [plugin],
  });
  const tmp = path.join(
    os.tmpdir(),
    `viewed-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`,
  );
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

const iso = (s) => new Date(s).toISOString();

async function main() {
  const { readReceipt, READ_RECEIPT_WINDOWS } = await load(
    "src/lib/readReceipt.js",
  );
  const { documentViewedEmail } = await loadTemplate();

  console.log("\nreadReceipt -- the negative case");
  {
    const none = readReceipt({});
    check("no stamps means not opened", none.opened === false);
    check("count is zero", none.count === 0);
    check(
      "never asserts the client ignored it",
      /not opened yet/i.test(none.label) && !/ignor|read/i.test(none.label),
      none.label,
    );
    check("a null document does not throw", readReceipt(null).opened === false);
    check(
      "an unparseable stamp is treated as no stamp",
      readReceipt({ first_viewed_at: "not a date" }).opened === false,
    );
  }

  console.log("\nreadReceipt -- the stamp outranks the counter");
  {
    // The real shape this guards: public-link.ts sets first_viewed_at in one
    // branch of the patch and view_count in another, so this row exists.
    const lagged = readReceipt({
      first_viewed_at: iso("2026-09-01T10:00:00Z"),
      view_count: 0,
    });
    check("opened despite a zero counter", lagged.opened === true);
    check("count floors at one, never zero", lagged.count === 1, lagged.count);
    check(
      "reads as once, not as 0 times",
      /once/.test(lagged.label) && !/0 times/.test(lagged.label),
      lagged.label,
    );
  }

  console.log("\nreadReceipt -- return visits");
  {
    const first = "2026-09-01T10:00:00Z";
    const oneVisit = readReceipt({
      first_viewed_at: iso(first),
      // Inside the 60s window: one visit that re-rendered, not two.
      last_viewed_at: iso("2026-09-01T10:00:20Z"),
      view_count: 1,
    });
    check("a re-render is not a return visit", oneVisit.reopened === false);

    const came_back = readReceipt({
      first_viewed_at: iso(first),
      last_viewed_at: iso("2026-09-03T14:00:00Z"),
      view_count: 3,
    });
    check("a later visit is a return visit", came_back.reopened === true);
    check(
      "the count is reported",
      came_back.shortLabel === "Opened 3×",
      came_back.shortLabel,
    );
    check(
      "the long label says how many and when",
      /3 times/.test(came_back.label) && /first on/.test(came_back.label),
      came_back.label,
    );
    check(
      "exactly at the threshold is still one visit",
      readReceipt({
        first_viewed_at: iso(first),
        last_viewed_at: new Date(
          new Date(first).getTime() + READ_RECEIPT_WINDOWS.REOPEN_MS,
        ).toISOString(),
      }).reopened === false,
    );
  }

  console.log("\nreadReceipt -- freshness");
  {
    const at = new Date("2026-09-05T12:00:00Z").getTime();
    const justNow = readReceipt(
      { first_viewed_at: iso("2026-09-05T11:00:00Z") },
      at,
    );
    check("an open an hour ago is fresh", justNow.fresh === true);
    const old = readReceipt(
      { first_viewed_at: iso("2026-09-01T11:00:00Z") },
      at,
    );
    check("an open four days ago is not fresh", old.fresh === false);
    check(
      "an old open is still an open",
      old.opened === true && old.shortLabel === "Opened",
    );
  }

  console.log("\ndocumentViewedEmail -- the claim it makes");
  {
    const built = documentViewedEmail({
      userEmail: "pro@example.com",
      kind: "invoice",
      number: "1042",
      clientName: "Dave Carter",
      total: 2400,
      viewedAt: iso("2026-09-05T12:00:00Z"),
      sentAt: iso("2026-09-02T12:00:00Z"),
      documentUrl: "https://www.invoicium.ca/InvoiceDetail?id=abc",
    });
    const layout = JSON.parse(built.html);

    check(
      "the client's name leads the subject",
      built.subject.startsWith("Dave Carter opened invoice #1042"),
      built.subject,
    );
    check(
      "it says plainly that nothing was paid",
      /nothing has been paid/i.test(layout.intro),
      layout.intro,
    );
    check(
      "the caveat about the PDF is present",
      /pdf are not counted/i.test(layout.footnote),
    );
    check(
      "it says this fires once per document",
      /only get this once/i.test(layout.footnote),
    );
    check(
      "it points at the contractor's page, not the client's link",
      layout.cta.url.includes("/InvoiceDetail") &&
        !layout.cta.url.includes("/i/"),
      layout.cta.url,
    );
    check(
      "the waited row is rendered",
      layout.rows.some((r) => r.label === "Waited" && r.value === "3 days"),
      JSON.stringify(layout.rows),
    );
    check(
      "an open is not coloured like a payment",
      layout.hero.accent === "#0369A1",
      layout.hero.accent,
    );
  }

  console.log("\ndocumentViewedEmail -- the arithmetic that can embarrass us");
  {
    const waited = (sentAt, viewedAt) => {
      const layout = JSON.parse(
        documentViewedEmail({
          userEmail: "a@b.c",
          kind: "quote",
          total: 10,
          viewedAt,
          sentAt,
        }).html,
      );
      const row = layout.rows.find((r) => r.label === "Waited");
      return row ? row.value : null;
    };

    check(
      "a view BEFORE the send prints nothing, not a negative",
      waited(iso("2026-09-05T12:00:00Z"), iso("2026-09-05T11:00:00Z")) === null,
    );
    check(
      "a missing sentAt prints nothing",
      waited(null, iso("2026-09-05T12:00:00Z")) === null,
    );
    check(
      "an unparseable date prints nothing",
      waited("whenever", iso("2026-09-05T12:00:00Z")) === null,
    );
    check(
      "minutes",
      waited(iso("2026-09-05T12:00:00Z"), iso("2026-09-05T12:20:00Z")) ===
        "20 minutes",
    );
    check(
      "an immediate open reads as within a minute",
      waited(iso("2026-09-05T12:00:00Z"), iso("2026-09-05T12:00:10Z")) ===
        "Within a minute",
    );
    check(
      "hours",
      waited(iso("2026-09-05T12:00:00Z"), iso("2026-09-05T15:00:00Z")) ===
        "About 3 hours",
    );
    check(
      "days",
      waited(iso("2026-09-01T12:00:00Z"), iso("2026-09-09T12:00:00Z")) ===
        "8 days",
    );
  }

  console.log("\ndocumentViewedEmail -- quotes say the right thing");
  {
    const layout = JSON.parse(
      documentViewedEmail({
        userEmail: "a@b.c",
        kind: "quote",
        number: "Q-7",
        clientName: "Rivera Homes",
        total: 890,
        viewedAt: iso("2026-09-05T12:00:00Z"),
        documentUrl: "https://www.invoicium.ca/QuoteDetail?id=xyz",
      }).html,
    );
    check(
      "a quote is not described as unpaid",
      !/paid/i.test(layout.intro),
      layout.intro,
    );
    check(
      "a quote says it is unanswered",
      /approved or declined/i.test(layout.intro),
      layout.intro,
    );
    check("the CTA is quote-shaped", layout.cta.label === "View quote");
    check("the heading is quote-shaped", layout.heading === "Quote opened");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
