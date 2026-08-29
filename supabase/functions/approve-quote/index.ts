import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserContact } from '../_shared/supabase-admin.ts';
import { tokensMatch } from '../_shared/public-link.ts';
import { notify } from '../_shared/notify.ts';
import { APP_URL } from '../_shared/app-url.ts';

/**
 * Record a client's response to a quote from the public link they were emailed:
 * approve it, or decline it.
 *
 * THIS FUNCTION NEVER EXISTED. ApproveQuote.jsx has called
 * sdk.functions.invoke("approveQuote") since it was written; nothing answered,
 * so the request fell through to a catch-all in src/api/sdk.js that returned
 * { success: true } for any unimplemented name. The page then rendered a green
 * "Quote Approved!" to the client while the quote's status was never touched
 * and the contractor was never told. Every approval ever made was discarded,
 * and both sides were shown a confirmation.
 *
 * -- ONE FUNCTION, TWO ACTIONS ---------------------------------------------
 *
 * Decline lives here rather than in a sibling function on purpose. Everything
 * that protects an approval -- credential resolution, the constant-time
 * compare, the revoked check, the status and expiry guards, the business gate,
 * the server-side confirmation -- protects a decline identically. A separate
 * function would have to import that sequence and remember to call every step
 * in order; here there is one path and `action` selects only the terminal
 * branch. Sharing by construction, not by discipline.
 *
 * The slug still says approve-quote. Kept deliberately: renaming would leave
 * the old function deployed and orphaned, and `approveQuote` is the name the
 * pages already call through src/api/sdk.js.
 *
 * -- DELIBERATE: no requireAppAccess() on this path -----------------------
 *
 * Every other function here starts with the paywall. This one must not, and it
 * is the same reasoning recorded for the public invoice pages:
 *
 *   1. The caller is the contractor's CLIENT. They have no account, no session
 *      and no subscription. requireAppAccess would reject every legitimate use.
 *   2. If the contractor's own subscription has lapsed, blocking their client
 *      from responding punishes the contractor by killing work they already won.
 *   3. The exposure is bounded: RLS still stops a lapsed user creating new
 *      quotes, so the set of reachable documents is frozen at the moment
 *      access lapsed.
 *
 * The credential is therefore the only thing standing here, which is why it is
 * compared in constant time and why unknown tokens are answered identically to
 * expired ones.
 */

/** Approve/decline outcomes the pages distinguish. */
type Outcome =
  | {
      ok: true;
      action: 'approved' | 'declined';
      client_name: string;
      business_name: string;
      quote_number: string;
      total: number;
      responded_by: string;
      /** Retained for the existing pages, which read `approved_by`. */
      approved_by?: string;
    }
  | {
      ok: false;
      already_approved?: true;
      already_declined?: true;
      expired?: true;
      needs_confirmation?: true;
      responses_disabled?: true;
      not_sent?: true;
      error?: string;
    };

