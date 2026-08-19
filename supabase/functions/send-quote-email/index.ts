import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/resend.ts';
import { renderEmailLayout, formatCurrency, formatDate, escapeHtml, LineItem } from '../_shared/email-templates.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const {
      to,
      quote_number,
      client_name,
      total,
      subtotal,
      tax_rate,
      tax_amount,
      items,
      pdf_url,
      approval_link,
      business_name,
      sender_name,
      sender_email,
      sender_phone,
      sender_address,
      notes,
      expiry_date,
      date_issued,
      created_date,
    } = await req.json();

    if (!to) throw new Error('Recipient email (to) is required');

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
      },
    });

    const data = await sendEmail({ to, subject, html, attachments });

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
