import { handleCors, corsHeaders } from '../_shared/cors.ts';
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

    const data = await sendSMS({ to, body });

    return new Response(
      JSON.stringify({ success: true, sid: data?.sid }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (err) {
    console.error('send-quote-sms error:', err);
    return new Response(
      JSON.stringify({ error: err.message || 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
