import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { sendSMS } from '../_shared/twilio.ts';

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
      invoice_number,
      client_name,
      total,
      due_date,
      payment_link,
      business_name,
      sender_phone,
    } = await req.json();

    if (!to) throw new Error('Recipient phone number (to) is required');

    const biz = business_name || 'Invoicium';
    const hello = client_name ? `Hi ${String(client_name).split(' ')[0]}, ` : '';
    const due = shortDate(due_date);

    const lines: string[] = [];
    lines.push(`${hello}${biz} here with invoice${invoice_number ? ` #${invoice_number}` : ''}.`);
    lines.push(`Amount due: ${money(total)}${due ? ` by ${due}` : ''}.`);
    if (payment_link) lines.push(`Pay securely: ${payment_link}`);
    lines.push(`Questions? ${sender_phone ? `Call ${sender_phone}` : 'Reply here'}. Thanks!`);

    const body = lines.join('\n');

    const data = await sendSMS({ to, body });

    return new Response(
      JSON.stringify({ success: true, sid: data?.sid }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-invoice-sms error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
