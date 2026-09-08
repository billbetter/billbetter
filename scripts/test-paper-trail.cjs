/**
 * How the sealed record is described to whoever reads it.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Overclaiming. The ledger's own guarantees are enforced in Postgres and tested
 * against the live database by scripts/test-paper-trail-db.py. What this file
 * guards is the layer where those guarantees get turned into English, and the
 * failure mode there is not a crash -- it is a document that says more than the
 * data supports and falls apart the first time somebody with a reason to argue
 * reads it properly.
 *
 * So the properties pinned here are the ones whose absence is invisible:
 *
 *   * an entry the contractor performed is never counted as witnessed
 *   * an event kind nobody has taught this file about still renders, rather
 *     than dropping silently out of a legal record
 *   * a payment entered three weeks after the date it claims is flagged
 *   * ...and an imported one, whose gap is an artefact of the import rather
 *     than anything anyone did, is NOT -- otherwise every invoice that existed
 *     before this shipped is presented as suspicious
 *
 * Usage: node scripts/test-paper-trail.cjs
 */
const fs = require("fs");
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
    console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`);
  }
}

/**
 * src/lib/paperTrail.js imports the Supabase client, which builds a real client
 * from import.meta.env at module load and cannot run here. Stubbing it at the
 * bundler keeps the module under test unmodified -- a test harness problem
 * should not reshape the source it is testing.
 */
const stubSupabase = {
  name: "stub-supabase",
  setup(build) {
    build.onResolve({ filter: /^@\/api\/supabaseClient$/ }, () => ({
      path: "stub-supabase",
      namespace: "stub",
    }));
    build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const supabase = { from() {}, rpc() {} };",
      loader: "js",
    }));
  },
};

async function load() {
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src/lib/paperTrail.js")],
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    plugins: [stubSupabase],
    alias: { "@": path.join(ROOT, "src") },
  });
  const tmp = path.join(ROOT, `tmp-papertrail-${process.pid}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.split(path.sep).join("/"));
  fs.unlinkSync(tmp);
  return mod;
}

const AT = (iso) => new Date(iso).toISOString();

/** A row as it comes back from public."AuditEvent". */
function row(over = {}) {
  return {
    id: over.id || "e1",
    seq: 1,
    kind: "sent",
    detail: "Marked as sent",
    amount: null,
    occurred_at: AT("2026-03-01T10:00:00Z"),
    recorded_at: AT("2026-03-01T10:00:00Z"),
    source: "user",
    hash: "abc123def456789",
    ...over,
  };
}

