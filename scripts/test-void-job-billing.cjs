/**
 * The rules behind voiding an invoice and flagging a job that needs one.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * Both features fail silently rather than loudly, and both failures cost real
 * money:
 *
 *   1. A void that half lands. localDataEngine strips keys that are not in
 *      ENTITY_COLUMNS, so on a database without the migration a void would
 *      write `status: 'void'` and quietly drop the timestamp, the reason and
 *      the actor -- a voided invoice with no audit trail, produced BY the
 *      feature whose only job is keeping one. voidSupported() is the guard,
 *      and it is tested against both a schema that has the columns and one
 *      that does not, because the interesting branch is the one that is false
 *      today and true after the migration runs.
 *
 *   2. A job flagged for invoicing that was already invoiced. The contractor
 *      bills their client twice and hears about it from the client. That is
 *      why an unresolvable invoice link reads as INVOICED and never as
 *      REQUIRES_INVOICING -- an asymmetry that looks like a bug until you
 *      price the two mistakes.
 *
 * Usage: node scripts/test-void-job-billing.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail !== undefined ? ` -- ${detail}` : ""}`); }
}

/**
 * Load a module, bundling its `@/` imports.
 *
 * These modules are no longer import-free -- invoiceVoid reads the generated
 * column map, and jobBilling asks invoiceVoid whether an invoice is voided --
 * so a bare esbuild.transform() would leave unresolvable imports behind.
 *
 * `stubs` replaces a module's source outright, which is how the two schema
 * states below are produced without touching the real generated file.
 */
async function load(rel, stubs = {}) {
  const plugin = {
    name: "alias-and-stub",
    setup(build) {
      build.onResolve({ filter: /^@\// }, (args) => {
        const target = args.path.slice(2);
        if (stubs[args.path]) return { path: args.path, namespace: "stub" };
        return { path: path.join(ROOT, "src", target) + ".js" };
      });
      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
        contents: stubs[args.path],
        loader: "js",
      }));
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

  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

/** A column map WITH the void columns -- what the database looks like after the migration. */
const SCHEMA_WITH_VOID = `export const ENTITY_COLUMNS = { Invoice: [
  "id","user_id","invoice_number","status","total","due_date","paid_date",
  "public_token","public_link_revoked_at","stripe_payment_intent_id",
  "voided_at","void_reason","voided_by","voided_by_name"
] };`;

/** The same map BEFORE the migration. The four audit columns are absent. */
const SCHEMA_WITHOUT_VOID = `export const ENTITY_COLUMNS = { Invoice: [
  "id","user_id","invoice_number","status","total","due_date","paid_date",
  "public_token","public_link_revoked_at","stripe_payment_intent_id"
] };`;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY).toISOString();

