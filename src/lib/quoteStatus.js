/**
 * What a quote's status means, in one place.
 *
 * The app writes "approved" when a client accepts a quote -- approve-quote
 * does, the quote list filters on it, QuoteDetail displays it. Analytics was
 * looking for "accepted" instead, so approved quotes were missing from the
 * funnel, left out of the conversion rate, and listed as needing follow-up:
 * the contractor was told to chase clients who had already said yes.
 *
 * "accepted" and "rejected" are read as well, the way QuoteDetail reads
 * "rejected" beside "declined" -- cheap, and safe against older rows.
 */

/** The client said yes (or the quote has already become an invoice). */
export const WON_QUOTE_STATUSES = ["approved", "accepted", "converted"];

/** The client said no. */
export const DECLINED_QUOTE_STATUSES = ["declined", "rejected"];

/** Sent, and waiting on the client. */
export const PENDING_QUOTE_STATUSES = ["sent", "pending", "viewed"];

export const isWonQuote = (quote) => WON_QUOTE_STATUSES.includes(quote?.status);
export const isDeclinedQuote = (quote) =>
  DECLINED_QUOTE_STATUSES.includes(quote?.status);
export const isPendingQuote = (quote) =>
  PENDING_QUOTE_STATUSES.includes(quote?.status);
