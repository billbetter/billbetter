/**
 * Where a job stands with its invoice, worked out rather than stored.
 *
 * -- Why nothing is stored -------------------------------------------------
 *
 * The obvious implementation is a `requires_invoicing` boolean on Job, set by
 * whatever marks a job complete. It was rejected, and the reason is the whole
 * design: a stored flag has to be cleared by every path that could clear it,
 * and there are five -- invoicing the job, deleting that invoice, voiding it,
 * reopening the job, and the contractor invoicing outside the app. Miss one
 * and the flag lies, in the direction that costs money: a job that says it
 * still needs billing when it was billed a month ago is how a client gets
 * charged twice.
 *
 * Derived from the two rows that already exist -- the job and the invoice it
 * points at -- the answer cannot go stale, because there is nothing to go
 * stale. No migration, no backfill, and no flag to reconcile.
 *
 * -- The link is one-way ---------------------------------------------------
 *
 * `Job.linked_invoice_id` is the only join between the two. "Invoice" has no
 * job_id column, so a job knows its invoice and an invoice does not know its
 * job. Everything here reads in that direction only.
 *
 * -- The asymmetry that matters -------------------------------------------
 *
 * When a job's linked invoice is not in the list we were handed, the honest
 * answer is "I do not know" -- it may have been deleted, or it may simply be
 * outside the rows that were loaded (PostgREST caps a request at max-rows, and
 * a busy contractor's second year of invoices will hit that).
 *
 * Unknown is resolved as INVOICED, not as REQUIRES_INVOICING, and the two
 * mistakes are not equal. Flagging an already-billed job invites a contractor
 * to bill a client twice, which they find out about from the client. Failing
 * to flag one costs a reminder they were not getting before this feature
 * existed. The cheap mistake is the one we make.
 */

import { isVoided } from "@/lib/invoiceVoid";

export const BILLING_STATE = {
  /** Job is not finished. Billing part-way is allowed, just not prompted. */
  IN_PROGRESS: "in_progress",
  /** Finished, nothing valid billed against it. This is the flag. */
  REQUIRES_INVOICING: "requires_invoicing",
  /** An invoice exists and is live. */
  INVOICED: "invoiced",
  /** Its invoice is settled. Nothing left to do. */
  PAID: "paid",
  /** Cancelled job. Never prompted, never counted. */
  NOT_APPLICABLE: "not_applicable",
};

/** Why a job needs invoicing, which is not always "it never was". */
export const REQUIRES_REASON = {
  NEVER_INVOICED: "never_invoiced",
  INVOICE_VOIDED: "invoice_voided",
};

/**
 * Index invoices by id for lookup.
 *
 * Taken as a Map rather than rebuilt per job, because the jobs list calls this
 * once per render for every row and a linear scan per job is quadratic on the
 * exact accounts where it would be felt.
 */
export function indexInvoices(invoices = []) {
  const map = new Map();
  for (const invoice of invoices) {
    if (invoice?.id) map.set(invoice.id, invoice);
  }
  return map;
}

/**
 * What is happening with this job's billing.
 *
 * @param {object} job
 * @param {Map} invoicesById  from indexInvoices()
 * @returns {{ state: string, invoice: object|null, reason?: string,
 *             label: string, detail: string }}
 */
