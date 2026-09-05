// The daily sweep that decides which overdue invoices are far enough gone to
// be worth offering a formal demand letter about.
//
// -- What it does, and firmly does not do ---------------------------------
//
// It stamps `demand_letter_prompted_at` on invoices that have crossed the
// threshold and have never been surfaced before. That is the whole job. It
// sends no email, no SMS and no letter, and it does not draft anything: the
// letter is written only when the contractor asks for one, reviewed by them,
// and sent by them. A demand letter goes out over a contractor's name and can
// end a customer relationship, so nothing about it is allowed to happen on a
// timer.
//
// -- Why it is not check-overdue-invoices ----------------------------------
//
// check-overdue-invoices looks adjacent and cannot be reused. It opens with
// requireAppAccess(req) and getUserFromAuthHeader(req), so it needs a user's
// JWT -- which a cron job does not have -- and it is single-user, scoped to
// `user_id=eq.<caller>`. This runs for every account at once, on a schedule,
// with no user in the request at all. See docs/feature-audit.md section 3.
//
// -- How it authenticates --------------------------------------------------
//
// verify_jwt = false, because pg_cron presents a shared secret and not a JWT;
// platform JWT verification would reject the bearer and break the sweep every
// night. So the function authenticates its own callers, the same way the
// Stripe sync worker already does on this project: no header at all is 401,
// a wrong secret is 403. CRON_SECRET rather than a name specific to this sweep
// because the scheduler is expected to grow more jobs, and one rotated secret
// beats one per job.

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';

/**
 * How overdue an invoice must be before a demand letter is worth offering.
 *
 * Mirrors DEMAND_LETTER_DAYS in src/lib/demandLetter.js, which is where the
 * rule is explained and where the browser reads it from. Two copies because a
 * Deno edge function and a Vite bundle share no module; they must be changed
 * together.
 */
const DEMAND_LETTER_DAYS = 21;

/**
 * Statuses that mean "this money has not arrived".
 *
 * 'sent' is in the list on purpose. Nothing in this app reliably promotes an
 * invoice to 'overdue' -- check-overdue-invoices does that relabelling but only
 * when a signed-in user happens to trigger it -- so an invoice can sit at
 * 'sent' months past its due date. Trusting the status would skip precisely the
 * invoices this feature exists for. The date is the fact; the status is a
 * label that may never have been updated.
 *
 * 'paid', 'draft', 'cancelled' and 'void' are all absent, and 'void' most
 * deliberately: a voided invoice is one the contractor has already retracted.
 */
const UNPAID_STATUSES = ['sent', 'overdue'];

function unauthorized(req: Request, status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) {
    // Refuse rather than run unauthenticated. A misconfigured deploy that let
    // anyone sweep would leak, in the response body, which of every account's
    // clients are months behind on paying.
    console.error('sweep-demand-letters: CRON_SECRET is not set');
    return unauthorized(req, 500, 'Sweep is not configured');
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader) return unauthorized(req, 401, 'Unauthorized');
  if (authHeader.replace(/^Bearer\s+/i, '') !== secret) {
    return unauthorized(req, 403, 'Forbidden: Invalid cron secret');
  }

  try {
    const now = new Date();
    const cutoff = new Date(now.getTime() - DEMAND_LETTER_DAYS * 24 * 60 * 60 * 1000);

    // One atomic claim rather than read-then-write. The `is.null` conditions
    // are inside the PATCH, so a row can only be stamped by whichever run gets
    // there first -- a pg_cron double-fire, or a manual run racing the nightly
    // one, finds nothing left and stamps nothing twice. This is the whole
    // reason the filter is not applied in a separate SELECT.
    const query = [
      `status=in.(${UNPAID_STATUSES.join(',')})`,
      `due_date=lte.${encodeURIComponent(cutoff.toISOString())}`,
      'due_date=not.is.null',
      'demand_letter_prompted_at=is.null',
      'demand_letter_sent_at=is.null',
      'select=id,user_id,invoice_number,client_name,due_date,total',
    ].join('&');

    const stamped = await db.updateWhere('Invoice', query, {
      demand_letter_prompted_at: now.toISOString(),
    });

    console.log(
      `sweep-demand-letters: stamped ${stamped.length} invoice(s) at or past ${DEMAND_LETTER_DAYS} days overdue`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        threshold_days: DEMAND_LETTER_DAYS,
        cutoff: cutoff.toISOString(),
        prompted_count: stamped.length,
        // Every row that matched was updated; PostgREST caps only the list it
        // hands back (max_rows, 1000 on this project). Flagged so a large
        // first run is not misread as a partial write.
        count_truncated: stamped.length >= 1000,
      }),
      {
        headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
        status: 200,
      },
    );
  } catch (err) {
    console.error('sweep-demand-letters error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
