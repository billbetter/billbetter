import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { notify } from '../_shared/notify.ts';
import { stripeGet, stripePost, stripeDelete } from '../_shared/stripe.ts';
import { PLAN_LIMITS, limitsForPlan } from '../_shared/plan-limits.ts';


// The paid invoice behind a subscription, whichever API shape it arrives in.
//
// invoice.charge and invoice.payment_intent were both removed in
// 2025-03-31.basil in favour of the invoice_payments list, and this account is
// on 2026-04-22.dahlia. The older fields stay as fallbacks so a pinned account
// still refunds correctly.
async function findInvoicePayment(invoice: Record<string, any>) {
  const fromList = invoice?.payments?.data?.[0]?.payment;
  if (fromList?.payment_intent) return { payment_intent: fromList.payment_intent };
  if (invoice?.payment_intent) {
    return {
      payment_intent:
        typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent.id,
    };
  }

  try {
    const list = await stripeGet(`/invoice_payments?invoice=${invoice.id}&limit=1`);
    const pi = list?.data?.[0]?.payment?.payment_intent;
    if (pi) return { payment_intent: typeof pi === 'string' ? pi : pi.id };
  } catch (err) {
    console.warn('invoice_payments lookup failed:', err?.message || err);
  }

  if (invoice?.charge) {
    return { charge: typeof invoice.charge === 'string' ? invoice.charge : invoice.charge.id };
  }
  return null;
}

// A subscription whose first invoice was $0 -- a 100%-off promo, or a trial --
// is activated by Stripe without a payment method attached. The card was still
// collected through a SetupIntent, so point the subscription at it; otherwise
// the first real renewal has nothing to charge and goes straight to past_due.
async function ensureDefaultPaymentMethod(sub: Record<string, any>) {
  if (!sub?.id || !sub?.customer || sub.default_payment_method) return;
  try {
    const pms = await stripeGet(`/customers/${sub.customer}/payment_methods?type=card&limit=1`);
    const pm = pms?.data?.[0];
    if (pm) {
      await stripePost(`/subscriptions/${sub.id}`, { default_payment_method: pm.id });
    }
  } catch (err) {
    console.warn('ensureDefaultPaymentMethod failed for', sub.id, err?.message || err);
  }
}

