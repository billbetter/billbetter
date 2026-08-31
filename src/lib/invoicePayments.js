/**
 * What has been paid on an invoice, and what happened to it.
 *
 * -- What was there before -------------------------------------------------
 *
 * Nothing in the app had ever written `paid_date`; only stripe-webhook did.
 * Marking an offline payment meant picking "paid" from the status dropdown,
 * and handleStatusChange wrote `{ status: 'paid' }` and nothing else -- no
 * date, no amount, no method, no actor. A cheque received last Tuesday was
 * recorded as an invoice that is paid, somehow, at some point.
 *
 * -- Money is summed in whole cents ---------------------------------------
 *
 * Every total here is computed in integer cents and converted back once. Three
 * payments of 33.33 against a 100.00 invoice must leave a balance of 0.01 and
 * not 0.010000000000005, because the balance is compared against zero to
 * decide whether an invoice is settled -- and a float that lands just above
 * zero leaves an invoice permanently one hundredth of a cent short, chased
 * forever for money nobody owes.
 *
 * -- No new status --------------------------------------------------------
 *
 * A partly paid invoice keeps the status it has and carries a balance. Adding
 * a `partially_paid` status would mean touching every consumer of `status` --
 * the list filters, batchSendEligibility, the reminder ladder, the overdue
 * sweep, the public page -- and the one that got missed would stop chasing an
 * invoice that is still owed. The balance is shown instead, which is the fact
 * the contractor actually wants, and the reminder ladder keeps working
 * unmodified: an invoice with $300 still owed is still overdue.
 */

import { ENTITY_COLUMNS } from "@/api/entityColumns";
import { isVoided } from "@/lib/invoiceVoid";

/** Methods offered in the UI. Not a constraint -- the column is free text. */
export const PAYMENT_METHODS = [
  "Cash",
  "Cheque",
  "e-Transfer",
  "Bank transfer",
  "Card",
  "Other",
];

/**
 * Whether the database can record payments yet.
 *
 * The same guard as voidSupported(), for the same reason and a worse failure.
 * localDataEngine falls back to localStorage when a table is missing, so
 * without the migration a payment would appear to save, live in one browser,
 * and be invisible from every other device -- while the invoice it belongs to
 * is on the server saying it is paid. Money that exists on one laptop is worse
 * than money that failed to save.
 */
export function paymentsSupported() {
  return Boolean(ENTITY_COLUMNS.InvoicePayment);
}

/** True once the history table exists. The timeline works without it. */
export function historySupported() {
  return Boolean(ENTITY_COLUMNS.InvoiceEvent);
}

const cents = (n) => Math.round((Number(n) || 0) * 100);
const fromCents = (c) => Math.round(c) / 100;

/** Two decimal places, matching the rounding used elsewhere. */
export function money(n) {
  return fromCents(cents(n));
}

/**
 * The money position on one invoice.
 *
 * @param {object} invoice
 * @param {Array} payments  rows from "InvoicePayment" for this invoice
 * @returns {{ total: number, paid: number, balance: number, settled: boolean,
 *             overpaid: boolean, count: number }}
 */
export function paymentSummary(invoice, payments = []) {
  const totalCents = cents(invoice?.total);
  const paidCents = (payments || []).reduce((sum, p) => sum + cents(p?.amount), 0);
  const balanceCents = totalCents - paidCents;

  return {
    total: fromCents(totalCents),
    paid: fromCents(paidCents),
    balance: fromCents(balanceCents),
    // <= 0 rather than === 0, so an overpayment counts as settled rather than
    // leaving the invoice open with a negative balance.
    settled: totalCents > 0 && balanceCents <= 0,
    overpaid: balanceCents < 0,
    count: (payments || []).length,
  };
}

/**
 * What the status SHOULD be, given the payments.
 *
 * Only ever returns a status when the payments themselves settle it. It never
 * reopens an invoice: an invoice already marked paid stays paid even if no
 * payment rows exist, because most invoices in the account were paid before
 * this feature existed and they must not all revert to unpaid.
 *
 * @returns {string|null} the status to write, or null to leave it alone
 */
export function statusFromPayments(invoice, payments = []) {
  // A voided invoice's status is frozen. Money arriving against one is a
  // conflict the UI reports; it is not a reason to quietly mark it paid.
  if (isVoided(invoice)) return null;

  const current = String(invoice?.status || "").toLowerCase();
  if (current === "paid") return null;

  const { settled } = paymentSummary(invoice, payments);
  return settled ? "paid" : null;
}

/**
 * The date the invoice was settled: the LAST payment that brought the balance
 * to zero, not the first payment and not today.
 *
 * Used for `paid_date`, which is what the revenue charts are dated by. A
 * deposit in January against an invoice settled in April is April's revenue,
 * because that is when the invoice stopped being owed.
 *
 * @returns {string|null} "yyyy-MM-dd"
 */
