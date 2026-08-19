import { handleCors, corsHeaders } from '../_shared/cors.ts';
import { sendEmail } from '../_shared/resend.ts';
import { db, getUserFromAuthHeader } from '../_shared/supabase-admin.ts';
import { renderEmailLayout, escapeHtml } from '../_shared/email-templates.ts';

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;
  try {
    const user = await getUserFromAuthHeader(req);
    if (!user) throw new Error('Not authenticated');

    const { email, name, role, custom_title } = await req.json();
    if (!email) throw new Error('email is required');

    const invite = await db.insert('CrewInvite', {
      owner_id: user.id,
      email,
      name: name || null,
      role: role || 'employee',
      custom_title: custom_title || null,
      status: 'pending',
    });

    const settings = await db.findOne('BusinessSettings', { user_id: user.id });
    const businessName = settings?.business_name || 'Invoicium';
    const appBase = Deno.env.get('APP_BASE_URL') || 'http://localhost:5173';
    const inviteId = Array.isArray(invite) ? invite[0].id : invite.id;
    const acceptUrl = `${appBase}/AcceptCrewInvite?invite_id=${encodeURIComponent(inviteId)}`;

    const titleLabel = custom_title || role || 'team member';
    const inviterName = user.email || 'Your manager';

    const intro = `Hi ${escapeHtml(name || 'there')},<br><br><strong>${escapeHtml(inviterName)}</strong> has invited you to join <strong>${escapeHtml(businessName)}</strong> on Invoicium as a <strong>${escapeHtml(titleLabel)}</strong>.<br><br>Invoicium is where the team tracks jobs, logs hours, uploads photos, and keeps everything in sync in the field. Tap the button below to accept and set up your account — it only takes a minute.`;

    const html = renderEmailLayout({
      preheader: `${inviterName} invited you to join ${businessName} on Invoicium`,
      heading: 'Team invitation',
      heroLabel: 'You\'re invited',
      heroValue: businessName,
      intro,
      detailsRows: [
        { label: 'Invited by', value: inviterName },
        { label: 'Role', value: String(titleLabel) },
        { label: 'Email', value: email },
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
      to: email,
      subject: `${inviterName} invited you to join ${businessName} on Invoicium`,
      html,
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('send-crew-invite error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
