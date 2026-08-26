import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { docByToken, dedupeHash, isRateLimited, isBotRequest, recordHit } from '../_shared/public-link.ts';
import { buildInvoiceCheckoutSession } from '../_shared/stripe-session.ts';

/**
 * Start a Stripe Checkout session for a client paying from the public invoice
 * page. Authorised by the public token and nothing else.
 *
 * -- Why this is a separate function from create-invoice-payment-link -------
 *
 * That one opens with `requireAppAccess(req)`, which authenticates the
 * CONTRACTOR and checks their subscription. An anonymous client has no session,
 * so the call fails for every legitimate use. The obvious fix -- a branch
 * inside create-invoice-payment-link that skips the paywall when a token is
 * present -- was rejected: it puts a door in the middle of the wall, and every
 * future reader has to work out whether the door is reachable. requireAppAccess
 * stays a wall with no door, and this function is a different wall.
 *
 * The divergence risk that creates is handled by _shared/stripe-session.ts,
 * which owns EVERYTHING about the session. Both callers differ by exactly their
 * first three lines.
 *
 * -- DELIBERATE: no requireAppAccess() ------------------------------------
 *
 * A lapsed contractor's client can still pay an invoice that was already sent.
 * Blocking it would punish the contractor by breaking their cash flow over a
 * failed card of their own, and would forfeit our fee on money we are already
 * owed. The exposure is bounded: RLS still stops a lapsed user CREATING
 * invoices, so no new links appear while they are lapsed.
 *
 * -- The session is minted HERE, at click time ----------------------------
 *
 * Never pre-generated and baked into an email. A Checkout session URL expires
 * (24h), so an emailed one is a link that works for a day and then silently
 * fails -- for an invoice a client may open a fortnight later. The email
 * carries the page; the page mints the session.
 */

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  const fail = (reason: string, error: string, status: number, extra: Record<string, unknown> = {}) =>
    new Response(JSON.stringify({ success: false, reason, error, ...extra }), { status, headers });

  try {
    const { token } = await req.json().catch(() => ({ token: null }));

    const hash = await dedupeHash(req);
    if (await isRateLimited(hash)) {
      return fail('rate_limited', 'Too many requests. Please wait a moment and try again.', 429);
    }

    const found = await docByToken('Invoice', token);

    // Recorded before any branch, so the limiter above has something to count.
    // See the equivalent comment in get-public-invoice: a limiter that nothing
    // feeds returns false forever and is not a limiter.
    await recordHit({
      invoice_id: found.ok ? String(found.row.id) : null,
      is_bot: isBotRequest(req),
      referrer: req.headers.get('referer'),
      dedupe_hash: hash,
    });

    if (!found.ok) {
      if (found.reason === 'revoked') {
        return fail('revoked', 'This invoice link has been turned off by the sender.', 410);
      }
      // Same answer for invalid and unknown: this endpoint must not become an
      // oracle for probing tokens.
      return fail('not_found', 'This invoice link is not valid.', 404);
    }

    const result = await buildInvoiceCheckoutSession(found.row);
    if (!result.ok) {
      return fail(result.reason, result.error, result.status, {
        ...(result.stripe_account_status ? { stripe_account_status: result.stripe_account_status } : {}),
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        // The Checkout URL is the only thing the client needs. Deliberately no
        // platform_fee here: that is the contractor's commercial arrangement
        // with us and is none of their client's business.
        url: result.url,
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('pay-public-invoice failed:', err);
    return fail('server_error', 'Something went wrong starting the payment.', 500);
  }
});
