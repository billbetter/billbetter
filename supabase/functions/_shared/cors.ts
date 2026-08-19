const ALLOWED_ORIGINS = [
  'https://invoicium.ca',
  'https://www.invoicium.ca',
  'https://billbetter.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

export function getCorsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export const corsHeaders = getCorsHeaders(new Request('https://invoicium.ca'));

export function handleCors(req: Request) {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) });
  }
  return null;
}
