import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';
import { docByToken, dedupeHash, isBotRequest, isRateLimited, recordHit, advanceViewCounters, LINK_UNAVAILABLE } from '../_shared/public-link.ts';

/**
 * Serve one quote to somebody with no account, addressed only by its public_id.
 *
 * The invoice version of this file explains why the boundary is a service-role
 * function rather than a looser RLS policy, and why the payload is enumerated
 * rather than spread. Both apply here unchanged. What follows is what is
 * different about quotes.
 *
 * -- THE TRAP THIS FIXES ---------------------------------------------------
 *
 * PublicQuote.jsx used to do:
 *
 *     const [quoteData, settingsData] = await Promise.all([
 *       sdk.entities.Quote.filter({ public_id: publicId }),
 *       sdk.entities.BusinessSettings.list(),       // <-- and then take [0]
 *     ]);
 *
 * `BusinessSettings.list()` is not scoped to the quote's owner. It takes the
 * FIRST row in the table. Under the old RLS that read resolved to [] for an
 * anonymous caller, so the bug was dormant and the page merely showed "Quote
 * Not Found".
 *
 * Moving the read behind the service role is exactly what would have woken it
 * up: the service role bypasses RLS, so `list()` would have started returning
 * rows, and `[0]` would have shown one contractor's client another
 * contractor's business name, logo, address, phone and tax details. Porting the
 * pattern without noticing this would have converted a dead page into a
 * cross-tenant branding leak.
 *
 * So settings are resolved BY quote.user_id below, and there is no list() call
 * in this file. That is the whole fix, and it is one line -- but it is one line
 * that only works if you go looking for it.
 *
 * -- DELIBERATE: no requireAppAccess() ------------------------------------
 *
 * See _shared/public-link.ts. A lapsed contractor's client can still read and
 * approve a quote that was already sent.
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
    const token = body?.public_id ?? body?.token;
    const action = String(body?.action || 'get');
    const isPreview = body?.preview === true;

    const hash = await dedupeHash(req);
    if (await isRateLimited(hash)) {
      return fail('rate_limited', 'Too many requests. Please wait a moment and try again.', 429);
    }

    // Quote.public_id is text, not uuid -- it predates the convention and is
    // already in links that were sent, so renaming it would have broken every
    // one of them. New values are uuids cast to text.
    const found = await docByToken('Quote', token, { column: 'public_id', format: 'opaque' });
    const bot = isBotRequest(req);

    // Every request recorded before any branch, because this is what the rate
    // limiter counts. A null quote_id means the credential matched nothing.
    await recordHit({
      quote_id: found.ok ? String(found.row.id) : null,
      is_bot: bot,
      referrer: req.headers.get('referer'),
      dedupe_hash: hash,
    });

    if (!found.ok) {
      // Identical to the invoice answer, from the same shared constant.
      return new Response(JSON.stringify(LINK_UNAVAILABLE.body), {
        status: LINK_UNAVAILABLE.status,
        headers,
      });
    }

    const quote = found.row;

    // THE FIX. By user_id, from the document. Never .list()[0].
    const settings = await db.findOne('BusinessSettings', { user_id: String(quote.user_id) });

    if (action === 'record_view') {
      const outcome = isPreview
        ? 'skipped_preview'
        : await advanceViewCounters('Quote', quote, { isBot: bot, dedupeHash: hash });
      return new Response(JSON.stringify({ success: true, outcome }), { status: 200, headers });
    }

    if (action === 'download_pdf') {
      const pdf = String(quote.pdf_url || '');
      if (!pdf.startsWith('data:application/pdf')) {
        return fail('no_pdf', 'No PDF is available for this quote.', 404);
      }
      return new Response(JSON.stringify({ success: true, pdf_url: pdf }), { status: 200, headers });
    }

    const status = String(quote.status || 'sent');
    const expired = Boolean(
      quote.expiry_date && new Date(String(quote.expiry_date)).getTime() < Date.now(),
    );

    // The contractor's switch for whether clients may respond at all.
    //
    // `!== false` rather than truthiness: a missing settings row, or a row read
    // before this column existed, must mean ENABLED -- that is how the product
    // behaves today, and a business-level default that silently changed the
    // behaviour of links already sitting in clients' inboxes would be worse
    // than the one it replaced. Only an explicit false turns it off.
    const acceptsResponses = settings?.allow_client_quote_approval !== false;

    return new Response(
      JSON.stringify({
        success: true,
        // No ids. Not quote.id, not client_id, not user_id -- and above all not
        // approval_token. The page holds public_id, which is the credential it
        // was opened with; handing it the approval credential as well would put
        // a second one into browser history, screenshots and devtools for no
        // gain. approve-quote accepts public_id instead.
        quote: {
          number: quote.quote_number || '',
          issue_date: quote.date_issued || quote.created_at || null,
          expiry_date: quote.expiry_date || null,
          status,
          notes: quote.notes || '',
          currency: String(settings?.currency || 'CAD').toUpperCase(),
          items: narrowItems(quote.items),
          subtotal: Number(quote.subtotal) || 0,
          tax_rate: Number(quote.tax_rate) || 0,
          tax_amount: Number(quote.tax_amount) || 0,
          total: Number(quote.total) || 0,
        },
        client: {
          // Name only. The client's own email is not echoed back to a page
          // reachable by anyone holding the link.
          name: quote.client_name || '',
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
          // Computed server-side. The page never decides for itself whether a
          // response would be accepted -- approve-quote re-checks every one of
          // these, including the business gate, because this endpoint decides
          // what is DRAWN and cannot decide what is ALLOWED.
          can_approve: acceptsResponses && status === 'sent' && !expired,
          // A separate flag even though it is computed identically today.
          // "Clients may say no but not yes" is a setting somebody will ask
          // for, and a page reading one flag for two buttons would need
          // changing on that day rather than a server that already sends two.
          can_decline: acceptsResponses && status === 'sent' && !expired,
          expired,
          can_download_pdf: String(quote.pdf_url || '').startsWith('data:application/pdf'),
        },
      }),
      { status: 200, headers },
    );
  } catch (err) {
    console.error('get-public-quote failed:', err);
    return fail('server_error', 'Something went wrong loading this quote.', 500);
  }
});
