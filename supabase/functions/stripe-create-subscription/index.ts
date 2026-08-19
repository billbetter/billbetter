import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripeGet, stripePost, stripeDelete, resolvePromotionCode } from '../_shared/stripe.ts';

// A user holds exactly one plan. Switching plans is therefore a replacement,
// not an addition: this function creates and charges the new subscription at
// full price, and confirm-and-activate refunds and cancels the old one once
// the new charge has actually gone through.
//
// The order matters. Cancelling first would leave a user with no plan at all
// if their card is declined on the new one.
const REPLACEABLE = ['active', 'trial', 'trialing', 'past_due'];

// Reuse the customer already on the Subscription row when there is one, so a
// user who upgrades does not accumulate duplicate Stripe customers.
//
// The stored id is confirmed against Stripe rather than trusted. A customer
// deleted from the dashboard still leaves its id on our row, and Stripe answers
// a deleted customer with 200 {deleted: true} rather than a 404 -- so reusing it
// blind failed the subscription with "No such customer" and locked that user out
// of checkout permanently, with no way back other than editing the database.
async function resolveCustomer(user: { id: string; email?: string }, existing: any) {
  const stored = existing?.stripe_customer_id;
  if (stored) {
    try {
      const customer = await stripeGet(`/customers/${stored}`);
      if (customer?.id && !customer.deleted) return { id: customer.id, reused: true };
      console.warn('stored Stripe customer is deleted, creating a new one:', stored);
    } catch (err) {
      // 404 -- the id belongs to another account, or to test mode.
      console.warn('stored Stripe customer unusable, creating a new one:', stored, err?.message || err);
    }
  }

  const params: Record<string, string> = { 'metadata[user_id]': user.id };
  if (user.email) params.email = user.email;
  const customer = await stripePost('/customers', params);
  return { id: customer.id, reused: false };
}

