/**
 * The LLM seam: complete({ prompt, schema, imageUrls }) -> validated object.
 *
 * Replaces a stub in src/api/sdk.js that ignored the prompt entirely and
 * returned the same two line items -- Labor x4 @ $85, Materials x1 @ $240 -- to
 * every caller, for every input, forever. "AI invoicing" is the product's
 * identity and it was that function.
 *
 * -- Adding a provider ----------------------------------------------------
 *
 * Two implementations exist (Anthropic, OpenAI). Adding another means writing a
 * Provider and registering it in PROVIDERS; nothing else changes, because
 * callers only ever see `complete()`. Deliberately NOT writing adapters for
 * providers nobody has an account with -- unused ones are speculative work
 * that rots.
 *
 * A provider must do two things:
 *   1. Constrain generation to the schema natively where it can (Anthropic
 *      tool-use, OpenAI structured outputs). That is the PRIMARY enforcement.
 *   2. Return parsed JSON, or throw.
 *
 * Our own validation is defence-in-depth on top. Which means the validator
 * earns its keep on the provider's bad days -- so the failing path below is the
 * part that matters, not the happy one.
 *
 * -- Configuration --------------------------------------------------------
 *
 * LLM_PROVIDER  provider id: "anthropic" (default) or "openai"
 * LLM_API_KEY   the key for whichever provider is selected. Lives in Supabase
 *               secrets and never reaches the browser bundle: a key in client
 *               JS is a public key.
 * LLM_MODEL     optional model override. Defaults are claude-sonnet-5 and
 *               gpt-4o respectively.
 *
 * Switching provider is a secret change, not a code change. Note that
 * LLM_API_KEY is provider-specific -- switching LLM_PROVIDER without also
 * swapping the key gets you a 401 that reads like a bad key, because it is one:
 * an sk-... OpenAI key sent to Anthropic, or the reverse.
 * scripts/diagnose-llm.py checks that pairing before anything is deployed.
 */
import Ajv from "npm:ajv@8";

// Verified to run in this runtime before committing to it: ajv compiles schemas
// by generating JS and evaluating it with `new Function`, which Deno
// Deploy-class runtimes can restrict. A spike deployed here compiled our real
// line-items schema and correctly rejected both a wrong type and a missing
// required field, so the default (non-standalone) mode is fine and no build
// step is needed.
const ajv = new Ajv({ allErrors: true, strict: false });

export interface CompleteRequest {
  prompt: string;
  /** JSON Schema the response must satisfy. */
  schema: Record<string, unknown>;
  /** Public image URLs for receipt/photo analysis. */
  imageUrls?: string[];
}

export interface Provider {
  id: string;
  /** Throws on transport/API failure. Returns parsed JSON, unvalidated. */
  run(
    req: CompleteRequest,
    opts: { apiKey: string; model?: string; repair?: string },
  ): Promise<unknown>;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly code:
      | "not_configured"
      | "provider_error"
      | "invalid_response"
      | "unknown_provider",
    readonly detail?: string,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------------
// Anthropic
// ---------------------------------------------------------------------------

const ANTHROPIC_DEFAULT_MODEL = "claude-sonnet-5";

/**
 * Structured output via tool-use.
 *
 * Passing the schema as a tool's input_schema and forcing that tool constrains
 * generation to the shape, rather than asking for JSON in the prompt and hoping.
 * The model's tool input IS the answer.
 */
const anthropic: Provider = {
  id: "anthropic",
  async run(req, { apiKey, model, repair }) {
    const content: Record<string, unknown>[] = [];
    for (const url of req.imageUrls || []) {
      content.push({ type: "image", source: { type: "url", url } });
    }
    let text = req.prompt;
    if (repair) {
      // The retry. Telling the model exactly which field was wrong fixes shape
      // errors reliably; asking again unchanged mostly reproduces them.
      text +=
        `\n\nYour previous response did not match the required schema:\n${repair}\n` +
        `Return a corrected response. Do not explain the error, just return valid data.`;
    }
    content.push({ type: "text", text });

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model || ANTHROPIC_DEFAULT_MODEL,
        max_tokens: 4096,
        tools: [
          {
            name: "respond",
            description: "Return the structured result.",
            input_schema: req.schema,
          },
        ],
        tool_choice: { type: "tool", name: "respond" },
        messages: [{ role: "user", content }],
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new LlmError(
        "The AI provider rejected the request.",
        "provider_error",
        `${res.status}: ${body?.error?.message || "no detail"}`,
      );
    }
    const block = (body?.content || []).find(
      (b: Record<string, unknown>) => b.type === "tool_use",
    );
    if (!block) {
      throw new LlmError(
        "The AI returned no structured result.",
        "invalid_response",
        `stop_reason=${body?.stop_reason}`,
      );
    }
    return block.input;
  },
};

// ---------------------------------------------------------------------------
// OpenAI
// ---------------------------------------------------------------------------

const OPENAI_DEFAULT_MODEL = "gpt-4o";

