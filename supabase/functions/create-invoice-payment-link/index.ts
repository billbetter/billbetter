import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error('invoice_id is required');

    const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeSecret) throw new Error('STRIPE_SECRET_KEY not configured');

    const invoice = await db.getOne('Invoice', invoice_id);
    if (!invoice) throw new Error('Invoice not found');

    const total = Number(invoice.total || 0);
    if (total <= 0) throw new Error('Invoice total must be greater than zero');

    const settings = await db.findOne('BusinessSettings', { user_id: invoice.user_id });
    const businessName = settings?.business_name || 'Invoicium';
    const appBase = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';

    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('line_items[0][price_data][currency]', 'usd');
    form.set('line_items[0][price_data][product_data][name]', `${businessName} Invoice ${invoice.invoice_number || ''}`.trim());
    form.set('line_items[0][price_data][unit_amount]', String(Math.round(total * 100)));
    form.set('line_items[0][quantity]', '1');
    form.set('success_url', `${appBase}/InvoicePaymentSuccess?invoice_id=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`);
    form.set('cancel_url', `${appBase}/InvoiceDetail?id=${invoice.id}`);
    form.set('metadata[invoice_id]', invoice.id);
    form.set('metadata[user_id]', invoice.user_id);
    if (invoice.client_email) form.set('customer_email', invoice.client_email);

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });
    const session = await res.json();
    if (!res.ok) throw new Error(session?.error?.message || `Stripe ${res.status}`);

    await db.update('Invoice', invoice.id, {
      payment_link: session.url,
      stripe_session_id: session.id,
    });

    return new Response(
      JSON.stringify({ success: true, payment_link: session.url, session_id: session.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('create-invoice-payment-link error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
