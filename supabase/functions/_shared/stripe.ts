// Shared Stripe REST client.
//
// The functions here talk to Stripe over plain fetch rather than the SDK: the
// deploy script inlines _shared/* into a single module, and the Node SDK does
// not survive that. Everything is form-encoded, which is what /v1 expects.
//
// This account is on API version 2026-04-22.dahlia. Two things follow from that
// and are easy to get wrong:
//   - discounts are set with discounts[0][...]; the old top-level `coupon` and
//     `promotion_code` params were removed in 2025-03-31.basil.
//   - an invoice's client secret lives at latest_invoice.confirmation_secret.

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY')!;

// `stripeAccount` issues the call against a connected account (the Stripe-Account
// header). Connect uses this for direct charges: the charge is created on the
// contractor's account, so they are the merchant of record, Stripe's processing
// fee comes out of their balance, and the platform keeps only the
// application_fee_amount. Omitting the header charges the platform instead --
// the same request, but the money lands in a different place.
export interface StripeOptions {
  stripeAccount?: string;
  idempotencyKey?: string;
}

export async function stripeRequest(
  method: string,
  path: string,
  params?: Record<string, string>,
  options?: StripeOptions,
): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ':')}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (options?.stripeAccount) headers['Stripe-Account'] = options.stripeAccount;
  if (options?.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  const init: RequestInit = { method, headers };
  if (params) init.body = new URLSearchParams(params).toString();

  const res = await fetch(`https://api.stripe.com/v1${path}`, init);
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe ${res.status}`);
  return data;
}

export const stripeGet = (path: string, options?: StripeOptions) =>
  stripeRequest('GET', path, undefined, options);
export const stripePost = (path: string, params?: Record<string, string>, options?: StripeOptions) =>
  stripeRequest('POST', path, params, options);
export const stripeDelete = (path: string, params?: Record<string, string>, options?: StripeOptions) =>
  stripeRequest('DELETE', path, params, options);

export type PromoResult =
  | { ok: true; id: string; code: string; coupon: Record<string, any> }
  | { ok: false; reason: string };

// Resolve a customer-facing promotion code ("SAVE20") to its promo_... id.
//
// Lives here so the Checkout preview and the actual subscription charge apply
// the identical rules -- a code the preview accepts but the charge rejects
// (or worse, the reverse) is how a customer ends up billed a price they were
// never shown.
export async function resolvePromotionCode(
  rawCode: string,
  order?: { amountCents?: number; currency?: string },
): Promise<PromoResult> {
  const code = String(rawCode || '').trim();
  if (!code) return { ok: false, reason: 'Enter a promo code.' };

  // Stripe matches `code` case-insensitively but exactly otherwise, and the
  // list endpoint is the only way in -- promotion codes have no lookup by code.
  //
  // The discount hangs off promotion.coupon on 2026-04-22.dahlia, not the
  // top-level `coupon` of older versions. Expanding the wrong path is silent --
  // Stripe returns 200 with the field simply absent -- which read as an invalid
  // coupon and rejected every code as expired.
  const list = await stripeRequest(
    'GET',
    `/promotion_codes?code=${encodeURIComponent(code)}&active=true&limit=1` +
      `&expand[0]=data.promotion.coupon&expand[1]=data.coupon`,
  );
  const promo = list?.data?.[0];
  if (!promo) return { ok: false, reason: 'That promo code is not valid.' };

  const coupon = promo.promotion?.coupon || promo.coupon;

  // active=true already filters expiry and the global redemption cap, but a
  // coupon deleted out from under a still-active code stays listed.
  if (!coupon?.valid) return { ok: false, reason: 'That promo code has expired.' };

  if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
    return { ok: false, reason: 'That promo code has been fully redeemed.' };
  }

  // Stripe enforces restrictions itself when the code reaches a subscription,
  // but only after the card has been entered. Checking the order minimum here
  // means the customer is told before that, not after.
  const min = promo.restrictions?.minimum_amount;
  if (min && order?.amountCents != null && order.amountCents < min) {
    const currency = String(promo.restrictions.minimum_amount_currency || order.currency || '').toUpperCase();
    return {
      ok: false,
      reason: `That code needs an order of at least $${(min / 100).toFixed(2)} ${currency}.`.trim(),
    };
  }

  return { ok: true, id: promo.id, code: promo.code, coupon };
}

// What the customer actually pays on the first invoice, in dollars.
//
// Only the first invoice is discounted for `once` coupons, and `repeating`
// coupons stop after duration_in_months -- the checkout summary shows the
// first charge, so both collapse to the same number here.
export function applyCoupon(amount: number, coupon: Record<string, any>): number {
  if (coupon?.percent_off) {
    return Math.max(0, Math.round(amount * (1 - coupon.percent_off / 100) * 100) / 100);
  }
  if (coupon?.amount_off) {
    return Math.max(0, Math.round((amount - coupon.amount_off / 100) * 100) / 100);
  }
  return amount;
}

// When a subscription's paid period actually ends, as an ISO string, or null.
//
// Stripe moved current_period_start/end OFF the subscription and onto each
// subscription ITEM in API version 2025-04-30.basil, and this account is on
// 2026-04-22.dahlia -- so a direct read of /subscriptions no longer carries the
// top-level field. That is measured, not assumed: a live read of this account's
// own subscription returns the date only on items.data[0], with the top-level
// key absent entirely. A webhook event still can, because events are delivered at
// the version pinned on the ENDPOINT rather than the account default, and that
// version is not ours to assume. Both shapes are real, so both are tried.
//
// Returns null rather than a guess when none of them is there. Every caller
// uses this date to tell a customer when their access or their billing changes,
// and a wrong date is worse than no date: it is the single fact they plan
// around. Callers show nothing, or fall back to something they actually know.
//
// Shared rather than copied because stripe-webhook, stripe-cancel-subscription
// and confirm-and-activate all report this same date, and three copies would
// drift. There is a harder reason too: deploy-functions.py inlines _shared/*
// into ONE top-level scope, so a private copy under this name alongside the
// import would be a duplicate declaration -- a SyntaxError, a BOOT_ERROR, and a
// deploy that still prints Done.
export function subscriptionPeriodEnd(sub: Record<string, any>): string | null {
  const seconds =
    sub?.items?.data?.[0]?.current_period_end ??
    sub?.current_period_end ??
    sub?.cancel_at ??
    (sub?.status === 'trialing' ? sub?.trial_end : null);

  if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
  const date = new Date(seconds * 1000);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// The one place a Stripe account object becomes the status the app stores.
//
// Shared so stripe-connect-status (polled by Settings) and the webhook's
// account.updated handler can never disagree -- a contractor shown as "active"
// by one and "pending" by the other would be told they can take payments while
// the payment link refuses to build.
//
// 'active' specifically requires charges_enabled: an account that has submitted
// details but is still under review cannot take money yet.
export function connectAccountStatus(
  account: Record<string, any>,
): 'active' | 'pending' | 'restricted' {
  if (account?.charges_enabled && account?.details_submitted) return 'active';
  if (account?.requirements?.disabled_reason) return 'restricted';
  return 'pending';
}

// What the platform keeps on a contractor's payment, in cents.
//
// The rate is the plan's payment_processing_fee (1% on most tiers, 0.75% and
// 0.6% higher up, 0 on free) -- the "1% platform fee" the pricing page
// advertises. Defaults to 1 when no subscription row is readable so a missing
// row undercharges rather than charging nothing at all.
export function applicationFeeCents(totalCents: number, feePercent: unknown): number {
  const rate = Number(feePercent);
  const pct = Number.isFinite(rate) && rate >= 0 ? rate : 1;
  if (pct === 0) return 0;
  // Never let rounding produce a fee at or above the charge itself.
  return Math.min(Math.round(totalCents * pct / 100), Math.max(totalCents - 1, 0));
}

// Invoicium's own brand, applied to every connected account so the Stripe
// Checkout page a contractor's client lands on looks like the product that sent
// the invoice. Values mirror --brand-700 / --brand-500 in src/index.css.
export const PLATFORM_BRANDING = {
  primary_color: '#0369A1',
  secondary_color: '#0EA5E9',
};

// Stripe stores branding images as File objects, not URLs, so a logo has to be
// uploaded before it can be referenced.
//
// Files belong to whoever uploaded them. Branding images for a connected account
// must therefore be uploaded and attached as the PLATFORM, with no
// Stripe-Account: uploading against the connected account yields a file id the
// platform cannot then attach, and the update fails with "No such file upload".
// The upside is that one upload serves every connected account.
//
// Multipart, so Content-Type is deliberately left unset -- fetch fills in the
// boundary and overriding it breaks the upload.
export async function stripeUploadFile(
  file: Blob,
  filename: string,
  purpose: string,
  options?: StripeOptions,
): Promise<any> {
  const form = new FormData();
  form.append('purpose', purpose);
  form.append('file', file, filename);

  const headers: Record<string, string> = {
    Authorization: `Basic ${btoa(STRIPE_SECRET_KEY + ':')}`,
  };
  if (options?.stripeAccount) headers['Stripe-Account'] = options.stripeAccount;

  const res = await fetch('https://files.stripe.com/v1/files', {
    method: 'POST',
    headers,
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Stripe files ${res.status}`);
  return data;
}
