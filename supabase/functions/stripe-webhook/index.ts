import { getCorsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';

// Mirrors PLAN_LIMITS in confirm-and-activate. A cancelled subscription drops
// the user back to the free tier rather than leaving paid limits in place.
const FREE_TIER = { plan_name: 'free', monthly_transaction_limit: 10, payment_processing_fee: 0 };

// Subscriptions created before subscription_data[metadata] was set carry no
// user_id, so fall back to the ids confirm-and-activate stored on the row.
async function findSubscriptionRow(sub: Record<string, any>) {
  const userId = sub?.metadata?.user_id;
  if (userId) {
    const row = await db.findOne('Subscription', { user_id: userId });
    if (row) return row;
  }
  if (sub?.id) {
    const row = await db.findOne('Subscription', { stripe_subscription_id: sub.id });
    if (row) return row;
  }
  if (sub?.customer) {
    const row = await db.findOne('Subscription', { stripe_customer_id: sub.customer });
    if (row) return row;
  }
  return null;
}

async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === v1;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: getCorsHeaders(req) });

  try {
    const raw = await req.text();
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const sig = req.headers.get('stripe-signature') || '';

    if (!secret) {
      console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not configured');
      return new Response('server misconfigured', { status: 500 });
    }
    if (!sig) {
      return new Response('missing stripe-signature header', { status: 400 });
    }
    const ok = await verifySignature(raw, sig, secret);
    if (!ok) {
      console.warn('stripe-webhook: signature verification failed');
      return new Response('invalid signature', { status: 400 });
    }

    const event = JSON.parse(raw);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        await db.update('Invoice', invoiceId, {
          status: 'paid',
          paid_date: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent || null,
        });
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        await db.update('Invoice', invoiceId, {
          status: 'paid',
          paid_date: new Date().toISOString(),
          stripe_payment_intent_id: pi.id,
        });
      }
    }

    // A subscription ending -- cancelled, or terminated for non-payment --
    // must revoke paid access, otherwise the user keeps their plan for free.
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const row = await findSubscriptionRow(sub);
      if (row) {
        await db.update('Subscription', row.id, {
          status: 'canceled',
          ...FREE_TIER,
          subscription_end_date: new Date().toISOString(),
        });
      } else {
        console.warn('subscription.deleted: no matching row for', sub.id);
      }
    }

    // Covers cancel_at_period_end, pauses, past_due and plan changes made from
    // the Stripe dashboard or customer portal.
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object;
      const row = await findSubscriptionRow(sub);
      if (row) {
        const stripeStatus = sub.status;
        const patch: Record<string, unknown> = {};

        if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') {
          Object.assign(patch, { status: 'canceled', ...FREE_TIER });
        } else if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') {
          patch.status = 'past_due';
        } else if (stripeStatus === 'trialing') {
          patch.status = 'trial';
        } else if (stripeStatus === 'active') {
          patch.status = 'active';
        }

        if (sub.current_period_end) {
          patch.next_billing_date = new Date(sub.current_period_end * 1000).toISOString();
        }
        if (sub.trial_end) {
          patch.trial_end_date = new Date(sub.trial_end * 1000).toISOString();
        }

        if (Object.keys(patch).length) {
          await db.update('Subscription', row.id, patch);
        }
      } else {
        console.warn('subscription.updated: no matching row for', sub.id);
      }
    }

    // A failed renewal is not yet a cancellation -- Stripe retries -- so mark
    // past_due and let subscription.deleted do the revoking if retries run out.
    if (event.type === 'invoice.payment_failed') {
      const inv = event.data.object;
      const subId = typeof inv.subscription === 'string' ? inv.subscription : inv.subscription?.id;
      if (subId) {
        const row = await findSubscriptionRow({ id: subId, customer: inv.customer });
        if (row) {
          await db.update('Subscription', row.id, { status: 'past_due' });
        } else {
          console.warn('invoice.payment_failed: no matching row for', subId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
