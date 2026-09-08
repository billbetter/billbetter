// Notification 7: a client opened an invoice or quote for the first time.
// Fired from _shared/public-link.ts, after the view is already recorded.
import {
  renderNotification,
  money,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type { DocumentViewedPayload } from "../_shared/notification-types.ts";

/**
 * How long the document sat between being sent and being opened.
 *
 * Rendered as a row because it is the part a contractor reasons with: opened
 * within the hour is a client on top of things, opened after nine days is a
 * client who needed the reminder. Returns "" when it cannot be computed or
 * when the gap is negative -- a clock skew must not produce "opened -2 hours
 * after it was sent".
 */
function waitedFor(sentAt?: string | null, viewedAt?: string | null): string {
  if (!sentAt || !viewedAt) return "";
  const from = new Date(sentAt).getTime();
  const to = new Date(viewedAt).getTime();
  if (isNaN(from) || isNaN(to) || to < from) return "";

  const minutes = Math.round((to - from) / 60000);
  if (minutes < 60) return minutes <= 1 ? "Within a minute" : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return hours === 1 ? "About an hour" : `About ${hours} hours`;
  const days = Math.round(hours / 24);
  return `${days} days`;
}

export function documentViewedEmail(p: DocumentViewedPayload): {
  subject: string;
  html: string;
} {
  const isInvoice = p.kind === "invoice";
  const noun = isInvoice ? "invoice" : "quote";
  const number = p.number ? `#${p.number}` : "";
  const who = p.clientName || "Someone";
  const waited = waitedFor(p.sentAt, p.viewedAt);

  return {
    // The client's name leads. In a phone's notification shade the contractor
    // sees perhaps six words, and "Dave Carter opened invoice #1042" is a
    // complete thought where "Invoicium notification" is not.
    subject: `${who} opened ${noun} ${number}`.replace(/\s+/g, " ").trim(),
    html: renderNotification({
      preheader: `${who} just opened your ${noun}${number ? ` ${number}` : ""} for ${money(p.total)}.`,
      heading: `${isInvoice ? "Invoice" : "Quote"} opened`,
      name: p.userName,
      intro: isInvoice
        ? `${who} opened ${noun} ${number} for the first time. Nothing has been paid yet — this only means the link was viewed.`
            .replace(/\s+/g, " ")
            .trim()
        : `${who} opened ${noun} ${number} for the first time. They have not approved or declined it yet.`
            .replace(/\s+/g, " ")
            .trim(),
      // Blue, not green. An open is information, not money in the bank, and
      // colouring it like a payment would train someone to misread the one
      // email that does mean they got paid.
      hero: {
        label: isInvoice ? "Amount due" : "Quote total",
        value: money(p.total),
        accent: BRAND.primary,
      },
      rows: [
        ...(p.number
          ? [{ label: isInvoice ? "Invoice" : "Quote", value: `#${p.number}` }]
          : []),
        ...(p.clientName ? [{ label: "Client", value: p.clientName }] : []),
        ...(niceDate(p.viewedAt)
          ? [{ label: "Opened", value: niceDate(p.viewedAt) }]
          : []),
        ...(waited ? [{ label: "Waited", value: waited }] : []),
      ],
      ...(p.documentUrl
        ? {
            cta: {
              label: isInvoice ? "View invoice" : "View quote",
              url: p.documentUrl,
            },
          }
        : {}),
      // The honest caveat, in the place people actually read it. Without this
      // a contractor will eventually treat silence as being ignored and ring a
      // client who read the PDF the day it arrived.
      footnote:
        "You only get this once per document, the first time it is opened. " +
        "Opens of the attached PDF are not counted, so no notice here does not " +
        "mean they have not seen it. Turn these off under Notifications in Settings.",
    }),
  };
}
