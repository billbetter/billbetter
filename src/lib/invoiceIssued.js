/**
 * The date an invoice was issued, as distinct from the date its row was made.
 *
 * -- Why this is a module and not two lines at the call site ---------------
 *
 * An invoice becomes 'sent' in three unrelated places -- CreateInvoice's
 * send-now path, the batch send on Invoices, and QuickBillFlow -- and a fourth
 * will arrive the moment recurring invoices start generating. Four copies of
 * "stamp today's date, but only if it is not already stamped" is four chances
 * for one of them to forget, and the symptom of forgetting is an invoice with
 * no issue date that nobody notices until a demand letter has to name one.
 *
 * -- Read through issueDateOf(), always -----------------------------------
 *
 * date_issued is nullable and will be null for a while yet: on drafts, which
 * genuinely have no issue date, and on any invoice sent by a browser still
 * running a bundle from before this shipped. created_at is the documented
 * fallback -- it is what the backfill used for existing rows, so reads stay
 * consistent with what is already in the table.
 */

/**
 * The patch that records an invoice as issued.
 *
 * Applied only where an invoice is actually going out. Note it does NOT
 * overwrite an existing date: an overdue invoice re-sent as a reminder was
 * issued once, months ago, and re-stamping it would quietly reset how old the
 * debt appears -- in the one document where its age is the argument.
 */
export function issuedPatch(invoice, now = new Date()) {
  if (invoice?.date_issued) return {};
  // A full instant, deliberately -- Quote writes its own date_issued as a bare
  // "yyyy-MM-dd", and that shape is the reason a due date read a day early on
  // the chase queue: PostgreSQL stores the bare date as midnight UTC, which is
  // the previous evening anywhere west of Greenwich. An instant round-trips.
  // It also matches the backfill, which copied created_at.
  return { date_issued: new Date(now).toISOString() };
}

/**
 * The issue date to display or put in a document, or null if there is none.
 *
 * Returns a Date rather than a string so callers format it themselves; every
 * surface that shows this wants a different format.
 */
export function issueDateOf(invoice) {
  const raw = invoice?.date_issued || invoice?.created_at;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
