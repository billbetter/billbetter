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
