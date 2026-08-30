// Read, schedule and undo a subscription cancellation, so the whole flow can
// happen on an Invoicium page instead of on Stripe's hosted one.
//
// -- Why this exists -------------------------------------------------------
//
// Cancelling used to mean leaving the product: Settings -> Billing -> "Open
// Stripe Billing Portal" -> a page with Stripe's chrome on it. That is the one
// moment a customer is already unsure about us, and we handed them to a page
// that does not look like us and does not say what actually happens to their
// invoices.
//
// -- What it deliberately does NOT do --------------------------------------
//
// It never cancels immediately. `cancel_at_period_end` is the whole mechanism:
// the customer paid for this period, so they keep the period. Stripe leaves the
// subscription `active` until the end, which means access is unchanged and
// lib/access.js needs no special case -- and then fires
// customer.subscription.deleted, which stripe-webhook already handles by
// setting status 'canceled'. So this function writes NOTHING to our database.
// The webhook stays the only writer of subscription state; a second writer is
// how the row and Stripe drift apart.
//
// It also never takes a subscription id from the request. The id is read from
// the caller's OWN Subscription row under the service role, the same rule
// stripe-customer-portal follows: otherwise any signed-in user could cancel
// anyone's plan by guessing an id.
import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripeGet, stripePost } from '../_shared/stripe.ts';

type Action = 'preview' | 'cancel' | 'resume';

const ACTIONS: Action[] = ['preview', 'cancel', 'resume'];

/**
 * When paid access actually ends, as an ISO string, or null.
 *
 * Stripe moved current_period_start/end OFF the subscription and onto each
 * subscription ITEM in API version 2025-04-30.basil. This account is on
 * 2026-04-22.dahlia (see _shared/stripe.ts), so the top-level field that
 * stripe-webhook still reads is not guaranteed to be present on a direct read
 * -- webhook events are delivered at the version pinned on the endpoint, which
 * is not the account default.
 *
 * So every place the date legitimately lives is tried, and null is returned
 * rather than a guess. The page renders no date at all in that case. A wrong
 * date here is worse than no date: it is the single fact the customer will
 * plan around.
 */
function resolveAccessUntil(sub: Record<string, any>): string | null {
  const seconds =
    sub?.items?.data?.[0]?.current_period_end ??
    sub?.current_period_end ??
    sub?.cancel_at ??
    (sub?.status === 'trialing' ? sub?.trial_end : null);

  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** The subscription as the cancel page needs to see it. */
function describe(sub: Record<string, any>, planName: string | null) {
  const item = sub?.items?.data?.[0];
  const price = item?.price;
  return {
    plan_name: planName,
    // Stripe's own status, not ours. The page shows what is true at Stripe,
    // because that is what the cancellation acts on.
    status: sub?.status ?? null,
    cancel_at_period_end: Boolean(sub?.cancel_at_period_end),
    access_until: resolveAccessUntil(sub),
    // For "you are giving up $X a month". Null when the price is missing
    // rather than 0, which would read as free.
    amount: typeof price?.unit_amount === 'number' ? price.unit_amount / 100 : null,
    currency: typeof price?.currency === 'string' ? price.currency.toUpperCase() : null,
    interval: price?.recurring?.interval ?? null,
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status,
    });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return json({ success: false, error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => ({}));
    const action: Action = ACTIONS.includes(body?.action) ? body.action : 'preview';

    const row = await db.findOne('Subscription', { user_id: user.id });
    const subscriptionId = row?.stripe_subscription_id;

    if (!subscriptionId) {
      // A row with no Stripe subscription is a real state -- a plan set by
      // hand, or a checkout that never completed. Say which, rather than
      // failing with something that sounds like a bug.
      return json(
        {
          success: false,
          error: 'no_stripe_subscription',
          message: row
            ? 'This plan is not billed through Stripe, so there is nothing to cancel here. Contact support@invoicium.ca and we will sort it out.'
            : 'You do not have a subscription to cancel.',
        },
        400,
      );
    }

    let sub;
    try {
      sub = await stripeGet(`/subscriptions/${subscriptionId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Stripe says "No such subscription" when the id is stale -- a test-mode
      // id against live keys, or a subscription deleted directly in the
      // dashboard. The plan is already gone either way.
      if (/no such subscription/i.test(message)) {
        return json(
          {
            success: false,
            error: 'subscription_not_found',
            message:
              'We could not find this subscription at Stripe. It may already be cancelled — reload the page, and contact support@invoicium.ca if it still shows as active.',
          },
          404,
        );
      }
      throw err;
    }

    if (sub?.status === 'canceled' || sub?.status === 'incomplete_expired') {
      return json({
        success: true,
        already_ended: true,
        state: describe(sub, row?.plan_name ?? null),
      });
    }

    if (action === 'preview') {
      return json({ success: true, state: describe(sub, row?.plan_name ?? null) });
    }

    // Cancelling an already-scheduled cancellation, or resuming one that was
    // never scheduled, is a no-op rather than an error. Both are what a double
    // click or a stale tab produces, and neither is a problem.
    const wantCancel = action === 'cancel';
    if (Boolean(sub.cancel_at_period_end) === wantCancel) {
      return json({
        success: true,
        unchanged: true,
        state: describe(sub, row?.plan_name ?? null),
      });
    }

    const updated = await stripePost(`/subscriptions/${subscriptionId}`, {
      cancel_at_period_end: String(wantCancel),
    });

    // Logged without the customer id or email: this is the event we will want
    // to find later, and the user id is enough to find it by.
    console.log(
      `stripe-cancel-subscription: ${action} for user ${user.id}, ` +
        `cancel_at_period_end=${Boolean(updated?.cancel_at_period_end)}`,
    );

    // Stripe also emits customer.subscription.updated for this change, which
    // stripe-webhook picks up. That is the path that touches our database.
    return json({ success: true, state: describe(updated, row?.plan_name ?? null) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-cancel-subscription error:', message);
    return json({ success: false, error: message || 'Unknown error' }, 500);
  }
});