async function main() {
  const {
    entryView,
    trailStrength,
    kindLabel,
    kindTone,
    recordReference,
    SOURCE_LABELS,
  } = await load();

  console.log("\nwitnessed vs claimed -- the distinction the record rests on");
  {
    const observed = entryView(row({ kind: "viewed", source: "system" }));
    const claimed = entryView(row({ kind: "sent", source: "user" }));
    const rebuilt = entryView(row({ kind: "created", source: "imported" }));

    check("a client opening the link counts as witnessed", observed.witnessed === true);
    check("the contractor marking it sent does NOT", claimed.witnessed === false);
    check("a reconstructed entry does NOT", rebuilt.witnessed === false);
    check(
      "each source is labelled distinctly",
      new Set([observed.sourceLabel, claimed.sourceLabel, rebuilt.sourceLabel]).size === 3,
      `${observed.sourceLabel} / ${claimed.sourceLabel} / ${rebuilt.sourceLabel}`,
    );
    check(
      "and every label is real text, not a raw column value",
      Object.values(SOURCE_LABELS).every((l) => /[a-z] [a-z]/i.test(l)),
    );
  }

  console.log("\nentries recorded later than the date they claim");
  {
    const late = entryView(
      row({
        kind: "payment",
        source: "user",
        occurred_at: AT("2026-03-01T12:00:00Z"),
        recorded_at: AT("2026-03-21T09:00:00Z"),
      }),
    );
    check("a payment entered 20 days later is flagged", late.backdated === true);

    const sameDay = entryView(
      row({
        occurred_at: AT("2026-03-01T09:00:00Z"),
        recorded_at: AT("2026-03-01T17:00:00Z"),
      }),
    );
    check(
      "Friday's cheque entered Friday evening is not",
      sameDay.backdated === false,
      "8 hours must stay inside the tolerance",
    );

    const monday = entryView(
      row({
        occurred_at: AT("2026-03-01T09:00:00Z"),
        recorded_at: AT("2026-03-02T08:00:00Z"),
      }),
    );
    check("nor is one entered the next morning", monday.backdated === false);

    // The whole back catalogue is imported at once, so every imported row has
    // a large gap by construction. Flagging them would paint every invoice a
    // contractor already had as suspicious on the day the feature shipped.
    const imported = entryView(
      row({
        source: "imported",
        occurred_at: AT("2025-01-01T09:00:00Z"),
        recorded_at: AT("2026-09-08T09:00:00Z"),
      }),
    );
    check("an imported entry is never flagged as backdated", imported.backdated === false);
  }

  console.log("\nunknown event kinds still render");
  {
    check("a known kind gets its label", kindLabel("viewed") === "Client opened it");
    check(
      "an unknown kind is humanised rather than dropped",
      kindLabel("court_filing_lodged") === "Court filing lodged",
      kindLabel("court_filing_lodged"),
    );
    check("and gets a usable tone", kindTone("court_filing_lodged") === "neutral");
    check("a missing kind does not throw", kindLabel(undefined) === "Event");
  }

  console.log("\nthe headline is about the client, not the paperwork");
  {
    const nothing = trailStrength([]);
    check("no entries reads as not sent", nothing.headline === "Not sent yet.");

    const sentOnly = trailStrength([entryView(row({ kind: "sent" }))].map((e) => e));
    check(
      "sent but never opened says exactly that",
      sentOnly.headline === "Sent, but never opened from the link.",
      sentOnly.headline,
    );

    const opened = trailStrength([
      entryView(row({ id: "a", kind: "sent" })),
      entryView(row({ id: "b", kind: "viewed", source: "system" })),
    ]);
    check("one open is singular", opened.headline === "The client opened this.");
    check("and the open date is surfaced", opened.firstOpenedAt instanceof Date);

    const many = trailStrength([
      entryView(row({ id: "a", kind: "sent" })),
      entryView(row({ id: "b", kind: "viewed", source: "system" })),
      entryView(row({ id: "c", kind: "viewed", source: "system" })),
      entryView(row({ id: "d", kind: "viewed", source: "system" })),
    ]);
    check("three opens are counted", many.headline === "The client opened this 3 times.");
    check("witnessed counts only the observed entries", many.witnessed === 3, many.witnessed);
    check("entries counts everything", many.entries === 4);
  }

  console.log("\nthe record reference");
  {
    const ref = recordReference([entryView(row({ hash: "0123456789abcdef0011" }))]);
    check("is the tail hash, short and quotable", ref === "0123456789AB", ref);
    check("is empty rather than wrong when there is nothing", recordReference([]) === "");
  }

  console.log("\ndegenerate rows must not throw");
  {
    for (const bad of [
      {},
      { occurred_at: "not a date", recorded_at: null },
      { amount: "0.00", occurred_at: null },
      { source: "something-new" },
    ]) {
      let ok = true;
      try {
        const v = entryView(row(bad));
        // A null date must stay null rather than becoming "Invalid Date",
        // which renders as literal garbage inside a legal document.
        if (v.occurred && Number.isNaN(v.occurred.getTime())) ok = false;
      } catch {
        ok = false;
      }
      check(`survives ${JSON.stringify(bad)}`, ok);
    }
    check(
      "a zero amount stays zero rather than becoming null",
      entryView(row({ amount: "0.00" })).amount === 0,
    );
    check("an absent amount is null, not NaN", entryView(row({ amount: null })).amount === null);
  }

  await gateTests();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

/**
 * What the pricing page sells, and what the app actually enforces.
 *
 * permissions.jsx opens with a warning worth heeding: a previous rewrite fixed
 * the feature TABLE and never checked whether anything READ it, leaving four
 * flags that were advertised on the pricing page and enforced nowhere. So these
 * assertions go through canAccessFeature -- the function the gate calls -- for
 * every tier, rather than reading FEATURE_MINIMUM_PLAN back to itself.
 *
 * The pricing bullet is checked against the EXPORTED list, after
 * config/dormantFeatures.js has filtered it, because that filter matches
 * bullets by exact string and silently removes anything it recognises.
 */
async function gateTests() {
  const build = await esbuild.build({
    bundle: true,
    write: false,
    format: "esm",
    platform: "neutral",
    target: "es2022",
    alias: { "@": path.join(ROOT, "src") },
    stdin: {
      contents: `
        export { PLANS } from "@/config/plans";
        export {
          canAccessFeature,
          getMinimumPlanForFeature,
          FEATURE_MINIMUM_PLAN,
        } from "@/components/utils/permissions";
      `,
      resolveDir: path.join(ROOT, "src"),
      loader: "js",
    },
  });
  const tmp = path.join(ROOT, `tmp-gate-${process.pid}.mjs`);
  fs.writeFileSync(tmp, build.outputFiles[0].text);
  const { PLANS, canAccessFeature, getMinimumPlanForFeature, FEATURE_MINIMUM_PLAN } =
    await import("file://" + tmp.split(path.sep).join("/"));
  fs.unlinkSync(tmp);

  console.log("\nthe plan gate");
  {
    check(
      "essential is the minimum plan",
      FEATURE_MINIMUM_PLAN.paper_trail === "essential",
      FEATURE_MINIMUM_PLAN.paper_trail,
    );
    check(
      "core is refused",
      canAccessFeature({ plan_name: "core" }, "paper_trail") === false,
    );
    check(
      "essential is allowed",
      canAccessFeature({ plan_name: "essential" }, "paper_trail") === true,
    );
    check(
      "professional is allowed",
      canAccessFeature({ plan_name: "professional" }, "paper_trail") === true,
    );
    check(
      "custom is allowed",
      canAccessFeature({ plan_name: "custom" }, "paper_trail") === true,
    );
    // A trialist evaluating the product must be able to see the thing they are
    // being asked to pay for.
    check(
      "a trial can see it",
      canAccessFeature({ plan_name: "trial" }, "paper_trail") === true,
    );
    check(
      "no subscription at all is refused",
      canAccessFeature(null, "paper_trail") === false,
    );
    // `starter` still exists on old rows and aliases to core.
    check(
      "the legacy starter plan is refused, like core",
      canAccessFeature({ plan_name: "starter" }, "paper_trail") === false,
    );
    check(
      "the upgrade prompt names Essential",
      getMinimumPlanForFeature("paper_trail") === "Essential",
      getMinimumPlanForFeature("paper_trail"),
    );
  }

  console.log("\nwhat the pricing page promises");
  {
    const bullet = PLANS.essential.features.find((f) => /paper trail/i.test(f));
    check("Essential advertises it", Boolean(bullet), PLANS.essential.features);
    check(
      "and it survived the dormant-bullet filter",
      Boolean(bullet) && PLANS.essential.features.includes(bullet),
    );
    check(
      "Core says plainly that it does not include it",
      PLANS.core.notIncluded.some((f) => /paper trail/i.test(f)),
      PLANS.core.notIncluded,
    );
    check(
      "Core does NOT advertise it",
      !PLANS.core.features.some((f) => /paper trail/i.test(f)),
    );
    // Home.jsx renders `.slice(0, 4)`, so a bullet pushed past position four is
    // sold on Pricing and invisible on the page most people see first.
    check(
      "it is inside the four bullets the landing page shows",
      PLANS.essential.features.slice(0, 4).some((f) => /paper trail/i.test(f)),
      PLANS.essential.features.slice(0, 4),
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
