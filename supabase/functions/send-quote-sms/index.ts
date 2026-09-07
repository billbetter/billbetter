import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { sendSMS } from '../_shared/sms.ts';
import { loadOwnedForSend } from '../_shared/owned-send.ts';
import { APP_URL } from '../_shared/app-url.ts';

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
    const { quote_id, quote_number, total, expiry_date } = await req.json();

    // Recipient, business identity and the approve link come from the caller's
    // own quote and settings, never the body -- otherwise any subscriber could
    // fire platform-branded SMS at arbitrary numbers. See _shared/owned-send.ts.
    const guard = await loadOwnedForSend('Quote', quote_id, access.user!, 'sms');
    if (!guard) {
      return new Response(
        JSON.stringify({ success: false, error: 'Quote not found' }),
        { status: 404, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      );
    }
    const to = guard.to;
    if (!to) throw new Error('This quote has no client phone on file.');

    const client_name = guard.record.client_name;
    const sender_phone = guard.business.sender_phone;
    const approval_link = guard.record.public_id
      ? `${APP_URL}/PublicQuote?id=${guard.record.public_id}`
      : undefined;

    const biz = guard.business.business_name;
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