export function jobBillingState(job, invoicesById = new Map()) {
  const status = String(job?.status || "").toLowerCase();

  if (status === "cancelled") {
    return {
      state: BILLING_STATE.NOT_APPLICABLE,
      invoice: null,
      label: "Cancelled",
      detail: "Cancelled jobs are never flagged for invoicing.",
    };
  }

  const linkedId = job?.linked_invoice_id || null;
  const invoice = linkedId ? invoicesById.get(linkedId) || null : null;

  // A link we cannot resolve. See the header: this is deliberately the
  // reassuring answer rather than the alarming one.
  if (linkedId && !invoice) {
    return {
      state: BILLING_STATE.INVOICED,
      invoice: null,
      label: "Invoiced",
      detail: "This job is linked to an invoice that was not loaded.",
    };
  }

  if (invoice && !isVoided(invoice)) {
    if (String(invoice.status || "").toLowerCase() === "paid") {
      return {
        state: BILLING_STATE.PAID,
        invoice,
        label: "Paid",
        detail: `${invoice.invoice_number || "The invoice"} has been paid.`,
      };
    }
    return {
      state: BILLING_STATE.INVOICED,
      invoice,
      label: "Invoiced",
      detail: `${invoice.invoice_number || "An invoice"} is ${
        String(invoice.status || "open").toLowerCase()
      }.`,
    };
  }

  // Either nothing was ever invoiced, or what was invoiced has been voided.
  // Both leave the work unbilled, but they are different situations to be in
  // and the contractor is told which.
  const reason = invoice ? REQUIRES_REASON.INVOICE_VOIDED : REQUIRES_REASON.NEVER_INVOICED;

  if (status !== "completed") {
    return {
      state:
        reason === REQUIRES_REASON.INVOICE_VOIDED
          ? BILLING_STATE.REQUIRES_INVOICING
          : BILLING_STATE.IN_PROGRESS,
      invoice: invoice || null,
      reason,
      label: reason === REQUIRES_REASON.INVOICE_VOIDED ? "Needs invoicing" : "Not invoiced",
      detail:
        reason === REQUIRES_REASON.INVOICE_VOIDED
          ? `${invoice?.invoice_number || "Its invoice"} was voided, so this job is unbilled again.`
          : "Nothing billed yet. Invoicing before a job finishes is fine, it just is not chased.",
    };
  }

  return {
    state: BILLING_STATE.REQUIRES_INVOICING,
    invoice: invoice || null,
    reason,
    label: "Needs invoicing",
    detail:
      reason === REQUIRES_REASON.INVOICE_VOIDED
        ? `${invoice?.invoice_number || "Its invoice"} was voided, so this finished job is unbilled again.`
        : "This job is finished and has not been invoiced.",
  };
}

/**
 * Every job that needs invoicing, most valuable first.
 *
 * Sorted by what the job is worth rather than by age, because a contractor
 * working down this list wants the biggest unbilled thing first. Ties fall
 * back to completion date so the order is stable between renders.
 *
 * @returns {Array<{ job, state, value }>}
 */
export function jobsRequiringInvoicing(jobs = [], invoices = [], now = Date.now()) {
  const index = indexInvoices(invoices);
  return jobs
    .map((job) => ({ job, state: jobBillingState(job, index), value: jobValue(job) }))
    .filter((row) => row.state.state === BILLING_STATE.REQUIRES_INVOICING)
    .sort((a, b) => {
      if (b.value !== a.value) return b.value - a.value;
      return completedAt(b.job, now) - completedAt(a.job, now);
    });
}

/**
 * Roughly what a job is worth, from figures already on the row.
 *
 * actual_cost over estimated_cost, same precedence as billableHours() in
 * jobInvoice.js: estimated is what it was sold at, actual is what it came to.
 *
 * Deliberately NOT the real invoice total. Producing that means reading the
 * linked quote and every JobMaterial row for every job on the page -- two more
 * queries per job for a number shown in a banner. This one is on the row
 * already, costs nothing, and is labelled as approximate wherever it is shown.
 * The exact figure appears when the form opens, which is where it matters.
 */
export function jobValue(job) {
  const actual = Number(job?.actual_cost) || 0;
  if (actual > 0) return actual;
  return Number(job?.estimated_cost) || 0;
}

function completedAt(job, fallback) {
  const raw = job?.completion_date || job?.updated_at || job?.created_at;
  const t = raw ? new Date(raw).getTime() : NaN;
  return Number.isNaN(t) ? fallback : t;
}

/**
 * How long a finished job has been sitting unbilled.
 *
 * @returns {number|null} whole days, or null when there is no completion date
 *   to measure from -- which is common, since the field is optional.
 */
export function daysAwaitingInvoice(job, now = Date.now()) {
  if (!job?.completion_date) return null;
  const t = new Date(job.completion_date).getTime();
  if (Number.isNaN(t)) return null;
  const days = Math.floor((now - t) / 86400000);
  return days >= 0 ? days : null;
}

/**
 * The one-line summary for the jobs list banner.
 *
 * Returns null when nothing needs invoicing, so the caller renders nothing
 * rather than a banner announcing zero.
 */
export function requiresInvoicingSummary(rows = []) {
  if (!rows.length) return null;
  const value = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  return {
    count: rows.length,
    value,
    // "about" because jobValue() is the job's own cost figure, not a summed
    // invoice. Saying "$4,200" when the invoice comes to $4,380 is worse than
    // saying "about $4,200".
    label:
      rows.length === 1
        ? "1 finished job has not been invoiced"
        : `${rows.length} finished jobs have not been invoiced`,
  };
}
