import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { sendSMS } from '../_shared/sms.ts';

function money(v: unknown) {
  return `$${Number(v || 0).toFixed(2)}`;
}

function shortDate(v?: string | null) {
  if (!v) return null;
  const d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  // Paywall. These functions run with SERVICE_ROLE and so bypass RLS --
  // without this a lapsed user could still have work done on their behalf.
  const access = await requireAppAccess(req);
  const denied = accessDenied(access, getCorsHeaders(req));
  if (denied) return denied;

  try {
    const {
      to,
      quote_number,
      client_name,
      total,
      expiry_date,
      approval_link,
      business_name,
      sender_phone,
    } = await req.json();

    if (!to) throw new Error('Recipient phone number (to) is required');

    const biz = business_name || 'Invoicium';
    const hello = client_name ? `Hi ${String(client_name).split(' ')[0]}, ` : '';
    const validUntil = shortDate(expiry_date);

    const lines: string[] = [];
    lines.push(`${hello}${biz} sent you quote${quote_number ? ` #${quote_number}` : ''}.`);
    lines.push(`Total: ${money(total)}${validUntil ? ` (valid until ${validUntil})` : ''}.`);
    if (approval_link) lines.push(`Review & approve: ${approval_link}`);
    lines.push(`Questions? ${sender_phone ? `Call ${sender_phone}` : 'Reply here'}.`);

    const body = lines.join('\n');

    // Throws unless the provider ACCEPTED the message. With Infobip that is
    // not the same as a 2xx -- a rejected message arrives as HTTP 200 with the
    // refusal in the body -- so the check lives in _shared/sms.ts and this
    // caller only has to care that it either returned or threw.
    const result = await sendSMS({ to, body });

    return new Response(
      // `id` rather than `sid`: sid was Twilio-shaped and would be undefined on
      // Infobip, whose identifier is messages[0].messageId. Normalised in
      // sms.ts so neither caller has to know which provider answered.
      JSON.stringify({ success: true, id: result.id, provider: result.provider }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-quote-sms error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
