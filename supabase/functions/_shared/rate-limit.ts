import { db } from './supabase-admin.ts';

/**
 * Per-user rate limiting for the endpoints that spend real money.
 *
 * -- What this is for -------------------------------------------------------
 *
 * requireAppAccess bounds WHO can call these endpoints. It does not bound HOW
 * MUCH. A single subscriber -- or one stolen session, or one client-side retry
 * loop that nobody noticed -- could send unlimited SMS, unlimited email, and
 * make unlimited Stripe calls. Every one of those is a charge, and the email
 * case is worse than a charge: volume from one abuser is how a Resend sending
 * domain gets blocked, and then invoice delivery stops for EVERY contractor on
 * the platform, not just the one who caused it.
 *
 * -- Why a table and not a Map ----------------------------------------------
 *
 * invoke-llm had a Map in isolate memory and said so honestly in its own
 * comment: "a brake, not a wall". Supabase runs several isolates and recycles
 * them, so a client that reconnects gets a fresh budget each time. This counts
 * rows instead, which is shared across every isolate and survives a recycle.
 * It is the same shape as the PublicLinkHit limiter that guards the public
 * endpoints, which was verified working against production on 2026-09-07.
 *
 * -- FAILS OPEN, deliberately -----------------------------------------------
 *
 * If the counter cannot be read or written, the request is ALLOWED. A limiter
 * outage must not be the reason a contractor cannot send an invoice: the thing
 * being protected is a bill, and the thing at risk is someone getting paid.
 * That is the right way round. It does mean a database outage lifts the cap,
 * which is accepted -- the provider-side spend alert is the backstop for that,
 * and it is listed as manual work in security/plans/RATE_LIMITING_PLAN.md.
 *
 * -- One call does both halves ----------------------------------------------
 *
 * enforceRateLimit() counts AND records. They are not separable, on purpose.
 * The public limiter was once broken in exactly the way that separating them
 * invites: the check ran, but the recording sat on a branch the happy path
 * never reached, so it counted nothing and 38 consecutive requests all returned
 * 200. A caller here cannot make that mistake, because there is nothing to
 * forget to call.
 */

/** One budget: at most `max` calls in any `windowMs` sliding window. */
export interface RateWindow {
  windowMs: number;
  max: number;
  /** Human wording for the 429 body. */
  label: string;
}

/**
 * Budgets per endpoint.
 *
 * Two shapes, and the difference matters:
 *
 *   A per-MINUTE window stops a runaway loop. That is the realistic failure --
 *   a retry that fires as fast as the network allows, thousands of calls in
 *   the time it takes to notice.
 *
 *   A per-DAY window is what actually caps a bill. A minute window alone still
 *   permits 20/min forever, which is a five-figure SMS invoice over a weekend.
 *   Only the paths that spend per call carry one, because a daily cap is a
 *   real lockout if it is hit and should not exist where it buys nothing.
 *
 * Numbers are set so that a human being busy never meets them. Batch sending
 * is a real feature here (scripts/test-batch-invoices-ui.cjs), so the per-minute
 * budgets have to clear a contractor invoicing a whole job list in one sitting.
 * If a legitimate user ever hits one of these, the number is wrong -- raise it,
 * do not remove the limiter.
 */
