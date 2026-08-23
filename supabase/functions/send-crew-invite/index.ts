import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/resend.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { renderEmailLayout, escapeHtml } from '../_shared/email-templates.ts';
import { crewSeatsForPlan } from '../_shared/seats.ts';

const INVITE_TTL_DAYS = 14;

/**
 * The invite link's credential.
 *
 * This used to be the row's own id, which is the primary key the owner's UI
 * renders and PostgREST echoes back on insert -- a value that leaks in a dozen
 * ordinary ways and never expires. A separate high-entropy token means the
 * accept endpoint can look up by something that is only ever in the email, and
 * can be revoked by nulling one column.
 */
function mintToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const preflight = handleCors(req);
  if (preflight) return preflight;
  const cors = getCorsHeaders(req);

  const fail = (message: string, status: number) =>
    new Response(JSON.stringify({ error: message }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status,
    });

  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) return fail('Not authenticated', 401);

    const { email, name, role, custom_title } = await req.json();
    if (!email) return fail('email is required', 400);

    const normalisedEmail = String(email).trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalisedEmail)) {
      return fail('That does not look like an email address.', 400);
    }
    if (user.email && normalisedEmail === user.email.trim().toLowerCase()) {
      return fail('You are already the owner of this business.', 400);
    }

    // -- Seat limit ---------------------------------------------------------
    //
    // Checked here rather than only in the UI: the browser check is a courtesy,
    // and anyone can call this endpoint directly with the anon key that ships
    // in the bundle.
    const subscription = await db.findOne('Subscription', { user_id: user.id });
    const allowed = crewSeatsForPlan(subscription?.plan_name, subscription?.status);

    if (allowed === 0) {
      return fail(
        'Your plan does not include crew members. Upgrade to Professional to invite your team.',
        402,
      );
    }

    if (allowed > 0) {
      const [members, pending] = await Promise.all([
        db.list('EmployeeProfile', { owner_id: user.id, is_active: 'true' }),
        db.list('CrewInvite', { owner_id: user.id, status: 'pending' }),
      ]);
      // A pending invite holds a seat. Otherwise you could invite twenty people
      // on a five-seat plan and let the race decide who gets in.
      const taken = members.length + pending.filter((i: any) => i.email !== normalisedEmail).length;
      if (taken >= allowed) {
        return fail(
          `Your plan includes ${allowed} crew seat${allowed === 1 ? '' : 's'} and all of them are in use. Remove someone or upgrade to add more.`,
          402,
        );
      }
    }

    const alreadyMember = (await db.list('EmployeeProfile', { owner_id: user.id })).find(
      (m: any) => String(m.email || '').toLowerCase() === normalisedEmail && m.is_active,
    );
    if (alreadyMember) return fail('That person is already on your team.', 409);

    // -- Create or refresh the invite ---------------------------------------
    //
    // Re-inviting the same address reuses the row and mints a new token, so the
    // roster does not fill up with dead pending entries and the previous link
    // stops working.
    const token = mintToken();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();

    const existing = (await db.list('CrewInvite', { owner_id: user.id })).find(
      (i: any) => String(i.email || '').toLowerCase() === normalisedEmail && i.status === 'pending',
    );

    const payload = {
      email: normalisedEmail,
      name: name || null,
      role: role || 'employee',
      custom_title: custom_title || null,
      status: 'pending',
      token,
      expires_at: expiresAt,
    };

    if (existing) {
      await db.update('CrewInvite', existing.id, payload);
    } else {
      await db.insert('CrewInvite', { owner_id: user.id, ...payload });
    }

    const settings = await db.findOne('BusinessSettings', { user_id: user.id });
    const businessName = settings?.business_name || 'Invoicium';
    const appBase = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    const acceptUrl = `${appBase}/AcceptCrewInvite?token=${encodeURIComponent(token)}`;

    const titleLabel = custom_title || role || 'team member';
    const inviterName = settings?.business_name || user.email || 'Your manager';

    const intro = `Hi ${escapeHtml(name || 'there')},<br><br><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(businessName)}</strong> on Invoicium as a <strong>${escapeHtml(titleLabel)}</strong>.<br><br>Invoicium is where the team tracks jobs, logs hours, uploads photos, and keeps everything in sync in the field. Tap the button below to accept and set up your account — it only takes a minute.`;

    const html = renderEmailLayout({
      preheader: `${inviterName} invited you to join ${businessName} on Invoicium`,
      heading: 'Team invitation',
      heroLabel: "You're invited",
      heroValue: businessName,
      intro,
      detailsRows: [
        { label: 'Invited by', value: inviterName },
        { label: 'Role', value: String(titleLabel) },
        { label: 'Email', value: normalisedEmail },
        { label: 'Link expires', value: `${INVITE_TTL_DAYS} days` },
      ],
      ctaLabel: 'Accept invitation',
      ctaUrl: acceptUrl,
      secondaryCtaLabel: 'Or paste this link into your browser',
      secondaryCtaUrl: acceptUrl,
      footerMessage: `If you weren't expecting this invite, you can safely ignore this email — no account will be created.`,
      branding: {
        business_name: businessName,
        sender_name: businessName,
        sender_email: settings?.email || user.email,
        sender_phone: settings?.phone,
      },
    });

    await sendEmail({
      to: normalisedEmail,
      subject: `${inviterName} invited you to join ${businessName} on Invoicium`,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('send-crew-invite error:', err);
    return fail(err instanceof Error ? err.message : String(err), 500);
  }
});
