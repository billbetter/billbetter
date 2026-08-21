const ALLOWED_ORIGINS = [
  "https://invoicium.ca",
  "https://www.invoicium.ca",
  // Infrastructure, not branding: this is the hostname Vercel derives from the
  // PROJECT name, which is still `billbetter`. It is the app's own origin, so
  // dropping it would refuse the app's own fetches rather than tidy anything.
  // Rename the Vercel project to `invoicium` and this becomes
  // https://invoicium.vercel.app; do not change it before the rename, or the
  // allowlist points at a hostname nobody controls.
  "https://billbetter.vercel.app",
];

// Any loopback port. Vite falls back to 5174/5175 when 5173 is already taken,
// `vite preview` uses 4173, and 127.0.0.1 is a distinct origin from localhost —
// each of those was being rejected. A loopback origin can only be served from
// the developer's own machine, so allowing any port costs nothing.
const LOCALHOST_ORIGIN = /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/;

// Vercel gives every deployment its own hostname, so preview builds can never
// appear in a fixed list — and until production serves this app, previews are
// the ONLY place it runs. Scoped to this team's own deployments rather than all
// of *.vercel.app, which would let any Vercel site call these functions.
// The -zubayir-s-projects suffix is the security boundary: only this Vercel
// team can create hostnames ending that way. Everything before it is left
// unmatched on purpose — it is the project name plus, on branch previews, a
// -git-<branch> segment, so pinning it means renaming the Vercel project (or
// pushing a branch whose name does not fit) silently kills every preview.
const PREVIEW_ORIGIN = /^https:\/\/[a-z0-9-]+-zubayir-s-projects\.vercel\.app$/;

function isAllowed(origin: string): boolean {
  return (
    ALLOWED_ORIGINS.includes(origin) ||
    LOCALHOST_ORIGIN.test(origin) ||
    PREVIEW_ORIGIN.test(origin)
  );
}

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  // Falling back to the canonical origin (rather than echoing an unknown one)
  // means a disallowed caller gets a mismatch and the browser blocks it.
  const allowedOrigin = isAllowed(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-api-version, x-region",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

export function handleCors(req: Request) {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  return null;
}
