import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { enforceRateLimit, rateLimited } from '../_shared/rate-limit.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

async function stripePost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    // Spend cap: a Stripe API call per request. Deliberately keyed on the user
    // and placed AFTER authentication -- there is no requireAppAccess here (this
    // is the endpoint someone uses to START paying, so demanding an active
    // subscription would lock out every new signup), which makes the auth check
    // above the only thing bounding who reaches it.
    //
    // The budget is the tightest of the set because a human clicks Subscribe
    // once, maybe twice. Any volume at all here is a loop.
    const budget = await enforceRateLimit('stripe-create-session', user.id);
    const tooMany = rateLimited(budget, getCorsHeaders(req));
    if (tooMany) return tooMany;

    const { price_id, plan_name, billing_cycle, is_trial, frontend_origin } = await req.json();
    if (!price_id) throw new Error('price_id is required');
    if (!frontend_origin) throw new Error('frontend_origin is required');

    const successUrl = `${frontend_origin}/PaymentSuccess?session_id={CHECKOUT_SESSION_ID}&plan=${encodeURIComponent(plan_name)}&cycle=${encodeURIComponent(billing_cycle)}`;
    const cancelUrl = `${frontend_origin}/Pricing`;

    let trialEligible = false;
    if (is_trial) {
      const existing = await db.findOne('Subscription', { user_id: user.id });
      if (existing && (existing.status === 'active' || existing.status === 'trial' || existing.status === 'trialing')) {
        return new Response(
          JSON.stringify({ trial_eligible: false }),
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      trialEligible = true;
    }

    const params: Record<string, string> = {
      'mode': 'subscription',
      'payment_method_types[0]': 'card',
      'line_items[0][price]': price_id,
      'line_items[0][quantity]': '1',
      'success_url': successUrl,
      'cancel_url': cancelUrl,
      'client_reference_id': user.id,
      'metadata[user_id]': user.id,
      'metadata[plan_name]': plan_name,
      'metadata[billing_cycle]': billing_cycle || 'monthly',
      // Also stamp the subscription itself. Session metadata does not propagate,
      // and customer.subscription.* events carry only the subscription -- without
      // this the webhook cannot tell which user a cancellation belongs to.
      'subscription_data[metadata][user_id]': user.id,
      'subscription_data[metadata][plan_name]': plan_name,
      'subscription_data[metadata][billing_cycle]': billing_cycle || 'monthly',
    };

    if (user.email) {
      params['customer_email'] = user.email;
    }

    if (trialEligible) {
      params['subscription_data[trial_period_days]'] = '7';
      params['metadata[is_trial]'] = 'true';
    }

    const session = await stripePost('/checkout/sessions', params);

    return new Response(
      JSON.stringify({ url: session.url, session_id: session.id }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-create-session error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
