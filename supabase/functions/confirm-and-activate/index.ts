import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

const PLAN_LIMITS: Record<string, { transactions: number; fee: number }> = {
  free:         { transactions: 10,  fee: 0 },
  core:         { transactions: 30,  fee: 1 },
  essential:    { transactions: 75,  fee: 1 },
  professional: { transactions: 250, fee: 1 },
  enterprise:   { transactions: 500, fee: 1 },
};

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ':')}` },
  });
  return res.json();
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { session_id, subscription_id } = await req.json();
    if (!session_id && !subscription_id) {
      throw new Error('session_id or subscription_id is required');
    }

    // Two ways in: the hosted Checkout redirect returns a session, while the
    // on-site Elements flow confirms a subscription directly and has none.
    let session: Record<string, any> = {};
    let subscription: Record<string, any> = {};

    if (session_id) {
      session = await stripeGet(`/checkout/sessions/${session_id}`);
      if (session.error) throw new Error(session.error.message);

      if (session.payment_status !== 'paid' && session.status !== 'complete') {
        return new Response(
          JSON.stringify({ ok: false, status: 'pending' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
    } else {
      subscription = await stripeGet(`/subscriptions/${subscription_id}`);
      if (subscription.error) throw new Error(subscription.error.message);

      // Only Stripe's own view of the subscription decides this -- never the
      // client, which could otherwise claim activation without paying.
      const good = subscription.status === 'active' || subscription.status === 'trialing';
      if (!good) {
        return new Response(
          JSON.stringify({ ok: false, status: subscription.status || 'pending' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      // Verify it belongs to the caller before writing anything.
      if (subscription.metadata?.user_id && subscription.metadata.user_id !== user.id) {
        throw new Error('Subscription does not belong to this user');
      }

      session = {
        metadata: subscription.metadata || {},
        customer: subscription.customer,
        subscription: subscription.id,
      };
    }

    const planName = session.metadata?.plan_name || 'core';
    const billingCycle = session.metadata?.billing_cycle || 'monthly';
    const isTrial = subscription.status === 'trialing' || session.metadata?.is_trial === 'true';
    const limits = PLAN_LIMITS[planName] || PLAN_LIMITS.core;

    const now = new Date().toISOString();
    // Prefer Stripe's own trial_end; the +7d fallback only covers the hosted
    // Checkout path, where we have no subscription object to read.
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : isTrial
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const existing = await db.findOne('Subscription', { user_id: user.id });

    const subData: Record<string, unknown> = {
      user_id: user.id,
      plan_name: planName,
      billing_cycle: billingCycle,
      status: isTrial ? 'trial' : 'active',
      monthly_transaction_limit: limits.transactions,
      payment_processing_fee: limits.fee,
      transactions_used_this_month: 0,
      invoices_used_this_month: 0,
      quotes_used_this_month: 0,
      lifetime_documents_created: existing?.lifetime_documents_created || 0,
      subscription_start_date: now,
      ...(trialEnd ? { trial_end_date: trialEnd } : {}),
      // Needed by stripe-webhook to map lifecycle events back to this user.
      ...(session.customer ? { stripe_customer_id: session.customer } : {}),
      ...(session.subscription ? { stripe_subscription_id: session.subscription } : {}),
    };

    if (existing) {
      await db.update('Subscription', existing.id, subData);
    } else {
      await db.insert('Subscription', subData);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        plan_name: planName,
        billing_cycle: billingCycle,
        monthly_transaction_limit: limits.transactions,
        payment_processing_fee: limits.fee,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('confirm-and-activate error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