export const RATE_LIMITS: Record<string, RateWindow[]> = {
  // Every call is a billed message, so this one carries a daily ceiling too.
  // 200/day is roughly ten times the busiest real day observed.
  'send-invoice-sms': [
    { windowMs: 60_000, max: 15, label: 'texts in a minute' },
    { windowMs: 86_400_000, max: 200, label: 'texts in a day' },
  ],
  'send-quote-sms': [
    { windowMs: 60_000, max: 15, label: 'texts in a minute' },
    { windowMs: 86_400_000, max: 200, label: 'texts in a day' },
  ],
  // Email is cheap per send; the scarce resource is domain reputation, which
  // is shared platform-wide. Hence a daily ceiling here as well.
  'send-invoice-email': [
    { windowMs: 60_000, max: 40, label: 'emails in a minute' },
    { windowMs: 86_400_000, max: 500, label: 'emails in a day' },
  ],
  'send-quote-email': [
    { windowMs: 60_000, max: 40, label: 'emails in a minute' },
    { windowMs: 86_400_000, max: 500, label: 'emails in a day' },
  ],
  // CPU and a multi-MB artifact per call, and the UI regenerates on preview,
  // so this is the chattiest legitimate caller of the five.
  'generate-invoice-pdf': [{ windowMs: 60_000, max: 60, label: 'PDFs in a minute' }],
  // A Stripe API call each. No daily cap: a contractor re-issuing links all
  // day is doing something normal.
  'create-invoice-payment-link': [
    { windowMs: 60_000, max: 30, label: 'payment links in a minute' },
  ],
  // Subscription checkout. A human clicks this once, maybe twice. The only
  // caller that could ever produce volume here is a loop.
  'stripe-create-session': [{ windowMs: 60_000, max: 10, label: 'checkout attempts in a minute' }],
  // Was 20/min in an isolate-local Map. Same number, now actually enforced.
  'invoke-llm': [
    { windowMs: 60_000, max: 20, label: 'AI requests in a minute' },
    { windowMs: 86_400_000, max: 400, label: 'AI requests in a day' },
  ],
};

export interface RateVerdict {
  limited: boolean;
  /** Seconds the caller should wait. Only meaningful when limited. */
  retryAfterSec: number;
  /** Which budget was exceeded, for the message and the log. */
  label?: string;
}

const ALLOWED: RateVerdict = { limited: false, retryAfterSec: 0 };

/**
 * Count this user's calls to this endpoint, and record the current one.
 *
 * Returns `{ limited: true }` when any of the endpoint's budgets is already
 * used up. In that case NOTHING is recorded -- a rejected call did no work and
 * cost nothing, and counting rejections would let a client that keeps retrying
 * hold its own window permanently full. The window has to be able to drain.
 *
 * An endpoint with no entry in RATE_LIMITS is not limited. That is deliberate
 * rather than a default-deny: adding a limit is an explicit act, and silently
 * capping an endpoint nobody meant to cap is its own outage.
 */
export async function enforceRateLimit(
  endpoint: string,
  userId: string,
): Promise<RateVerdict> {
  const windows = RATE_LIMITS[endpoint];
  if (!windows || !userId) return ALLOWED;

  const bucket = `${endpoint}:${userId}`;

  try {
    for (const w of windows) {
      const since = new Date(Date.now() - w.windowMs).toISOString();
      // Selecting max+1 ids answers "is it over?" with a bounded response --
      // we never need the exact count, only which side of the line it is on.
      const rows = await db.select(
        'RateLimitHit',
        `select=id&bucket=eq.${encodeURIComponent(bucket)}` +
          `&hit_at=gte.${encodeURIComponent(since)}&limit=${w.max + 1}`,
      );
      if (rows.length >= w.max) {
        return {
          limited: true,
          retryAfterSec: Math.ceil(w.windowMs / 1000),
          label: w.label,
        };
      }
    }

    await db.insert('RateLimitHit', { bucket });
    return ALLOWED;
  } catch (err) {
    // Fails open. See the header comment: a limiter outage must not stop a
    // contractor getting paid. Logged loudly so it does not become permanent.
    console.error(
      `enforceRateLimit(${endpoint}) failed, allowing the request:`,
      err instanceof Error ? err.message : err,
    );
    return ALLOWED;
  }
}

/**
 * The 429 for a limited caller, or null when they may proceed.
 *
 * Shaped so a call site reads like the accessDenied() pattern already used
 * next to it:
 *
 *     const limit = await enforceRateLimit('send-invoice-sms', access.user!.id);
 *     const tooMany = rateLimited(limit, getCorsHeaders(req));
 *     if (tooMany) return tooMany;
 *
 * `rate_limited: true` is in the body because the UI already branches on that
 * field for invoke-llm; keeping the shape means no client change is needed.
 */
export function rateLimited(
  verdict: RateVerdict,
  corsHeaders: Record<string, string>,
): Response | null {
  if (!verdict.limited) return null;
  return new Response(
    JSON.stringify({
      success: false,
      error: `Too many ${verdict.label ?? 'requests'}. Wait a moment and try again.`,
      rate_limited: true,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(verdict.retryAfterSec),
      },
    },
  );
}
