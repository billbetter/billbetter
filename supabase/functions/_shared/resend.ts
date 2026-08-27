/**
 * Minimal Resend client.
 *
 * -- Why replyTo exists ----------------------------------------------------
 *
 * Every email this product sends goes out from RESEND_FROM_EMAIL, which is
 * noreply@invoicium.ca. Several of them tell the recipient to reply:
 *
 *   send-invoice-email  "Just reply to this email and we'll get back to you."
 *   send-quote-email    "Questions or changes? Just reply to this email..."
 *   notification-layout "Questions? Reply to this email or contact ..."
 *
 * With no Reply-To header those replies went to a noreply mailbox -- confirmed
 * on a real delivered message, which came back with `reply_to: null`. A client
 * doing exactly what the email told them to do wrote into a void, and the
 * contractor never learned they had a question about an unpaid invoice.
 *
 * The instruction is the right one -- replying is what people actually do -- so
 * the header is what had to change, not the sentence.
 *
 * A malformed address is dropped rather than sent. Resend rejects the whole
 * request for a bad reply_to, and losing an invoice because a contractor typed
 * their own email badly in Settings would be a far worse failure than losing
 * the reply path for that one message.
 */

/** Deliberately permissive: this rejects junk, it does not validate deliverability. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validAddresses(replyTo: string | string[] | undefined | null): string[] {
  if (!replyTo) return [];
  const list = Array.isArray(replyTo) ? replyTo : [replyTo];
  return list
    .map((a) => String(a || '').trim())
    .filter((a) => EMAIL_RE.test(a));
}

export async function sendEmail({
  to,
  subject,
  html,
  attachments,
  replyTo,
}: {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
  /**
   * Where a reply should actually go -- normally the contractor's own address.
   * Invalid entries are dropped; if nothing survives, no header is set and the
   * send proceeds exactly as before.
   */
  replyTo?: string | string[] | null;
}) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  const from = Deno.env.get('RESEND_FROM_EMAIL');

  if (!apiKey) throw new Error('RESEND_API_KEY not configured');
  if (!from) throw new Error('RESEND_FROM_EMAIL not configured');

  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
  };

  const reply = validAddresses(replyTo);
  if (reply.length > 0) {
    body.reply_to = reply.length === 1 ? reply[0] : reply;
  } else if (replyTo) {
    // Say so: silently discarding it is how you end up with a Reply-To that
    // nobody notices is missing for six months.
    console.warn(`sendEmail: ignoring unusable replyTo ${JSON.stringify(replyTo)}`);
  }

  if (attachments && attachments.length > 0) {
    body.attachments = attachments.map((a) => ({
      filename: a.filename,
      content: a.content,
    }));
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || `Resend error: ${res.status}`);
  }

  return data;
}

/** The address the platform's own notifications should route replies to. */
export const SUPPORT_EMAIL = 'support@invoicium.ca';
