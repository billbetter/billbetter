/**
 * Voiding an invoice: cancelling it without destroying the record of it.
 *
 * -- Why void is not delete -----------------------------------------------
 *
 * Today the only way to retract an invoice is Delete, which removes the row.
 * That is fine for a draft nobody ever saw and wrong for anything that was
 * sent: the client has the number in their inbox, and when they ask about
 * INV-482913 six weeks later there is nothing to look at. Worse, deleting is
 * silent -- there is no record that the invoice existed, who cancelled it, or
 * why.
 *
 * Voiding keeps the row exactly as it was, stamps who did it and when, and
 * closes every door that could still move money or mislead a client. The
 * invoice number is retained and never reissued, which is the entire point.
 *
 * -- Why a distinct status rather than reusing 'cancelled' ----------------
 *
 * "cancelled" already exists, and reusing it was tempting. It was rejected
 * because Invoices.jsx renders a status dropdown built from `statusConfig`,
 * so every status in that map is settable -- and reversible -- with one click
 * and no confirmation. A void set that way would carry no reason, no actor and
 * no timestamp, and could be clicked straight back to `sent` afterwards.
 *
 * `void` is deliberately NOT in that dropdown. It is reachable only through
 * voidPatch() below, and there is no unvoidPatch(). A one-way door has to be
 * built as one, or it is just a door.
 *
 * -- What this module is not ----------------------------------------------
 *
 * It is not the enforcement. Pure functions cannot stop anything; they only
 * say what the answer is. The actual blocking happens where the actions live:
 *
 *   editing        CreateInvoice refuses to open a voided invoice
 *   deleting       InvoiceDetail and Invoices hide Delete on a voided invoice
 *   batch send     NEVER_SEND in invoiceBatch.js
 *   reminders      REMINDABLE in reminders.js is 'overdue' only, so void is out
 *   card payment   buildInvoiceCheckoutSession refuses a voided invoice --
 *                  the one choke point BOTH payment routes go through
 *   public link    voidPatch() sets public_link_revoked_at, so docByToken()
 *                  stops resolving the token at the existing boundary rather
 *                  than through a new branch bolted into each function
 *
 * The last two are the ones that matter. Everything else is tidiness; those
 * two are money.
 */

import { ENTITY_COLUMNS } from "@/api/entityColumns";

export const VOID_STATUS = "void";

/** The columns the audit trail is written to. All four, or the feature is off. */
export const VOID_COLUMNS = ["voided_at", "void_reason", "voided_by", "voided_by_name"];

/**
 * Whether the database can actually record a void yet.
 *
 * This is a real guard, not a formality. localDataEngine strips keys that are
 * not in ENTITY_COLUMNS before every write -- so on a database without the
 * migration, a void would write `status: 'void'` and silently drop the
 * timestamp, the reason and the actor. The invoice would be voided with no
 * audit trail: precisely the thing this feature exists to prevent, arrived at
 * through the feature itself.
 *
 * So the UI asks first and refuses to offer Void at all until the columns are
 * there. Checked against the generated column map rather than by attempting a
 * write, because a half-completed void cannot be undone.
 */
export function voidSupported() {
  const columns = ENTITY_COLUMNS.Invoice;
  // No map for the table means no stripping either, so nothing would be lost.
  if (!columns) return true;
  return VOID_COLUMNS.every((c) => columns.includes(c));
}

/**
 * Is this invoice voided?
 *
 * Either signal is enough. status is what every list and filter reads;
 * voided_at is what survives if somebody edits a status by hand in the
 * dashboard. Treating either as voided means the restrictive answer wins,
 * which is the correct way round for a check that gates payment.
 */
export function isVoided(invoice) {
  if (!invoice) return false;
  return (
    String(invoice.status || "").toLowerCase() === VOID_STATUS ||
    Boolean(invoice.voided_at)
  );
}

/**
 * Whether this invoice may be voided, and why not.
 *
 * @returns {{ ok: boolean, reason?: string }}
 */
export function voidEligibility(invoice) {
  if (!invoice) return { ok: false, reason: "No invoice" };
  if (isVoided(invoice)) return { ok: false, reason: "Already voided" };

  // A paid invoice is a record of money that arrived. Voiding it would make
  // the books say the payment was never owed while the cash is still in the
  // account. A refund is a different operation, it happens in Stripe, and it
  // leaves the invoice paid and then refunded -- which is what actually
  // happened.
  if (String(invoice.status || "").toLowerCase() === "paid") {
    return {
      ok: false,
      reason: "This invoice is paid. Refund it in Stripe rather than voiding the record.",
    };
  }

  if (!voidSupported()) {
    return {
      ok: false,
      reason:
        "Voiding needs a database update that has not been applied yet, so the audit trail could not be recorded.",
    };
  }

  return { ok: true };
}