/** Longest decline reason we store. Trimmed here, not by a database error. */
const MAX_REASON = 500;

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

    // 'approve' is the default so every caller that predates the decline branch
    // keeps working unchanged.
    const action = payload?.action === 'decline' ? 'decline' : 'approve';

    // -- Two credentials, one action --------------------------------------
    //
    // `token` is the approval_token from the one-click link in the email, and
    // is the original path. `public_id` is the credential the public quote page
    // was opened with, added so that page can carry Approve and Decline.
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
      return respond({ ok: false, error: 'This link is not valid.' }, 400);
    }

    // -- The confirmation is server-side, not a client-side dialog ---------
    //
    // A confirm step that lives only in the page is decoration: the endpoint is
    // reachable directly, so anything that matters has to be required HERE.
    // Requiring a typed name makes a response a deliberate act rather than a
    // consequence of opening a URL, and gives the contractor a record that
    // survives a scope dispute three months later.
    //
    // This also removes a GET-triggered state change. ApproveQuote.jsx used to
    // approve on mount, so merely loading the emailed link committed the
    // client -- and anything that pre-fetches or pre-renders a URL could do it
    // for them. A response now takes a second, explicit call carrying a name.
    //
    // Two accepted spellings: `responder_name` is what the pages send now,
    // `approver_name` is what a cached older bundle still sends.
    const rawName = payload?.responder_name ?? payload?.approver_name;
    const responderName = typeof rawName === 'string'
      ? rawName.trim().slice(0, 120)
      : '';
    if (responderName.length < 2) {
      return respond({ ok: false, needs_confirmation: true }, 400);
    }

    // PostgREST filter, then a constant-time confirm. The filter is what makes
    // the lookup indexed; the compare is what makes it safe to have used a
    // string equality to get here. tokensMatch is imported rather than
    // redeclared -- this file used to carry its own copy, and two constant-time
    // comparators that must stay identical is one more than necessary.
    const quote = await db.findOne('Quote', { [credential.column]: credential.value });
    if (!quote || !tokensMatch(String(quote[credential.column]), credential.value)) {
      // Deliberately the same answer as an expired quote: distinguishing them
      // would turn this endpoint into an oracle for guessing valid tokens.
      return respond({ ok: false, error: 'This link is no longer valid.' }, 404);
    }

    // A revoked link must not be usable. Answered like an unknown token,
    // because a contractor who turned the link off does not want it confirming
    // that the quote exists.
    if (quote.public_link_revoked_at) {
      return respond({ ok: false, error: 'This link is no longer valid.' }, 404);
    }

    // -- Terminal states, before the positive guard ------------------------
    //
    // Checked first so a client who clicks twice gets "already approved"
    // rather than the blunter "this quote is not awaiting a response".
    if (quote.status === 'approved') {
      return respond({ ok: false, already_approved: true });
    }
    // Both spellings. The app writes 'declined' everywhere; 'rejected' was read
    // by this file and by PublicQuote.jsx and written by nothing, so it is
    // accepted on the way in and never on the way out.
    if (quote.status === 'declined' || quote.status === 'rejected') {
      return respond({ ok: false, already_declined: true });
    }

    // -- A quote must be SENT to be responded to ---------------------------
    //
    // get-public-quote already computes `can_approve: status === 'sent'`, under
    // a comment saying this function re-checks it. It did not: the guards above
    // were the only ones, so a DRAFT quote could be approved by a direct call
    // even though the page never offered the button.
    //
    // This closes it, and it is safe to close only because QuoteDetail.jsx now
    // sets status:'sent' when it sends. Before that fix a quote sent from the
    // detail page stayed 'draft' forever, and this guard would have refused
    // every one of those emailed approval links.
    if (quote.status !== 'sent') {
      return respond({
        ok: false,
        not_sent: true,
        error: 'This quote is not currently awaiting a response.',
      }, 409);
    }

    // Expiry is checked against the stored date, never against anything the
    // client sends.
    if (quote.expiry_date && new Date(String(quote.expiry_date)).getTime() < Date.now()) {
      return respond({ ok: false, expired: true });
    }

    // -- The business gate, re-checked here --------------------------------
    //
    // get-public-quote uses this same column to decide whether to render the
    // buttons. That decides what is DRAWN; it cannot decide what is ALLOWED,
    // because this endpoint is reachable directly by anyone holding the link.
    // So it is read again here, from the same row.
    //
    // The settings read also supplies the branding below, and it moved above
    // the write rather than being added: one query, two jobs.
    //
    // `!== false`, not truthiness -- a missing row, or a row from before the
    // column existed, means enabled, which is how the product behaves today.
    const settings = await db.findOne('BusinessSettings', { user_id: String(quote.user_id) });
    if (settings?.allow_client_quote_approval === false) {
      return respond({
        ok: false,
        responses_disabled: true,
        error:
          'This business is not accepting online quote responses right now. ' +
          'Please contact them directly.',
      }, 403);
    }

    const businessName = settings?.business_name || 'Your contractor';
    const respondedAt = new Date().toISOString();

    // -- The write ---------------------------------------------------------
    //
    // Everything above is a read, so a failure here is the only one that can
    // leave the client believing something untrue -- hence it happens BEFORE
    // the notification, and a notification failure never fails the call.
    //
    // approved_at / declined_at are stored separately from updated_at because
    // updated_at moves on any edit and cannot answer "when did the client
    // decide", which is the question that matters in a dispute.
    const patch: Record<string, unknown> = { updated_at: respondedAt };

    let reason = '';
    if (action === 'decline') {
      const rawReason = payload?.decline_reason;
      reason = typeof rawReason === 'string' ? rawReason.trim().slice(0, MAX_REASON) : '';
      patch.status = 'declined';
      patch.declined_by_name = responderName;
      patch.declined_at = respondedAt;
      // Only when given. Writing '' would make "declined without saying why"
      // indistinguishable from "declined and the reason was lost".
      if (reason) patch.decline_reason = reason;
    } else {
      patch.status = 'approved';
      patch.approved_by_name = responderName;
      patch.approved_at = respondedAt;
    }

    await db.update('Quote', String(quote.id), patch);

    // -- Tell the contractor -----------------------------------------------
    //
    // Best-effort by design: the response is already committed, and a Resend
    // outage must not make the client think their click failed and try again.
    //
    // Routed through notify.ts rather than sendEmail, which is what makes the
    // Settings toggle real -- this used to call sendEmail directly, so
    // quote_approved in Settings gated nothing. The settings row is passed in
    // because it is already loaded, so the preference check costs no query.
    try {
      const contact = await getUserContact(String(quote.user_id));
      if (contact?.email) {
        const shared = {
          userEmail: contact.email,
          userName: contact.name,
          quoteNumber: quote.quote_number ? String(quote.quote_number) : null,
          clientName: quote.client_name ? String(quote.client_name) : null,
          total: Number(quote.total) || 0,
          quoteUrl: `${APP_URL}/QuoteDetail?id=${quote.id}`,
        };
        // Reply-To is the CLIENT: this email goes to the contractor about a
        // decision their client just made, and the next conversation is with
        // that client.
        const opts = {
          settings,
          replyTo: quote.client_email ? String(quote.client_email) : undefined,
        };

        if (action === 'decline') {
          await notify.quoteDeclined(
            { ...shared, declinedBy: responderName, declinedAt: respondedAt, reason: reason || null },
            opts,
          );
        } else {
          await notify.quoteApproved(
            { ...shared, approvedBy: responderName, approvedAt: respondedAt },
            opts,
          );
        }
      }
    } catch (notifyError) {
      console.error('approve-quote: response saved but notification failed:', notifyError);
    }

    return respond({
      ok: true,
      action: action === 'decline' ? 'declined' : 'approved',
      client_name: quote.client_name ? String(quote.client_name) : '',
      business_name: businessName,
      quote_number: quote.quote_number ? String(quote.quote_number) : '',
      total: Number(quote.total) || 0,
      responded_by: responderName,
      // ApproveQuote.jsx reads approved_by. Kept so a cached older bundle still
      // greets the person by name.
      approved_by: responderName,
    });
  } catch (err) {
    console.error('approve-quote failed:', err);
    return respond({ ok: false, error: 'Something went wrong recording your response.' }, 500);
  }
});
