import { corsHeaders } from '../_shared/cors.ts';
import { db } from '../_shared/supabase-admin.ts';

async function verifySignature(payload: string, sigHeader: string, secret: string): Promise<boolean> {
  try {
    const parts = Object.fromEntries(sigHeader.split(',').map((p) => p.split('=')));
    const timestamp = parts.t;
    const v1 = parts.v1;
    if (!timestamp || !v1) return false;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === v1;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const raw = await req.text();
    const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const sig = req.headers.get('stripe-signature') || '';

    if (!secret) {
      console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET not configured');
      return new Response('server misconfigured', { status: 500 });
    }
    if (!sig) {
      return new Response('missing stripe-signature header', { status: 400 });
    }
    const ok = await verifySignature(raw, sig, secret);
    if (!ok) {
      console.warn('stripe-webhook: signature verification failed');
      return new Response('invalid signature', { status: 400 });
    }

    const event = JSON.parse(raw);

    if (event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') {
      const session = event.data.object;
      const invoiceId = session.metadata?.invoice_id;
      if (invoiceId) {
        await db.update('Invoice', invoiceId, {
          status: 'paid',
          paid_date: new Date().toISOString(),
          stripe_payment_intent_id: session.payment_intent || null,
        });
      }
    }

    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      const invoiceId = pi.metadata?.invoice_id;
      if (invoiceId) {
        await db.update('Invoice', invoiceId, {
          status: 'paid',
          paid_date: new Date().toISOString(),
          stripe_payment_intent_id: pi.id,
        });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (err) {
    console.error('stripe-webhook error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