export function settledDate(invoice, payments = []) {
  const { settled } = paymentSummary(invoice, payments);
  if (!settled) return null;
  const dates = (payments || []).map((p) => p?.paid_at).filter(Boolean).sort();
  return dates.length ? String(dates[dates.length - 1]).slice(0, 10) : null;
}

/**
 * The payment row to insert.
 *
 * Built here rather than at the call site so there is one shape of a payment
 * and no way for a screen to produce a partial one.
 */
export function paymentRecord({ invoice, amount, paidAt, method, reference, notes, user }) {
  return {
    user_id: invoice?.user_id || user?.id || null,
    invoice_id: invoice?.id,
    amount: money(amount),
    // A date, never a timestamp -- see the migration. Defaults to today
    // because that is the common case, but the field is editable, because a
    // cheque banked on Friday is often entered on Monday.
    paid_at: String(paidAt || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    method: method ? String(method).trim().slice(0, 60) : null,
    reference: reference ? String(reference).trim().slice(0, 120) : null,
    notes: notes ? String(notes).trim().slice(0, 500) : null,
    recorded_by: user?.id || null,
    recorded_by_name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      null,
  };
}

/**
 * Whether an amount can be recorded against this invoice.
 *
 * @returns {{ ok: boolean, reason?: string, warning?: string }}
 *   `warning` is not a refusal. Overpaying is legitimate -- a client rounds up,
 *   or pays two invoices with one cheque -- so it is flagged and allowed. A
 *   product that refuses money that has genuinely arrived is worse than one
 *   that records an awkward number.
 */
export function validatePayment({ invoice, payments = [], amount }) {
  if (!paymentsSupported()) {
    return {
      ok: false,
      reason:
        "Recording payments needs a database update that has not been applied yet.",
    };
  }
  if (isVoided(invoice)) {
    return { ok: false, reason: "This invoice has been voided." };
  }

  const value = Number(amount);
  if (!Number.isFinite(value) || cents(value) === 0) {
    return { ok: false, reason: "Enter an amount." };
  }

  const { balance } = paymentSummary(invoice, payments);
  if (cents(value) > cents(balance) && cents(balance) >= 0) {
    return {
      ok: true,
      warning: `That is more than the ${formatMoney(balance)} still owed. It will be recorded as an overpayment.`,
    };
  }
  return { ok: true };
}

/** Currency for display. Matches the `$` convention used across the app. */
export function formatMoney(n) {
  const v = Number(n) || 0;
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---- The timeline --------------------------------------------------------

/**
 * Everything that happened to an invoice, newest first.
 *
 * -- Why most of this is DERIVED ------------------------------------------
 *
 * An events table records nothing that happened before it existed, so a
 * history built only from stored rows would be empty for every invoice already
 * in the account -- which is all of them on the day this ships. Most of an
 * invoice's history is already on the invoice itself: when it was created,
 * when the client first opened it, how many reminders went out and when the
 * last one did, whether the link was revoked, whether it was voided and by
 * whom. Those are read here and merged with the stored events, so the timeline
 * is populated from day one and the stored table only has to carry what has no
 * column of its own.
 *
 * The cost is honesty about resolution: the invoice row keeps only the LAST
 * reminder date and a count, so the timeline says "3 reminders sent, last on
 * 4 March" rather than inventing three entries at dates nobody recorded.
 *
 * @param {object} invoice
 * @param {Array} payments  rows from "InvoicePayment"
 * @param {Array} events    rows from "InvoiceEvent"
 * @returns {Array<{ at: string, kind: string, title: string, detail?: string,
 *                   actor?: string, amount?: number }>}
 */
export function invoiceTimeline(invoice, payments = [], events = []) {
  const entries = [];
  const push = (at, kind, title, extra = {}) => {
    if (!at) return;
    const t = new Date(at).getTime();
    if (Number.isNaN(t)) return;
    entries.push({ at: new Date(at).toISOString(), kind, title, ...extra });
  };

  push(invoice?.created_at || invoice?.created_date, "created", "Invoice created");

  for (const p of payments || []) {
    const parts = [p.method, p.reference].filter(Boolean).join(" · ");
    push(paymentInstant(p), "payment", `Payment of ${formatMoney(p.amount)}`, {
      detail: parts || undefined,
      actor: p.recorded_by_name || undefined,
      amount: Number(p.amount) || 0,
    });
  }

  push(invoice?.first_viewed_at, "viewed", "Client opened the invoice");
  // Only when it differs from the first, otherwise one view produces two
  // identical-looking entries a second apart.
  if (
    invoice?.last_viewed_at &&
    invoice?.first_viewed_at &&
    new Date(invoice.last_viewed_at).getTime() - new Date(invoice.first_viewed_at).getTime() > 60000
  ) {
    push(invoice.last_viewed_at, "viewed", "Client opened it again", {
      detail: invoice.view_count ? `${invoice.view_count} views in total` : undefined,
    });
  }

  if (invoice?.last_reminder_sent_at) {
    const n = Number(invoice.reminder_count) || 0;
    push(
      invoice.last_reminder_sent_at,
      "reminder",
      n > 1 ? `${n} reminders sent` : "Reminder sent",
      // Said plainly: the invoice row keeps a count and one date, so the dates
      // of the earlier reminders genuinely are not recorded anywhere.
      { detail: n > 1 ? "Showing the most recent; earlier dates are not kept" : undefined },
    );
  }

  if (invoice?.voided_at) {
    push(invoice.voided_at, "voided", "Voided", {
      detail: invoice.void_reason || undefined,
      actor: invoice.voided_by_name || undefined,
    });
  } else if (invoice?.public_link_revoked_at) {
    // Only when it was not a void. Voiding revokes the link as a side effect,
    // and showing both makes one action look like two.
    push(invoice.public_link_revoked_at, "link", "Client link switched off");
  }

  for (const e of events || []) {
    const title =
      e.kind === "status_changed"
        ? `Status changed${e.from_status ? ` from ${e.from_status}` : ""} to ${e.to_status || "?"}`
        : e.detail || e.kind;
    push(e.at || e.created_at, e.kind || "event", title, {
      detail: e.kind === "status_changed" ? e.detail || undefined : undefined,
      actor: e.actor_name || undefined,
    });
  }

  // Newest first, and stable: two entries at the same instant keep the order
  // they were added, so a payment and the status change it caused do not swap
  // places between renders.
  return entries
    .map((e, i) => ({ e, i }))
    .sort((a, b) => {
      const d = new Date(b.e.at).getTime() - new Date(a.e.at).getTime();
      return d !== 0 ? d : a.i - b.i;
    })
    .map(({ e }) => e);
}

/**
 * A sortable instant for a payment.
 *
 * `paid_at` is a DATE, so every payment on the same day would otherwise sort
 * arbitrarily against timestamped entries at midnight. created_at is used to
 * break ties within the day, while the day itself still comes from paid_at --
 * which is the date that matters and the one the contractor entered.
 */
function paymentInstant(payment) {
  const day = String(payment?.paid_at || "").slice(0, 10);
  if (!day) return payment?.created_at || null;
  const created = payment?.created_at ? new Date(payment.created_at) : null;
  if (created && !Number.isNaN(created.getTime())) {
    const sameDay = created.toISOString().slice(0, 10) === day;
    if (sameDay) return created.toISOString();
  }
  // Midday rather than midnight, so a payment dated the 4th sorts after
  // anything timestamped early on the 4th and before anything late on it.
  return `${day}T12:00:00.000Z`;
}

/** The event row recording a status change. */
export function statusChangeEvent({ invoice, from, to, detail, user }) {
  return {
    user_id: invoice?.user_id || user?.id || null,
    invoice_id: invoice?.id,
    at: new Date().toISOString(),
    kind: "status_changed",
    from_status: from || null,
    to_status: to || null,
    detail: detail || null,
    actor_id: user?.id || null,
    actor_name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      null,
  };
}

/**
 * Index payments by invoice id.
 *
 * Taken by every list screen that wants a balance per row, so the lookup is
 * built once rather than filtered per invoice, which is quadratic on exactly
 * the accounts where it would be noticed.
 */
export function indexPaymentsByInvoice(payments = []) {
  const map = new Map();
  for (const p of payments) {
    if (!p?.invoice_id) continue;
    if (!map.has(p.invoice_id)) map.set(p.invoice_id, []);
    map.get(p.invoice_id).push(p);
  }
  return map;
}

/**
 * The date revenue from this invoice should be counted on.
 *
 * paid_date first -- it is what the webhook and the settle path write. Then
 * the last payment, for an invoice marked paid before this feature existed but
 * with payments since. Then created_at, which is what every chart used to use
 * for everything and is the only thing left for a historic invoice that was
 * marked paid by hand and carries no date at all.
 *
 * Returning the creation date as a LAST resort rather than as the rule is the
 * whole change: Analytics dated every invoice by when it was raised, so an
 * invoice sent in January and paid in April counted as January revenue.
 */
export function revenueDate(invoice, payments = []) {
  if (invoice?.paid_date) return new Date(invoice.paid_date);
  const dates = (payments || []).map((p) => p?.paid_at).filter(Boolean).sort();
  if (dates.length) return new Date(`${String(dates[dates.length - 1]).slice(0, 10)}T12:00:00Z`);
  return new Date(invoice?.created_at || invoice?.created_date || Date.now());
}
