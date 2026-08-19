import { handleCors, corsHeaders } from '../_shared/cors.ts';
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
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
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
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-create-session error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
