import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/Invoice?user_id=eq.${user.id}&status=eq.sent&select=id,due_date`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } }
    );
    const rows = await res.json();
    const now = Date.now();
    let updated = 0;
    for (const row of rows) {
      if (row.due_date && new Date(row.due_date).getTime() < now) {
        await db.update('Invoice', row.id, { status: 'overdue' });
        updated++;
      }
    }
    return new Response(JSON.stringify({ success: true, updated_count: updated }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('check-overdue-invoices error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
