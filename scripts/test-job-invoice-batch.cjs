/**
 * The arithmetic and the precedence behind the two new invoicing features,
 * with no browser, no network and no key.
 *
 * -- What is actually at risk here -----------------------------------------
 *
 * Both features produce something a contractor sends to a paying client, and
 * both have a failure mode that is silent rather than loud:
 *
 *   1. Billing the wrong figure. A job linked to a quote must invoice the
 *      QUOTE's numbers -- those are what the client was shown and often
 *      approved. Re-deriving from the job would quietly bill something else,
 *      and nobody would notice until the client did.
 *
 *   2. Mailing the wrong people. A batch that reports "sent" for an invoice
 *      that failed is worse than one that fails loudly: the contractor stops
 *      chasing. The sdk resolves rather than throws on a non-2xx, so a batch
 *      that only catches exceptions counts every failure as a success. That
 *      exact mistake is what the stub below is shaped to catch.
 *
 * Usage: node scripts/test-job-invoice-batch.cjs
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

// The modules are plain ESM with no imports of their own, so they load
// directly once transformed -- no stubbing needed, which is the point of
// having kept them free of sdk and React.
async function load(rel) {
  const src = fs.readFileSync(path.join(ROOT, rel), "utf8");
  const { code } = await esbuild.transform(src, { loader: "js", format: "esm", target: "es2022" });
  const tmp = path.join(os.tmpdir(), `${path.basename(rel)}-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);
  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  fs.unlinkSync(tmp);
  return mod;
}

async function main() {
  const J = await load("src/lib/jobInvoice.js");
  const B = await load("src/lib/invoiceBatch.js");

  // Distinct values throughout: a job rate of 85 and a quote rate of 120 so an
  // assertion cannot pass by reading the wrong source and landing on the same
  // number by luck.
  const settings = { hourly_rate: 60, tax_rate: 5 };
  const job = {
    id: "job-1", user_id: "u1", job_title: "Kitchen remodel", client_id: "c1",
    client_name: "Dana Reyes", status: "completed",
    estimated_hours: 8, actual_hours: 12, hourly_rate: 85,
  };
  const materials = [
    { item_name: "2x4 lumber", quantity: 20, unit: "ea", price_estimate: 6 },
    { item_name: "Paint", quantity: 3, price_estimate: 45 },
  ];
  const quote = {
    id: "q1", tax_rate: 13,
    items: [{ description: "Agreed scope", quantity: 1, rate: 2400, amount: 999999 }],
  };

  console.log("\nwhich hours get billed\n");
  check("actual hours win over the estimate", J.billableHours(job) === 12, J.billableHours(job));
  check("the estimate is used when no actual is recorded",
        J.billableHours({ estimated_hours: 8 }) === 8);
  check("a zero actual means 'not recorded', not 'worked nothing'",
        J.billableHours({ estimated_hours: 8, actual_hours: 0 }) === 8);
  check("no hours anywhere is 0, not NaN", J.billableHours({}) === 0);

  console.log("\nwhich rate\n");
  check("the job's own rate beats the business default",
        J.labourRate(job, settings) === 85, J.labourRate(job, settings));
  check("the business default is the fallback",
        J.labourRate({ }, settings) === 60);
  check("no rate anywhere is 0, so no labour line is invented",
        J.labourRate({}, {}) === 0);

  console.log("\nthe quote wins, whole\n");
  const fromQuote = J.buildJobInvoiceItems({ job, materials, quote, settings });
  check("a linked quote's items are used, not the job's", fromQuote.source === "quote", fromQuote.source);
  check("and the job's labour is NOT appended to them",
        fromQuote.items.length === 1, JSON.stringify(fromQuote.items));
  check("the rate is the quote's 2400, not the job's 85",
        fromQuote.items[0].rate === 2400, fromQuote.items[0].rate);
  check("the quote's tax rate comes with it", fromQuote.taxRate === 13, fromQuote.taxRate);
  check("a stored amount is recomputed, never trusted",
        fromQuote.items[0].amount === 2400, fromQuote.items[0].amount);

  console.log("\nfalling back to the job itself\n");
  const fromJob = J.buildJobInvoiceItems({ job, materials, quote: null, settings });
  check("source says job", fromJob.source === "job", fromJob.source);
  check("labour is 12h at 85 = 1020",
        fromJob.items[0].amount === 1020, JSON.stringify(fromJob.items[0]));
  check("materials follow, one line each", fromJob.items.length === 3, fromJob.items.length);
  check("the unit is shown when there is one",
        fromJob.items[1].description === "2x4 lumber (ea)", fromJob.items[1].description);
  check("and omitted when there is not",
        fromJob.items[2].description === "Paint", fromJob.items[2].description);
  check("business tax rate is used for a job-derived invoice",
        fromJob.taxRate === 5, fromJob.taxRate);

  console.log("\nnothing is invented\n");
  const bare = J.buildJobInvoiceItems({ job: { id: "j2", job_title: "Callout" }, settings: {} });
  check("a job with no hours, rate or materials yields NO items",
        bare.items.length === 0 && bare.source === "none", JSON.stringify(bare));
  check("and the prefill is null, so the caller opens the ordinary empty form",
        J.buildJobInvoicePrefill({ job: { id: "j2" }, settings: {} }) === null);
  const zeroRate = J.buildJobInvoiceItems({ job: { job_title: "x", actual_hours: 5 }, settings: {} });
  check("hours with no rate produce no labour line rather than a $0 one",
        zeroRate.items.length === 0, JSON.stringify(zeroRate.items));
  const badMaterial = J.buildJobInvoiceItems({
    job: {}, materials: [{ item_name: "Freebie", quantity: 2, price_estimate: 0 }], settings: {},
  });
  check("a zero-priced material is skipped, not billed at nothing",
        badMaterial.items.length === 0, JSON.stringify(badMaterial.items));

  console.log("\nthe totals, and float dust\n");
  const pre = J.buildJobInvoicePrefill({
    job: { id: "j3", job_title: "Deck", actual_hours: 3, hourly_rate: 0.1, client_id: "c9" },
    client: { id: "c9", name: "Sam", email: "sam@example.com", phone: "+15550000000" },
    materials: [{ item_name: "Screws", quantity: 1, price_estimate: 0.2 }],
    settings: { tax_rate: 0 },
  });
  check("0.1*3 + 0.2 is 0.5 exactly, not 0.5000000000000001",
        pre.subtotal === 0.5, pre.subtotal);
  check("contact details come from the client row, not the job",
        pre.client_email === "sam@example.com" && pre.client_phone === "+15550000000");
  check("the job id rides along so the link is made AFTER the invoice exists",
        pre.job_id === "j3", pre.job_id);
  check("it opens as a draft", pre.status === "draft", pre.status);

  const taxed = J.buildJobInvoicePrefill({ job, client: null, materials, settings });
  check("tax is computed off the subtotal",
        taxed.subtotal === 1275 && taxed.tax_amount === 63.75 && taxed.total === 1338.75,
        JSON.stringify({ s: taxed.subtotal, t: taxed.tax_amount, g: taxed.total }));

  console.log("\nwho may be batch-sent\n");
  const el = (inv, c) => B.batchSendEligibility(inv, c);
  const withEmail = { client_email: "a@b.co" };
  check("a draft may be sent -- that is the first send",
        el({ status: "draft", ...withEmail }).ok === true &&
        el({ status: "draft", ...withEmail }).kind === "send");
  check("a sent invoice may be re-sent, and is labelled a resend",
        el({ status: "sent", ...withEmail }).kind === "resend");
  check("an overdue invoice is a resend too",
        el({ status: "overdue", ...withEmail }).kind === "resend");
  check("a PAID invoice is never sent", el({ status: "paid", ...withEmail }).ok === false);
  check("a cancelled invoice is never sent", el({ status: "cancelled", ...withEmail }).ok === false);
  check("both spellings of cancelled are refused",
        el({ status: "canceled", ...withEmail }).ok === false);
  check("status matching is case-insensitive",
        el({ status: "PAID", ...withEmail }).ok === false);
  check("no contact means it cannot be sent, and says why",
        el({ status: "draft" }).ok === false && /No email or phone/.test(el({ status: "draft" }).reason));
  check("a client-row phone counts when the invoice has none",
        el({ status: "draft" }, { phone: "+15550000000" }).ok === true);

  console.log("\nsending: a non-2xx must not read as success\n");
  // The sdk RESOLVES with { data: { success: false } } on failure rather than
  // throwing. A batch that only catches exceptions would count this as sent.
  const calls = [];
  const invoke = async (name, payload) => {
    calls.push({ name, payload });
    if (payload.client_email === "bounce@example.com") {
      return { data: { success: false, error: "Recipient rejected" } };
    }
    if (payload.client_phone === "+15551111111") throw new Error("SMS blew up");
    return { data: { success: true } };
  };

  const good = await B.sendOneInvoice(
    { invoice: { id: "i1", invoice_number: "INV-1", client_email: "ok@example.com", total: 10 } }, invoke);
  check("a successful email is reported as emailed", good.emailed === true && good.errors.length === 0);

  const bounced = await B.sendOneInvoice(
    { invoice: { id: "i2", invoice_number: "INV-2", client_email: "bounce@example.com", total: 10 } }, invoke);
  check("a resolved failure is NOT counted as sent", bounced.emailed === false, JSON.stringify(bounced));
  check("and the provider's own reason is kept",
        /Recipient rejected/.test(bounced.errors[0]), bounced.errors[0]);

  const bothChannels = await B.sendOneInvoice(
    { invoice: { id: "i3", invoice_number: "INV-3", client_email: "ok@example.com",
                 client_phone: "+15551111111", total: 10 } }, invoke);
  check("a thrown SMS does not stop the email that already succeeded",
        bothChannels.emailed === true && bothChannels.texted === false, JSON.stringify(bothChannels));

  console.log("\nthe batch as a whole\n");
  const rows = [
    { invoice: { id: "a", invoice_number: "A", status: "draft", client_email: "ok@example.com" } },
    { invoice: { id: "b", invoice_number: "B", status: "draft", client_email: "bounce@example.com" } },
    { invoice: { id: "c", invoice_number: "C", status: "overdue", client_email: "ok@example.com" } },
  ];
  const seen = [];
  const summary = await B.sendInvoiceBatch(rows, invoke, (n) => seen.push(n));
  check("every invoice is attempted, even after one fails",
        summary.total === 3, summary.total);
  check("the counts split correctly", summary.sent === 2 && summary.failed === 1,
        JSON.stringify({ sent: summary.sent, failed: summary.failed }));
  check("progress fires once per invoice", seen.join(",") === "1,2,3", seen.join(","));

  const flip = B.draftsNowSent(rows, summary.results);
  check("only the DELIVERED draft is flipped to sent",
        flip.length === 1 && flip[0] === "a", JSON.stringify(flip));
  check("the overdue one is left alone, so it does not lose its lateness",
        !flip.includes("c"));
  check("the failed draft is not flipped", !flip.includes("b"));

  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
