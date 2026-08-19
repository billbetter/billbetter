import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { buildQuotePDF } from '../_shared/pdf-utils.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

  try {
    const raw = await req.json();
    const quote = raw.quote || raw;
    const settings = raw.settings || raw.business_settings || {};
    const payload = { ...quote, business_settings: settings };

    const pdfBase64 = await buildQuotePDF(payload);

    return new Response(
      JSON.stringify({ pdf_url: `data:application/pdf;base64,${pdfBase64}` }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('generate-quote-pdf error:', err, err?.stack);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error', stack: String(err?.stack || '').slice(0, 500) }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