/**
 * The exact patch that voids an invoice.
 *
 * Every field is set here rather than by the caller, so there is one shape of
 * a voided invoice and no way to produce a partial one.
 *
 * `public_link_revoked_at` is the load-bearing line. Without it a client with
 * the link in their inbox can still open the page and pay, because
 * pay-public-invoice authorises on the token and nothing else. Setting it
 * routes a voided invoice into the SAME unavailable answer as a revoked link,
 * through docByToken(), which every public function already calls. No new
 * branch, no function that can be forgotten.
 *
 * It is set only if it is not already set, so voiding an invoice whose link
 * was revoked last week does not rewrite the date that actually happened.
 *
 * @param {object} invoice
 * @param {{ reason?: string, user?: object, now?: Date }} opts
 */
export function voidPatch(invoice, { reason = "", user = null, now = new Date() } = {}) {
  const at = new Date(now).toISOString();
  return {
    status: VOID_STATUS,
    voided_at: at,
    // Trimmed and capped. Free text that ends up in an audit line and, one
    // day, in an export.
    void_reason: String(reason || "").trim().slice(0, 500),
    voided_by: user?.id || null,
    // Stored alongside the id rather than joined at read time: a crew member
    // who is later removed still has to be nameable on an invoice they voided
    // last year. Same reason Quote keeps approved_by_name.
    voided_by_name:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      user?.email ||
      null,
    public_link_revoked_at: invoice?.public_link_revoked_at || at,
  };
}

/**
 * Whether a voided invoice was paid anyway.
 *
 * The window is narrow and real: voiding revokes the public link, so no NEW
 * Checkout session can be minted -- but a session opened before the void stays
 * valid for 24 hours. If the client pays in that window the money genuinely
 * arrives in the contractor's Stripe account.
 *
 * The webhook deliberately does NOT flip such an invoice to 'paid' (see
 * stripe-webhook), because that would erase the void and leave no sign the two
 * ever conflicted. It records the payment fields and leaves the status alone,
 * and this is what the UI reads to say so out loud. A contractor who has money
 * they cannot reconcile needs to be told, not protected from it.
 */
export function paidAfterVoid(invoice) {
  return isVoided(invoice) && Boolean(invoice?.paid_date || invoice?.stripe_payment_intent_id);
}

/** @returns {{ ok: boolean, reason?: string }} */
export function canEditInvoice(invoice) {
  if (isVoided(invoice)) {
    return { ok: false, reason: "A voided invoice cannot be edited. Create a replacement instead." };
  }
  return { ok: true };
}

/**
 * @returns {{ ok: boolean, reason?: string, prefer?: 'void' }}
 *
 * `prefer` is a nudge, not a refusal. Deleting a sent invoice is still
 * allowed -- it is allowed today, and quietly removing something contractors
 * can do is not this feature's job. But the dialog says what deleting costs
 * and offers Void, because for anything a client has seen, void is the answer
 * and delete is how the record disappears.
 */
export function canDeleteInvoice(invoice) {
  if (isVoided(invoice)) {
    return {
      ok: false,
      reason: "A voided invoice is kept as a record and cannot be deleted.",
    };
  }
  const status = String(invoice?.status || "").toLowerCase();
  if (status === "draft") return { ok: true };
  return { ok: true, prefer: "void" };
}

/**
 * The one-line audit trail, for the banner on a voided invoice.
 *
 * Returns null when the invoice is not voided, so the caller renders nothing
 * rather than an empty box.
 */
export function voidAuditLine(invoice, formatDate) {
  if (!isVoided(invoice)) return null;

  const when = invoice.voided_at
    ? typeof formatDate === "function"
      ? formatDate(invoice.voided_at)
      : new Date(invoice.voided_at).toISOString().slice(0, 10)
    : null;

  const parts = ["Voided"];
  if (when) parts.push(`on ${when}`);
  if (invoice.voided_by_name) parts.push(`by ${invoice.voided_by_name}`);

  const head = parts.join(" ");
  return invoice.void_reason ? `${head} — ${invoice.void_reason}` : head;
}
