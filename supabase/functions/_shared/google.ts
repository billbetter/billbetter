import { db } from './supabase-admin.ts';

const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');

// SUPABASE_URL is NOT declared here because when this file is inlined into
// a function, supabase-admin.ts has already declared it in the same scope.
// We read it at call-time via Deno.env.get to avoid duplicate const declarations.
export function getRedirectUri() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  return `${supabaseUrl}/functions/v1/google-calendar-callback`;
}

export function getAuthUrl(state: string) {
  if (!CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID not configured');
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(code: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Google OAuth creds missing');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri: getRedirectUri(),
      grant_type: 'authorization_code',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || `Google token exchange failed: ${res.status}`);
  return data as { access_token: string; refresh_token?: string; expires_in: number; scope: string };
}

export async function refreshAccessToken(refreshToken: string) {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Google OAuth creds missing');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'refresh_token',
    }).toString(),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || `Google refresh failed: ${res.status}`);
  return data as { access_token: string; expires_in: number; scope?: string };
}

export async function getValidAccessTokenForUser(userId: string): Promise<string> {
  const row = await db.findOne('GoogleCalendarToken', { user_id: userId });
  if (!row) throw new Error('User has not connected Google Calendar');
  const now = Date.now();
  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  if (row.access_token && expiresAt > now + 60_000) return row.access_token;

  const refreshed = await refreshAccessToken(row.refresh_token);
  const newExpiresAt = new Date(now + (refreshed.expires_in - 60) * 1000).toISOString();
  await db.update('GoogleCalendarToken', row.id, {
    access_token: refreshed.access_token,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  });
  return refreshed.access_token;
}
