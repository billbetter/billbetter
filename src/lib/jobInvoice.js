/**
 * Turn a finished job into the line items of an invoice.
 *
 * -- Why this is a module and not a handler --------------------------------
 *
 * The rules here are the whole feature. "Create Invoice" on a job already
 * existed and navigated to an EMPTY form -- CreateInvoice only ever prefilled
 * from a quote, and read the jobId purely to link the two records after saving.
 * So the contractor retyped, from a screen that already knew the answer.
 *
 * Pure functions, no sdk and no React, because the interesting part is the
 * arithmetic and the precedence, and both are worth testing without a browser.
 *
 * -- Where the numbers come from, in order --------------------------------
 *
 *   1. A linked quote's items, verbatim. If a quote exists, those numbers were
 *      shown to the client and very often approved by them. Re-deriving from
 *      the job would quietly bill a different figure to the one they agreed,
 *      which is the worst thing this module could do. So the quote wins, and
 *      it wins whole -- items, tax rate and all.
 *
 *   2. Otherwise, the job itself: labour hours times a rate, plus materials.
 *
 * Nothing here invents a number it was not given. A job with no hours, no rate
 * and no materials produces NO line items, and the caller opens the ordinary
 * empty form -- which is what happens today, so the feature can only improve
 * on it, never replace a real figure with a plausible one.
 *
 * -- On materials ----------------------------------------------------------
 *
 * Materials come from JobMaterial, which is the real table. The job screen's
 * expenses tab reads and writes `JobExpense`, which does not exist in the
 * database at all -- every call there 404s with PGRST205. That is a separate
 * bug, and this module deliberately does not join it: reading the table that
 * exists means materials appear here the moment anything writes to it.
 */

/** Two decimal places, without the float dust `0.1 + 0.2` leaves behind. */
function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function lineItem(description, quantity, rate) {
  const q = Number(quantity) || 0;
  const r = Number(rate) || 0;
  return { description, quantity: q, rate: money(r), amount: money(q * r) };
}

/**
 * Hours to bill for a job.
 *
 * actual_hours wins over estimated_hours whenever it has been filled in --
 * estimated is what the job was sold on, actual is what it took. A job that
 * ran long should not invoice the estimate just because the estimate is the
 * older field.
 *
 * Zero actual_hours is treated as "not recorded" rather than "worked no
 * hours", because nothing in the product distinguishes the two and billing
 * nothing is the more damaging reading of an ambiguous 0.
 */
export function billableHours(job) {
  const actual = Number(job?.actual_hours) || 0;
  if (actual > 0) return actual;
  return Number(job?.estimated_hours) || 0;
}

/** The labour rate, preferring the job's own over the business default. */
export function labourRate(job, settings) {
  const onJob = Number(job?.hourly_rate) || 0;
  if (onJob > 0) return onJob;
  return Number(settings?.hourly_rate) || 0;
}

/**
 * Line items for a job, and where they came from.
 *
 * @returns {{ items: Array, source: 'quote'|'job'|'none', taxRate: number|null }}
 *   `source` is returned so the UI can say which it used. A contractor who
 *   sees quote figures needs to know they are the quote's, not a fresh
 *   calculation, before sending.
 */
export function buildJobInvoiceItems({ job, materials = [], quote = null, settings = null }) {
  const quoteItems = Array.isArray(quote?.items) ? quote.items : [];
  if (quoteItems.length) {
    return {
      source: "quote",
      // Normalised, not trusted: a stored quote item may predate a field, and
      // amount is recomputed rather than carried, so a bad stored amount
      // cannot ride into an invoice.
      items: quoteItems.map((i) =>
        lineItem(i.description || "", i.quantity ?? 1, i.rate ?? 0),
      ),
      taxRate: Number(quote?.tax_rate) || 0,
    };
  }

  const items = [];

  const hours = billableHours(job);
  const rate = labourRate(job, settings);
  if (hours > 0 && rate > 0) {
    // Named after the job so a multi-job invoice stays readable once several
    // of these sit in one document.
    items.push(lineItem(`Labour — ${job?.job_title || "job"}`, hours, rate));
  }

  for (const m of materials) {
    const qty = Number(m?.quantity) || 0;
    const price = Number(m?.price_estimate) || 0;
    if (!m?.item_name || qty <= 0 || price <= 0) continue;
    const unit = m.unit ? ` (${m.unit})` : "";
    items.push(lineItem(`${m.item_name}${unit}`, qty, price));
  }

  return {
    source: items.length ? "job" : "none",
    items,
    taxRate: items.length ? Number(settings?.tax_rate) || 0 : null,
  };
}

/**
 * The full prefill CreateInvoice expects on location.state.
 *
 * Shaped to match what Timesheet already sends, because CreateInvoice's save
 * path reads `prefillData.job_id` and links the job to the invoice only AFTER
 * the invoice exists. That ordering matters and is worth keeping: the quote
 * flow marks a quote `converted` at the moment the button is pressed, so
 * abandoning the form leaves a quote claiming an invoice that was never made.
 * Passing job_id through here gets the correct ordering for free.
 *
 * @returns {object|null} null when there is nothing to prefill, so the caller
 *   can fall through to the ordinary empty form rather than opening one that
 *   looks prefilled and is not.
 */
export function buildJobInvoicePrefill({ job, client = null, materials = [], quote = null, settings = null }) {
  if (!job) return null;

  const { items, source, taxRate } = buildJobInvoiceItems({ job, materials, quote, settings });
  if (!items.length) return null;

  const subtotal = money(items.reduce((sum, i) => sum + i.amount, 0));
  const rate = Number(taxRate) || 0;
  const tax_amount = money((subtotal * rate) / 100);

  return {
    client_id: job.client_id || client?.id || "",
    client_name: job.client_name || client?.name || "",
    // The job carries no contact details, so they come from the Client row.
    // Without them the invoice saves but cannot be emailed or texted, and the
    // contractor finds out at the send step rather than here.
    client_email: client?.email || "",
    client_phone: client?.phone || "",
    client_address: client?.address || "",
    items,
    subtotal,
    tax_rate: rate,
    tax_amount,
    total: money(subtotal + tax_amount),
    status: "draft",
    notes: job.description || "",
    // Read by CreateInvoice after a successful save.
    job_id: job.id,
    // Not persisted; only so the form can say where the figures came from.
    prefill_source: source,
  };
}
