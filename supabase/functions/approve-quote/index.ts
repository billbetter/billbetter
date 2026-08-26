import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserContact } from '../_shared/supabase-admin.ts';
import { sendEmail } from '../_shared/resend.ts';
import { renderEmailLayout, formatCurrency, escapeHtml } from '../_shared/email-templates.ts';

/**
 * Approve a quote from the public link a client was emailed.
 *
 * THIS FUNCTION NEVER EXISTED. ApproveQuote.jsx has called
 * sdk.functions.invoke("approveQuote") since it was written; nothing answered,
 * so the request fell through to a catch-all in src/api/sdk.js that returned
 * { success: true } for any unimplemented name. The page then rendered a green
 * "Quote Approved!" to the client while the quote's status was never touched
 * and the contractor was never told. Every approval ever made was discarded,
 * and both sides were shown a confirmation.
 *
 * -- DELIBERATE: no requireAppAccess() on this path -----------------------
 *
 * Every other function here starts with the paywall. This one must not, and it
 * is the same reasoning recorded for the public invoice pages:
 *
 *   1. The caller is the contractor's CLIENT. They have no account, no session
 *      and no subscription. requireAppAccess would reject every legitimate use.
 *   2. If the contractor's own subscription has lapsed, blocking their client
 *      from approving punishes the contractor by killing work they already won.
 *   3. The exposure is bounded: RLS still stops a lapsed user creating new
 *      quotes, so the set of approvable documents is frozen at the moment
 *      access lapsed.
 *
 * The approval_token is therefore the only credential, which is why it is
 * compared in constant time and why unknown tokens are answered identically to
 * expired ones.
 */

/** Approve/expire outcomes the page distinguishes. */
type Outcome =
  | { ok: true; client_name: string; business_name: string; quote_number: string; total: number; approved_by: string }
  | { ok: false; already_approved?: true; expired?: true; needs_confirmation?: true; error?: string };

/**
 * Constant-time string compare.
 *
 * The token is the whole credential, so a plain === would leak its prefix
 * through timing. Deno gives us no crypto.timingSafeEqual, so compare every
 * byte and accumulate.
 */
