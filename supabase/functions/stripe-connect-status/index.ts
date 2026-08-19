import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripeGet, connectAccountStatus } from '../_shared/stripe.ts';

// Reports whether the caller's connected account can actually take payments.
//
// Settings polls this as checkStripeStatus after onboarding returns, and reads
// only `status`. Stripe's own view of the account is the authority here -- the
// stored status is a cache, refreshed from what this call finds.

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const settings = await db.findOne('BusinessSettings', { user_id: user.id });
    const accountId = settings?.stripe_account_id;

    if (!accountId) {
      return new Response(
        JSON.stringify({ status: 'not_connected' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    let account: Record<string, any>;
    try {
      account = await stripeGet(`/accounts/${accountId}`);
    } catch (err) {
      // The account was deleted or rejected. Clear it so the UI offers to
      // connect again instead of polling an id that will never resolve.
      console.warn('connected account unreadable:', accountId, err?.message || err);
      await db.update('BusinessSettings', settings.id, {
        stripe_account_id: null,
        stripe_account_status: 'not_connected',
        stripe_onboarding_completed: false,
      });
      return new Response(
        JSON.stringify({ status: 'not_connected' }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const status = connectAccountStatus(account);

    if (
      status !== settings.stripe_account_status ||
      Boolean(settings.stripe_onboarding_completed) !== (status === 'active')
    ) {
      await db.update('BusinessSettings', settings.id, {
        stripe_account_status: status,
        stripe_onboarding_completed: status === 'active',
      });
    }

    return new Response(
      JSON.stringify({
        status,
        charges_enabled: Boolean(account.charges_enabled),
        payouts_enabled: Boolean(account.payouts_enabled),
        details_submitted: Boolean(account.details_submitted),
        // Lets Settings tell someone what Stripe is still waiting on rather
        // than just saying "pending".
        requirements_due: account.requirements?.currently_due || [],
        disabled_reason: account.requirements?.disabled_reason || null,
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-connect-status error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
