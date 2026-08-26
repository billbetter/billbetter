import { db } from './supabase-admin.ts';
import { stripePost, applicationFeeCents } from './stripe.ts';
import { feePercentForSubscription } from './plan-limits.ts';
import { APP_URL } from './app-url.ts';

/**
 * The one place a Checkout session for an invoice is built.
 *
 * -- Why this is shared ----------------------------------------------------
 *
 * There are two ways to pay an invoice: the contractor generates a link
 * (create-invoice-payment-link, behind requireAppAccess) or the client pays
 * from the public page (pay-public-invoice, authorised by the public token
 * alone). Those two callers must not diverge -- a difference between them would
 * mean money moving differently depending on which button was pressed, which is
 * the kind of bug nobody finds until a contractor is short.
 *
 * requireAppAccess stays a wall with no door: the split is drawn ABOVE this
 * function, at authentication, and everything below it -- line items, currency,
 * URLs, metadata keys, the Stripe-Account header, the application fee -- is
 * identical by construction. Each caller reduces to:
 *
 *   const access = await requireAppAccess(req);   |   const found = await docByToken(...)
 *   ...                                          |   ...
 *   return buildInvoiceCheckoutSession(invoice);  |   return buildInvoiceCheckoutSession(invoice);
 *
 * If a future change cannot be expressed inside this function, that is the
 * signal the split has drifted. Challenge it rather than adding a flag.
 */

export type SessionResult =
  | { ok: true; url: string; session_id: string; platform_fee: number; currency: string }
  | { ok: false; reason: 'not_connected' | 'zero_total' | 'already_paid'; error: string; status: number; stripe_account_status?: string };

/**
 * Resolve the platform fee rate for an invoice.
 *
 * The stamped rate wins. Decision 4 (docs/invoice-links-plan.md section 2.0b):
 * the rate is locked onto the invoice when it is SENT, because deriving it at
 * payment time means a lapsed contractor's client pays the Core 1% when their
 * plan promised 0.75% -- the fee would RISE when they stopped subscribing, so
 * we would earn more from a churning customer than a paying one on the same
 * invoice. Nobody chose that incentive.
 *
 * The subscription fallback is for invoices sent before platform_fee_percent
 * existed. It is temporary and should be deletable once no such invoice can
 * still be unpaid.
 */
export async function feePercentForInvoice(invoice: Record<string, unknown>): Promise<number> {
  const stamped = invoice.platform_fee_percent;
  if (stamped !== null && stamped !== undefined && Number.isFinite(Number(stamped))) {
    return Number(stamped);
  }
  const subscription = await db.findOne('Subscription', { user_id: String(invoice.user_id) });
  return feePercentForSubscription(subscription);
}

/**
 * Lock the platform fee rate onto an invoice at SEND time.
 *
 * Idempotent -- an invoice that already carries a rate keeps it, so re-sending
 * a reminder cannot silently reprice work that was quoted months ago. That is
 * the entire point: the rate the contractor was promised when the work was
 * invoiced is the rate that applies to it, and their fee per invoice becomes
 * knowable at send time rather than depending on subscription state weeks
 * later.
 *
 * Never throws. A fee-stamping failure must not stop an invoice going out --
 * the fallback in feePercentForInvoice() still resolves a real rate.
 */
export async function stampFeePercentOnSend(invoice: Record<string, unknown>): Promise<void> {
  if (invoice.platform_fee_percent !== null && invoice.platform_fee_percent !== undefined) return;
  try {
    const subscription = await db.findOne('Subscription', { user_id: String(invoice.user_id) });
    const percent = feePercentForSubscription(subscription);
    await db.update('Invoice', String(invoice.id), { platform_fee_percent: percent });
    invoice.platform_fee_percent = percent;
  } catch (err) {
    console.error('stampFeePercentOnSend failed (ignored):', err instanceof Error ? err.message : err);
  }
}

export async function buildInvoiceCheckoutSession(
  invoice: Record<string, unknown>,
): Promise<SessionResult> {
  const total = Number(invoice.total || 0);
  if (total <= 0) {
    return { ok: false, reason: 'zero_total', error: 'This invoice has no amount to pay.', status: 400 };
  }
  if (String(invoice.status || '') === 'paid') {
    return { ok: false, reason: 'already_paid', error: 'This invoice has already been paid.', status: 409 };
  }

  const settings = await db.findOne('BusinessSettings', { user_id: String(invoice.user_id) });
  const accountId = settings?.stripe_account_id;

  // Refuse rather than quietly charging the platform account. The client would
  // pay, the money would land in OUR balance, and the contractor would be told
  // their invoice was settled.
  if (!accountId || settings?.stripe_account_status !== 'active') {
    return {
      ok: false,
      reason: 'not_connected',
      error: 'This business is not set up to take card payments yet.',
      status: 409,
      stripe_account_status: String(settings?.stripe_account_status || 'not_connected'),
    };
  }

  const businessName = settings?.business_name || 'Invoicium';
  const currency = String(settings?.currency || 'CAD').toLowerCase();
  const totalCents = Math.round(total * 100);
  const feePercent = await feePercentForInvoice(invoice);
  const feeCents = applicationFeeCents(totalCents, feePercent);

  const form: Record<string, string> = {
    mode: 'payment',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][product_data][name]':
      `${businessName} Invoice ${invoice.invoice_number || ''}`.trim(),
    'line_items[0][price_data][unit_amount]': String(totalCents),
    'line_items[0][quantity]': '1',
    success_url: `${APP_URL}/InvoicePaymentSuccess?invoice_id=${invoice.id}&session_id={CHECKOUT_SESSION_ID}`,
    // Back to the public page, not the contractor's InvoiceDetail -- a client
    // who cancels has no account and would land on a login screen. The token is
    // the only address they have.
    cancel_url: `${APP_URL}/i/${invoice.public_token}`,
    'metadata[invoice_id]': String(invoice.id),
    'metadata[user_id]': String(invoice.user_id),
    // Repeated onto the PaymentIntent: the webhook matches on whichever of
    // checkout.session.completed or payment_intent.succeeded arrives, and a
    // session's metadata does not propagate to the intent on its own.
    'payment_intent_data[metadata][invoice_id]': String(invoice.id),
    'payment_intent_data[metadata][user_id]': String(invoice.user_id),
  };

  if (feeCents > 0) {
    form['payment_intent_data[application_fee_amount]'] = String(feeCents);
  }
  if (invoice.client_email) form.customer_email = String(invoice.client_email);

  // Stripe-Account is what makes this a direct charge on the contractor.
  const session = await stripePost('/checkout/sessions', form, { stripeAccount: String(accountId) });

  await db.update('Invoice', String(invoice.id), {
    payment_link: session.url,
    stripe_session_id: session.id,
    platform_fee_amount: feeCents / 100,
  });

  return {
    ok: true,
    url: session.url,
    session_id: session.id,
    platform_fee: feeCents / 100,
    currency: currency.toUpperCase(),
  };
}
