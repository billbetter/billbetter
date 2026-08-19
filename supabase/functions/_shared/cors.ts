const ALLOWED_ORIGINS = [
  "https://invoicium.ca",
  "https://www.invoicium.ca",
  "https://billbetter.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

// Vercel gives every deployment its own hostname, so preview builds can never
// appear in a fixed list — and until production serves this app, previews are
// the ONLY place it runs. Scoped to this project's own deployments rather than
// all of *.vercel.app, which would let any Vercel site call these functions.
const PREVIEW_ORIGIN =
  /^https:\/\/billbetter-[a-z0-9]+-zubayir-s-projects\.vercel\.app$/;

function isAllowed(origin: string): boolean {
  return ALLOWED_ORIGINS.includes(origin) || PREVIEW_ORIGIN.test(origin);
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  // Falling back to the canonical origin (rather than echoing an unknown one)
  // means a disallowed caller gets a mismatch and the browser blocks it.
  const allowedOrigin = isAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export const corsHeaders = getCorsHeaders(new Request("https://invoicium.ca"));

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
