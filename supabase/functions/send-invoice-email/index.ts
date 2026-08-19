import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/resend.ts';
import { notify } from '../_shared/notify.ts';
import { getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { renderEmailLayout, formatCurrency, formatDate, escapeHtml, LineItem } from '../_shared/email-templates.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const {
      to,
      invoice_number,
      client_name,
      total,
      subtotal,
      tax_rate,
      tax_amount,
      items,
      pdf_url,
      payment_link,
      business_name,
      sender_name,
      sender_email,
      sender_phone,
      sender_address,
      notes,
      due_date,
      issue_date,
      created_date,
      status,
    } = await req.json();

    if (!to) throw new Error('Recipient email (to) is required');

    let attachments: { filename: string; content: string }[] | undefined;
    if (pdf_url && pdf_url.startsWith('data:application/pdf;base64,')) {
      const base64 = pdf_url.split(',')[1];
      attachments = [{ filename: `Invoice-${invoice_number || '000'}.pdf`, content: base64 }];
    }

    const biz = business_name || 'Invoicium';
    const subject = `Invoice ${invoice_number ? '#' + invoice_number : ''} from ${biz} — ${formatCurrency(total)} due`;

    const lineItems: LineItem[] = Array.isArray(items) ? items : [];
    const sub = subtotal != null ? Number(subtotal) : null;
    const taxA = tax_amount != null ? Number(tax_amount) : null;
    const taxR = tax_rate != null ? Number(tax_rate) : null;

    const summary: { label: string; value: string; emphasized?: boolean }[] = [];
    if (sub != null) summary.push({ label: 'Subtotal', value: formatCurrency(sub) });
    if (taxA != null) summary.push({ label: `Tax${taxR ? ` (${taxR}%)` : ''}`, value: formatCurrency(taxA) });
    summary.push({ label: 'Amount due', value: formatCurrency(total), emphasized: true });

    const detailsRows = [
      { label: 'Invoice number', value: invoice_number ? `#${invoice_number}` : '—' },
      { label: 'Billed to', value: client_name || '—' },
      { label: 'Issue date', value: formatDate(issue_date || created_date) },
      { label: 'Due date', value: formatDate(due_date) },
    ];
    if (status) detailsRows.push({ label: 'Status', value: String(status).toUpperCase() });

    const intro = `Hi ${escapeHtml(client_name || 'there')},<br><br>Thanks for your business. Your invoice from <strong>${escapeHtml(biz)}</strong> is ready. A PDF copy is attached for your records${payment_link ? ', and you can settle it online using the secure link below' : ''}.`;

    const footerMessage = payment_link
      ? `Questions about this invoice? Just reply to this email and we'll get back to you.`
      : `Questions about this invoice? Just reply to this email${sender_phone ? ` or call ${escapeHtml(sender_phone)}` : ''} and we'll get back to you.`;

    const html = renderEmailLayout({
      preheader: `Invoice ${invoice_number ? '#' + invoice_number : ''} for ${formatCurrency(total)} — due ${formatDate(due_date)}`,
      heading: 'Invoice',
      heroLabel: 'Amount due',
      heroValue: formatCurrency(total),
      intro,
      detailsRows,
      items: lineItems,
      summary,
      ctaLabel: payment_link ? 'Pay invoice securely' : undefined,
      ctaUrl: payment_link,
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

    // Confirm to the CONTRACTOR that it went out. The client already has the
    // invoice itself (above); this is the account notification. Deliberately
    // after the real send, and non-throwing, so a notification problem can
    // never make a successfully-sent invoice look like a failure.
    const sender = await getUserFromAuthHeader(req);
    await notify.invoiceSent({
      userEmail: sender?.email || sender_email || '',
      userName: null,
      invoiceNumber: invoice_number,
      clientName: client_name,
      sentTo: Array.isArray(to) ? to.join(', ') : to,
      amount: Number(total || 0),
      dueDate: due_date,
      invoiceUrl: `${Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca'}/Invoices`,
    });

    return new Response(
      JSON.stringify({ success: true, id: data?.id }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-invoice-email error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
