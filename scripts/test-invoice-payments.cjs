/**
 * The arithmetic and the rules behind payment tracking and status history.
 *
 * -- What is actually at risk ----------------------------------------------
 *
 * All of it is money, and none of it fails loudly:
 *
 *   Float drift. Three payments of 33.33 against a 100.00 invoice must leave
 *   exactly 0.01 owed. In floats it leaves 0.010000000000005, and since the
 *   balance is compared against zero to decide whether an invoice is settled,
 *   an invoice can end up owed forever for a fraction of a cent -- chased by
 *   the reminder ladder, for money nobody owes.
 *
 *   Reopening. statusFromPayments must never turn a paid invoice back into an
 *   unpaid one. Every invoice paid before this feature existed has no payment
 *   rows at all, so a rule that derived status purely from payments would
 *   reopen the entire back catalogue and start chasing clients who paid months
 *   ago.
 *
 *   The settled date. paid_date is what the revenue charts are now dated by,
 *   so it has to be the payment that CLEARED the invoice -- not the first
 *   payment, and not today.
 *
 *   The timeline. Built by merging derived entries with stored ones, because
 *   an events table records nothing that happened before it existed and every
 *   invoice in the account predates it.
 *
 * Usage: node scripts/test-invoice-payments.cjs
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
 * Load a module, bundling `@/` the way vite does, with the option to replace a
 * dependency's source outright -- which is how the two schema states below are
 * produced without touching the generated column map.
 */
