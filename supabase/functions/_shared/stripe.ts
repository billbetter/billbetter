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

export async function stripeRequest(
  method: string,
  path: string,
  params?: Record<string, string>,
): Promise<any> {
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

export const stripeGet = (path: string) => stripeRequest('GET', path);
export const stripePost = (path: string, params?: Record<string, string>) =>
  stripeRequest('POST', path, params);
export const stripeDelete = (path: string, params?: Record<string, string>) =>
  stripeRequest('DELETE', path, params);

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
