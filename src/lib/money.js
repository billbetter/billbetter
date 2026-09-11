/**
 * Round an amount to whole cents, as a number: `0.1 + 0.2` -> 0.3, never
 * 0.30000000000000004. Anything that is not a number counts as 0.
 *
 * Arithmetic, not display -- formatting for the screen or a PDF happens where
 * the amount is shown. Deliberately not `lib/ai/lineItems`'s round2, which
 * adds Number.EPSILON first and so rounds 1.005 up where this rounds it down;
 * the two are not interchangeable.
 */
export function roundToCents(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Money, in the business's own currency.
 *
 * Six screens formatted amounts as USD and two as CAD, all of them hardcoded,
 * so a Canadian contractor saw their own invoices labelled "US$1,234.00" on
 * some pages and "$1,234.00" on others. The currency belongs to the business:
 * BusinessSettings.currency, which the 20260819140000_stripe_connect migration
 * added with a CAD default, and which the client-facing pages already use.
 *
 * The locale is the reader's, not "en-US": a Canadian reading CAD should see
 * "$1,234.00", and an American reading the same business's CAD invoice should
 * see "CA$1,234.00". Both are the same amount, named correctly for who is
 * looking.
 */

/**
 * An amount in `currency` (CAD unless the business has set another).
 *
 * No fraction-digit defaults of its own: "currency" style already means two
 * decimals for CAD and USD, and setting minimumFractionDigits here would
 * collide with a caller asking for whole dollars -- Intl throws when the
 * minimum exceeds an explicit maximum, which the catch below would then
 * quietly render as "0.00 CAD".
 */
export function formatMoney(amount, currency, options = {}) {
  const code = currency || "CAD";
  try {
    return (Number(amount) || 0).toLocaleString(undefined, {
      style: "currency",
      currency: code,
      ...options,
    });
  } catch {
    // An unknown currency code must not blank out a total.
    return `${(Number(amount) || 0).toFixed(2)} ${code}`.trim();
  }
}

/** A formatter bound to one currency, for a screen that formats many amounts. */
export function moneyFormatter(currency, options = {}) {
  return (amount) => formatMoney(amount, currency, options);
}
