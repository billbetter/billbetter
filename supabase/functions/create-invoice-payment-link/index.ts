import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripePost, applicationFeeCents } from '../_shared/stripe.ts';

// Builds the Checkout link a contractor sends their client.
//
// This is a Connect DIRECT charge: the session is created on the contractor's
// own connected account (the Stripe-Account header), so they are the merchant of
// record, Stripe's processing fee comes out of their balance, and the platform
// keeps only application_fee_amount -- the 1% the pricing page advertises.
//
// Before Connect this charged the platform account, which meant contractors'
// invoice payments landed in our balance with no route back out to them.

const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Invoices are read with SERVICE_ROLE, which bypasses RLS -- so ownership is
    // checked here rather than relying on the platform's JWT gate alone.
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { invoice_id } = await req.json();
    if (!invoice_id) throw new Error('invoice_id is required');

    const invoice = await db.getOne('Invoice', invoice_id);
    if (!invoice) throw new Error('Invoice not found');
    // Same message either way: whether an id exists is not something a caller
    // should be able to probe for.
    if (invoice.user_id !== user.id) throw new Error('Invoice not found');

    const total = Number(invoice.total || 0);
    if (total <= 0) throw new Error('Invoice total must be greater than zero');

    const settings = await db.findOne('BusinessSettings', { user_id: invoice.user_id });
    const accountId = settings?.stripe_account_id;

    // Refuse rather than quietly charging the platform account. The client would
    // pay, the money would land in our balance, and the contractor would be told
    // their invoice was settled.
    if (!accountId || settings?.stripe_account_status !== 'active') {
      return new Response(
        JSON.stringify({
          error: 'Connect your Stripe account in Settings before sending a payment link.',
          stripe_not_connected: true,
          stripe_account_status: settings?.stripe_account_status || 'not_connected',
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    const businessName = settings?.business_name || 'Invoicium';
    const currency = String(settings?.currency || 'CAD').toLowerCase();

    // The platform's cut follows the plan the contractor is on right now.
    const subscription = await db.findOne('Subscription', { user_id: invoice.user_id });
    const totalCents = Math.round(total * 100);
    const feeCents = applicationFeeCents(totalCents, subscription?.payment_processing_fee);

    const form: Record<string, string> = {
      mode: 'payment',
      'line_items[0][price_data][currency]': currency,
      'line_items[0][price_data][product_data][name]':
        `${businessName} Invoice ${invoice.invoice_number || ''}`.trim(),
      'line_items[0][price_data][unit_amount]': String(totalCents),
      'line_items[0][quantity]': '1',
      success_url: `${APP_URL}/InvoicePaymentSuccess?invoice_id=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/InvoiceDetail?id=${invoice.id}`,
      'metadata[invoice_id]': invoice.id,
      'metadata[user_id]': invoice.user_id,
      // Repeated onto the PaymentIntent: the webhook matches on whichever of
      // checkout.session.completed or payment_intent.succeeded arrives, and a
      // session's metadata does not propagate to the intent on its own.
      'payment_intent_data[metadata][invoice_id]': invoice.id,
      'payment_intent_data[metadata][user_id]': invoice.user_id,
    };

    if (feeCents > 0) {
      form['payment_intent_data[application_fee_amount]'] = String(feeCents);
    }
    if (invoice.client_email) form.customer_email = invoice.client_email;

    // Stripe-Account is what makes this a direct charge on the contractor.
    const session = await stripePost('/checkout/sessions', form, { stripeAccount: accountId });

    await db.update('Invoice', invoice.id, {
      payment_link: session.url,
      stripe_session_id: session.id,
      platform_fee_amount: feeCents / 100,
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_link: session.url,
        session_id: session.id,
        platform_fee: feeCents / 100,
        currency: currency.toUpperCase(),
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('create-invoice-payment-link error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
