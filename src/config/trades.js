/**
 * The trades this product is sold to.
 *
 * One list, because it is rendered in two places that must agree: the "Trusted
 * by" row on the homepage and the trade dropdown on the demo form. Two copies
 * would drift, and the drift is visible to the customer -- a visitor who reads
 * "Roofing" in the hero and then cannot find it in the dropdown has been told
 * the product is not for them.
 *
 * Order is deliberate: the three trades that invoice most often first, then the
 * rest roughly by how common they are. "Other" is only ever appended by the
 * dropdown -- it is not a trade and does not belong in a list that is also
 * rendered as marketing copy.
 */
export const TRADES = [
  "Electrical",
  "HVAC",
  "Plumbing",
  "Carpentry",
  "Landscaping",
  "Roofing",
  "Painting",
  "Flooring",
  "General Contracting",
  "Cleaning",
];

/** The dropdown's options: every trade, plus an escape hatch. */
export const TRADE_OPTIONS = [...TRADES, "Other"];

/** How many people are on the tools. One click, not a number field. */
export const TEAM_SIZES = [
  { id: "solo", label: "Just me", hint: "Solo operator" },
  { id: "crew", label: "Me + a crew", hint: "2 or more" },
];
