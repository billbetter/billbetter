import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { getAuthUrl } from '../_shared/google.ts';
import { getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');
    const url = getAuthUrl(user.id);
    return new Response(JSON.stringify({ success: true, url }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
