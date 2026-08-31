import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';
import { docByToken, dedupeHash, isBotRequest, isRateLimited, recordHit, advanceViewCounters, LINK_UNAVAILABLE } from '../_shared/public-link.ts';
import { invoiceBalance } from '../_shared/invoice-balance.ts';

/**
 * Serve one invoice to somebody who has no account, addressed only by its
 * public token.
 *
 * -- Why this function exists rather than an RLS policy --------------------
 *
 * The obvious implementation is to let `anon` select invoices where the token
 * matches. It was rejected, and the reasoning is worth keeping: a policy that
 * grants anon SELECT on "Invoice" grants it on every COLUMN of every matching
 * row, and PostgREST lets the caller choose which ones to ask for. The token
 * would gate the row; nothing would gate the shape. This function is the
 * boundary instead -- it runs with the service role, RLS on "Invoice" stays
 * exactly as tight as it is today, and the payload below is the only thing
 * that ever reaches a client.
 *
 * -- The payload is enumerated, not spread ---------------------------------
 *
 * Every field is copied out by name. There is no `...invoice` anywhere in this
 * file and there must never be one: a spread means the next column somebody
 * adds to "Invoice" is published to the public internet by default, and nobody
 * reviewing that migration would think to check this file. `items` is jsonb and
 * therefore unvalidated -- whatever a client wrote is in there -- so it is
 * re-mapped field by field too.
 *
 * -- DELIBERATE: no requireAppAccess() ------------------------------------
 *
 * See the header of _shared/public-link.ts. A lapsed contractor's client can
 * still read and pay an invoice that was already sent, on purpose.
 */

interface PublicItem {
  description: string;
  quantity: number;
  rate: number;
  amount: number;
}

