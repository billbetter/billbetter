/**
 * Prove the OpenAI provider in _shared/llm.ts behaves, without a key or a
 * network.
 *
 * -- Why this exists --------------------------------------------------------
 *
 * Anthropic returns the answer already parsed, as a tool_use block. OpenAI
 * returns a JSON STRING in message.content, and can also return a refusal, or a
 * truncated string that is not JSON at all. Three failure shapes the Anthropic
 * path does not have, none visible to a boot test or to `npm run check`.
 *
 * The one that matters most is the truncation case: a cut-off response parses
 * as a JSON error here, but if it were passed through unparsed it would surface
 * later as a confusing schema-validation failure, several layers from the cause.
 *
 * Usage: node scripts/test-llm-provider.cjs
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const esbuild = require("esbuild");

const SRC = path.join(__dirname, "..", "supabase", "functions", "_shared", "llm.ts");

let passed = 0, failed = 0;
function check(label, cond, detail) {
  if (cond) { passed++; console.log(`  PASS  ${label}`); }
  else { failed++; console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ""}`); }
}

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          quantity: { type: "number" },
          rate: { type: "number" },
        },
        required: ["description", "quantity", "rate"],
      },
    },
  },
  required: ["items"],
};

const GOOD = { items: [{ description: "Labour", quantity: 2, rate: 75 }] };

function openaiReply(content, extra = {}) {
  return { choices: [{ message: { content, ...extra }, finish_reason: "stop" }] };
}

async function main() {
  // ajv is an npm: specifier that Node cannot resolve; the seam is exercised
  // through its provider rather than through complete(), which is the part that
  // differs per provider anyway.
  let ts = fs.readFileSync(SRC, "utf8");
  ts = ts.replace(/^import Ajv from .*$/m, "const Ajv = class { compile() { return () => true; } };");
  ts = ts.replace(/^const PROVIDERS[^;]*;$/m, "const PROVIDERS = { anthropic, openai };\nexport const __providers = PROVIDERS;");

  const { code } = await esbuild.transform(ts, { loader: "ts", format: "esm", target: "es2022" });
  const tmp = path.join(os.tmpdir(), `llm-under-test-${process.pid}.mjs`);
  fs.writeFileSync(tmp, code);

  const env = { LLM_PROVIDER: "openai", LLM_API_KEY: "placeholder-not-a-real-key", LLM_MODEL: "" };
  globalThis.Deno = { env: { get: (k) => env[k] || undefined } };

  let lastRequest = null;
  const stub = (status, body) => {
    globalThis.fetch = async (url, init) => {
      lastRequest = { url, init };
      return { ok: status >= 200 && status < 300, status, json: async () => body };
    };
  };

  const mod = await import("file://" + tmp.replace(/\\/g, "/"));
  const openai = mod.__providers.openai;
  const run = (opts = {}) =>
    openai.run({ prompt: "two hours labour at 75", schema: SCHEMA }, { apiKey: "k", ...opts });

  console.log("\nthe happy path returns PARSED json, not a string\n");
  stub(200, openaiReply(JSON.stringify(GOOD)));
  const out = await run();
  check("a JSON string in message.content comes back parsed",
        out && Array.isArray(out.items) && out.items[0].rate === 75, JSON.stringify(out));

  console.log("\nthe three failures Anthropic's path does not have\n");
  for (const [label, body, expect] of [
    ["a refusal throws, and says so", openaiReply(null, { refusal: "I can't help with that" }), /declined/i],
    ["truncated JSON throws as MALFORMED, not as a schema failure",
     openaiReply('{"items":[{"description":"Lab'), /malformed/i],
    ["an empty content string throws", openaiReply(""), /no structured result/i],
    ["a missing message throws", { choices: [] }, /no structured result/i],
  ]) {
    stub(200, body);
    try {
      await run();
      check(label, false, "did not throw");
    } catch (e) {
      check(label, expect.test(e.message), `message was ${JSON.stringify(e.message)}`);
    }
  }

  console.log("\nHTTP failures surface the provider's own reason\n");
  stub(401, { error: { message: "Incorrect API key provided" } });
  try { await run(); check("401 throws", false, "did not throw"); }
  catch (e) { check("401 surfaces the provider message",
                    /Incorrect API key/.test(e.detail || ""), e.detail); }

  stub(429, { error: { message: "Rate limit reached" } });
  try { await run(); check("429 throws", false, "did not throw"); }
  catch (e) { check("429 is reported as provider_error, not a bad response",
                    e.code === "provider_error", e.code); }

  console.log("\nthe request shape OpenAI actually receives\n");
  stub(200, openaiReply(JSON.stringify(GOOD)));
  await run();
  const sent = JSON.parse(lastRequest.init.body);
  check("posts to the chat completions endpoint",
        lastRequest.url === "https://api.openai.com/v1/chat/completions", lastRequest.url);
  check("authorises with Bearer", /^Bearer /.test(lastRequest.init.headers.Authorization));
  check("sends the schema as response_format json_schema",
        sent.response_format?.type === "json_schema" &&
        sent.response_format.json_schema.schema === undefined
          ? false
          : JSON.stringify(sent.response_format.json_schema.schema) === JSON.stringify(SCHEMA),
        JSON.stringify(sent.response_format).slice(0, 120));
  // strict:false is deliberate -- our schemas leave optional fields out of
  // `required`, which strict mode forbids. See the provider docblock.
  check("strict is FALSE, so our optional fields stay optional",
        sent.response_format.json_schema.strict === false,
        String(sent.response_format.json_schema.strict));
  check("defaults to gpt-4o when LLM_MODEL is unset", sent.model === "gpt-4o", sent.model);

  console.log("\nimages and the repair retry\n");
  stub(200, openaiReply(JSON.stringify(GOOD)));
  await openai.run(
    { prompt: "read this", schema: SCHEMA, imageUrls: ["https://example.com/a.jpg"] },
    { apiKey: "k" },
  );
  const withImg = JSON.parse(lastRequest.init.body).messages[0].content;
  check("an image is sent as image_url, OpenAI's shape not Anthropic's",
        withImg.some((c) => c.type === "image_url" && c.image_url.url === "https://example.com/a.jpg"),
        JSON.stringify(withImg).slice(0, 140));

  stub(200, openaiReply(JSON.stringify(GOOD)));
  await run({ repair: "/items/0/rate must be number" });
  const repaired = JSON.parse(lastRequest.init.body).messages[0].content[0].text;
  check("the repair retry feeds the validation error back in",
        repaired.includes("must be number"), repaired.slice(-90));

  console.log("\nthe model override\n");
  env.LLM_MODEL = "gpt-4o-mini";
  stub(200, openaiReply(JSON.stringify(GOOD)));
  await openai.run({ prompt: "x", schema: SCHEMA }, { apiKey: "k", model: "gpt-4o-mini" });
  check("LLM_MODEL overrides the default",
        JSON.parse(lastRequest.init.body).model === "gpt-4o-mini",
        JSON.parse(lastRequest.init.body).model);

  fs.unlinkSync(tmp);
  console.log(`\n${failed === 0 ? "ALL PASS" : "FAILURES ABOVE"} -- ${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