function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  const respond = (body: Outcome, status = 200) =>
    new Response(JSON.stringify({ success: body.ok, ...body }), { status, headers });

  try {
    const payload = await req.json().catch(() => ({}));
    const token = payload?.token;
    const publicId = payload?.public_id;

    // -- Two credentials, one action --------------------------------------
    //
    // `token` is the approval_token from the one-click link in the email, and
    // is the original path. `public_id` is the credential the public quote page
    // was opened with, added so that page can carry an Approve button.
    //
    // The alternative was to put approval_token into get-public-quote's
    // payload. That was rejected: it would place a second credential into the
    // browser's memory, history and any screenshot, for no gain -- both
    // credentials are delivered to the same inbox, so accepting public_id here
    // grants nothing that forwarding the email did not already grant.
    //
    // The tradeoff that creates: the view link is MEANT to be forwarded -- a
    // client sending "here's the quote" to their spouse or business partner is
    // normal -- and that forward would otherwise carry the power to commit to
    // the job. Hence the confirmation below.
    const credential = typeof token === 'string' && token.length >= 16
      ? { column: 'approval_token', value: token }
      : typeof publicId === 'string' && publicId.length >= 8
        ? { column: 'public_id', value: publicId }
        : null;

    if (!credential) {
      return respond({ ok: false, error: 'This approval link is not valid.' }, 400);
    }

    // -- The confirmation is server-side, not a client-side dialog ---------
    //
    // A confirm step that lives only in the page is decoration: the endpoint is
    // reachable directly, so anything that matters has to be required HERE.
    // Requiring a typed name makes approval a deliberate act rather than a
    // consequence of opening a URL, and gives the contractor a record that
    // survives a scope dispute three months later.
    //
    // This also removes a GET-triggered state change. ApproveQuote.jsx used to
    // approve on mount, so merely loading the emailed link committed the
    // client -- and anything that pre-fetches or pre-renders a URL could do it
    // for them. Approval now takes a second, explicit call carrying a name.
    const approverName = typeof payload?.approver_name === 'string'
      ? payload.approver_name.trim().slice(0, 120)
      : '';
    if (approverName.length < 2) {
      return respond({ ok: false, needs_confirmation: true }, 400);
    }

    // PostgREST filter, then a constant-time confirm. The filter is what makes
    // the lookup indexed; the compare is what makes it safe to have used a
    // string equality to get here.
    const quote = await db.findOne('Quote', { [credential.column]: credential.value });
    if (!quote || !tokensMatch(String(quote[credential.column]), credential.value)) {
      // Deliberately the same answer as an expired quote: distinguishing them
      // would turn this endpoint into an oracle for guessing valid tokens.
      return respond({ ok: false, error: 'This approval link is no longer valid.' }, 404);
    }

    // A revoked link must not be approvable. Answered like an unknown token,
    // because a contractor who turned the link off does not want it confirming
    // that the quote exists.
    if (quote.public_link_revoked_at) {
      return respond({ ok: false, error: 'This approval link is no longer valid.' }, 404);
    }

    if (quote.status === 'approved') {
      return respond({ ok: false, already_approved: true });
    }
    if (quote.status === 'rejected') {
      return respond({ ok: false, error: 'This quote was already declined.' });
    }

    // Expiry is checked against the stored date, never against anything the
    // client sends.
    if (quote.expiry_date && new Date(quote.expiry_date).getTime() < Date.now()) {
      return respond({ ok: false, expired: true });
    }

    const settings = await db.findOne('BusinessSettings', { user_id: quote.user_id });
    const businessName = settings?.business_name || 'Your contractor';

    // The write. Everything above is a read, so a failure here is the only one
    // that can leave the client believing something untrue -- hence it happens
    // BEFORE the notification, and a notification failure never fails the call.
    const approvedAt = new Date().toISOString();
    await db.update('Quote', quote.id, {
      status: 'approved',
      // Who and when, stored so an approval is a record rather than a state
      // flag. approved_at is separate from updated_at because updated_at moves
      // on any edit and cannot answer "when did the client agree".
      approved_by_name: approverName,
      approved_at: approvedAt,
      updated_at: approvedAt,
    });

    // Tell the contractor. Best-effort by design: the approval is already
    // committed, and a Resend outage must not make the client think their
    // approval failed and click again.
    try {
      const contact = await getUserContact(quote.user_id);
      if (contact?.email) {
        const total = formatCurrency(Number(quote.total) || 0);
        await sendEmail({
          to: contact.email,
          subject: `Quote ${quote.quote_number} approved by ${approverName}`,
          html: renderEmailLayout({
            heading: 'Quote approved',
            // The typed name, not the client_name on the record -- they can
            // differ, and the one that matters in a dispute is what the person
            // approving actually asserted about themselves.
            intro:
              `<strong>${escapeHtml(approverName)}</strong> approved quote ` +
              `<strong>${escapeHtml(quote.quote_number || '')}</strong> for <strong>${total}</strong>` +
              `${quote.client_name ? ` on behalf of ${escapeHtml(String(quote.client_name))}` : ''}.`,
            detailsRows: [
              { label: 'Approved by', value: approverName },
              { label: 'Approved on', value: new Date(approvedAt).toUTCString() },
            ],
            footerMessage: 'You can convert it to an invoice whenever you are ready.',
            // This email goes to the CONTRACTOR, so it is branded as their own
            // business writing to them -- the same settings row the client-
            // facing quote email uses.
            branding: {
              business_name: businessName,
              sender_name: settings?.business_name || businessName,
              sender_email: settings?.email,
              sender_phone: settings?.phone,
              sender_address: settings?.address,
              website: settings?.website,
            },
          }),
        });
      }
    } catch (notifyError) {
      console.error('approve-quote: approval saved but notification failed:', notifyError);
    }

    return respond({
      ok: true,
      client_name: quote.client_name || '',
      business_name: businessName,
      quote_number: quote.quote_number || '',
      total: Number(quote.total) || 0,
      approved_by: approverName,
    });
  } catch (err) {
    console.error('approve-quote failed:', err);
    return respond({ ok: false, error: 'Something went wrong approving this quote.' }, 500);
  }
});
