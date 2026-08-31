import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { sendEmail } from '../_shared/resend.ts';
import { notify } from '../_shared/notify.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { renderEmailLayout, formatCurrency, formatDate, escapeHtml, LineItem } from '../_shared/email-templates.ts';
import { stampFeePercentOnSend } from '../_shared/stripe-session.ts';
import { APP_URL } from '../_shared/app-url.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

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
      invoice_id,
    } = await req.json();

    if (!to) throw new Error('Recipient email (to) is required');

    // -- Phase A of the deliverability plan (docs/invoice-links-plan.md s.6) --
    //
    // The email gains a link to the hosted invoice page and KEEPS the PDF
    // attachment. Zero deliverability delta: the message has exactly the
    // attachment profile it had yesterday, so we get the hosted page, the pay
    // flow and the view signal with nothing at risk. Dropping the attachment is
    // Phase D, behind its own flag, and only after A-C are measured.
    //
    // The token is resolved HERE rather than accepted from the request body.
    // The body is client-supplied, and a wrong or stale token would send a
    // client a link to nothing -- with no error, because a send that reaches
    // Resend is a successful send.
    let publicUrl: string | null = null;
    let canPayOnline = false;
    if (invoice_id) {
      const invoice = await db.getOne('Invoice', invoice_id);

      // A voided invoice is never mailed, whoever asks.
      //
      // The UI already hides every route to here for a voided invoice, but
      // hiding a button is presentation and this function is reachable with an
      // invoice_id and nothing else. Emailing one would be a demand for money
      // the contractor has already withdrawn, under a number they retired --
      // and the client, not the contractor, is the one who reads it.
      //
      // Both signals, matching isVoided() in src/lib/invoiceVoid.js.
      if (invoice && (String(invoice.status || '') === 'void' || invoice.voided_at)) {
        return new Response(
          JSON.stringify({
            success: false,
            reason: 'voided',
            error: 'This invoice has been voided and cannot be sent.',
          }),
          { status: 409, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
        );
      }

      if (invoice) {
        // Decision 4: lock the fee rate to the plan they are on right now.
        await stampFeePercentOnSend(invoice);
        if (invoice.public_token && !invoice.public_link_revoked_at) {
          publicUrl = `${APP_URL}/i/${invoice.public_token}`;
        }
        const settings = await db.findOne('BusinessSettings', { user_id: String(invoice.user_id) });
        canPayOnline =
          Boolean(settings?.stripe_account_id) && settings?.stripe_account_status === 'active';
      }
    }

    // The pre-generated Stripe Checkout URL is the fallback, and it is the
    // thing this change exists to stop sending: a Checkout session expires
    // after 24 hours, so an emailed one works for a day and then silently fails
    // for an invoice a client may open a fortnight later. The hosted page never
    // expires and mints the session at click time.
    const ctaUrl = publicUrl || payment_link || undefined;
    const ctaLabel = ctaUrl
      ? (publicUrl && canPayOnline) || (!publicUrl && payment_link)
        ? 'View & pay invoice'
        : 'View your invoice'
      : undefined;

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

    // "A PDF copy is attached" stays TRUE throughout Phase A. It becomes a lie
    // in Phase D, when the attachment is dropped, and must be rewritten there.
    const onlineClause = ctaUrl
      ? canPayOnline || !publicUrl
        ? ', and you can view and settle it online using the secure link below'
        : ', and you can view it online using the link below'
      : '';
    const intro = `Hi ${escapeHtml(client_name || 'there')},<br><br>Thanks for your business. Your invoice from <strong>${escapeHtml(biz)}</strong> is ready. A PDF copy is attached for your records${onlineClause}.`;

    const footerMessage = ctaUrl
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
      ctaLabel,
      ctaUrl,
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

    // The body says "just reply to this email", and the From is
    // noreply@invoicium.ca -- so without this the client's reply goes nowhere
    // and the contractor never learns they had a question about an unpaid
    // invoice. sender_email is the contractor's own address, already rendered
    // in the footer of this very message.
    const data = await sendEmail({
      to,
      subject,
      html,
      attachments,
      replyTo: sender_email,
    });

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
