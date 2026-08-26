import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { complete, LlmError } from '../_shared/llm.ts';

/**
 * The app's one LLM entry point.
 *
 * -- PRODUCT RULES, and they are not optional --------------------------------
 *
 * 1. ANYTHING THIS PRODUCES IS A DRAFT.
 *    An AI-generated invoice goes to someone's customer and asks them for
 *    money. It is always reviewed by the contractor before it is sent -- no
 *    call site may auto-send, auto-charge, or treat this output as final. If a
 *    future feature wants to skip the review step, that is a product decision
 *    that has to be taken deliberately, not inherited by accident.
 *
 * 2. EXTRACTED TEXT IS UNTRUSTED INPUT, NOT INSTRUCTIONS.
 *    Receipt and photo analysis read user-supplied images. Anything the model
 *    reads out of one is data of unknown provenance -- a receipt photographed
 *    off a screen can contain text designed to be read as an instruction. It is
 *    rendered and stored, never executed, never fed back as a system prompt,
 *    and never used to decide what this function does next.
 *
 * 3. NO FALLBACK, EVER.
 *    This function's predecessor returned the same two invented line items to
 *    every caller and every caller believed them. On failure this returns an
 *    error and the UI asks the contractor to write it by hand. A plausible
 *    wrong answer is worse than an honest missing one.
 *
 * -- Access -----------------------------------------------------------------
 *
 * requireAppAccess, deliberately, unlike the public document endpoints. This
 * one costs money per call and is only ever invoked by a signed-in contractor
 * from inside the app.
 */

/**
 * Per-user rate limit.
 *
 * In-memory, so it is per-isolate rather than global -- Supabase may run
 * several, and an isolate recycles. That makes this a brake, not a wall: it
 * stops a runaway client loop billing us thousands of calls, which is the
 * realistic failure. A hard global cap needs a shared counter (a table or
 * Redis) and belongs with the scheduler work, where a job registry exists to
 * put it in.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(userId: string): boolean {
  const now = Date.now();
  const recent = (hits.get(userId) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(userId, recent);
  // Bound the map so a long-lived isolate cannot grow it without limit.
  if (hits.size > 500) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  const headers = { ...getCorsHeaders(req), 'Content-Type': 'application/json' };

  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Not authenticated' }),
        { status: 401, headers },
      );
    }

    if (rateLimited(user.id)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Too many AI requests. Wait a minute and try again.',
          rate_limited: true,
        }),
        { status: 429, headers },
      );
    }

    const body = await req.json().catch(() => ({}));
    const { prompt, response_json_schema, file_urls } = body || {};

    if (!prompt || typeof prompt !== 'string') {
      return new Response(
        JSON.stringify({ success: false, error: 'A prompt is required.' }),
        { status: 400, headers },
      );
    }
    if (!response_json_schema || typeof response_json_schema !== 'object') {
      // Required, not optional: without a schema there is nothing to validate
      // against, and an unvalidated response is the bug this replaces.
      return new Response(
        JSON.stringify({
          success: false,
          error: 'A response_json_schema is required.',
        }),
        { status: 400, headers },
      );
    }

    const result = await complete({
      prompt,
      schema: response_json_schema,
      imageUrls: Array.isArray(file_urls) ? file_urls.slice(0, 4) : undefined,
    });

    // Spread at the top level: every existing caller reads response.items,
    // response.confirmation and so on directly.
    return new Response(
      JSON.stringify({ success: true, ...(result as Record<string, unknown>) }),
      { status: 200, headers },
    );
  } catch (err) {
    const e = err as LlmError;
    const code = e?.code;
    // Detail goes to the logs, never to the client -- it can quote provider
    // messages and schema internals.
    console.error(`invoke-llm failed [${code || 'unknown'}]:`, e?.detail || e?.message || err);

    const status = code === 'not_configured' ? 503 : 502;
    return new Response(
      JSON.stringify({
        success: false,
        error: e?.message || 'The AI request failed.',
        code: code || 'provider_error',
        // Lets the UI say "not set up yet" rather than "something went wrong".
        not_configured: code === 'not_configured',
      }),
      { status, headers },
    );
  }
});
