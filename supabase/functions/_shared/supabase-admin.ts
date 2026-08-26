const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

async function restFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE,
      Authorization: `Bearer ${SERVICE_ROLE}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* keep text */ }
  if (!res.ok) {
    throw new Error(`Supabase ${path} ${res.status}: ${text}`);
  }
  return body as any;
}

export const db = {
  async getOne(table: string, id: string) {
    const rows = await restFetch(`${table}?id=eq.${encodeURIComponent(id)}&limit=1`);
    return Array.isArray(rows) ? rows[0] || null : null;
  },
  async findOne(table: string, filters: Record<string, string>) {
    const qs = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const rows = await restFetch(`${table}?${qs}&limit=1`);
    return Array.isArray(rows) ? rows[0] || null : null;
  },
  async list(table: string, filters: Record<string, string> = {}) {
    const qs = Object.entries(filters).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
    const rows = await restFetch(qs ? `${table}?${qs}` : table);
    return Array.isArray(rows) ? rows : [];
  },
  /**
   * Escape hatch for queries `list` cannot express.
   *
   * `list` only builds `eq` filters, which is enough for almost everything here
   * but cannot do a range -- and the public-link rate limiter needs
   * `hit_at=gte.<iso>`. The query string is passed through verbatim, so callers
   * own their own encoding; it exists so that one range query does not become a
   * reason to hand-roll another fetch with its own copy of the service-role
   * headers.
   */
  async select(table: string, query: string) {
    const rows = await restFetch(`${table}?${query}`);
    return Array.isArray(rows) ? rows : [];
  },
  async update(table: string, id: string, patch: Record<string, unknown>) {
    return restFetch(`${table}?id=eq.${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  async insert(table: string, row: Record<string, unknown>) {
    return restFetch(table, { method: 'POST', body: JSON.stringify(row) });
  },
  async upsert(table: string, row: Record<string, unknown>, onConflict: string) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?on_conflict=${onConflict}`, {
      method: 'POST',
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify(row),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Supabase upsert ${table} ${res.status}: ${text}`);
    return text ? JSON.parse(text) : null;
  },
};

/**
 * Look up a user's email and display name by id, using the service role.
 *
 * Webhook handlers only have a Stripe customer/subscription, which maps to a
 * user_id in our Subscription table -- but the address to notify lives in
 * auth.users, which is not reachable through PostgREST. Returns null rather
 * than throwing: a notification must never be the reason a webhook 500s.
 */
export async function getUserContact(
  userId: string,
): Promise<{ email?: string; name?: string } | null> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
      { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
    );
    if (!res.ok) {
      console.warn(`getUserContact: ${res.status} for ${userId}`);
      return null;
    }
    const user = await res.json();
    if (!user?.email) return null;
    const meta = user.user_metadata || {};
    return {
      email: user.email,
      name: meta.full_name || meta.name || undefined,
    };
  } catch (err) {
    console.warn('getUserContact failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function getUserFromAuthHeader(req: Request): Promise<{ id: string; email?: string } | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const user = await res.json();
  return user?.id ? { id: user.id, email: user.email } : null;
}
