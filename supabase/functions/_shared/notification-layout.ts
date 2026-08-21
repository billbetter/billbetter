// Shared chrome for account notifications (trial, invoice sent/paid, billing).
//
// Colours are lifted from the website's own design tokens in src/index.css so
// the mail matches the product:
//   --brand-700  #0369A1   primary / buttons / links
//   --brand-800  #075985   pressed + footer rules
//   --ink-900    #0F172A   body text
//   --ink-500    #64748B   muted text
//   --ink-200    #E2E8F0   borders
//   --ink-50     #F8FAFC   page background
//
// NOTE: email-templates.ts (client-facing invoice/quote mail) reads the same
// brand-700/brand-800 pair from its own PRIMARY/PRIMARY_DARK constants, so the
// two families of mail now match. Keep them in step when the token moves.
//
// Everything is inline-styled with table layout: Gmail strips <style> blocks
// and Outlook ignores flex/grid.

export const BRAND = {
  primary: "#0369A1",
  primaryDark: "#075985",
  primarySoft: "#F0F9FF",
  text: "#0F172A",
  muted: "#64748B",
  body: "#475569",
  border: "#E2E8F0",
  pageBg: "#F8FAFC",
  success: "#059669",
  successSoft: "#ECFDF5",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  warning: "#F59E0B",
  warningSoft: "#FFFBEB",
} as const;

export function esc(value: unknown): string {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function money(value: unknown): string {
  const n = Number(value || 0);
  return `$${n.toFixed(2)}`;
}

export function niceDate(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface NotificationLayout {
  /** Inbox preview line. Shown after the subject in most clients. */
  preheader: string;
  heading: string;
  /** Greeting name. Defaults to "there". */
  name?: string | null;
  intro: string;
  /** Big number or status at the top of the card. */
  hero?: { label: string; value: string; accent?: string };
  rows?: { label: string; value: string }[];
  cta?: { label: string; url: string };
  footnote?: string;
}

export function renderNotification(o: NotificationLayout): string {
  const accent = o.hero?.accent || BRAND.primary;

  const heroBlock = o.hero
    ? `<tr><td style="padding:0 32px 24px 32px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="background:${BRAND.primarySoft};border:1px solid ${BRAND.border};border-radius:12px;">
          <tr><td style="padding:20px 24px;">
            <div style="font:600 12px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:${BRAND.muted};">${esc(o.hero.label)}</div>
            <div style="margin-top:8px;font:700 30px/1.15 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${accent};">${esc(o.hero.value)}</div>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const rowsBlock =
    o.rows && o.rows.length
      ? `<tr><td style="padding:0 32px 8px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${o.rows
              .map(
                (r) => `<tr>
                  <td style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font:400 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.muted};">${esc(r.label)}</td>
                  <td align="right" style="padding:10px 0;border-bottom:1px solid ${BRAND.border};font:600 14px/1.5 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.text};">${esc(r.value)}</td>
                </tr>`,
              )
              .join("")}
          </table>
        </td></tr>`
      : "";

  const ctaBlock = o.cta
    ? `<tr><td style="padding:28px 32px 8px 32px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-radius:10px;background:${BRAND.primary};">
            <a href="${esc(o.cta.url)}"
               style="display:inline-block;padding:13px 28px;font:700 15px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">${esc(o.cta.label)}</a>
          </td></tr>
        </table>
      </td></tr>`
    : "";

  const footnoteBlock = o.footnote
    ? `<tr><td style="padding:20px 32px 0 32px;font:400 13px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.muted};">${esc(o.footnote)}</td></tr>`
    : "";

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(o.heading)}</title></head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.pageBg};padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="max-width:560px;background:#ffffff;border:1px solid ${BRAND.border};border-radius:16px;overflow:hidden;">

    <tr><td style="padding:28px 32px 0 32px;">
      <div style="font:800 20px/1 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:${BRAND.primary};">Invoicium</div>
    </td></tr>

    <tr><td style="padding:20px 32px 12px 32px;">
      <h1 style="margin:0;font:800 24px/1.25 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;letter-spacing:-.02em;color:${BRAND.text};">${esc(o.heading)}</h1>
    </td></tr>

    <tr><td style="padding:0 32px 20px 32px;font:400 15px/1.65 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.body};">
      <p style="margin:0 0 12px 0;">Hi ${esc(o.name || "there")},</p>
      <p style="margin:0;">${esc(o.intro)}</p>
    </td></tr>

    ${heroBlock}
    ${rowsBlock}
    ${ctaBlock}
    ${footnoteBlock}

    <tr><td style="padding:28px 32px 28px 32px;">
      <div style="border-top:1px solid ${BRAND.border};padding-top:16px;font:400 12px/1.6 -apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${BRAND.muted};">
        Sent by Invoicium — invoicing for contractors.<br>
        Questions? Reply to this email or contact
        <a href="mailto:support@invoicium.ca" style="color:${BRAND.primary};text-decoration:none;">support@invoicium.ca</a>.
      </div>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}
