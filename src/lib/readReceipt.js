/**
 * Read receipts: the one place that decides what a document's view columns
 * mean, for both invoices and quotes.
 *
 * -- Why this is a library and not three copies of the same ternary ---------
 *
 * `first_viewed_at`, `last_viewed_at` and `view_count` are written by
 * supabase/functions/_shared/public-link.ts under rules that are not obvious
 * from the column names -- a send-grace window, a bot filter, and a 30-minute
 * debounce. Four surfaces read them back (the invoice list, the quote list,
 * both detail pages) and every one of them is making the same claim TO THE
 * CONTRACTOR ABOUT THEIR CLIENT. That claim has to be identical everywhere,
 * because "opened" on one screen and "not opened" on another is the kind of
 * disagreement that makes someone stop believing the feature entirely.
 *
 * -- The honesty rules ------------------------------------------------------
 *
 * Two of these matter more than the formatting:
 *
 *   1. Absence of a view is NOT evidence of anything. A client who read the
 *      PDF attachment without clicking the link leaves no trace at all, and
 *      neither does one whose mail client blocked the page. So the negative
 *      case says "Not opened yet" -- never "your client has not read this" --
 *      and callers are expected to render nothing at all in dense views
 *      rather than print an accusation on every row.
 *
 *   2. A first-open timestamp outranks the counter. The two are written by
 *      separate branches of the same patch and the counter is deliberately
 *      allowed to lag (a debounced re-open moves `last_viewed_at` and not
 *      `view_count`), so a row can legitimately carry `first_viewed_at` with
 *      a zero count. Trusting the counter there would report "not opened"
 *      about a document we watched somebody open.
 */

/**
 * Opened inside this window is still news. Drives nothing but emphasis --
 * a caller may colour a fresh receipt and mute an old one.
 */
const FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * A second visit only counts as a separate one this far after the first.
 *
 * Same threshold src/lib/invoicePayments.js uses before it adds an "opened it
 * again" entry to the timeline: below it, the two stamps are one visit whose
 * page simply re-rendered, and reporting that as a return visit would invent
 * client interest that did not happen.
 */
const REOPEN_MS = 60 * 1000;

function parseStamp(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function longDate(date) {
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Describe one document's read receipt.
 *
 * `now` is injectable so `fresh` can be tested without waiting a day.
 *
 * @param {object|null|undefined} doc An Invoice or Quote row.
 * @param {number} [now] Epoch ms to measure freshness against.
 */
export function readReceipt(doc, now = Date.now()) {
  const firstAt = parseStamp(doc?.first_viewed_at);
  const lastAt = parseStamp(doc?.last_viewed_at);

  if (!firstAt) {
    return {
      opened: false,
      count: 0,
      firstAt: null,
      lastAt: null,
      reopened: false,
      fresh: false,
      shortLabel: "Not opened",
      label: "Not opened yet",
    };
  }

  // See honesty rule 2 above: the stamp wins over the counter.
  const count = Math.max(1, Number(doc.view_count) || 1);
  const reopened = Boolean(
    lastAt && lastAt.getTime() - firstAt.getTime() > REOPEN_MS,
  );

  return {
    opened: true,
    count,
    firstAt,
    lastAt,
    reopened,
    fresh: now - firstAt.getTime() < FRESH_MS,
    // For a table cell, where the row already says which document it is.
    shortLabel: count > 1 ? `Opened ${count}×` : "Opened",
    // For a detail page, where there is room to say when.
    label: `Opened ${count === 1 ? "once" : `${count} times`} · first on ${longDate(firstAt)}`,
  };
}

export const READ_RECEIPT_WINDOWS = { FRESH_MS, REOPEN_MS };