async function main() {
  const V = await load("src/lib/invoiceVoid.js", { "@/api/entityColumns": SCHEMA_WITH_VOID });
  const Vold = await load("src/lib/invoiceVoid.js", { "@/api/entityColumns": SCHEMA_WITHOUT_VOID });
  const J = await load("src/lib/jobBilling.js", { "@/api/entityColumns": SCHEMA_WITH_VOID });
  const B = await load("src/lib/invoiceBatch.js", { "@/api/entityColumns": SCHEMA_WITH_VOID });

  // ---- Recognising a voided invoice -------------------------------------
  console.log("\nrecognising a void\n");

  check("a void status is a void", V.isVoided({ status: "void" }));
  check("uppercase counts too", V.isVoided({ status: "VOID" }));
  check(
    "a stamped voided_at counts even when the status says otherwise",
    V.isVoided({ status: "sent", voided_at: daysAgo(1) }),
    "this is the hand-edited-in-the-dashboard case",
  );
  check("an ordinary sent invoice is not", !V.isVoided({ status: "sent" }));
  check("neither is nothing at all", !V.isVoided(null));

  // ---- Who may be voided -------------------------------------------------
  console.log("\nwhat may be voided\n");

  check("a sent invoice may be", V.voidEligibility({ status: "sent" }).ok);
  check("a draft may be", V.voidEligibility({ status: "draft" }).ok);
  check("an overdue one may be", V.voidEligibility({ status: "overdue" }).ok);

  const paid = V.voidEligibility({ status: "paid" });
  check("a PAID invoice may not be", !paid.ok);
  check(
    "and is pointed at a refund rather than left with a bare refusal",
    /refund/i.test(paid.reason || ""),
    paid.reason,
  );

  check("an already-voided one may not be", !V.voidEligibility({ status: "void" }).ok);
  check("nor may nothing", !V.voidEligibility(null).ok);

  // ---- The guard that stops a half-void ---------------------------------
  console.log("\nthe schema guard\n");

  check("with the columns present, voiding is supported", V.voidSupported());
  check("without them it is NOT", !Vold.voidSupported());
  const unsupported = Vold.voidEligibility({ status: "sent" });
  check(
    "and an otherwise perfectly voidable invoice is refused",
    !unsupported.ok,
    "a void with no audit trail is worse than no void",
  );
  check(
    "with a reason that names the cause",
    /database update/i.test(unsupported.reason || ""),
    unsupported.reason,
  );

  // ---- The patch ---------------------------------------------------------
  console.log("\nthe patch\n");

  const at = new Date("2026-03-04T10:00:00.000Z");
  const user = {
    id: "user-1",
    email: "sam@example.com",
    user_metadata: { full_name: "Sam Okonkwo", name: "Sammy" },
  };
  const patch = V.voidPatch({ id: "inv-1", status: "sent" }, {
    reason: "  Wrong client  ",
    user,
    now: at,
  });

  check("sets the status", patch.status === "void", patch.status);
  check("stamps the time", patch.voided_at === at.toISOString(), patch.voided_at);
  check("trims the reason", patch.void_reason === "Wrong client", JSON.stringify(patch.void_reason));
  check("records the actor's id", patch.voided_by === "user-1");
  check(
    "and prefers their full name over the other two",
    patch.voided_by_name === "Sam Okonkwo",
    patch.voided_by_name,
  );
  check(
    "falling back to name, then email",
    V.voidPatch({}, { user: { id: "u", email: "a@b.c", user_metadata: { name: "Nick" } } })
      .voided_by_name === "Nick" &&
      V.voidPatch({}, { user: { id: "u", email: "a@b.c", user_metadata: {} } })
        .voided_by_name === "a@b.c",
  );

  const long = V.voidPatch({}, { reason: "x".repeat(600) });
  check("caps a runaway reason at 500", long.void_reason.length === 500, long.void_reason.length);

  check(
    "KILLS THE PUBLIC LINK -- the line that stops a client paying it",
    patch.public_link_revoked_at === at.toISOString(),
    patch.public_link_revoked_at,
  );
  const alreadyRevoked = V.voidPatch(
    { public_link_revoked_at: "2026-01-01T00:00:00.000Z" },
    { now: at },
  );
  check(
    "but does not rewrite a revocation that already happened",
    alreadyRevoked.public_link_revoked_at === "2026-01-01T00:00:00.000Z",
    alreadyRevoked.public_link_revoked_at,
  );

  // ---- Money that arrived anyway ----------------------------------------
  console.log("\nthe payment that beat the void\n");

  check(
    "a voided invoice with a paid_date is flagged",
    V.paidAfterVoid({ status: "void", paid_date: daysAgo(0) }),
  );
  check(
    "so is one carrying a payment intent",
    V.paidAfterVoid({ status: "void", stripe_payment_intent_id: "pi_123" }),
  );
  check("a void with neither is not", !V.paidAfterVoid({ status: "void" }));
  check(
    "and an ordinary paid invoice is certainly not",
    !V.paidAfterVoid({ status: "paid", paid_date: daysAgo(1) }),
  );

  // ---- Edit and delete ---------------------------------------------------
  console.log("\nediting and deleting\n");

  check("a voided invoice cannot be edited", !V.canEditInvoice({ status: "void" }).ok);
  check("a sent one still can", V.canEditInvoice({ status: "sent" }).ok);
  check("a voided invoice cannot be deleted", !V.canDeleteInvoice({ status: "void" }).ok);
  check(
    "a draft can, with no nudge -- nobody ever saw it",
    V.canDeleteInvoice({ status: "draft" }).ok &&
      !V.canDeleteInvoice({ status: "draft" }).prefer,
  );
  check(
    "a SENT one can still be deleted, but is steered to void",
    V.canDeleteInvoice({ status: "sent" }).ok &&
      V.canDeleteInvoice({ status: "sent" }).prefer === "void",
    "deleting a sent invoice was allowed before this feature and still is",
  );
  check(
    "so is an overdue one",
    V.canDeleteInvoice({ status: "overdue" }).prefer === "void",
  );

  // ---- The audit line ----------------------------------------------------
  console.log("\nthe audit line\n");

  check("nothing for an invoice that is not voided", V.voidAuditLine({ status: "sent" }) === null);

  const line = V.voidAuditLine(
    {
      status: "void",
      voided_at: "2026-03-04T10:00:00.000Z",
      voided_by_name: "Sam Okonkwo",
      void_reason: "Wrong client",
    },
    (d) => new Date(d).toISOString().slice(0, 10),
  );
  check("names the date, the person and the reason", line === "Voided on 2026-03-04 by Sam Okonkwo — Wrong client", line);

  const noReason = V.voidAuditLine(
    { status: "void", voided_at: "2026-03-04T10:00:00.000Z", voided_by_name: "Sam" },
    (d) => new Date(d).toISOString().slice(0, 10),
  );
  check("and leaves no dangling dash when there is no reason", noReason === "Voided on 2026-03-04 by Sam", noReason);
  check(
    "survives a void with nothing recorded on it",
    V.voidAuditLine({ status: "void" }) === "Voided",
    V.voidAuditLine({ status: "void" }),
  );

  // ---- Batch sending -----------------------------------------------------
  console.log("\nbatch sending a void\n");

  const contactable = { client_email: "a@b.c", client_name: "Dana" };
  check(
    "a voided invoice is never batch-sent",
    !B.batchSendEligibility({ ...contactable, status: "void" }).ok,
  );
  check(
    "and says why in a word a contractor recognises",
    B.batchSendEligibility({ ...contactable, status: "void" }).reason === "Voided",
    B.batchSendEligibility({ ...contactable, status: "void" }).reason,
  );
  check(
    "a stamped voided_at blocks it even when the status says sent",
    !B.batchSendEligibility({ ...contactable, status: "sent", voided_at: daysAgo(1) }).ok,
  );
  check(
    "an ordinary sent invoice is still eligible",
    B.batchSendEligibility({ ...contactable, status: "sent" }).ok === true,
  );

  // ---- Job billing state -------------------------------------------------
  console.log("\nwhere a job stands\n");

  // Distinct ids and figures throughout, so an assertion cannot pass by
  // landing on the right answer from the wrong row.
  const invoices = [
    { id: "inv-sent", invoice_number: "INV-100", status: "sent" },
    { id: "inv-paid", invoice_number: "INV-200", status: "paid" },
    { id: "inv-void", invoice_number: "INV-300", status: "void", voided_at: daysAgo(2) },
  ];
  const index = J.indexInvoices(invoices);

  const done = (over = {}) => ({
    id: "job-x", status: "completed", completion_date: daysAgo(9),
    estimated_cost: 1000, actual_cost: 0, ...over,
  });

  check(
    "a finished job with no invoice needs one",
    J.jobBillingState(done(), index).state === J.BILLING_STATE.REQUIRES_INVOICING,
  );
  check(
    "and says it was never invoiced, not that something was voided",
    J.jobBillingState(done(), index).reason === J.REQUIRES_REASON.NEVER_INVOICED,
  );
  check(
    "a finished job with a live invoice does not",
    J.jobBillingState(done({ linked_invoice_id: "inv-sent" }), index).state ===
      J.BILLING_STATE.INVOICED,
  );
  check(
    "a paid one reads as paid",
    J.jobBillingState(done({ linked_invoice_id: "inv-paid" }), index).state ===
      J.BILLING_STATE.PAID,
  );

  const voidedJob = J.jobBillingState(done({ linked_invoice_id: "inv-void" }), index);
  check(
    "a job whose invoice was VOIDED needs invoicing again",
    voidedJob.state === J.BILLING_STATE.REQUIRES_INVOICING,
    "this is the interlock between the two features",
  );
  check(
    "and the reason distinguishes it from never having been billed",
    voidedJob.reason === J.REQUIRES_REASON.INVOICE_VOIDED,
  );
  check(
    "naming the invoice that went away",
    /INV-300/.test(voidedJob.detail),
    voidedJob.detail,
  );

  check(
    "a cancelled job is never flagged",
    J.jobBillingState({ id: "j", status: "cancelled" }, index).state ===
      J.BILLING_STATE.NOT_APPLICABLE,
  );
  check(
    "an unfinished job with no invoice is not flagged either",
    J.jobBillingState({ id: "j", status: "in_progress" }, index).state ===
      J.BILLING_STATE.IN_PROGRESS,
    "billing part-way is allowed, it just is not chased",
  );
  check(
    "but an unfinished job whose invoice was voided IS",
    J.jobBillingState(
      { id: "j", status: "in_progress", linked_invoice_id: "inv-void" },
      index,
    ).state === J.BILLING_STATE.REQUIRES_INVOICING,
    "it was billed, and now it is not",
  );

  // The asymmetry. Worth its own section because it looks like a bug.
  const unresolved = J.jobBillingState(done({ linked_invoice_id: "inv-not-loaded" }), index);
  check(
    "AN UNRESOLVABLE LINK READS AS INVOICED, NOT AS NEEDING AN INVOICE",
    unresolved.state === J.BILLING_STATE.INVOICED,
    "flagging it would invite a contractor to bill a client twice",
  );
  check(
    "and says so, rather than claiming an invoice it cannot see",
    /not loaded/i.test(unresolved.detail),
    unresolved.detail,
  );

  // ---- The list ----------------------------------------------------------
  console.log("\nthe list of jobs to bill\n");

  const jobs = [
    done({ id: "small", actual_cost: 400 }),
    done({ id: "big", actual_cost: 9000 }),
    done({ id: "billed", linked_invoice_id: "inv-sent", actual_cost: 5000 }),
    done({ id: "settled", linked_invoice_id: "inv-paid", actual_cost: 7000 }),
    done({ id: "revoked", linked_invoice_id: "inv-void", actual_cost: 3000 }),
    { id: "scrapped", status: "cancelled", actual_cost: 8000 },
    { id: "running", status: "in_progress", actual_cost: 6000 },
  ];
  const rows = J.jobsRequiringInvoicing(jobs, invoices);
  const ids = rows.map((r) => r.job.id);

  check("picks exactly the unbilled finished work", ids.length === 3, JSON.stringify(ids));
  check("biggest first", ids[0] === "big" && ids[1] === "revoked" && ids[2] === "small", JSON.stringify(ids));
  check("leaves the invoiced one out", !ids.includes("billed"));
  check("leaves the paid one out", !ids.includes("settled"));
  check("leaves the cancelled one out", !ids.includes("scrapped"));
  check("leaves the running one out", !ids.includes("running"));

  const summary = J.requiresInvoicingSummary(rows);
  check("summarises the count", summary.count === 3);
  check("and the value", summary.value === 12400, summary.value);
  check("plural when there are several", /3 finished jobs/.test(summary.label), summary.label);
  check(
    "singular when there is one",
    /^1 finished job has/.test(J.requiresInvoicingSummary([{ value: 1 }]).label),
    J.requiresInvoicingSummary([{ value: 1 }]).label,
  );
  check("nothing at all when there is nothing", J.requiresInvoicingSummary([]) === null);

  // ---- The figures -------------------------------------------------------
  console.log("\nthe figures\n");

  check(
    "actual cost wins over the estimate",
    J.jobValue({ estimated_cost: 100, actual_cost: 250 }) === 250,
  );
  check(
    "a zero actual falls back to the estimate rather than reading as free",
    J.jobValue({ estimated_cost: 100, actual_cost: 0 }) === 100,
  );
  check("and nothing recorded is zero, not NaN", J.jobValue({}) === 0);

  check(
    "days waiting counts from the completion date",
    J.daysAwaitingInvoice({ completion_date: daysAgo(12) }) === 12,
    J.daysAwaitingInvoice({ completion_date: daysAgo(12) }),
  );
  check(
    "no completion date means no number, not zero",
    J.daysAwaitingInvoice({}) === null,
    "the field is optional, and 0 would read as 'finished today'",
  );
  check(
    "a completion date in the future is not a negative wait",
    J.daysAwaitingInvoice({ completion_date: new Date(Date.now() + 5 * DAY).toISOString() }) === null,
  );

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