// Replace the plan the user was on: refund what they paid for it, then cancel.
//
// Runs only after the new subscription is confirmed and written to the row, so
// a failure here costs the user nothing -- they keep the plan they just bought.
// Nothing in this function is allowed to throw for the same reason: a refund we
// cannot issue is a support ticket, not a reason to withhold a paid-for plan.
async function refundAndCancel(oldSubId: string, newSubId: string | null, userId: string) {
  const result: Record<string, unknown> = { subscription_id: oldSubId, refunded: false };

  try {
    const old = await stripeGet(`/subscriptions/${oldSubId}?expand[0]=latest_invoice`);
    if (old?.error) throw new Error(old.error.message);

    const invoice = old.latest_invoice;

    // Only the period they actually paid for is refundable. A trial that never
    // charged, or a past_due subscription whose current invoice went unpaid,
    // leaves nothing to give back.
    if (invoice && invoice.status === 'paid' && invoice.amount_paid > 0) {
      const target = await findInvoicePayment(invoice);

      if (!target) {
        result.refund_error = 'No charge found on the last invoice';
      } else {
        // Guard against a duplicate refund if this endpoint is called twice for
        // the same switch.
        const key = target.payment_intent
          ? `payment_intent=${target.payment_intent}`
          : `charge=${target.charge}`;
        const existingRefunds = await stripeGet(`/refunds?${key}&limit=1`);

        if (existingRefunds?.data?.length) {
          result.refunded = true;
          result.refund_id = existingRefunds.data[0].id;
          result.refund_amount = existingRefunds.data[0].amount / 100;
        } else {
          const refund = await stripePost('/refunds', {
            ...(target.payment_intent
              ? { payment_intent: target.payment_intent }
              : { charge: target.charge! }),
            reason: 'requested_by_customer',
            'metadata[user_id]': userId,
            'metadata[reason]': 'plan_switch',
            ...(newSubId ? { 'metadata[replaced_by]': newSubId } : {}),
          });
          result.refunded = true;
          result.refund_id = refund.id;
          result.refund_amount = refund.amount / 100;
        }
      }
    }
  } catch (err) {
    console.error('plan switch refund failed for', oldSubId, err?.message || err);
    result.refund_error = err?.message || String(err);
  }

  try {
    // Immediate, and without prorating -- the refund above already settles the
    // money, so a Stripe credit note on top would pay the user twice.
    await stripeDelete(`/subscriptions/${oldSubId}`, { prorate: 'false' });
    result.canceled = true;
  } catch (err) {
    console.error('plan switch cancel failed for', oldSubId, err?.message || err);
    result.cancel_error = err?.message || String(err);
  }

  return result;
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
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
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
          { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
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
    const limits = limitsForPlan(planName);

    const now = new Date().toISOString();
    // Prefer Stripe's own trial_end; the +7d fallback only covers the hosted
    // Checkout path, where we have no subscription object to read.
    const trialEnd = subscription.trial_end
      ? new Date(subscription.trial_end * 1000).toISOString()
      : isTrial
        ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
        : null;

    const existing = await db.findOne('Subscription', { user_id: user.id });

    // One plan per user: anything they were already paying for is replaced by
    // what they just bought.
    const newSubId = session.subscription || null;
    const replacedSubId =
      existing?.stripe_subscription_id && existing.stripe_subscription_id !== newSubId
        ? existing.stripe_subscription_id
        : null;

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
      subscription_end_date: null,
      ...(trialEnd ? { trial_end_date: trialEnd } : {}),
      // Needed by stripe-webhook to map lifecycle events back to this user.
      ...(session.customer ? { stripe_customer_id: session.customer } : {}),
      ...(newSubId ? { stripe_subscription_id: newSubId } : {}),
    };

    // Write before touching the old subscription. Cancelling it fires
    // customer.subscription.deleted, and the webhook only knows to ignore that
    // event once the row already points at the new subscription id.
    if (existing) {
      await db.update('Subscription', existing.id, subData);
    } else {
      await db.insert('Subscription', subData);
    }

    // Plan display name: the ids are lowercase slugs ('enterprise').
    const pretty = (id?: string | null) =>
      id ? id.charAt(0).toUpperCase() + id.slice(1) : '';

    // Upgrade vs downgrade is decided by the transaction allowance, which is
    // the only ordering the plans actually carry.
    // -1 means UNLIMITED (custom), so it sorts highest, not lowest -- otherwise
    // a move onto a negotiated Custom plan is announced as a downgrade.
    const rank = (id?: string | null) => {
      if (!id || !PLAN_LIMITS[id]) return -1;
      const t = PLAN_LIMITS[id].transactions;
      return t === -1 ? Number.POSITIVE_INFINITY : t;
    };

    // Awaited but never throws (see notify.ts), so it cannot fail activation.
    //
    // A plan change is notified HERE rather than from the webhook. An earlier
    // version assumed customer.subscription.updated would cover it; it cannot.
    // That event carries Stripe price ids, not our plan slugs, so the webhook
    // has no way to say what someone moved from and to -- it saw active ->
    // active and stayed silent, which is why plan changes sent nothing at all.
    if (isTrial && !existing) {
      await notify.trialStarted({
        userEmail: user.email || '',
        userName: null,
        planName,
        trialEndDate: trialEnd,
        dashboardUrl: `${Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca'}/Dashboard`,
      });
    } else if (existing?.plan_name && existing.plan_name !== planName) {
      await notify.subscriptionChanged({
        userEmail: user.email || '',
        userName: null,
        change: rank(planName) >= rank(existing.plan_name) ? 'upgraded' : 'downgraded',
        planName: pretty(planName),
        previousPlanName: pretty(existing.plan_name),
        effectiveDate: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
        billingUrl: `${Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca'}/Settings`,
      });
    }

    await ensureDefaultPaymentMethod(subscription);

    const replaced = replacedSubId
      ? await refundAndCancel(replacedSubId, newSubId, user.id)
      : null;

    return new Response(
      JSON.stringify({
        ok: true,
        plan_name: planName,
        billing_cycle: billingCycle,
        monthly_transaction_limit: limits.transactions,
        payment_processing_fee: limits.fee,
        ...(replaced ? { replaced } : {}),
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('confirm-and-activate error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
