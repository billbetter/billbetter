import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { stripeGet, stripePost, stripeUploadFile, PLATFORM_BRANDING } from '../_shared/stripe.ts';

// Starts (or resumes) Stripe Express onboarding for a contractor.
//
// Express means Stripe hosts the onboarding form and the KYC that goes with it,
// and the contractor gets a Stripe-run dashboard for their payouts. We only ever
// hold the account id.
//
// Called by Settings and the onboarding tour as createStripeConnectAccount, both
// of which expect { url } back and send the browser there.

const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';

// Account links are single-use and expire in minutes, so a fresh one is minted
// on every call. Reusing the account id is what makes this resumable: a
// contractor who abandons onboarding halfway returns to where they left off
// rather than starting a second account.
async function resolveAccount(settings: any, user: { id: string; email?: string }) {
  const stored = settings?.stripe_account_id;
  if (stored) {
    try {
      const account = await stripeGet(`/accounts/${stored}`);
      if (account?.id) return { id: account.id, created: false, account };
    } catch (err) {
      // Deleted from the dashboard, or belonging to another platform/mode.
      console.warn('stored connected account unusable, creating a new one:', stored, err?.message || err);
    }
  }

  const params: Record<string, string> = {
    type: 'express',
    'capabilities[card_payments][requested]': 'true',
    'capabilities[transfers][requested]': 'true',
    'metadata[user_id]': user.id,
    // Direct charges: the contractor is the merchant of record, so Stripe's
    // processing fee settles against their balance, not ours.
    'settings[payouts][schedule][interval]': 'daily',
  };
  if (user.email) params.email = user.email;
  if (settings?.business_name) params['business_profile[name]'] = settings.business_name;
  if (settings?.website) params['business_profile[url]'] = settings.website;

  const account = await stripePost('/accounts', params);
  return { id: account.id, created: true, account };
}

// Dress the connected account in Invoicium's brand.
//
// With direct charges the client checks out on the CONTRACTOR's account, so the
// hosted Checkout page takes its icon and colours from that account -- left
// alone it renders as an unbranded Stripe page that looks nothing like the
// invoice the client just received. The contractor's own business name stays on
// the page: they are who the client is paying, and overwriting that would
// misrepresent the merchant.

// Branding images are File objects, and files belong to whoever uploaded them.
// They must be uploaded and referenced as the PLATFORM -- uploading against the
// connected account produces a file id the platform cannot then attach ("No
// such file upload").
//
// One upload does NOT serve every contractor, which is what this used to assume.
// Attaching a file to an account consumes it, and attaching the same one to a
// second account fails with "That file is already attached to something else."
// Because the failure is swallowed as cosmetic below, the visible symptom was
// not an error -- it was the second contractor onwards quietly getting no
// branding at all.
//
// Nor is there a cached id worth keeping. Reuse used to be unconditional: the
// newest file with the right purpose won, whatever it depicted, which is how
// every contractor onboarded after the AxisBill rebrand still checked out under
// the dead logo. Re-reading the shipped asset each time is what makes replacing
// public/logo-full.png the whole job.
//
// Content cannot be compared to avoid the re-upload, either -- Stripe re-encodes
// branding images, so the size it reports back is not the size that was sent.
//
// So: a fresh upload per account, per onboarding. Two images of a few KB, on a
// path a contractor reaches by hand, is not worth optimising.
async function uploadBrandFiles() {
  const found: { icon?: string; logo?: string } = {};
  for (const [purpose, field, path] of [
    ['business_icon', 'icon', '/logo-icon.png'],
    ['business_logo', 'logo', '/logo-full.png'],
  ] as const) {
    try {
      const res = await fetch(`${APP_URL}${path}`);
      if (!res.ok) continue;
      const file = await stripeUploadFile(await res.blob(), path.slice(1), purpose);
      found[field] = file.id;
    } catch (err) {
      console.warn(`brand ${field} unavailable:`, err instanceof Error ? err.message : err);
    }
  }
  return found;
}

async function applyPlatformBranding(accountId: string) {
  try {
    // Applied on every onboarding, not only when branding is unset.
    //
    // The guard here used to be `if (account?.settings?.branding?.icon) return`,
    // which meant an account branded once was branded forever -- a contractor
    // onboarded before a rebrand kept the dead logo with no route to the new
    // one, because this is the only place branding is ever set.
    //
    // Re-applying unconditionally is what gives them that route: the next time
    // they open onboarding they pick up whatever the app currently ships. This
    // runs only on a page a contractor opens by hand, so the extra write costs
    // nothing worth guarding.
    const files = await uploadBrandFiles();
    const params: Record<string, string> = {
      'settings[branding][primary_color]': PLATFORM_BRANDING.primary_color,
      'settings[branding][secondary_color]': PLATFORM_BRANDING.secondary_color,
    };
    if (files.icon) params['settings[branding][icon]'] = files.icon;
    if (files.logo) params['settings[branding][logo]'] = files.logo;

    await stripePost(`/accounts/${accountId}`, params);
  } catch (err) {
    // Branding is cosmetic. A contractor who cannot get paid because a logo
    // would not upload is a far worse outcome.
    console.warn('applyPlatformBranding failed for', accountId, err instanceof Error ? err.message : err);
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const body = await req.json().catch(() => ({}));
    const returnUrl = body?.return_url || `${APP_URL}/Settings`;
    const refreshUrl = body?.refresh_url || returnUrl;

    let settings = await db.findOne('BusinessSettings', { user_id: user.id });

    const { id: accountId } = await resolveAccount(settings, user);
    await applyPlatformBranding(accountId);

    // Persist before sending them to Stripe. If they complete onboarding and
    // never come back to the return_url, the webhook still needs this id to
    // match account.updated to the right row.
    const patch = {
      stripe_account_id: accountId,
      stripe_account_status: 'pending',
      stripe_onboarding_completed: false,
    };
    if (settings) {
      await db.update('BusinessSettings', settings.id, patch);
    } else {
      settings = await db.insert('BusinessSettings', { user_id: user.id, ...patch });
    }

    const link = await stripePost('/account_links', {
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: 'account_onboarding',
    });

    return new Response(
      JSON.stringify({ url: link.url, account_id: accountId }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-connect-onboard error:', err);

    // The platform has not signed up for Connect. Stripe's own wording points
    // at a dashboard page, but says nothing about what the user was trying to
    // do, so translate it into something the contractor can act on.
    const raw = err instanceof Error ? err.message : String(err);
    const message = /signed up for Connect/i.test(raw)
      ? 'Card payments are not switched on for this platform yet. The account ' +
        'owner needs to enable Stripe Connect at https://dashboard.stripe.com/connect.'
      : raw || 'Unknown error';

    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
