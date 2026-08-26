import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { requireAppAccess, accessDenied } from '../_shared/require-access.ts';
import { sendSMS } from '../_shared/twilio.ts';
import { db } from '../_shared/supabase-admin.ts';
import { stampFeePercentOnSend } from '../_shared/stripe-session.ts';
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
    const {
      to,
      invoice_number,
      client_name,
      total,
      due_date,
      payment_link,
      business_name,
      sender_phone,
      invoice_id,
    } = await req.json();

    if (!to) throw new Error('Recipient phone number (to) is required');

    // Resolved server-side, not taken from the request body -- the body is
    // client-supplied and a stale token would send a link to nothing, with no
    // error, because an SMS that reaches Twilio is a successful send.
    let publicUrl: string | null = null;
    if (invoice_id) {
      const invoice = await db.getOne('Invoice', invoice_id);
      if (invoice) {
        await stampFeePercentOnSend(invoice);
        if (invoice.public_token && !invoice.public_link_revoked_at) {
          publicUrl = `${APP_URL}/i/${invoice.public_token}`;
        }
      }
    }

    const biz = business_name || 'Invoicium';
    const hello = client_name ? `Hi ${String(client_name).split(' ')[0]}, ` : '';
    const due = shortDate(due_date);

    // Length is a deliverability concern, not a style one. One GSM-7 segment is
    // 160 characters; every extra segment is another chance for a carrier to
    // drop the message, and A2P 10DLC is NOT registered, so US carriers already
    // filter this aggressively -- link-bearing messages most of all.
    //
    // Nothing in the design may depend on an SMS arriving. It is a convenience
    // channel behind email, and the hosted page must be fully reachable from
    // the email alone.
    const lines: string[] = [];
    lines.push(`${hello}${biz} here with invoice${invoice_number ? ` #${invoice_number}` : ''}.`);
    lines.push(`Amount due: ${money(total)}${due ? ` by ${due}` : ''}.`);
    // The hosted page wins over a pre-generated Checkout URL: the latter dies
    // after 24 hours, and it is also far longer.
    const link = publicUrl || payment_link;
    if (link) lines.push(`View & pay: ${link}`);
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