/**
 * Structured output via response_format: json_schema.
 *
 * -- Why strict is FALSE, deliberately ------------------------------------
 *
 * OpenAI's strict mode is the stronger guarantee and we cannot use it, because
 * it requires every property to appear in `required` and every object to carry
 * `additionalProperties: false`. Our schemas violate both on purpose:
 *
 *   src/lib/ai/schemas.js:60 omits the line total from `required` with the
 *   reason written down -- "the total is derived and the model gets it wrong
 *   often enough that requiring it would fail otherwise-good responses" -- and
 *   the consumer recomputes quantity x rate anyway. LINE_ITEMS likewise leaves
 *   `notes` optional.
 *
 * Turning strict on would mean forcing `total` and `notes` to be required,
 * which reverses a documented product decision to make a provider happy. So the
 * schema is still sent and still constrains generation, and `complete()`'s
 * ajv validation plus its one repair retry stays the enforcement -- which is
 * exactly the division of labour this file's header already describes.
 *
 * If someone later wants strict mode, the schemas have to change first, and
 * that is a decision about what we require of the model, not a provider detail.
 */
const openai: Provider = {
  id: "openai",
  async run(req, { apiKey, model, repair }) {
    let text = req.prompt;
    if (repair) {
      text +=
        `\n\nYour previous response did not match the required schema:\n${repair}\n` +
        `Return a corrected response. Do not explain the error, just return valid data.`;
    }

    // OpenAI takes text and images in one content array, image_url shaped
    // differently from Anthropic's source/url.
    const content: Record<string, unknown>[] = [{ type: "text", text }];
    for (const url of req.imageUrls || []) {
      content.push({ type: "image_url", image_url: { url } });
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model || OPENAI_DEFAULT_MODEL,
        max_tokens: 4096,
        response_format: {
          type: "json_schema",
          json_schema: { name: "respond", strict: false, schema: req.schema },
        },
        messages: [{ role: "user", content }],
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      throw new LlmError(
        "The AI provider rejected the request.",
        "provider_error",
        `${res.status}: ${body?.error?.message || "no detail"}`,
      );
    }

    const message = body?.choices?.[0]?.message;

    // A refusal is a successful HTTP call with no answer in it. Left as its own
    // branch so the log says "refused" rather than "returned nothing", which
    // are different problems with different fixes.
    if (message?.refusal) {
      throw new LlmError(
        "The AI declined to answer.",
        "invalid_response",
        String(message.refusal).slice(0, 200),
      );
    }

    const raw = message?.content;
    if (typeof raw !== "string" || raw.trim() === "") {
      throw new LlmError(
        "The AI returned no structured result.",
        "invalid_response",
        `finish_reason=${body?.choices?.[0]?.finish_reason}`,
      );
    }

    // Unlike Anthropic's tool-use, where the tool input arrives already parsed,
    // OpenAI hands back a JSON STRING. A truncated response lands here as a
    // parse error, so it is reported as one rather than surfacing later as a
    // confusing schema failure.
    try {
      return JSON.parse(raw);
    } catch {
      throw new LlmError(
        "The AI returned malformed JSON.",
        "invalid_response",
        `finish_reason=${body?.choices?.[0]?.finish_reason}, ${raw.slice(0, 120)}`,
      );
    }
  },
};

const PROVIDERS: Record<string, Provider> = { anthropic, openai };

// ---------------------------------------------------------------------------

function describeErrors(errors: unknown[]): string {
  return (errors as { instancePath?: string; message?: string }[])
    .slice(0, 8)
    .map((e) => `${e.instancePath || "(root)"} ${e.message}`)
    .join("; ");
}

/**
 * Ask the model for something and return it only if it matches the schema.
 *
 * The failing path, deliberately:
 *
 *   1. Response does not validate.
 *   2. Retry ONCE, feeding the validation errors back into the prompt.
 *   3. Still failing -> throw. The call site tells the contractor to write it
 *      by hand.
 *
 * There is NO synthesised fallback and no partial object with holes filled in.
 * That is the whole reason this function exists: the thing it replaces answered
 * plausibly and wrongly, and every caller believed it.
 */
export async function complete(req: CompleteRequest): Promise<unknown> {
  const apiKey = Deno.env.get("LLM_API_KEY");
  if (!apiKey) {
    // Honest, and honest immediately. Not "coming soon", not a canned draft.
    throw new LlmError(
      "AI features are not configured on this deployment.",
      "not_configured",
    );
  }
  const providerId = Deno.env.get("LLM_PROVIDER") || "anthropic";
  const provider = PROVIDERS[providerId];
  if (!provider) {
    throw new LlmError(
      `Unknown LLM provider "${providerId}".`,
      "unknown_provider",
    );
  }
  const model = Deno.env.get("LLM_MODEL") || undefined;

  const validate = ajv.compile(req.schema);

  let result = await provider.run(req, { apiKey, model });
  if (validate(result)) return result;

  const firstErrors = describeErrors(validate.errors || []);
  console.warn(`[llm] response failed validation, retrying once: ${firstErrors}`);

  result = await provider.run(req, { apiKey, model, repair: firstErrors });
  if (validate(result)) return result;

  const secondErrors = describeErrors(validate.errors || []);
  throw new LlmError(
    "The AI could not produce a usable result.",
    "invalid_response",
    `after retry: ${secondErrors}`,
  );
}
