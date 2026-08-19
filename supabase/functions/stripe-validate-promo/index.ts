import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { resolvePromotionCode, applyCoupon } from '../_shared/stripe.ts';

// Checkout calls this when the customer applies a promo code, so the summary can
// show the real first charge before any card is entered.
//
// This only previews. The discount that actually bills is resolved again inside
// stripe-create-subscription from the code string -- a client that edits the
// preview response changes nothing about what Stripe charges.

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    // Authenticated so the endpoint cannot be used to brute-force which promo
    // codes exist on the account.
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { code, amount, currency } = await req.json();

    const amountNum = Number(amount);
    const hasAmount = Number.isFinite(amountNum) && amountNum > 0;

    const promo = await resolvePromotionCode(code, {
      amountCents: hasAmount ? Math.round(amountNum * 100) : undefined,
      currency: currency || 'CAD',
    });

    if (!promo.ok) {
      return new Response(
        JSON.stringify({ valid: false, reason: promo.reason }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const coupon = promo.coupon;

    return new Response(
      JSON.stringify({
        valid: true,
        code: promo.code,
        percent_off: coupon.percent_off ?? null,
        amount_off: coupon.amount_off ? coupon.amount_off / 100 : null,
        currency: (coupon.currency || currency || 'CAD').toUpperCase(),
        duration: coupon.duration,
        duration_in_months: coupon.duration_in_months ?? null,
        ...(hasAmount ? { discounted_amount: applyCoupon(amountNum, coupon) } : {}),
      }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('stripe-validate-promo error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
