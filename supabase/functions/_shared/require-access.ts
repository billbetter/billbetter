// Server-side paywall for Edge Functions.
//
// RLS blocks a lapsed user from reading or writing their rows directly, but
// these functions run with SERVICE_ROLE, which bypasses RLS entirely. Without
// this check a cancelled user could still call send-invoice-email or
// generate-invoice-pdf and the function would happily do the work on their
// behalf -- the paywall would stop at the UI.
//
// Mirrors public.has_app_access(uuid) in
// 20260819160000_hard_paywall_rls.sql and hasAppAccess() in src/lib/access.js.
// Three copies is two too many, but each runs in a different runtime; keep them
// in step.

import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

const LIVE_STATUSES = new Set(['active', 'trial', 'trialing']);

export interface AccessResult {
  ok: boolean;
  user?: { id: string; email?: string };
  status?: string;
  reason?: string;
}

/** Whether a Subscription row grants access. Trials expire on their own date. */
export function subscriptionGrantsAccess(sub: Record<string, any> | null): boolean {
  if (!sub || !LIVE_STATUSES.has(sub.status)) return false;
  if (sub.status === 'active') return true;
  if (!sub.trial_end_date) return false;
  const end = new Date(sub.trial_end_date).getTime();
  return !isNaN(end) && end > Date.now();
}

/**
 * Authenticate the caller and confirm they may use the app.
 *
 * Returns a result rather than throwing so callers choose the status code --
 * 401 for "not signed in" and 402 for "signed in but not paying" are different
 * things to the client, and the UI routes them differently.
 */
export async function requireAppAccess(req: Request): Promise<AccessResult> {
  const user = await getUserFromAuthHeader(req);
  if (!user) return { ok: false, reason: 'Not authenticated' };

  let sub: Record<string, any> | null = null;
  try {
    sub = await db.findOne('Subscription', { user_id: user.id });
  } catch (err) {
    // Fail CLOSED. A lookup failure must not become a free pass -- that would
    // turn a transient database blip into an open door.
    console.error('requireAppAccess: subscription lookup failed:', err);
    return { ok: false, user, reason: 'Could not verify subscription' };
  }

  if (!subscriptionGrantsAccess(sub)) {
    return {
      ok: false,
      user,
      status: sub?.status || 'no_subscription',
      reason: 'An active subscription is required.',
    };
  }

  return { ok: true, user, status: sub?.status };
}

/** The 401/402 Response for a failed check, or null when access is granted. */
export function accessDenied(
  result: AccessResult,
  corsHeaders: Record<string, string>,
): Response | null {
  if (result.ok) return null;
  const unauthenticated = result.reason === 'Not authenticated';
  return new Response(
    JSON.stringify({
      error: result.reason,
      ...(result.status ? { subscription_status: result.status } : {}),
    }),
    {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: unauthenticated ? 401 : 402, // 402 Payment Required
    },
  );
}
