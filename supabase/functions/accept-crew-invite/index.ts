import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';

// Turns a pending CrewInvite into an EmployeeProfile.
//
// This cannot be done from the browser. The invitee is not in EmployeeProfile
// yet, so accessible_owner_ids() does not include the business and every RLS
// policy denies them -- including CrewInvite's own, which is owner-only. The
// service role is the only thing that can bridge the gap, which is exactly why
// this function is small and checks everything itself.
//
// The caller must already be signed in. The invite link points at a page that
// sends them through Register/Login first and returns them here, so "accept"
// always happens as a real authenticated user whose id we can trust from the
// JWT rather than from the request body.

/** GET /accept-crew-invite?token=… returns what the invite is, without accepting. */
async function describe(token: string, cors: HeadersInit) {
  const invite = await db.findOne('CrewInvite', { token });
  if (!invite) {
    return json({ error: 'This invitation link is not valid.' }, 404, cors);
  }
  const settings = await db.findOne('BusinessSettings', { user_id: invite.owner_id });
  return json(
    {
      status: invite.status,
      email: invite.email,
      name: invite.name,
      role: invite.custom_title || invite.role,
      business_name: settings?.business_name || 'a business',
      expired: isExpired(invite),
    },
    200,
    cors,
  );
}

function isExpired(invite: { expires_at?: string | null }) {
  if (!invite.expires_at) return false;
  return new Date(invite.expires_at).getTime() < Date.now();
}

function json(body: unknown, status: number, cors: HeadersInit) {
  return new Response(JSON.stringify(body), {
    headers: { ...cors, 'Content-Type': 'application/json' },
    status,
  });
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (req.method === 'GET') {
      if (!token) return json({ error: 'token is required' }, 400, cors);
      return await describe(token, cors);
    }

    const user = await getUserFromAuthHeader(req);
    if (!user) return json({ error: 'You must be signed in to accept an invite.' }, 401, cors);

    const body = await req.json().catch(() => ({}));
    const inviteToken = token || body.token;
    if (!inviteToken) return json({ error: 'token is required' }, 400, cors);

    const invite = await db.findOne('CrewInvite', { token: inviteToken });
    if (!invite) return json({ error: 'This invitation link is not valid.' }, 404, cors);

    if (invite.status === 'revoked') {
      return json({ error: 'This invitation has been revoked.' }, 410, cors);
    }
    if (isExpired(invite)) {
      return json({ error: 'This invitation has expired. Ask for a new one.' }, 410, cors);
    }

    // The invite is addressed to an email, so it may only be accepted by that
    // address. Without this, a leaked link would let anyone join the business.
    if (
      invite.email &&
      user.email &&
      invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()
    ) {
      return json(
        {
          error: `This invitation was sent to ${invite.email}. Sign in as that address to accept it.`,
        },
        403,
        cors,
      );
    }

    if (invite.owner_id === user.id) {
      return json({ error: 'You cannot join your own business as crew.' }, 400, cors);
    }

    // Already accepted by this person: succeed quietly rather than erroring, so
    // a re-opened link or a double-tap lands somewhere sensible.
    const existing = await db.findOne('EmployeeProfile', {
      owner_id: invite.owner_id,
      user_id: user.id,
    });

    if (existing) {
      if (!existing.is_active) {
        await db.update('EmployeeProfile', existing.id, {
          is_active: true,
          removed_at: null,
        });
      }
    } else {
      await db.insert('EmployeeProfile', {
        owner_id: invite.owner_id,
        user_id: user.id,
        name: invite.name || null,
        email: user.email || invite.email || null,
        role: invite.role || 'employee',
        custom_title: invite.custom_title || null,
        is_active: true,
      });
    }

    if (invite.status !== 'accepted') {
      await db.update('CrewInvite', invite.id, {
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by_user_id: user.id,
      });
    }

    const settings = await db.findOne('BusinessSettings', { user_id: invite.owner_id });

    return json(
      {
        success: true,
        owner_id: invite.owner_id,
        business_name: settings?.business_name || 'the team',
      },
      200,
      cors,
    );
  } catch (err) {
    console.error('accept-crew-invite error:', err);
    return json({ error: err instanceof Error ? err.message : String(err) }, 500, cors);
  }
});
