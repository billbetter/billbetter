// Creates a Stripe Billing Portal session so the user can manage their card,
// invoices and cancellation on Stripe's own hosted pages.
//
// This replaces a frontend stub that returned { url: '#' }, which is why the
// "Open Stripe Billing Portal" button appeared to do nothing.
import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripePost } from '../_shared/stripe.ts';

const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';

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
    if (!user) return json({ error: 'Not authenticated' }, 401);

    // The portal is scoped to a Stripe customer. Read it from this user's own
    // row rather than trusting anything in the request body -- otherwise any
    // signed-in user could open any other customer's billing portal.
    const row = await db.findOne('Subscription', { user_id: user.id });
    const customerId = row?.stripe_customer_id;

    if (!customerId) {
      return json(
        {
          error:
            'No billing account yet. Choose a plan first, then manage billing here.',
        },
        400,
      );
    }

    const { searchParams } = new URL(req.url);
    const returnTo = searchParams.get('return_to') || '/Settings';

    const session = await stripePost('/billing_portal/sessions', {
      customer: customerId,
      return_url: `${APP_URL}${returnTo.startsWith('/') ? returnTo : `/${returnTo}`}`,
    });

    if (!session?.url) throw new Error('Stripe returned no portal URL');

    return json({ success: true, url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('stripe-customer-portal error:', message);

    // Stripe refuses to create a session until a portal configuration exists.
    // That is a one-time dashboard setup, not a code fault, so say so plainly
    // instead of surfacing Stripe's wording.
    if (/no configuration provided|default configuration has not been created/i.test(message)) {
      return json(
        {
          error:
            'The Stripe billing portal has not been set up yet. Enable it once at ' +
            'https://dashboard.stripe.com/settings/billing/portal',
        },
        400,
      );
    }

    return json({ error: message || 'Unknown error' }, 500);
  }
});