// Subscriptions left in `incomplete` mean a checkout that was started and never
// paid for. Stripe expires them after 24h on its own, but until then a user who
// retries accumulates them -- and a stray one could still be confirmed later by
// a client holding its old client secret, which would bill twice.
async function cancelIncompleteSubscriptions(customerId: string) {
  try {
    const list = await stripeGet(`/subscriptions?customer=${customerId}&status=incomplete&limit=20`);
    for (const sub of list?.data || []) {
      await stripeDelete(`/subscriptions/${sub.id}`);
    }
  } catch (err) {
    // Never block a checkout over housekeeping.
    console.warn('cancelIncompleteSubscriptions failed:', err?.message || err);
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { price_id, plan_name, billing_cycle, is_trial, promo_code } = await req.json();
    if (!price_id) throw new Error('price_id is required');
    if (!plan_name) throw new Error('plan_name is required');

    const cycle = billing_cycle || 'monthly';
    const existing = await db.findOne('Subscription', { user_id: user.id });

    const { id: customerId, reused } = await resolveCustomer(user, existing);

    // A plan only counts as held if the customer it belongs to is still real.
    // When the customer is gone its subscriptions went with it, so the row's
    // "active" status is stale -- treating it as live would refuse the purchase
    // as a duplicate and leave the user unable to buy anything at all.
    const holdsPlan = Boolean(
      existing && REPLACEABLE.includes(existing.status) && existing.stripe_subscription_id && reused
    );

    // Buying the plan you are already on is a double-submit, not a switch.
    if (holdsPlan && existing.plan_name === plan_name && existing.billing_cycle === cycle) {
      return new Response(
        JSON.stringify({
          error: `You are already on the ${plan_name} plan (${cycle}).`,
          already_subscribed: true,
        }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 409 }
      );
    }

    // Trials are once per user, tracked on our side -- Stripe would happily
    // grant another to the same customer under a new subscription. Switching
    // plans never re-opens one either.
    const trialEligible = Boolean(is_trial) && !existing?.trial_end_date && !holdsPlan;

    await cancelIncompleteSubscriptions(customerId);

    const params: Record<string, string> = {
      customer: customerId,
      'items[0][price]': price_id,
      payment_behavior: 'default_incomplete',
      'payment_settings[save_default_payment_method]': 'on_subscription',
      'payment_settings[payment_method_types[0]]': 'card',
      'metadata[user_id]': user.id,
      'metadata[plan_name]': plan_name,
      'metadata[billing_cycle]': cycle,
      'expand[0]': 'latest_invoice.confirmation_secret',
      'expand[1]': 'pending_setup_intent',
      // Legacy field, for accounts still pinned to a pre-Basil API version.
      'expand[2]': 'latest_invoice.payment_intent',
    };

    // The code is re-resolved here rather than trusted from the client, so the
    // browser can only ever name a discount -- never define one.
    let appliedPromo: Record<string, unknown> | null = null;
    if (promo_code) {
      const promo = await resolvePromotionCode(promo_code);
      if (!promo.ok) {
        return new Response(
          JSON.stringify({ error: promo.reason, promo_invalid: true }),
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      params['discounts[0][promotion_code]'] = promo.id;
      params['metadata[promo_code]'] = promo.code;
      appliedPromo = {
        code: promo.code,
        percent_off: promo.coupon.percent_off ?? null,
        amount_off: promo.coupon.amount_off ? promo.coupon.amount_off / 100 : null,
      };
    }

    if (trialEligible) {
      params.trial_period_days = '7';
      params['metadata[is_trial]'] = 'true';
      // With a trial nothing is charged now, so collect the card via a
      // SetupIntent instead and keep the subscription if setup is abandoned.
      params['trial_settings[end_behavior][missing_payment_method]'] = 'cancel';
    }

    const subscription = await stripePost('/subscriptions', params);

    // Paid start -> the first invoice carries the secret. Trial start -> nothing
    // to pay today, so Stripe attaches a SetupIntent instead.
    //
    // Stripe removed invoice.payment_intent in API version 2025-03-31.basil.
    // This account is on 2026-04-22.dahlia, where the secret arrives as
    // latest_invoice.confirmation_secret; reading the old field returned
    // undefined, so every paid checkout failed while the subscription had
    // already been created. The old path stays as a fallback.
    const invoice = subscription?.latest_invoice;
    const invoiceSecret =
      invoice?.confirmation_secret?.client_secret ||
      invoice?.payment_intent?.client_secret;
    const setupIntent = subscription?.pending_setup_intent;
    const clientSecret = invoiceSecret || setupIntent?.client_secret;

    // A 100%-off promo leaves nothing to confirm: Stripe skips the payment
    // intent entirely and activates the subscription on the spot. Without this
    // branch checkout would fail on a missing client secret after the customer
    // had already been given the plan.
    //
    // The card still has to be collected. A `once` or `repeating` coupon only
    // covers the first invoice, and a subscription with no payment method on
    // file goes past_due the moment the discount runs out -- so fall back to a
    // SetupIntent, exactly as the trial path does.
    let settledFree = false;
    let freeSecret: string | null = null;

    if (!clientSecret) {
      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        throw new Error('Stripe did not return a client secret for this subscription');
      }
      settledFree = true;
      const setup = await stripePost('/setup_intents', {
        customer: customerId,
        'payment_method_types[0]': 'card',
        usage: 'off_session',
        'metadata[user_id]': user.id,
        'metadata[subscription_id]': subscription.id,
      });
      freeSecret = setup.client_secret;
    }

    return new Response(
      JSON.stringify({
        subscription_id: subscription.id,
        customer_id: customerId,
        client_secret: clientSecret || freeSecret,
        mode: invoiceSecret ? 'payment' : 'setup',
        first_charge_free: settledFree,
        is_trial: trialEligible,
        promo: appliedPromo,
        // Tells Checkout what confirm-and-activate is about to replace.
        replacing: holdsPlan
          ? { plan_name: existing.plan_name, billing_cycle: existing.billing_cycle }
          : null,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-create-subscription error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
