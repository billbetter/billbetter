import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { enforceRateLimit, rateLimited } from '../_shared/rate-limit.ts';
import { sendEmail } from '../_shared/resend.ts';
import { renderEmailLayout, formatCurrency, formatDate, escapeHtml, LineItem } from '../_shared/email-templates.ts';
import { loadOwnedForSend } from '../_shared/owned-send.ts';
import { APP_URL } from '../_shared/app-url.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

  // Spend cap, on the shared sending domain's reputation as much as on cost.
  // See _shared/rate-limit.ts.
  const budget = await enforceRateLimit('send-quote-email', access.user!.id);
  const tooMany = rateLimited(budget, getCorsHeaders(req));
  if (tooMany) return tooMany;

  try {
    const {
      quote_id,
      quote_number,
      client_name,
      total,
      subtotal,
      tax_rate,
      tax_amount,
      items,
      pdf_url,
      notes,
      expiry_date,
      date_issued,
      created_date,
    } = await req.json();

    // Ownership + trusted fields. The recipient, the business identity and the
    // approve link are resolved from the caller's own quote and settings -- NOT
    // from the request body -- so this endpoint can no longer be used to send
    // mail from the platform's domain to an arbitrary recipient. A quote the
    // caller does not own answers 404 with the generic wording, so the endpoint
    // is not an existence oracle. See _shared/owned-send.ts.
    const guard = await loadOwnedForSend('Quote', quote_id, access.user!, 'email');
    if (!guard) {
      return new Response(
        JSON.stringify({ success: false, error: 'Quote not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }
    const to = guard.to;
    if (!to) throw new Error('This quote has no client email on file.');

    const { business_name, sender_name, sender_email, sender_phone, sender_address, logo_url } =
      guard.business;

    // Built from the stored public_id, never accepted from the body -- the body
    // value was a free phishing destination on the platform's domain.
    const approval_link = guard.record.public_id
      ? `${APP_URL}/PublicQuote?id=${guard.record.public_id}`
      : undefined;

    let attachments: { filename: string; content: string }[] | undefined;
    if (pdf_url && pdf_url.startsWith('data:application/pdf;base64,')) {
      const base64 = pdf_url.split(',')[1];
      attachments = [{ filename: `Quote-${quote_number || '000'}.pdf`, content: base64 }];
    }

    const biz = business_name || 'Invoicium';
    const subject = `Quote ${quote_number ? '#' + quote_number : ''} from ${biz} — ${formatCurrency(total)}`;

    const lineItems: LineItem[] = Array.isArray(items) ? items : [];
    const sub = subtotal != null ? Number(subtotal) : null;
    const taxA = tax_amount != null ? Number(tax_amount) : null;
    const taxR = tax_rate != null ? Number(tax_rate) : null;

    const summary: { label: string; value: string; emphasized?: boolean }[] = [];
    if (sub != null) summary.push({ label: 'Subtotal', value: formatCurrency(sub) });
    if (taxA != null) summary.push({ label: `Tax${taxR ? ` (${taxR}%)` : ''}`, value: formatCurrency(taxA) });
    summary.push({ label: 'Total', value: formatCurrency(total), emphasized: true });

    const detailsRows = [
      { label: 'Quote number', value: quote_number ? `#${quote_number}` : '—' },
      { label: 'Prepared for', value: client_name || '—' },
      { label: 'Issued', value: formatDate(date_issued || created_date) },
      { label: 'Valid until', value: formatDate(expiry_date) },
    ];

    const intro = `Hi ${escapeHtml(client_name || 'there')},<br><br>Thanks for the opportunity. Please find the detailed quote from <strong>${escapeHtml(biz)}</strong> below${pdf_url ? ' (a PDF copy is attached)' : ''}. ${approval_link ? 'Review the details and tap <strong>Approve quote</strong> when you\'re ready to move forward.' : 'Reply to this email to move forward or if you have any questions.'}`;

    const footerMessage = `Questions or changes? Just reply to this email${sender_phone ? ` or call ${escapeHtml(sender_phone)}` : ''} and we'll get right back to you.`;

    const html = renderEmailLayout({
      preheader: `Quote ${quote_number ? '#' + quote_number : ''} — ${formatCurrency(total)}${expiry_date ? ', valid until ' + formatDate(expiry_date) : ''}`,
      heading: 'Quote',
      heroLabel: 'Total estimate',
      heroValue: formatCurrency(total),
      intro,
      detailsRows,
      items: lineItems,
      summary,
      ctaLabel: approval_link ? 'Review & approve quote' : undefined,
      ctaUrl: approval_link,
      notes,
      footerMessage,
      branding: {
        business_name: biz,
        sender_name: sender_name || biz,
        sender_email,
        sender_phone,
        sender_address,
        logo_url,
      },
    });

    // This email asks for a reply in two places -- the intro when there is
    // no approval link, and the footer always -- so it needs the contractor's
    // address on the Reply-To header for either sentence to be true.
    const data = await sendEmail({
      to,
      subject,
      html,
      attachments,
      replyTo: sender_email,
    });

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-quote-email error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
