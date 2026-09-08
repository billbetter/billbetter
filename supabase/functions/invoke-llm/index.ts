import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { enforceRateLimit, rateLimited } from '../_shared/rate-limit.ts';
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
 * WAS an in-memory Map, and said so honestly: per-isolate rather than global,
 * so a client that reconnected got a fresh 20/min from each isolate Supabase
 * happened to route it to. A brake, not a wall, on an endpoint where every call
 * is a billed OpenAI request.
 *
 * It is now the shared row counter in _shared/rate-limit.ts -- same 20/min,
 * except that it is one budget across every isolate, plus a daily ceiling that
 * a per-minute limit alone cannot provide.
 */

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

    const budget = await enforceRateLimit('invoke-llm', user.id);
    const tooMany = rateLimited(budget, getCorsHeaders(req));
    if (tooMany) return tooMany;

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
