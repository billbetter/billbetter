// Notification 3 of 4: Stripe confirmed a client paid an invoice.
// Fired from the stripe-webhook on payment_intent.succeeded.
import {
  renderNotification,
  money,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type { InvoicePaidPayload } from "../_shared/notification-types.ts";

export function invoicePaidEmail(p: InvoicePaidPayload): {
  subject: string;
  html: string;
} {
  const number = p.invoiceNumber ? `#${p.invoiceNumber}` : "";
  const client = p.clientName || "Your client";
  const paid = niceDate(p.paidAt);

  return {
    subject: `You got paid — ${money(p.amount)}${number ? ` for invoice ${number}` : ""}`,
    html: renderNotification({
      preheader: `${client} paid ${money(p.amount)}.`,
      heading: "You just got paid",
      name: p.userName,
      intro:
        `${client} paid invoice ${number || ""}. The funds are on their way to your account.`
          .replace(/\s+/g, " ")
          .trim(),
      // Green here, not brand blue: money landing is the one moment worth
      // colouring as a success rather than as ordinary product chrome.
      hero: {
        label: "Amount received",
        value: money(p.amount),
        accent: BRAND.success,
      },
      rows: [
        ...(p.invoiceNumber
          ? [{ label: "Invoice", value: `#${p.invoiceNumber}` }]
          : []),
        { label: "Client", value: client },
        ...(paid ? [{ label: "Paid on", value: paid }] : []),
      ],
      ...(p.invoiceUrl
        ? { cta: { label: "View invoice", url: p.invoiceUrl } }
        : {}),
      footnote:
        "Payouts settle on your Stripe schedule, usually within a few business days.",
    }),
  };
}
