/**
 * The rules behind progress invoicing and the reminder queue.
 *
 * -- The two failures worth this file --------------------------------------
 *
 *   1. Stage amounts that do not add up to the contract. A plan is written in
 *      percentages and billed in money, and 30/40/30 of an awkward total
 *      rounds to less than the whole. The contractor cannot explain the
 *      shortfall to a client, and nothing in the product would ever flag it.
 *
 *   2. Chasing the wrong person. Reminding a client about money they have
 *      already paid, or firing three reminders in one afternoon because all
 *      three thresholds are in the past, is damage done in the contractor's
 *      name and cannot be taken back.
 *
 * Both are silent. Neither throws, neither logs, and both look fine on screen.
 *
 * Usage: node scripts/test-plans-reminders.cjs
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

async function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const { code } = await esbuild.transform(src, { loader: "js", format: "esm", target: "es2022" });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

const DAY = 24 * 60 * 60 * 1000;
const sum = (stages) =>
  Math.round(stages.reduce((s, x) => s + x.amount, 0) * 100) / 100;

async function main() {
  const P = await load("src/lib/paymentPlan.js");
  const R = await load("src/lib/reminders.js");

  console.log("\nthe parts must equal the whole\n");

  // The awkward totals, not the tidy ones. 12000 splits perfectly and proves
  // nothing; these are the ones that expose naive rounding.
  for (const total of [12000, 12000.01, 10000.03, 999.99, 1, 0.07, 33333.33]) {
    const stages = P.buildStages(total, P.DEFAULT_STAGES);
    const got = sum(stages);
    check(`30/40/30 of ${total} sums back to ${total}`, got === total, got);
  }

  const thirds = P.buildStages(100, [
    { label: "A", percent: 33.33 }, { label: "B", percent: 33.33 }, { label: "C", percent: 33.34 },
  ]);
  check("thirds of 100 sum to 100", sum(thirds) === 100, sum(thirds));
  check("the LAST stage absorbs the rounding, not the first",
        thirds[0].amount === 33.33 && thirds[2].amount === 33.34,
        JSON.stringify(thirds.map((s) => s.amount)));

  const many = P.buildStages(1000, Array.from({ length: 7 }, (_, i) => ({ label: `S${i}`, percent: 100 / 7 })));
  check("seven equal stages of 1000 still sum to 1000", sum(many) === 1000, sum(many));

  console.log("\na plan that cannot be billed is refused\n");

  check("95% is rejected, with the total named",
        (() => { const v = P.validateStages([{ label: "a", percent: 50 }, { label: "b", percent: 45 }]);
          return !v.ok && /95%/.test(v.reason); })());
  check("105% is rejected",
        !P.validateStages([{ label: "a", percent: 60 }, { label: "b", percent: 45 }]).ok);
  check("33.33+33.33+33.34 is accepted, not lost to float error",
        P.validateStages([{ label: "a", percent: 33.33 }, { label: "b", percent: 33.33 }, { label: "c", percent: 33.34 }]).ok);
  check("an unnamed stage is refused",
        !P.validateStages([{ label: "  ", percent: 100 }]).ok);
  check("a zero-percent stage is refused",
        !P.validateStages([{ label: "a", percent: 100 }, { label: "b", percent: 0 }]).ok);
  check("an empty plan is refused", !P.validateStages([]).ok);

  console.log("\nreleasing stages, strictly in order\n");

  const plan = {
    id: "pl1", title: "Kitchen remodel", client_id: "c1", client_name: "Dana",
    total_amount: 12000, tax_rate: 0,
    stages: P.buildStages(12000, P.DEFAULT_STAGES),
  };
  check("the first releasable stage is the deposit",
        P.nextReleasableStage(plan).label === "Deposit");
  check("nothing is billed yet", P.releasedTotal(plan.stages) === 0);
  check("everything is still outstanding", P.remainingTotal(plan) === 12000);

  plan.stages = P.markStageReleased(plan.stages, plan.stages[0].id, "inv-1");
  check("releasing records the invoice", plan.stages[0].invoice_id === "inv-1");
  check("and stamps a time", Boolean(plan.stages[0].released_at));
  check("the next releasable is now the second stage",
        P.nextReleasableStage(plan).label === "Work in progress");
  check("released total follows", P.releasedTotal(plan.stages) === 3600);
  check("remaining follows", P.remainingTotal(plan) === 8400);
  check("the plan is not fully billed", P.isPlanFullyBilled(plan) === false);

  const before = JSON.stringify(plan.stages);
  const copy = P.markStageReleased(plan.stages, plan.stages[1].id, "inv-2");
  check("markStageReleased does not mutate its input",
        JSON.stringify(plan.stages) === before && copy[1].invoice_id === "inv-2");

  plan.stages = P.markStageReleased(copy, copy[2].id, "inv-3");
  check("all three released means fully billed", P.isPlanFullyBilled(plan) === true);
  check("and nothing is left to release", P.nextReleasableStage(plan) === null);
  check("released equals the contract total", P.releasedTotal(plan.stages) === 12000);

  console.log("\nwhat the client actually sees on a stage invoice\n");

  const fresh = { ...plan, stages: P.buildStages(12000, P.DEFAULT_STAGES), tax_rate: 5 };
  const pre = P.buildStagePrefill({
    plan: fresh, stage: fresh.stages[0],
    client: { id: "c1", name: "Dana", email: "dana@example.com", phone: "+15145550123" },
  });
  check("one line item, not the whole contract", pre.items.length === 1);
  check("the line explains where it sits in the plan",
        /Deposit \(30% of Kitchen remodel\)/.test(pre.items[0].description), pre.items[0].description);
  check("it bills the stage amount, not the contract total",
        pre.subtotal === 3600 && pre.total === 3780, JSON.stringify({ s: pre.subtotal, t: pre.total }));
  check("tax is applied to the stage", pre.tax_amount === 180, pre.tax_amount);
  check("contact details come from the client row", pre.client_email === "dana@example.com");
  check("the plan and stage ride along for the post-save link",
        pre.payment_plan_id === "pl1" && pre.plan_stage_id === fresh.stages[0].id);
  check("it opens as a draft", pre.status === "draft");

  console.log("\nwho gets chased\n");

  const now = Date.UTC(2026, 8, 30);
  const daysAgo = (n) => new Date(now - n * DAY).toISOString();
  const inv = (over) => ({
    id: "i", status: "overdue", client_email: "a@b.co", due_date: daysAgo(over),
    reminder_count: 0,
  });

  check("2 days overdue is too soon", R.reminderStatus(inv(2), now).due === false);
  check("3 days overdue is the first reminder",
        R.reminderStatus(inv(3), now).due === true &&
        R.reminderStatus(inv(3), now).step.tone === "gentle");
  check("a PAID invoice is never chased",
        R.reminderStatus({ ...inv(30), status: "paid" }, now).due === false);
  check("a merely SENT invoice is not chased",
        R.reminderStatus({ ...inv(30), status: "sent" }, now).due === false);
  check("no contact means no reminder",
        R.reminderStatus({ ...inv(30), client_email: null }, now).due === false);
  check("no due date means nothing to measure from, so nothing is sent",
        R.reminderStatus({ ...inv(30), due_date: null }, now).due === false);

  console.log("\nthe ladder, and where it stops\n");

  // The trap: an invoice 90 days overdue with one reminder sent YESTERDAY.
  // Measured from the due date, every threshold is long past and all three
  // would fire at once. Measured from the last reminder, it waits.
  const stale = { ...inv(90), reminder_count: 1, last_reminder_sent_at: daysAgo(1) };
  check("90 days overdue but reminded yesterday: NOT due again today",
        R.reminderStatus(stale, now).due === false, JSON.stringify(R.reminderStatus(stale, now)));
  check("...and it says how long to wait",
        /Due in 3 day/.test(R.reminderStatus(stale, now).reason), R.reminderStatus(stale, now).reason);
  check("four days after the first, the second is due",
        R.reminderStatus({ ...stale, last_reminder_sent_at: daysAgo(4) }, now).due === true);
  check("the second reminder is the firm one",
        R.reminderStatus({ ...stale, last_reminder_sent_at: daysAgo(4) }, now).step.tone === "firm");
  check("seven days after the second, the final notice is due",
        R.reminderStatus({ ...inv(90), reminder_count: 2, last_reminder_sent_at: daysAgo(7) }, now).step.tone === "final");
  check("after three, it stops forever",
        R.reminderStatus({ ...inv(365), reminder_count: 3, last_reminder_sent_at: daysAgo(300) }, now).due === false);
  check("and says why it stopped",
        /All reminders sent/.test(R.reminderStatus({ ...inv(365), reminder_count: 3, last_reminder_sent_at: daysAgo(300) }, now).reason));
  check("a count with no timestamp waits rather than firing immediately",
        R.reminderStatus({ ...inv(90), reminder_count: 1, last_reminder_sent_at: null }, now).due === false);

  console.log("\nthe queue\n");

  const queue = R.dueReminders(
    [
      // Due: 5 days over, never reminded.
      { id: "a", status: "overdue", client_email: "a@b.co", due_date: daysAgo(5), reminder_count: 0 },
      // Not due: only 1 day over.
      { id: "b", status: "overdue", client_email: "a@b.co", due_date: daysAgo(1), reminder_count: 0 },
      // Due, and the worst of them.
      { id: "c", status: "overdue", client_email: "a@b.co", due_date: daysAgo(40), reminder_count: 0 },
      // Not due: already paid.
      { id: "d", status: "paid", client_email: "a@b.co", due_date: daysAgo(40), reminder_count: 0 },
      // Not due: exhausted the ladder.
      { id: "e", status: "overdue", client_email: "a@b.co", due_date: daysAgo(60), reminder_count: 3, last_reminder_sent_at: daysAgo(30) },
    ],
    now,
  );
  check("only the eligible ones are queued", queue.length === 2, queue.map((q) => q.invoice.id).join(","));
  check("worst first", queue[0].invoice.id === "c", queue.map((q) => q.invoice.id).join(","));
  check("the paid one never appears", !queue.some((q) => q.invoice.id === "d"));
  check("the exhausted one never appears", !queue.some((q) => q.invoice.id === "e"));

  console.log("\nrecording a reminder\n");

  const patch = R.reminderSentPatch({ reminder_count: 1 }, new Date(now));
  check("the count goes up by one", patch.reminder_count === 2, patch.reminder_count);
  check("and the time is stamped", patch.last_reminder_sent_at === new Date(now).toISOString());
  check("from zero it becomes one", R.reminderSentPatch({}).reminder_count === 1);

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
