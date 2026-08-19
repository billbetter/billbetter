import { corsHeaders } from '../_shared/cors.ts';
import { exchangeCode } from '../_shared/google.ts';
import { db } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code || !state) throw new Error('Missing code or state');

    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) {
      throw new Error('Google did not return a refresh_token (user may need to revoke access and retry)');
    }

    const expiresAt = new Date(Date.now() + (tokens.expires_in - 60) * 1000).toISOString();

    await db.upsert('GoogleCalendarToken', {
      user_id: state,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope,
      updated_at: new Date().toISOString(),
    }, 'user_id');

    // Flip the flag on BusinessSettings
    const existing = await db.findOne('BusinessSettings', { user_id: state });
    if (existing) {
      await db.update('BusinessSettings', existing.id, { google_calendar_connected: true });
    }

    const appBase = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:48px;"><h2>Google Calendar connected!</h2><p>You can close this window.</p><script>setTimeout(()=>{ try{ window.opener && window.opener.postMessage({type:'google-calendar-connected'},'*'); window.close(); }catch(e){ window.location.href='${appBase}/Settings'; } }, 800);</script></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 200 }
    );
  } catch (err) {
    console.error('google-calendar-callback error:', err);
    return new Response(
      `<html><body style="font-family:sans-serif;text-align:center;padding:48px;color:#b91c1c;"><h2>Google Calendar connection failed</h2><p>Please close this window and try again.</p></body></html>`,
      { headers: { 'Content-Type': 'text/html' }, status: 500 }
    );
  }
});
