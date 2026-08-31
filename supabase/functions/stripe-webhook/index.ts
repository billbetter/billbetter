import { getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserContact } from '../_shared/supabase-admin.ts';
import { notify } from '../_shared/notify.ts';
import { connectAccountStatus, stripeGet, subscriptionPeriodEnd } from '../_shared/stripe.ts';
import { PLAN_LIMITS, limitsForPlan } from '../_shared/plan-limits.ts';

// A cancelled subscription drops the user back to the free tier rather than
// leaving paid limits in place. Derived from the shared table rather than
// restating the numbers -- restating them is what put this file out of step
// with the pricing page in the first place.
const FREE_TIER = {
  plan_name: 'free',
  monthly_transaction_limit: PLAN_LIMITS.free.transactions,
  payment_processing_fee: PLAN_LIMITS.free.fee,
};


/**
 * Which plan a Stripe subscription is now on.
 *
 * Resolved from Stripe's own product name ("Invoicium Core") rather than from
 * a second copy of the price-id list -- src/config/plans.js warns that an id
 * drifting between places charges for the wrong plan, and a duplicate here
 * would be exactly that. Returns null if it cannot tell, and callers then
 * leave the plan alone rather than guessing.
 */
async function planFromSubscription(sub: Record<string, any>): Promise<string | null> {
  const priceId = sub?.items?.data?.[0]?.price?.id;
  if (!priceId) return null;
  try {
    const price = await stripeGet(`/prices/${priceId}?expand[]=product`);
    const name = String(price?.product?.name || '').toLowerCase();
    return Object.keys(PLAN_LIMITS).find((slug) => name.includes(slug)) || null;
  } catch (err) {
    console.warn('planFromSubscription failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

const APP_URL = Deno.env.get('APP_BASE_URL') || 'https://www.invoicium.ca';

/**
 * Record a payment against an invoice, without overwriting a void.
 *
 * -- The case this exists for ---------------------------------------------
 *
 * Voiding an invoice revokes its public token, so no NEW Checkout session can
 * be minted for it. But a session the client already had open stays valid for
 * 24 hours. Pay in that window and the money genuinely lands in the
 * contractor's Stripe account, after the invoice was voided.
 *
 * Two wrong answers were available. Flipping the invoice to 'paid' erases the
 * void -- the audit trail this feature exists to keep, gone, with no sign the
 * two ever conflicted. Ignoring the event entirely loses the payment: the
 * contractor has money in Stripe and nothing in the app that explains it.
 *
 * So the payment fields are written and the STATUS is left alone. The invoice
 * stays voided and now carries a paid_date and a payment intent id, which is
 * exactly what happened. paidAfterVoid() in src/lib/invoiceVoid.js reads that
 * combination and the UI says so out loud, because a contractor holding money
 * they cannot reconcile needs to be told rather than shielded.
 *
 * @returns whether the status was advanced to paid
 */
async function recordInvoicePayment(
  invoiceId: string,
  fields: Record<string, unknown>,
  payment?: { amountCents: number; intentId: string | null; paidAt: string },
): Promise<{ paid: boolean; invoice: Record<string, any> | null }> {
  const invoice = await db.getOne('Invoice', invoiceId).catch(() => null);

  // Both signals, matching isVoided() in src/lib/invoiceVoid.js.
  const voided = Boolean(invoice) && (String(invoice.status || '') === 'void' || invoice.voided_at);

  // A row in "InvoicePayment" for the money that arrived, so an online payment
  // sits in the same ledger as a cheque and the balance is right whichever way
  // the client paid. Recorded even for a voided invoice: the money is real and
  // the contractor has to be able to see it.
  if (payment && invoice) {
    await insertStripePayment(invoice, payment);
  }

  if (voided) {
    console.warn(`stripe-webhook: payment received for VOIDED invoice ${invoiceId}; status left as void`);
    await db.update('Invoice', invoiceId, fields);
    return { paid: false, invoice };
  }

  await db.update('Invoice', invoiceId, { status: 'paid', ...fields });
  return { paid: true, invoice };
}

/**
 * Write one "InvoicePayment" row for a Stripe payment, at most once.
 *
 * -- Why the guard is not optional ----------------------------------------
 *
 * Stripe retries a delivery until it is acknowledged, and this function
 * handles BOTH checkout.session.completed and payment_intent.succeeded -- two
 * events for ONE payment, each of them retryable. Without a guard a single
 * $500 card payment becomes two, three or four rows, the balance goes
 * negative, and the invoice shows a credit the client never paid.
 *
 * Guarded twice on purpose. The lookup catches the ordinary case; the partial
 * unique index on stripe_payment_intent_id catches the race between two
 * deliveries arriving at once, which a lookup cannot. A duplicate-key error is
 * therefore the guard WORKING, and is swallowed rather than logged as a
 * failure.
 *
 * Never throws. A payment row that could not be written must not fail the
 * webhook -- an unacknowledged delivery is retried, and the retry would try to
 * mark the invoice paid all over again.
 */
async function insertStripePayment(
  invoice: Record<string, any>,
  payment: { amountCents: number; intentId: string | null; paidAt: string },
): Promise<void> {
  if (!payment.amountCents) return;

  try {
    if (payment.intentId) {
      const existing = await db.findOne('InvoicePayment', {
        stripe_payment_intent_id: payment.intentId,
      });
      if (existing) return;
    }

    await db.insert('InvoicePayment', {
      user_id: invoice.user_id,
      invoice_id: invoice.id,
      amount: payment.amountCents / 100,
      paid_at: payment.paidAt.slice(0, 10),
      method: 'Card',
      stripe_payment_intent_id: payment.intentId,
      // No recorded_by: nobody recorded this, Stripe did. A name here would
      // claim a person entered a payment they never touched.
      recorded_by_name: 'Stripe',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // 23505 is the unique index doing its job on a concurrent retry.
    if (message.includes('23505') || message.toLowerCase().includes('duplicate key')) return;
    console.error('insertStripePayment failed (ignored):', message);
  }
}

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
  //
  // NOTE: a plan change also arrives as active->active, and is deliberately
  // NOT reported here -- this event carries price ids, not our plan slugs, so
  // it cannot say what the user moved from or to. confirm-and-activate owns
  // that notification because it knows both names. Consequence: a plan change
  // made from the Stripe billing portal (rather than in-app) sends no email.
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
    const sig = req.headers.get('stripe-signature') || '';

    // Connect direct charges fire their events on the CONTRACTOR's account, and
    // Stripe delivers those through a separate Connect endpoint with its own
    // signing secret. Accept either, so one URL can serve both endpoints --
    // otherwise every invoice payment fails signature checks and no invoice is
    // ever marked paid.
    // Either variable may hold several comma-separated secrets. Rolling a
    // signing secret in the dashboard invalidates the old one the moment it is
    // replaced, so carrying both across a rotation is what stops live events
    // being rejected in the gap before the new one is deployed.
    const secrets = [
      Deno.env.get('STRIPE_WEBHOOK_SECRET'),
      Deno.env.get('STRIPE_CONNECT_WEBHOOK_SECRET'),
    ]
      .flatMap((v) => String(v || '').split(','))
      .map((s) => s.trim())
      .filter(Boolean);

    if (!secrets.length) {
      console.error('stripe-webhook: no webhook signing secret configured');
      return new Response('server misconfigured', { status: 500 });
    }
    if (!sig) {
      return new Response('missing stripe-signature header', { status: 400 });
    }

    let ok = false;
    for (const secret of secrets) {
      if (await verifySignature(raw, sig, secret)) {
        ok = true;
        break;
      }
    }
    if (!ok) {
      console.warn('stripe-webhook: signature verification failed');
      return new Response('invalid signature', { status: 400 });
    }

    const event = JSON.parse(raw);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        const paidAt = new Date().toISOString();
        await recordInvoicePayment(
          invoiceId,
          {
            paid_date: paidAt,
            stripe_payment_intent_id: session.payment_intent || null,
          },
          {
            // What Stripe actually collected, which is the BALANCE when the
            // invoice was part paid -- not invoice.total.
            amountCents: Number(session.amount_total) || 0,
            intentId: session.payment_intent ? String(session.payment_intent) : null,
            paidAt,
          },
        );
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        const paidAt = new Date().toISOString();
        // The row is read inside recordInvoicePayment (it has to be, to see a
        // void) and handed back, so the notification below reuses it rather
        // than fetching the same invoice a second time. The values are as of
        // just before the write, which is fine -- nothing used here changes.
        const { invoice } = await recordInvoicePayment(
          invoiceId,
          {
            paid_date: paidAt,
            stripe_payment_intent_id: pi.id,
          },
          {
            amountCents: Number(pi.amount_received) || Number(pi.amount) || 0,
            intentId: pi.id ? String(pi.id) : null,
            paidAt,
          },
        );

        // Tell the contractor they got paid. Sent even when the invoice was
        // voided: money arriving is the urgent fact and they need it today,
        // whatever state the record is in. The email says an invoice was paid,
        // which is true; the app is where the void and the payment are shown
        // side by side and reconciled.
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

    // A contractor finishing (or failing) Express onboarding. Without this the
    // stored status only refreshes while someone sits on the Settings page, so
    // an account that goes live -- or gets restricted later for missing
    // documents -- would keep the status it had at that moment.
    if (event.type === 'account.updated') {
      const account = event.data.object;
      const row = await db.findOne('BusinessSettings', { stripe_account_id: account.id });
      if (row) {
        const status = connectAccountStatus(account);
        if (
          row.stripe_account_status !== status ||
          Boolean(row.stripe_onboarding_completed) !== (status === 'active')
        ) {
          await db.update('BusinessSettings', row.id, {
            stripe_account_status: status,
            stripe_onboarding_completed: status === 'active',
          });
        }
      } else {
        console.warn('account.updated: no settings row for', account.id);
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
          effectiveDate: subscriptionPeriodEnd(sub) || endedAt,
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

        // Resolved once: the plan-change email and the status-change email
        // below both report this same date, and Settings renders what is
        // stored. Left alone when Stripe gives no date, so an event that
        // carries none cannot blank a date already on the row.
        const periodEnd = subscriptionPeriodEnd(sub);
        if (periodEnd) {
          patch.next_billing_date = periodEnd;
        }
        if (sub.trial_end) {
          patch.trial_end_date = new Date(sub.trial_end * 1000).toISOString();
        }

        if (Object.keys(patch).length) {
          await db.update('Subscription', row.id, patch);
        }

        // A plan change arrives as active -> active, which describeChange
        // cannot classify. Resolve the plan from Stripe and compare with what
        // the row already says.
        //
        // This also dedupes against confirm-and-activate without any shared
        // state: whichever path runs first writes plan_name, and the other
        // then sees no difference and stays silent. Exactly one email either
        // way, in both orderings.
        const newPlan = await planFromSubscription(sub);
        const planChanged =
          !!newPlan && !!row.plan_name && newPlan !== row.plan_name && stripeStatus === 'active';

        if (planChanged) {
          const limits = limitsForPlan(newPlan);
          await db.update('Subscription', row.id, {
            plan_name: newPlan,
            monthly_transaction_limit: limits.transactions,
            payment_processing_fee: limits.fee,
          });

          const pretty = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
          // Ranked by transaction allowance, the only ordering the plans carry.
          // -1 means UNLIMITED (custom), so it has to sort highest rather than
          // lowest -- otherwise moving a customer onto a negotiated Custom plan
          // would be announced to them as a downgrade.
          const rank = (id?: string | null) => {
            if (!id) return -1;
            // limitsForPlan, not a raw lookup: a legacy name like `enterprise`
            // must rank as what it aliases to, or a retired tier ranks as
            // unknown and every move off it is announced as an upgrade.
            const t = limitsForPlan(id).transactions;
            return t === -1 ? Number.POSITIVE_INFINITY : t;
          };
          const contact = row.user_id ? await getUserContact(row.user_id) : null;

          await notify.subscriptionChanged({
            userEmail: contact?.email || '',
            userName: contact?.name || null,
            change: rank(newPlan) >= rank(row.plan_name) ? 'upgraded' : 'downgraded',
            planName: pretty(newPlan),
            previousPlanName: pretty(row.plan_name),
            effectiveDate: periodEnd,
            billingUrl: `${APP_URL}/Settings`,
          });
        }

        // Only mail on a change the user would notice. Stripe re-sends
        // subscription.updated for many internal edits, and describeChange
        // returns null for those so we stay quiet. Skipped when the plan
        // change above already sent one.
        const change = planChanged ? null : describeChange(stripeStatus, row.status);
        if (change) {
          const contact = row.user_id ? await getUserContact(row.user_id) : null;
          await notify.subscriptionChanged({
            userEmail: contact?.email || '',
            userName: contact?.name || null,
            change,
            planName: (patch.plan_name as string) || row.plan_name || 'your plan',
            previousPlanName: null,
            effectiveDate: periodEnd,
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
