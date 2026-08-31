import { db } from './supabase-admin.ts';
import { stripePost, applicationFeeCents } from './stripe.ts';
import { feePercentForSubscription } from './plan-limits.ts';
import { APP_URL } from './app-url.ts';
import { invoiceBalance } from './invoice-balance.ts';

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
  | { ok: false; reason: 'not_connected' | 'zero_total' | 'already_paid' | 'voided'; error: string; status: number; stripe_account_status?: string };

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

  // A voided invoice can never be charged for, by either caller.
  //
  // This is the single choke point both payment routes go through -- the
  // contractor generating a link and the client paying from the public page --
  // so the refusal is written once and cannot be true on one route and false
  // on the other. Voiding also revokes the public token, which stops
  // pay-public-invoice a step earlier at docByToken(); this is the check that
  // still holds when a token is not involved at all.
  //
  // Both signals, matching isVoided() in src/lib/invoiceVoid.js: `status` is
  // what the app writes, `voided_at` is what survives a status edited by hand.
  if (String(invoice.status || '') === 'void' || invoice.voided_at) {
    return {
      ok: false,
      reason: 'voided',
      error: 'This invoice has been voided and can no longer be paid.',
      status: 409,
    };
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

  // THE BALANCE, not the total.
  //
  // `total` used to be the amount due, and this function said so. Once a
  // contractor can record a $200 cash deposit against a $500 invoice, charging
  // the total takes that $200 a second time -- from the client, on the
  // contractor's own Stripe account, with nothing in the app saying it
  // happened. Both callers pass through here, so the balance is charged
  // whichever button was pressed.
  const balance = await invoiceBalance(invoice);
  if (balance.settled) {
    return {
      ok: false,
      reason: 'already_paid',
      error: 'This invoice has already been paid in full.',
      status: 409,
    };
  }
  const totalCents = balance.dueCents;

  // The platform fee follows what is actually CHARGED, not the invoice total.
  // The fee is taken out of this charge; charging a $150 balance and taking a
  // fee calculated on $500 would take a fee larger than the transaction can
  // support and Stripe would reject the whole payment.
  const feePercent = await feePercentForInvoice(invoice);
  const feeCents = applicationFeeCents(totalCents, feePercent);

  // Named so the client can see this is a balance rather than the whole
  // invoice, on the Checkout page and afterwards on their card statement.
  const partPaid = balance.paidCents > 0;
  const lineName = partPaid
    ? `${businessName} Invoice ${invoice.invoice_number || ''} (balance)`.trim()
    : `${businessName} Invoice ${invoice.invoice_number || ''}`.trim();

  const form: Record<string, string> = {
    mode: 'payment',
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][product_data][name]': lineName,
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
