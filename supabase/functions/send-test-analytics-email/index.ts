import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/resend.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { renderEmailLayout, formatCurrency, escapeHtml } from '../_shared/email-templates.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const settings = await db.findOne('BusinessSettings', { user_id: user.id });
    const businessName = settings?.business_name || 'Invoicium';
    const recipient = user.email;
    if (!recipient) throw new Error('No email on file for the current user');

    const invoices = (await db.list('Invoice', { user_id: user.id })) || [];
    const quotes = (await db.list('Quote', { user_id: user.id })) || [];
    const clients = (await db.list('Client', { user_id: user.id })) || [];

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const recentInvoices = invoices.filter((i: any) => new Date(i.created_date || 0) >= thirtyDaysAgo);

    const paid = recentInvoices.filter((i: any) => i.status === 'paid');
    const outstanding = recentInvoices.filter((i: any) => i.status === 'sent' || i.status === 'overdue');
    const overdue = recentInvoices.filter((i: any) => i.status === 'overdue');

    const sum = (arr: any[]) => arr.reduce((s, i) => s + Number(i.total || 0), 0);
    const paidTotal = sum(paid);
    const outstandingTotal = sum(outstanding);
    const overdueTotal = sum(overdue);
    const quotesSent = quotes.filter((q: any) => new Date(q.created_date || 0) >= thirtyDaysAgo).length;
    const quotesApproved = quotes.filter((q: any) => q.status === 'approved' && new Date(q.created_date || 0) >= thirtyDaysAgo).length;
    const newClients = clients.filter((c: any) => new Date(c.created_date || 0) >= thirtyDaysAgo).length;

    const intro = `Hi ${escapeHtml(businessName)} team,<br><br>Here's a <strong>preview</strong> of the automated analytics report Invoicium will send you on your chosen schedule. It summarizes the last 30 days at a glance so you always know where your business stands.`;

    const detailsRows = [
      { label: 'Invoices created', value: String(recentInvoices.length) },
      { label: 'Invoices paid', value: `${paid.length} (${formatCurrency(paidTotal)})` },
      { label: 'Outstanding', value: `${outstanding.length} (${formatCurrency(outstandingTotal)})` },
      { label: 'Overdue', value: `${overdue.length} (${formatCurrency(overdueTotal)})` },
      { label: 'Quotes sent', value: String(quotesSent) },
      { label: 'Quotes approved', value: String(quotesApproved) },
      { label: 'New clients', value: String(newClients) },
    ];

    const summary = [
      { label: 'Collected (30d)', value: formatCurrency(paidTotal) },
      { label: 'Outstanding', value: formatCurrency(outstandingTotal) },
      { label: 'Net pipeline', value: formatCurrency(paidTotal + outstandingTotal), emphasized: true },
    ];

    const html = renderEmailLayout({
      preheader: `Last 30 days: ${formatCurrency(paidTotal)} collected, ${formatCurrency(outstandingTotal)} outstanding`,
      heading: 'Analytics · Test',
      heroLabel: 'Collected · last 30 days',
      heroValue: formatCurrency(paidTotal),
      intro,
      detailsRows,
      summary,
      footerMessage: `This is a one-time test email sent from your dashboard. Your live analytics will be delivered on the schedule you set in <strong>Notifications</strong>.`,
      branding: {
        business_name: businessName,
        sender_name: businessName,
        sender_email: settings?.email || user.email,
        sender_phone: settings?.phone,
        sender_address: settings?.address,
      },
    });

    const data = await sendEmail({
      to: recipient,
      subject: `[Test] ${businessName} · 30-day analytics preview`,
      html,
    });

    return new Response(
      JSON.stringify({ success: true, id: data?.id, to: recipient }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-test-analytics-email error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