async function load(rel, stubs = {}) {
  const plugin = {
    name: "alias-and-stub",
    setup(build) {
      build.onResolve({ filter: /^@\// }, (args) => {
        if (stubs[args.path]) return { path: args.path, namespace: "stub" };
        const base = path.join(ROOT, "src", args.path.slice(2));
        for (const ext of ["", ".js", ".jsx"]) {
          if (fs.existsSync(base + ext) && fs.statSync(base + ext).isFile()) {
            return { path: base + ext };
          }
        }
        return { path: base };
      });
      build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({
        contents: stubs[args.path],
        loader: "js",
      }));
    },
  };
  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, rel)],
    bundle: true, write: false, format: "esm", platform: "neutral", target: "es2022",
    plugins: [plugin],
  });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}-${Math.random().toString(36).slice(2)}.mjs`);
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

const SCHEMA_WITH = `export const ENTITY_COLUMNS = {
  Invoice: ["id","status","total","paid_date","voided_at"],
  InvoicePayment: ["id","invoice_id","amount","paid_at"],
  InvoiceEvent: ["id","invoice_id","at","kind"],
};`;
const SCHEMA_WITHOUT = `export const ENTITY_COLUMNS = {
  Invoice: ["id","status","total","paid_date","voided_at"],
};`;

const j = JSON.stringify;
const pay = (amount, paid_at, extra = {}) => ({ amount, paid_at, ...extra });

async function main() {
  const P = await load("src/lib/invoicePayments.js", { "@/api/entityColumns": SCHEMA_WITH });
  const Pold = await load("src/lib/invoicePayments.js", { "@/api/entityColumns": SCHEMA_WITHOUT });

  // ---- The balance -------------------------------------------------------
  console.log("\nwhat is owed\n");

  const inv = { id: "i1", total: 500, status: "sent" };

  let s = P.paymentSummary(inv, []);
  check("nothing paid means the whole total is owed", s.paid === 0 && s.balance === 500);
  check("and it is not settled", !s.settled);

  s = P.paymentSummary(inv, [pay(200, "2026-04-15")]);
  check("a deposit leaves the rest owed", s.paid === 200 && s.balance === 300, j(s));
  check("a part-paid invoice is NOT settled", !s.settled);

  s = P.paymentSummary(inv, [pay(200, "2026-04-15"), pay(300, "2026-04-22")]);
  check("two payments that add up settle it", s.settled && s.balance === 0, j(s));

  s = P.paymentSummary(inv, [pay(520, "2026-04-22")]);
  check("an overpayment settles it rather than leaving it open", s.settled, j(s));
  check("and is reported as an overpayment", s.overpaid && s.balance === -20, j(s));

  s = P.paymentSummary(inv, [pay(500, "2026-04-01"), pay(-500, "2026-04-09")]);
  check(
    "a refund is a negative payment and reopens the balance",
    s.paid === 0 && s.balance === 500 && !s.settled,
    j(s),
  );

  // The one that floats get wrong.
  const hundred = { id: "i2", total: 100, status: "sent" };
  s = P.paymentSummary(hundred, [pay(33.33, "2026-01-01"), pay(33.33, "2026-01-02"), pay(33.33, "2026-01-03")]);
  check(
    "THREE PAYMENTS OF 33.33 LEAVE EXACTLY 0.01, NOT 0.010000000000005",
    // Object.is, not ===, and stated as an exact identity: the naive float sum
    // gives 0.010000000000005116, which `=== 0.01` already rejects, but
    // spelling it out keeps the assertion about the exact value rather than
    // about a tolerance somebody might later widen.
    Object.is(s.balance, 0.01),
    `${s.balance} -- a float here leaves an invoice chased forever for a fraction of a cent`,
  );
  check(
    "and paid-to-date is exact too",
    Object.is(s.paid, 99.99),
    `${s.paid} -- 33.33 * 3 in floats is 99.99000000000001`,
  );
  check("and it is correctly not settled", !s.settled);

  s = P.paymentSummary({ id: "i3", total: 0.1 }, [pay(0.03, "x"), pay(0.07, "x")]);
  check("0.03 + 0.07 settles a 0.10 invoice", s.settled && s.balance === 0, j(s));

  check("a total of zero is never 'settled'", !P.paymentSummary({ total: 0 }, []).settled);

  // ---- Deriving the status ----------------------------------------------
  console.log("\nwhat the status should become\n");

  check(
    "payments that settle it say paid",
    P.statusFromPayments(inv, [pay(500, "2026-04-01")]) === "paid",
  );
  check(
    "a part payment changes nothing",
    P.statusFromPayments(inv, [pay(200, "2026-04-01")]) === null,
    "no partially_paid status -- the balance is shown and the reminder ladder keeps chasing",
  );
  check(
    "AN INVOICE ALREADY MARKED PAID IS NEVER REOPENED",
    P.statusFromPayments({ id: "x", total: 500, status: "paid" }, []) === null,
    "every invoice paid before this feature has no payment rows; reopening them all would chase clients who paid months ago",
  );
  check(
    "and an already-paid invoice whose payments settle it is left alone",
    P.statusFromPayments({ id: "x", total: 500, status: "paid" }, [pay(500, "2026-04-01")]) === null,
    // The case above passes on the function's SHAPE -- it can only ever return
    // "paid" or null -- so it does not exercise the early return for a
    // already-paid invoice at all. Measured: removing that guard survived a
    // mutation run until this case existed. This one makes it a redundant
    // write if the guard goes.
    P.statusFromPayments({ id: "x", total: 500, status: "paid" }, [pay(500, "2026-04-01")]),
  );
  check(
    "and it can only ever answer 'paid' or nothing -- never a status that reopens",
    ["draft", "sent", "overdue", "paid", "cancelled"].every((status) => {
      const out = P.statusFromPayments({ id: "x", total: 500, status }, [pay(10, "2026-04-01")]);
      return out === null || out === "paid";
    }),
  );
  check(
    "a voided invoice is never quietly marked paid",
    P.statusFromPayments({ id: "x", total: 500, status: "void" }, [pay(500, "2026-04-01")]) === null,
  );
  check(
    "nor one carrying voided_at with another status",
    P.statusFromPayments({ id: "x", total: 500, status: "sent", voided_at: "2026-04-01" }, [pay(500, "z")]) === null,
  );

  // ---- The date it was settled ------------------------------------------
  console.log("\nwhen it was settled\n");

  check(
    "the LAST payment is the settled date, not the first",
    P.settledDate(inv, [pay(200, "2026-01-15"), pay(300, "2026-04-22")]) === "2026-04-22",
    P.settledDate(inv, [pay(200, "2026-01-15"), pay(300, "2026-04-22")]),
  );
  check(
    "order in the array does not matter",
    P.settledDate(inv, [pay(300, "2026-04-22"), pay(200, "2026-01-15")]) === "2026-04-22",
  );
  check("an unsettled invoice has no settled date", P.settledDate(inv, [pay(200, "2026-01-15")]) === null);

  // ---- Recording -------------------------------------------------------
  console.log("\nthe row that gets written\n");

  const user = { id: "u1", email: "sam@example.com", user_metadata: { full_name: "Sam Okonkwo" } };
  const row = P.paymentRecord({
    invoice: { id: "i1", user_id: "owner" },
    amount: "450.005",
    paidAt: "2026-04-22",
    method: "  Cheque  ",
    reference: " 4471 ",
    notes: " left with the site office ",
    user,
  });
  check("the invoice and owner are carried", row.invoice_id === "i1" && row.user_id === "owner");
  check("the amount is rounded to cents", row.amount === 450.01, row.amount);
  check("the date is the one entered, not today", row.paid_at === "2026-04-22", row.paid_at);
  check("text is trimmed", row.method === "Cheque" && row.reference === "4471", j([row.method, row.reference]));
  check("the actor is recorded by id and by name",
    row.recorded_by === "u1" && row.recorded_by_name === "Sam Okonkwo", j(row));
  check(
    "an empty method is null rather than an empty string",
    P.paymentRecord({ invoice: { id: "i" }, amount: 1, method: "" }).method === null,
  );
  check(
    "no date given defaults to today",
    /^\d{4}-\d{2}-\d{2}$/.test(P.paymentRecord({ invoice: { id: "i" }, amount: 1 }).paid_at),
  );

  // ---- Validation -------------------------------------------------------
  console.log("\nwhat may be recorded\n");

  check("a normal amount is fine", P.validatePayment({ invoice: inv, payments: [], amount: "200" }).ok);
  check("zero is refused", !P.validatePayment({ invoice: inv, payments: [], amount: "0" }).ok);
  check("blank is refused", !P.validatePayment({ invoice: inv, payments: [], amount: "" }).ok);
  check("gibberish is refused", !P.validatePayment({ invoice: inv, payments: [], amount: "some" }).ok);
  check(
    "a voided invoice takes no payments",
    !P.validatePayment({ invoice: { ...inv, status: "void" }, payments: [], amount: "100" }).ok,
  );

  const over = P.validatePayment({ invoice: inv, payments: [], amount: "600" });
  check("AN OVERPAYMENT IS ALLOWED, NOT REFUSED", over.ok,
    "the money has genuinely arrived; refusing to record it is worse than an awkward number");
  check("but it is flagged", /more than/.test(over.warning || ""), over.warning);

  const noSchema = Pold.validatePayment({ invoice: inv, payments: [], amount: "100" });
  check(
    "without the migration, recording is refused rather than saved to one browser",
    !noSchema.ok && /database update/i.test(noSchema.reason || ""),
    noSchema.reason,
  );
  check("and the support check says so directly",
    P.paymentsSupported() === true && Pold.paymentsSupported() === false);

  // ---- The timeline -----------------------------------------------------
  console.log("\nthe history\n");

  const rich = {
    id: "i9",
    total: 500,
    status: "paid",
    created_at: "2026-03-01T09:00:00.000Z",
    first_viewed_at: "2026-03-02T10:00:00.000Z",
    last_viewed_at: "2026-03-09T11:00:00.000Z",
    view_count: 4,
    last_reminder_sent_at: "2026-03-20T08:00:00.000Z",
    reminder_count: 2,
  };
  const timeline = P.invoiceTimeline(
    rich,
    [pay(500, "2026-03-25", { method: "Cheque", reference: "4471", recorded_by_name: "Sam" })],
    [{ at: "2026-03-05T12:00:00.000Z", kind: "status_changed", from_status: "draft", to_status: "sent", actor_name: "Sam" }],
  );
  const kinds = timeline.map((e) => e.kind);

  check("it is built at all", timeline.length >= 5, j(kinds));
  check("NEWEST FIRST", new Date(timeline[0].at) >= new Date(timeline[timeline.length - 1].at), j(timeline.map((e) => e.at)));
  check("the payment is on it", kinds.includes("payment"));
  check("with its method and reference", /Cheque/.test(timeline.find((e) => e.kind === "payment")?.detail || ""));
  check("the creation is on it", kinds.includes("created"));
  check("the client opening it is on it", kinds.includes("viewed"));
  check("the reminders are on it", kinds.includes("reminder"));
  check("and the stored status change", kinds.includes("status_changed"));
  check(
    "IT IS POPULATED WITH NO STORED EVENTS AT ALL",
    P.invoiceTimeline(rich, [], []).length >= 4,
    "an events table records nothing from before it existed, and every invoice in the account predates it",
  );
  check(
    "the reminder entry admits earlier dates are not kept",
    /not kept/i.test(timeline.find((e) => e.kind === "reminder")?.detail || ""),
    timeline.find((e) => e.kind === "reminder")?.detail,
  );
  check(
    "one view does not produce two entries",
    P.invoiceTimeline(
      { id: "x", created_at: "2026-03-01T09:00:00Z", first_viewed_at: "2026-03-02T10:00:00Z", last_viewed_at: "2026-03-02T10:00:20Z" },
      [], [],
    ).filter((e) => e.kind === "viewed").length === 1,
  );
  check(
    "a void does not also report the link revocation it caused",
    P.invoiceTimeline(
      { id: "x", created_at: "2026-03-01T09:00:00Z", voided_at: "2026-03-04T09:00:00Z", public_link_revoked_at: "2026-03-04T09:00:00Z" },
      [], [],
    ).filter((e) => e.kind === "link").length === 0,
    "voiding revokes the link as a side effect; showing both makes one action look like two",
  );
  check(
    "an unparseable date is dropped rather than breaking the timeline",
    P.invoiceTimeline({ id: "x", created_at: "not a date" }, [], []).length === 0,
  );

  // ---- Revenue dating ---------------------------------------------------
  console.log("\nwhen revenue counts\n");

  const jan = new Date("2026-01-12T00:00:00Z");
  const apr = "2026-04-03";
  check(
    "paid_date wins",
    P.revenueDate({ created_at: jan.toISOString(), paid_date: "2026-04-03" }).toISOString().slice(0, 7) === "2026-04",
  );
  check(
    "then the last payment",
    P.revenueDate({ created_at: jan.toISOString() }, [pay(1, "2026-02-01"), pay(1, apr)])
      .toISOString().slice(0, 7) === "2026-04",
  );
  check(
    "and only then the creation date",
    P.revenueDate({ created_at: jan.toISOString() }, []).toISOString().slice(0, 7) === "2026-01",
    "a historic invoice marked paid by hand carries no date at all, and this is the best that can be said",
  );

  // ---- Indexing ---------------------------------------------------------
  console.log("\ngrouping payments\n");

  const idx = P.indexPaymentsByInvoice([
    { invoice_id: "a", amount: 1 },
    { invoice_id: "b", amount: 2 },
    { invoice_id: "a", amount: 3 },
    { amount: 4 },
  ]);
  check("payments group by invoice", idx.get("a").length === 2 && idx.get("b").length === 1);
  check("a row with no invoice is dropped rather than crashing", idx.size === 2, j([...idx.keys()]));

  // ---- The event row ----------------------------------------------------
  console.log("\nthe history row\n");

  const ev = P.statusChangeEvent({
    invoice: { id: "i1", user_id: "owner" },
    from: "sent",
    to: "paid",
    detail: "Settled in full",
    user,
  });
  check("it records both ends of the change", ev.from_status === "sent" && ev.to_status === "paid");
  check("and who made it", ev.actor_id === "u1" && ev.actor_name === "Sam Okonkwo");
  check("with a kind the timeline understands", ev.kind === "status_changed");

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
