/**
 * Make an AI-suggested line-item list add up to the total the contractor asked
 * for.
 *
 * -- Why this is not a prompt change --------------------------------------
 *
 * All three generators already ask the model for this, in three different
 * wordings: CreateInvoice has "EXACT PRICE EXTRACTION - HIGHEST PRIORITY" and
 * "distribute it across line items proportionally", CreateQuote has "adjust the
 * rates and quantities so the total sum of all items equals that exact amount",
 * QuickBillFlow has "honor them". Measured against the live model, two of three
 * sample jobs still came back wrong -- "Bathroom retile, total $1200" produced
 * $1600, and "Deck repair. I want to charge 800 dollars" produced $850.
 *
 * That is not a wording problem. The model picks plausible quantities and
 * rates, and their sum is a side effect it never checks. Asking more firmly
 * makes it likelier, not certain, and "likelier" is the wrong guarantee for the
 * number a contractor is going to be paid. Arithmetic belongs in code.
 *
 * So the prompt keeps asking -- a model that gets it right needs no correction
 * and keeps its own sensible rates -- and this reconciles whatever comes back.
 */

/** Money-shaped runs: 1200, 1,200.50. */
const MONEY = /(?:\$\s*)?(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/g;

/**
 * Cues that mean "this number is the whole job", as opposed to the price of one
 * line. Split into two strengths because they carry different risks.
 *
 * UNAMBIGUOUS words state a job total outright, so they are trusted even when
 * the description also prices individual items.
 *
 * SOFT cues ("for $250") are how people write a single-item price too --
 * "lock removal for $50, furnace for $200" is two line prices and no job total.
 * Those are only trusted when the description contains exactly one amount, so
 * there is nothing for the cue to be confused with.
 */
const UNAMBIGUOUS = [
  /\b(?:grand\s+)?total\b[^.\d$]{0,14}(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i,
  /(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?\s*)?\b(?:in\s+total|total|altogether|all\s*[-\s]?\s*in)\b/i,
  // The same words with the number after them: "altogether 300", "all-in 12000".
  /\b(?:altogether|in\s+total|all\s*[-\s]?\s*in)\b[^.\d$]{0,14}(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i,
  /\bbudget\b[^.\d$]{0,14}(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i,
];

const SOFT = [
  /\b(?:charge|bill|quote|invoice)\b(?:\s+(?:them|him|her|it|the\s+client|the\s+customer))?[^.\d$]{0,14}(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)/i,
  /\bfor\s+(?:\$\s*)?(\d[\d,]*(?:\.\d{1,2})?)\s*(?:dollars?)?\s*[.!]?\s*$/i,
];

const toNumber = (raw) => {
  const n = Number(String(raw).replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * The total the contractor asked for, or null when they did not ask for one.
 *
 * Conservative on purpose: a false positive silently rewrites prices the
 * contractor typed by hand, which is worse than leaving a total unenforced.
 *
 * @param {string} text the job description as typed
 * @returns {number|null}
 */
export function requestedTotal(text) {
  const s = String(text || "");
  if (!s.trim()) return null;

  for (const re of UNAMBIGUOUS) {
    const m = s.match(re);
    const n = m && toNumber(m[1]);
    if (n) return n;
  }

  // Only one number in play, so a soft cue cannot be a per-item price.
  const amounts = s.match(MONEY) || [];
  if (amounts.length !== 1) return null;

  for (const re of SOFT) {
    const m = s.match(re);
    const n = m && toNumber(m[1]);
    if (n) return n;
  }
  return null;
}

/** Sum of quantity x rate, to the cent. */
export function itemsTotal(items) {
  return round2(
    (items || []).reduce(
      (sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.rate) || 0),
      0,
    ),
  );
}

/**
 * Scale rates so the lines add up to `target`.
 *
 * Rates move, quantities do not: "8 hours" is a fact about the job the
 * contractor can check, while the hourly rate is the part being negotiated to
 * hit a number. Scaling quantities instead would invent 7.6 hours of work.
 *
 * Exact whenever a set of two-decimal rates can reach the figure at all. It
 * cannot always: one line of quantity 3 asked to reach $100 sits between 33.33
 * and 33.34, and no printable rate lands on it. There the result is a cent
 * away, which beats an unprintable rate or a $400 miss.
 *
 * @param {Array<{quantity:number, rate:number}>} items
 * @param {number|null} target
 * @returns {Array} items whose quantity x rate sums to target
 */
export function reconcileToTotal(items, target) {
  const list = Array.isArray(items) ? items : [];
  if (!target || target <= 0 || list.length === 0) return list;

  const current = itemsTotal(list);
  // Nothing to scale from: every line is free, or quantities are all zero.
  if (current <= 0) return list;
  if (Math.abs(current - target) < 0.005) return list;

  const targetCents = Math.round(target * 100);
  const factor = target / current;

  // Cents, not floats. Rates are money and have to survive being printed, so
  // the correction is done on integers and converted back once at the end.
  const scaled = list.map((it) => ({
    item: it,
    q: Number(it.quantity) || 0,
    cents: Math.round((Number(it.rate) || 0) * factor * 100),
  }));

  const sumCents = () =>
    scaled.reduce((sum, r) => sum + Math.round(r.q * r.cents), 0);

  // Rounding each rate to the cent leaves a remainder. Spend it on the SMALLEST
  // quantities first: moving a rate by one cent moves the total by `quantity`
  // cents, so a small quantity is the fine adjustment and a large one is the
  // coarse one that cannot land on the figure. Doing this the other way round
  // is what left "Deck repair, 800" at 799.66 in testing -- half a cent of
  // rounding on a quantity of 100 is fifty cents of error.
  const order = scaled
    .map((r, i) => ({ i, q: r.q }))
    .filter((r) => r.q > 0)
    .sort((a, b) => a.q - b.q);

  let residual = targetCents - sumCents();

  // Best-so-far, so a search that cannot reach the figure still returns the
  // closest arrangement it saw rather than wherever the loop happened to stop.
  let best = scaled.map((r) => r.cents);
  let bestResidual = residual;

  // One pass of "spend the residual on the finest line that can take a whole
  // step" is not always enough: quantities of 8 and 100 chasing 1234.56 leave 4
  // cents that neither divides. Nudging the coarsest line by a single cent
  // changes the remainder, and the fine lines can then finish the job -- so the
  // two alternate until it lands. The guard bounds a case that never can, such
  // as a lone quantity of 3 reaching 100.
  for (let guard = 0; guard < 12 && residual !== 0; guard += 1) {
    let moved = false;
    for (const { i, q } of order) {
      const step = Math.trunc(residual / q);
      // Never price a line at or below zero to satisfy the arithmetic.
      if (step === 0 || scaled[i].cents + step <= 0) continue;
      scaled[i].cents += step;
      residual -= Math.round(step * q);
      moved = true;
    }
    if (!moved) {
      const coarse = order[order.length - 1];
      const dir = residual > 0 ? 1 : -1;
      if (scaled[coarse.i].cents + dir <= 0) break;
      scaled[coarse.i].cents += dir;
      residual -= Math.round(dir * coarse.q);
    }
    if (Math.abs(residual) < Math.abs(bestResidual)) {
      bestResidual = residual;
      best = scaled.map((r) => r.cents);
    }
  }
  scaled.forEach((r, i) => {
    r.cents = best[i];
  });

  return scaled.map(({ item, q, cents }) => {
    const rate = cents / 100;
    return { ...item, rate, amount: round2(q * rate) };
  });
}

/**
 * The whole job in one call: read the asked-for total out of the description
 * and make the items match it.
 *
 * @param {Array} items  what the model returned
 * @param {string} text  the job description as typed
 */
export function applyRequestedTotal(items, text) {
  return reconcileToTotal(items, requestedTotal(text));
}
