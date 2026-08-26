import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { buildInvoiceCheckoutSession } from '../_shared/stripe-session.ts';

// Builds the Checkout link a contractor sends their client.
//
// This is a Connect DIRECT charge: the session is created on the contractor's
// own connected account (the Stripe-Account header), so they are the merchant of
// record, Stripe's processing fee comes out of their balance, and the platform
// keeps only application_fee_amount -- the rate the pricing page advertises.
//
// Before Connect this charged the platform account, which meant contractors'
// invoice payments landed in our balance with no route back out to them.
//
// The session itself is built in _shared/stripe-session.ts, which this shares
// with pay-public-invoice. It used to be inline here, and the fee rate was
// derived from `subscription.payment_processing_fee` -- a column that is not
// where the plan's rate lives, so the fee was resolved from stale data. See
// docs/invoice-links-plan.md section 2.3b.

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  //
  // This is the wall with no door. The public payment path does NOT branch
  // around it; it is a separate function (pay-public-invoice) that shares only
  // the session builder below.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

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

    const result = await buildInvoiceCheckoutSession(invoice);
    if (!result.ok) {
      return new Response(
        JSON.stringify({
          error:
            result.reason === 'not_connected'
              ? 'Connect your Stripe account in Settings before sending a payment link.'
              : result.error,
          ...(result.reason === 'not_connected'
            ? { stripe_not_connected: true, stripe_account_status: result.stripe_account_status }
            : {}),
        }),
        { headers, status: result.status },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        payment_link: result.url,
        session_id: result.session_id,
        platform_fee: result.platform_fee,
        currency: result.currency,
      }),
      { headers, status: 200 },
    );
  } catch (err) {
    console.error('create-invoice-payment-link error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers, status: 500 },
    );
  }
});
