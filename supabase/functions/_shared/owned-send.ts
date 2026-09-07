import { db } from './supabase-admin.ts';

// Ownership + trusted-field resolution for the four send endpoints.
//
// -- Why this exists --------------------------------------------------------
//
// send-invoice-email/sms and send-quote-email/sms run with SERVICE_ROLE, so
// RLS does not scope them. Before this, they trusted the request body for
// everything: the recipient, the business name, the Reply-To, the CTA link,
// even the PDF. Two consequences, both confirmed:
//
//   * send-invoice-email/sms fetched the invoice by a body-supplied invoice_id
//     with no owner check -- a cross-tenant read of another tenant's public
//     token plus a service-role write (stampFeePercentOnSend) to their row.
//   * send-quote-email/sms did no lookup at all, so any subscriber could send
//     fully attacker-controlled email from the platform's Resend domain and
//     SMS from its sender id, to any recipient -- a phishing/spam primitive
//     wearing the platform's identity and burning its shared reputation.
//
// -- The rule ---------------------------------------------------------------
//
// The two fields an attacker abuses -- WHO receives it and WHOSE identity it
// wears -- must come from stored data owned by the caller, never from the
// body. This resolves both from the record the caller owns and the owner's
// BusinessSettings. A caller who does not own the record gets null, and the
// function answers 404 with the same wording as a genuine not-found so the
// endpoint is not an existence oracle for other tenants' record ids.
//
// The legitimate frontend already sends invoice_id/quote_id and derives these
// same fields from the same BusinessSettings client-side, so the visible
// output is unchanged for real callers; only the trust source moves server-side.

export interface TrustedSend {
  /** The owned record. */
  record: Record<string, any>;
  /** Recipient, resolved from stored data. Null when the record has no contact. */
  to: string | null;
  /** Business identity, from the owner's BusinessSettings -- not the body. */
  business: {
    business_name: string;
    sender_name: string;
    sender_email: string | null;
    sender_phone: string | null;
    sender_address: string | null;
    logo_url: string | null;
  };
}

/**
 * Load a record the caller owns and the trusted send fields, or null.
 *
 * @param table    'Invoice' or 'Quote'
 * @param id       the record id from the request body
 * @param user     the authenticated caller ({ id, email }) from requireAppAccess
 * @param channel  'email' or 'sms' -- selects which stored contact to use
 */
export async function loadOwnedForSend(
  table: 'Invoice' | 'Quote',
  id: string | undefined | null,
  user: { id: string; email?: string },
  channel: 'email' | 'sms',
): Promise<TrustedSend | null> {
  if (!id) return null;

  const record = await db.getOne(table, String(id));
  if (!record || String(record.user_id) !== String(user.id)) return null;

  // Recipient always comes from stored data. Quote rows carry client_email but
  // no phone, so an SMS recipient (and any missing email) is resolved from the
  // linked Client row.
  let to: string | null =
    channel === 'email' ? (record.client_email ?? null) : (record.client_phone ?? null);
  if (!to && record.client_id) {
    const client = await db.getOne('Client', String(record.client_id));
    if (client) to = channel === 'email' ? (client.email ?? null) : (client.phone ?? null);
  }

  const settings = await db.findOne('BusinessSettings', { user_id: String(user.id) });
  const business = {
    business_name: settings?.business_name || 'Invoicium',
    sender_name: settings?.business_name || user.email || 'Invoicium',
    sender_email: settings?.email || user.email || null,
    sender_phone: settings?.phone || null,
    sender_address: settings?.address || null,
    logo_url: settings?.logo_url || null,
  };

  return { record, to, business };
}