/** Coerce whatever is in the jsonb column into exactly four known fields. */
function narrowItems(raw: unknown): PublicItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 200).map((entry) => {
    const item = (entry && typeof entry === 'object' ? entry : {}) as Record<string, unknown>;
    return {
      description: String(item.description ?? '').slice(0, 500),
      quantity: Number(item.quantity) || 0,
      rate: Number(item.rate) || 0,
      amount: Number(item.amount) || 0,
    };
  });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  const fail = (reason: string, error: string, status: number) =>
    new Response(JSON.stringify({ success: false, reason, error }), { status, headers });

  try {
    const body = await req.json().catch(() => ({}));
    const token = body?.token;
    // 'get' returns the document. 'record_view' is a separate call the PAGE
    // makes after it mounts -- see the comment on that branch. 'download_pdf'
    // is split out so the stored PDF (a base64 data URL, often megabytes) only
    // crosses the wire when somebody actually clicks Download.
    const action = String(body?.action || 'get');
    const isPreview = body?.preview === true;

    const hash = await dedupeHash(req);
    if (await isRateLimited(hash)) {
      return fail('rate_limited', 'Too many requests. Please wait a moment and try again.', 429);
    }

    const found = await docByToken('Invoice', token);
    const bot = isBotRequest(req);

    // EVERY request is recorded, before any branch, because PublicLinkHit is
    // what the rate limiter counts. An earlier version recorded only failed
    // lookups and record_view calls, which meant the happy path fed the
    // limiter nothing -- so isRateLimited() always saw zero and 38 consecutive
    // requests all returned 200. The limiter existed, was called, and limited
    // nothing. Caught by scripts/test-public-rate-limit.py, which is why that
    // script asserts a 429 actually arrives rather than that the code is there.
    //
    // A row with a null invoice_id means the token resolved to nothing; it is
    // an attempt, not a view. Everything that reports views filters on
    // invoice_id.
    await recordHit({
      invoice_id: found.ok ? String(found.row.id) : null,
      is_bot: bot,
      referrer: req.headers.get('referer'),
      dedupe_hash: hash,
    });

    if (!found.ok) {
      // ONE answer for malformed, unknown and revoked -- byte for byte, from a
      // shared constant. Returns NO payload of any kind, so a revoked link
      // cannot render stale figures and an unknown one confirms nothing. See
      // LINK_UNAVAILABLE for why the three are not distinguished.
      return new Response(JSON.stringify(LINK_UNAVAILABLE.body), {
        status: LINK_UNAVAILABLE.status,
        headers,
      });
    }

    const invoice = found.row;

    // A voided invoice is unavailable, and says so in exactly the words a
    // revoked or unknown link gets.
    //
    // Voiding already sets public_link_revoked_at, so docByToken() normally
    // stops this a step earlier -- this catches the case where the revocation
    // was lifted afterwards, which the UI no longer offers but a hand-edit
    // still could. The SAME LINK_UNAVAILABLE body is returned rather than a
    // new "voided" answer: three outcomes are deliberately indistinguishable
    // here (see the constant), and a fourth that named itself would be a new
    // information channel for the sake of a case nobody can reach.
    if (String(invoice.status || '') === 'void' || invoice.voided_at) {
      return new Response(JSON.stringify(LINK_UNAVAILABLE.body), {
        status: LINK_UNAVAILABLE.status,
        headers,
      });
    }

    const settings = await db.findOne('BusinessSettings', { user_id: String(invoice.user_id) });

    if (action === 'record_view') {
      // Called from JS AFTER the page mounts, never from the GET that served
      // the HTML. Corporate mail security (Outlook Safe Links, Mimecast,
      // Proofpoint) pre-fetches every URL in an email at delivery time; those
      // scanners fetch HTML and do not boot a React SPA, so recording here
      // rather than in the page load removes most of them at a stroke.
      //
      // The contractor previewing their own link sends preview:true, which
      // advances nothing. It is trivially removable by anyone reading the URL --
      // which is fine, because the only person motivated to remove it is the
      // contractor, and they would only be fooling themselves.
      const outcome = isPreview
        ? 'skipped_preview'
        : await advanceViewCounters('Invoice', invoice, { isBot: bot, dedupeHash: hash });
      return new Response(JSON.stringify({ success: true, outcome }), { status: 200, headers });
    }

    if (action === 'download_pdf') {
      const pdf = String(invoice.pdf_url || '');
      if (!pdf.startsWith('data:application/pdf')) {
        return fail('no_pdf', 'No PDF is available for this invoice.', 404);
      }
      return new Response(JSON.stringify({ success: true, pdf_url: pdf }), { status: 200, headers });
    }

    // Computed server-side so the page never learns WHY it cannot offer
    // payment, only that it cannot.
    const stripeReady =
      Boolean(settings?.stripe_account_id) && settings?.stripe_account_status === 'active';
    const total = Number(invoice.total) || 0;
    const balance = await invoiceBalance(invoice);
    const isPaid = String(invoice.status || '') === 'paid' || balance.settled;

    return new Response(
      JSON.stringify({
        success: true,
        // No ids of any kind. Not invoice.id, not client_id, not user_id. The
        // page already holds the token, and every follow-up call (pay, PDF,
        // record_view) is authorised by that token -- so an id here would be a
        // liability with no compensating use.
        invoice: {
          number: invoice.invoice_number || '',
          // "Invoice" has no issue_date column; created_at is when it was
          // raised, which is what a client understands by the issue date.
          issue_date: invoice.created_at || null,
          due_date: invoice.due_date || null,
          status: invoice.status || 'sent',
          payment_terms: invoice.payment_terms || '',
          notes: invoice.notes || '',
          currency: String(settings?.currency || 'CAD').toUpperCase(),
          items: narrowItems(invoice.items),
          subtotal: Number(invoice.subtotal) || 0,
          tax_rate: Number(invoice.tax_rate) || 0,
          tax_amount: Number(invoice.tax_amount) || 0,
          total,

          // amount_paid / balance_due SUPERSEDE decision 5.
          //
          // That decision left both fields out on the grounds that Stripe
          // Checkout cannot produce a partial payment, so `total` was the
          // amount due and `status` alone separated unpaid from paid. That is
          // no longer true: a contractor can record a cash deposit or a cheque
          // against an invoice, and a client shown the full total would either
          // pay twice or write in to ask why the figure is wrong.
          //
          // Only the two totals are published, never the payments themselves.
          // A payment carries a method, a reference and the name of whoever
          // entered it -- the contractor's own bookkeeping, none of it the
          // client's business.
          amount_paid: balance.paidCents / 100,
          balance_due: Math.max(0, balance.dueCents) / 100,
        },
        client: {
          name: invoice.client_name || '',
          address: invoice.client_address || '',
        },
        business: {
          name: settings?.business_name || '',
          logo_url: settings?.logo_url || '',
          address: settings?.address || '',
          phone: settings?.phone || '',
          email: settings?.email || '',
          website: settings?.website || '',
        },
        capabilities: {
          // Gated on the BALANCE, not the total: an invoice settled entirely
          // by cash must not still offer a card payment.
          can_pay_online: stripeReady && balance.dueCents > 0 && !isPaid,
          can_download_pdf: String(invoice.pdf_url || '').startsWith('data:application/pdf'),
        },
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('get-public-invoice failed:', err);
    return fail('server_error', 'Something went wrong loading this invoice.', 500);
  }
});
