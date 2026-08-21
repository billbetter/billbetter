// Shared email building blocks for transactional emails (invoices, quotes, invites).
// All templates use inline styles and a dark-on-light palette that renders reliably
// across Gmail, Outlook, Apple Mail, and major mobile clients.

export function escapeHtml(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function formatCurrency(value: unknown): string {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export interface LineItem {
  description?: string;
  quantity?: number | string;
  rate?: number | string;
  total?: number | string;
}

export interface EmailBranding {
  business_name?: string;
  sender_name?: string;
  sender_email?: string;
  sender_phone?: string;
  sender_address?: string;
  website?: string;
}

interface LayoutOptions {
  preheader?: string;
  heading: string;
  heroLabel: string;
  heroValue: string;
  heroAccent?: string;
  intro: string;
  detailsRows: { label: string; value: string }[];
  items?: LineItem[];
  summary?: { label: string; value: string; emphasized?: boolean }[];
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCtaLabel?: string;
  secondaryCtaUrl?: string;
  notes?: string;
  footerMessage?: string;
  branding: EmailBranding;
}

// brand-700 / brand-800 from src/index.css, matching notification-layout.ts.
const PRIMARY = "#0369A1";
const PRIMARY_DARK = "#075985";
const TEXT = "#0f172a";
const MUTED = "#64748b";
const BORDER = "#e2e8f0";
const SOFT_BG = "#f8fafc";

export function renderEmailLayout(opts: LayoutOptions): string {
  const {
    preheader = "",
    heading,
    heroLabel,
    heroValue,
    heroAccent = PRIMARY,
    intro,
    detailsRows,
    items,
    summary,
    ctaLabel,
    ctaUrl,
    secondaryCtaLabel,
    secondaryCtaUrl,
    notes,
    footerMessage,
    branding,
  } = opts;

  const businessName = escapeHtml(branding.business_name || "Invoicium");
  const senderName = escapeHtml(
    branding.sender_name || branding.business_name || "",
  );
  const senderEmail = escapeHtml(branding.sender_email || "");
  const senderPhone = escapeHtml(branding.sender_phone || "");
  const senderAddress = escapeHtml(branding.sender_address || "");

  const detailsHtml = detailsRows
    .map(
      (r) => `
        <tr>
          <td style="padding:10px 0;color:${MUTED};font-size:13px;font-weight:500;letter-spacing:0.02em;text-transform:uppercase;width:40%;">${escapeHtml(r.label)}</td>
          <td style="padding:10px 0;color:${TEXT};font-size:14px;font-weight:600;text-align:right;">${escapeHtml(r.value)}</td>
        </tr>`,
    )
    .join("");

  const itemsHtml =
    items && items.length > 0
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-collapse:collapse;">
        <thead>
          <tr>
            <th align="left" style="padding:10px 12px;background:${SOFT_BG};color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${BORDER};">Description</th>
            <th align="right" style="padding:10px 12px;background:${SOFT_BG};color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${BORDER};width:60px;">Qty</th>
            <th align="right" style="padding:10px 12px;background:${SOFT_BG};color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${BORDER};width:90px;">Rate</th>
            <th align="right" style="padding:10px 12px;background:${SOFT_BG};color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;border-bottom:1px solid ${BORDER};width:100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((it) => {
              const qty = Number(it.quantity || 0);
              const rate = Number(it.rate || 0);
              const amount = Number(it.total ?? qty * rate ?? 0);
              return `
                <tr>
                  <td style="padding:12px;border-bottom:1px solid ${BORDER};color:${TEXT};font-size:14px;">${escapeHtml(it.description || "")}</td>
                  <td align="right" style="padding:12px;border-bottom:1px solid ${BORDER};color:${TEXT};font-size:14px;">${escapeHtml(String(qty))}</td>
                  <td align="right" style="padding:12px;border-bottom:1px solid ${BORDER};color:${TEXT};font-size:14px;">${formatCurrency(rate)}</td>
                  <td align="right" style="padding:12px;border-bottom:1px solid ${BORDER};color:${TEXT};font-size:14px;font-weight:600;">${formatCurrency(amount)}</td>
                </tr>`;
            })
            .join("")}
        </tbody>
      </table>`
      : "";

  const summaryHtml =
    summary && summary.length > 0
      ? `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px;border-collapse:collapse;">
        ${summary
          .map(
            (s) => `
          <tr>
            <td style="padding:8px 0;color:${s.emphasized ? TEXT : MUTED};font-size:${s.emphasized ? "16px" : "14px"};font-weight:${s.emphasized ? "700" : "500"};text-align:right;">${escapeHtml(s.label)}</td>
            <td style="padding:8px 0 8px 24px;color:${s.emphasized ? heroAccent : TEXT};font-size:${s.emphasized ? "18px" : "14px"};font-weight:${s.emphasized ? "700" : "600"};text-align:right;width:120px;">${escapeHtml(s.value)}</td>
          </tr>`,
          )
          .join("")}
      </table>`
      : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
        <tr>
          <td align="center" style="border-radius:8px;background:${heroAccent};">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;letter-spacing:0.01em;">${escapeHtml(ctaLabel)}</a>
          </td>
        </tr>
      </table>`
      : "";

  const secondaryHtml =
    secondaryCtaLabel && secondaryCtaUrl
      ? `<div style="text-align:center;margin-top:14px;"><a href="${escapeHtml(secondaryCtaUrl)}" style="color:${MUTED};font-size:13px;text-decoration:underline;">${escapeHtml(secondaryCtaLabel)}</a></div>`
      : "";

  const notesHtml = notes
    ? `
      <div style="margin-top:28px;padding:16px 18px;background:${SOFT_BG};border-left:3px solid ${heroAccent};border-radius:4px;">
        <div style="color:${MUTED};font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;">Note from ${senderName || businessName}</div>
        <div style="color:${TEXT};font-size:14px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(notes)}</div>
      </div>`
    : "";

  const contactBits = [senderEmail, senderPhone, senderAddress]
    .filter(Boolean)
    .join(" &nbsp;·&nbsp; ");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;color:#f1f5f9;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,0.08);overflow:hidden;">
        <tr>
          <td style="padding:28px 32px 20px;border-bottom:1px solid ${BORDER};">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="color:${TEXT};font-size:18px;font-weight:700;letter-spacing:-0.01em;">${businessName}</td>
                <td align="right" style="color:${MUTED};font-size:12px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;">${escapeHtml(heading)}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px 8px;">
            <div style="color:${MUTED};font-size:13px;font-weight:500;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(heroLabel)}</div>
            <div style="color:${heroAccent};font-size:40px;font-weight:700;letter-spacing:-0.02em;line-height:1.1;">${escapeHtml(heroValue)}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 4px;color:${TEXT};font-size:15px;line-height:1.6;">${intro}</td>
        </tr>
        <tr>
          <td style="padding:20px 32px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};">
              ${detailsHtml}
            </table>
          </td>
        </tr>
        ${itemsHtml ? `<tr><td style="padding:20px 32px 0;">${itemsHtml}</td></tr>` : ""}
        ${summaryHtml ? `<tr><td style="padding:0 32px 8px;">${summaryHtml}</td></tr>` : ""}
        ${ctaHtml ? `<tr><td align="center" style="padding:28px 32px 8px;">${ctaHtml}${secondaryHtml}</td></tr>` : ""}
        ${notesHtml ? `<tr><td style="padding:8px 32px 4px;">${notesHtml}</td></tr>` : ""}
        ${footerMessage ? `<tr><td style="padding:20px 32px 0;color:${MUTED};font-size:13px;line-height:1.6;">${footerMessage}</td></tr>` : ""}
        <tr>
          <td style="padding:32px;border-top:1px solid ${BORDER};background:${SOFT_BG};">
            <div style="color:${TEXT};font-size:13px;font-weight:600;margin-bottom:4px;">${senderName || businessName}</div>
            ${contactBits ? `<div style="color:${MUTED};font-size:12px;line-height:1.6;">${contactBits}</div>` : ""}
            <div style="color:${MUTED};font-size:11px;margin-top:14px;">Sent via <span style="color:${PRIMARY_DARK};font-weight:600;">Invoicium</span></div>
          </td>
        </tr>
      </table>
      <div style="color:#94a3b8;font-size:11px;margin-top:16px;">This email was sent by ${businessName}. If you received it by mistake, please disregard.</div>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export { PRIMARY, PRIMARY_DARK };
