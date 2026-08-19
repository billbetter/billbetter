import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

async function stripeCall(method: string, path: string, params?: Record<string, string>) {
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  };
  if (params) init.body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

// Reuse the customer already on the Subscription row when there is one, so a
// user who upgrades does not accumulate duplicate Stripe customers.
async function resolveCustomer(user: { id: string; email?: string }, existing: any) {
  if (existing?.stripe_customer_id) return existing.stripe_customer_id;

  const params: Record<string, string> = { 'metadata[user_id]': user.id };
  if (user.email) params.email = user.email;
  const customer = await stripeCall('POST', '/customers', params);
  return customer.id;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { price_id, plan_name, billing_cycle, is_trial } = await req.json();
    if (!price_id) throw new Error('price_id is required');
    if (!plan_name) throw new Error('plan_name is required');

    const existing = await db.findOne('Subscription', { user_id: user.id });

    // One paid subscription per user. Without this an impatient double-submit
    // creates two subscriptions and bills the customer twice.
    if (existing && (existing.status === 'active' || existing.status === 'trial' || existing.status === 'trialing')) {
      return new Response(
        JSON.stringify({ error: 'You already have an active subscription.', already_subscribed: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Trials are once per user, tracked on our side -- Stripe would happily
    // grant another to the same customer under a new subscription.
    const trialEligible = Boolean(is_trial) && !existing?.trial_end_date;

    const customerId = await resolveCustomer(user, existing);

    const params: Record<string, string> = {
      customer: customerId,
      'items[0][price]': price_id,
      payment_behavior: 'default_incomplete',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'payment_settings[payment_method_types[0]]': 'card',
      'metadata[user_id]': user.id,
      'metadata[plan_name]': plan_name,
      'metadata[billing_cycle]': billing_cycle || 'monthly',
      'expand[0]': 'latest_invoice.payment_intent',
      'expand[1]': 'pending_setup_intent',
    };

    if (trialEligible) {
      params.trial_period_days = '7';
      params['metadata[is_trial]'] = 'true';
      // With a trial nothing is charged now, so collect the card via a
      // SetupIntent instead and keep the subscription if setup is abandoned.
      params['trial_settings[end_behavior][missing_payment_method]'] = 'cancel';
    }

    const subscription = await stripeCall('POST', '/subscriptions', params);

    // Paid start -> PaymentIntent on the first invoice. Trial start -> no
    // invoice to pay, so Stripe attaches a SetupIntent instead.
    const paymentIntent = subscription?.latest_invoice?.payment_intent;
    const setupIntent = subscription?.pending_setup_intent;
    const clientSecret = paymentIntent?.client_secret || setupIntent?.client_secret;

    if (!clientSecret) {
      throw new Error('Stripe did not return a client secret for this subscription');
    }

    return new Response(
      JSON.stringify({
        subscription_id: subscription.id,
        customer_id: customerId,
        client_secret: clientSecret,
        mode: paymentIntent ? 'payment' : 'setup',
        is_trial: trialEligible,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-create-subscription error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
