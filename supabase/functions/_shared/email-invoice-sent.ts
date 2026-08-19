// Notification 2 of 4: a contractor sent an invoice to their client.
// This goes to the CONTRACTOR as a delivery confirmation — the client
// separately receives the invoice itself from send-invoice-email.
import {
  renderNotification,
  money,
  niceDate,
  BRAND,
} from "../_shared/notification-layout.ts";
import type { InvoiceSentPayload } from "../_shared/notification-types.ts";

export function invoiceSentEmail(p: InvoiceSentPayload): {
  subject: string;
  html: string;
} {
  const number = p.invoiceNumber ? `#${p.invoiceNumber}` : "";
  const client = p.clientName || "your client";
  const due = niceDate(p.dueDate);

  return {
    subject: `Invoice ${number} sent to ${client}`.replace(/\s+/g, " ").trim(),
    html: renderNotification({
      preheader: `${money(p.amount)} invoice delivered to ${p.sentTo}.`,
      heading: "Invoice sent",
      name: p.userName,
      intro:
        `Invoice ${number || ""} went out to ${client}. We will email you the moment it is paid.`
          .replace(/\s+/g, " ")
          .trim(),
      hero: {
        label: "Amount invoiced",
        value: money(p.amount),
        accent: BRAND.primary,
      },
      rows: [
        ...(p.invoiceNumber
          ? [{ label: "Invoice", value: `#${p.invoiceNumber}` }]
          : []),
        { label: "Client", value: client },
        { label: "Delivered to", value: p.sentTo },
        ...(due ? [{ label: "Due", value: due }] : []),
      ],
      ...(p.invoiceUrl
        ? { cta: { label: "View invoice", url: p.invoiceUrl } }
        : {}),
    }),
  };
}
