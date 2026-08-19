import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { getValidAccessTokenForUser } from '../_shared/google.ts';
import { getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { time_min, time_max } = await req.json().catch(() => ({}));
    const now = new Date();
    const min = time_min || now.toISOString();
    const max = time_max || new Date(now.getTime() + 30 * 86400_000).toISOString();

    const accessToken = await getValidAccessTokenForUser(user.id);
    const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    url.searchParams.set('timeMin', min);
    url.searchParams.set('timeMax', max);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');

    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${accessToken}` } });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Calendar API ${res.status}`);

    return new Response(JSON.stringify({ success: true, events: data.items || [] }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('google-calendar-events error:', err);
    return new Response(JSON.stringify({ error: err.message, events: [] }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
