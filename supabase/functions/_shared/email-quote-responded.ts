// Notifications 5 and 6: a client approved or declined a quote.
// Fired from approve-quote, after the response is already committed.
import {
  renderNotification,
  money,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type {
  QuoteApprovedPayload,
  QuoteDeclinedPayload,
} from "../_shared/notification-types.ts";

/**
 * One file, two templates, because they are the same event with opposite
 * signs and the contractor reads them in the same inbox. Splitting them into
 * two files would let the shape drift; a decline that looked structurally
 * different from an approval would read as a different KIND of message rather
 * than the other outcome of one decision.
 *
 * The typed name leads in both. That is the whole point of the record: not
 * "the quote changed state" but "this person said yes / no, on this date".
 */

export function quoteApprovedEmail(p: QuoteApprovedPayload): {
  subject: string;
  html: string;
} {
  const number = p.quoteNumber ? `#${p.quoteNumber}` : "";
  const who = p.approvedBy || "Your client";
  const on = niceDate(p.approvedAt);

  // The name the person TYPED, not the client_name on the record. They can
  // differ -- a spouse or a partner may be the one who actually agreed -- and
  // in a dispute the one that matters is what the approver asserted about
  // themselves. Where both exist and differ, both are shown.
  const onBehalf =
    p.clientName && p.clientName !== p.approvedBy
      ? ` on behalf of ${p.clientName}`
      : "";

  return {
    subject: `Quote ${number || ""} approved by ${who}`.replace(/\s+/g, " ").trim(),
    html: renderNotification({
      preheader: `${who} approved ${money(p.total)} of work.`,
      heading: "Quote approved",
      name: p.userName,
      intro:
        `${who} approved quote ${number}${onBehalf}. You can convert it to an invoice whenever you are ready.`
          .replace(/\s+/g, " ")
          .trim(),
      hero: {
        label: "Approved",
        value: money(p.total),
        accent: BRAND.success,
      },
      rows: [
        ...(p.quoteNumber ? [{ label: "Quote", value: `#${p.quoteNumber}` }] : []),
        { label: "Approved by", value: who },
        ...(p.clientName ? [{ label: "Client", value: p.clientName }] : []),
        ...(on ? [{ label: "Approved on", value: on }] : []),
      ],
      ...(p.quoteUrl ? { cta: { label: "View quote", url: p.quoteUrl } } : {}),
      footnote:
        "Replying to this email goes straight to your client.",
    }),
  };
}

export function quoteDeclinedEmail(p: QuoteDeclinedPayload): {
  subject: string;
  html: string;
} {
  const number = p.quoteNumber ? `#${p.quoteNumber}` : "";
  const who = p.declinedBy || "Your client";
  const on = niceDate(p.declinedAt);

  const onBehalf =
    p.clientName && p.clientName !== p.declinedBy
      ? ` on behalf of ${p.clientName}`
      : "";

  return {
    subject: `Quote ${number || ""} declined by ${who}`.replace(/\s+/g, " ").trim(),
    html: renderNotification({
      preheader: p.reason
        ? `${who} declined: ${p.reason}`
        : `${who} declined this quote.`,
      heading: "Quote declined",
      name: p.userName,
      intro:
        `${who} declined quote ${number}${onBehalf}.`
          .replace(/\s+/g, " ")
          .trim(),
      // Amber, not red. A declined quote is an outcome, not an error or a
      // failure on the contractor's part, and colouring it as one would make
      // ordinary business news read like something went wrong.
      hero: {
        label: "Declined",
        value: money(p.total),
        accent: BRAND.muted,
      },
      rows: [
        ...(p.quoteNumber ? [{ label: "Quote", value: `#${p.quoteNumber}` }] : []),
        { label: "Declined by", value: who },
        ...(p.clientName ? [{ label: "Client", value: p.clientName }] : []),
        ...(on ? [{ label: "Declined on", value: on }] : []),
        // Only when given. An empty "Reason: —" row invites the reader to
        // believe one was withheld, when usually none was asked for.
        ...(p.reason ? [{ label: "Reason", value: p.reason }] : []),
      ],
      ...(p.quoteUrl ? { cta: { label: "View quote", url: p.quoteUrl } } : {}),
      footnote: p.reason
        ? "Replying to this email goes straight to your client."
        : "No reason was given. Replying to this email goes straight to your client.",
    }),
  };
}
