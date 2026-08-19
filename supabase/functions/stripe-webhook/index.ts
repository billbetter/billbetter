import { getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserContact } from '../_shared/supabase-admin.ts';
import { notify } from '../_shared/notify.ts';

// Mirrors PLAN_LIMITS in confirm-and-activate. A cancelled subscription drops
// the user back to the free tier rather than leaving paid limits in place.
const FREE_TIER = { plan_name: 'free', monthly_transaction_limit: 10, payment_processing_fee: 0 };

const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';

// Stripe status -> the change we describe to the user. Mirrors the status
// mapping used when patching the row, so the email can never claim something
// different from what the account actually did.
function describeChange(
  stripeStatus: string,
  previousStatus?: string | null,
): 'upgraded' | 'downgraded' | 'renewed' | 'canceled' | 'past_due' | null {
  if (stripeStatus === 'canceled' || stripeStatus === 'incomplete_expired') return 'canceled';
  if (stripeStatus === 'past_due' || stripeStatus === 'unpaid') return 'past_due';
  // Recovering from past_due is worth telling them about; an active->active
  // no-op (Stripe resends these often) is not.
  if (stripeStatus === 'active') return previousStatus === 'past_due' ? 'renewed' : null;
  return null;
}

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

// Switching plans cancels the subscription the user was on, which fires
// customer.subscription.deleted for a subscription they no longer hold. Acting
// on it would drop the plan they just paid for back to the free tier, so any
// event about a subscription that is not the row's current one is ignored.
//
// Rows written before stripe_subscription_id existed have nothing to compare
// against; those still fall through to the handlers as before.
function isCurrentSubscription(row: Record<string, any>, subId?: string) {
  if (!row?.stripe_subscription_id || !subId) return true;
  return row.stripe_subscription_id === subId;
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
        const paidAt = new Date().toISOString();
        await db.update('Invoice', invoiceId, {
          status: 'paid',
          paid_date: paidAt,
          stripe_payment_intent_id: pi.id,
        });

        // Tell the contractor they got paid. Read the row back for the client
        // name and owner -- the PaymentIntent metadata only carries the id.
        const invoice = await db.getOne('Invoice', invoiceId).catch(() => null);
        if (invoice?.user_id) {
          const contact = await getUserContact(invoice.user_id);
          await notify.invoicePaid({
            userEmail: contact?.email || '',
            userName: contact?.name || null,
            invoiceNumber: invoice.invoice_number,
            clientName: invoice.client_name,
            // Prefer the invoice total; fall back to what Stripe actually
            // captured, which is in cents.
            amount:
              invoice.total != null
                ? Number(invoice.total)
                : Number(pi.amount_received || 0) / 100,
            paidAt,
            invoiceUrl: `${APP_URL}/Invoices`,
          });
        }
      }
    }

    // A subscription ending -- cancelled, or terminated for non-payment --
    // must revoke paid access, otherwise the user keeps their plan for free.
    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      const row = await findSubscriptionRow(sub);
      if (row && !isCurrentSubscription(row, sub.id)) {
        console.log('subscription.deleted: ignoring superseded subscription', sub.id);
      } else if (row) {
        const endedAt = new Date().toISOString();
        await db.update('Subscription', row.id, {
          status: 'canceled',
          ...FREE_TIER,
          subscription_end_date: endedAt,
        });

        const contact = row.user_id ? await getUserContact(row.user_id) : null;
        await notify.subscriptionChanged({
          userEmail: contact?.email || '',
          userName: contact?.name || null,
          change: 'canceled',
          planName: 'Free',
          previousPlanName: row.plan_name || null,
          // Stripe keeps access to the end of the paid period on a scheduled
          // cancel; fall back to now for an immediate one.
          effectiveDate: sub.current_period_end
            ? new Date(sub.current_period_end * 1000).toISOString()
            : endedAt,
          billingUrl: `${APP_URL}/Pricing`,
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
      if (row && !isCurrentSubscription(row, sub.id)) {
        console.log('subscription.updated: ignoring superseded subscription', sub.id);
      } else if (row) {
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

        // Only mail on a change the user would notice. Stripe re-sends
        // subscription.updated for many internal edits, and describeChange
        // returns null for those so we stay quiet.
        const change = describeChange(stripeStatus, row.status);
        if (change) {
          const contact = row.user_id ? await getUserContact(row.user_id) : null;
          await notify.subscriptionChanged({
            userEmail: contact?.email || '',
            userName: contact?.name || null,
            change,
            planName: (patch.plan_name as string) || row.plan_name || 'your plan',
            previousPlanName: null,
            effectiveDate:
              (patch.next_billing_date as string) ||
              (sub.current_period_end
                ? new Date(sub.current_period_end * 1000).toISOString()
                : null),
            billingUrl: `${APP_URL}/Pricing`,
          });
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
        if (row && !isCurrentSubscription(row, subId)) {
          console.log('invoice.payment_failed: ignoring superseded subscription', subId);
        } else if (row) {
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
