/**
 * The SMS seam. One export, two providers, and nothing above this file knows
 * which one is in use.
 *
 * -- Why the provider changed ----------------------------------------------
 *
 * Twilio began answering 401 with {"code": 20003, "message": "Authenticate"} to
 * well-formed credentials -- a rotated token or a closed account, not a code
 * problem (scripts/diagnose-twilio.py is what established that). Both SMS paths
 * were dead, while "Email & SMS delivery" was a bullet sold on Core.
 *
 * -- Why Twilio is still here ----------------------------------------------
 *
 * SMS_PROVIDER selects the branch, defaulting to infobip. Twilio stays reachable
 * for one release so that if Infobip misbehaves in production the rollback is a
 * secret change and a redeploy rather than a code revert. That only works while
 * the TWILIO_* secrets are still being pushed, which is why they stay in
 * scripts/deploy-secrets.py's SECRET_NAMES -- drop them and the rollback path
 * quietly stops being one.
 *
 * Delete the Twilio branch once Infobip has actually delivered messages, not
 * before, and take InvoiceDetail.jsx's Twilio-trial help panel with it -- that
 * panel is still correct for this branch and goes dead at exactly that moment.
 *
 * -- What this file does NOT fix -------------------------------------------
 *
 * A2P 10DLC. It is a US CARRIER registration requirement keyed on the
 * RECIPIENT, not a Twilio one, and Infobip carries the identical obligation.
 * Today's recipients are Canadian and Canadian carriers do not require it, so
 * this swap is a real fix rather than a lateral move -- but it is deferred, not
 * solved. The first US contractor to sign up makes it blocking, and
 * registration has weeks of lead time, so it wants starting when a US signup
 * looks plausible rather than when one lands.
 */

/** Normalised across providers, so no caller has to know which one answered. */
export interface SmsResult {
  /** Infobip messages[0].messageId, or Twilio sid. Null if absent. */
  id: string | null;
  provider: 'infobip' | 'twilio';
  /** Infobip status.groupName, or Twilio status. Diagnostic only. */
  status: string | null;
}

/**
 * Infobip status groups that mean "accepted for delivery".
 *
 * -- Why an allowlist, and why ACCEPTED is in it ---------------------------
 *
 * A denylist would let an unrecognised group through as a success. The whole
 * reason this file is careful is that a false success tells a contractor their
 * quote was texted when it never left; a false failure is visible and
 * recoverable. So anything not named here throws.
 *
 * ACCEPTED (groupId 0) and PENDING (groupId 1) are what a good SUBMIT actually
 * returns. DELIVERED (groupId 3) only appears later on a delivery report and
 * will essentially never be seen at this call site -- it is listed for
 * completeness rather than because it is expected.
 *
 * REJECTED (5), UNDELIVERABLE (2) and EXPIRED (4) are the ones that arrive
 * inside an HTTP 200 and are the entire reason for this check.
 */
const ALLOWED_STATUS_GROUPS = new Set(['PENDING', 'ACCEPTED', 'DELIVERED']);

/**
 * Last four digits, nothing else, ever.
 *
 * These are a contractor's CLIENT's phone numbers -- third parties who never
 * agreed to anything with us. Message bodies are never logged at all: they
 * carry the client's name, the amount owed and a live public link.
 */
export function maskPhone(value: unknown): string {
  const digits = String(value ?? '').replace(/\D/g, '');
  return digits.length >= 4 ? `***${digits.slice(-4)}` : '***';
}

/**
 * Infobip issues every account its own host (https://<account>.api.infobip.com).
 * A shared api.infobip.com produces auth failures that read exactly like a bad
 * key, which is a day lost chasing the wrong thing -- hence its own env var,
 * and hence scripts/diagnose-infobip.py checking it explicitly.
 *
 * Tolerates a missing scheme and a trailing slash because those are what a
 * human copying a host out of a dashboard actually produces.
 */
function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

async function sendViaInfobip(to: string, body: string): Promise<SmsResult> {
  const apiKey = Deno.env.get('INFOBIP_API_KEY');
  const baseUrl = Deno.env.get('INFOBIP_BASE_URL');
  // MUST be a numeric long code or toll-free number, never a brand string.
  // Alphanumeric sender IDs are not supported for US or Canadian destinations;
  // carriers reject them, and the rejection arrives as groupName=REJECTED
  // inside an HTTP 200 -- so the throw below is correct and the SENDER is what
  // is wrong. Reads as the code failing when it is doing its job.
  // scripts/diagnose-infobip.py checks this before a send is ever attempted.
  const sender = Deno.env.get('INFOBIP_SENDER');

  if (!apiKey) throw new Error('INFOBIP_API_KEY not configured');
  if (!baseUrl) throw new Error('INFOBIP_BASE_URL not configured');
  if (!sender) throw new Error('INFOBIP_SENDER not configured');

  const res = await fetch(`${normalizeBaseUrl(baseUrl)}/sms/2/text/advanced`, {
    method: 'POST',
    headers: {
      // The literal word App. Not Bearer -- Infobip rejects Bearer with a 401
      // that is indistinguishable from a wrong key.
      Authorization: `App ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      messages: [{ destinations: [{ to }], from: sender, text: body }],
    }),
  });

  const data = await res.json().catch(() => null);

  // -- Layer 1: HTTP ------------------------------------------------------
  if (!res.ok) {
    const text = data?.requestError?.serviceException?.text;
    const id = data?.requestError?.serviceException?.messageId;
    throw new Error(
      `Infobip error ${res.status}: ${text || id || 'no detail returned'}`,
    );
  }

  // -- Layer 2: envelope --------------------------------------------------
  //
  // A 200 with no per-message result is not a send. Treated as a failure rather
  // than an empty success, because the alternative is reporting delivery of a
  // message we have no evidence was ever accepted.
  const message = Array.isArray(data?.messages) ? data.messages[0] : null;
  if (!message) {
    throw new Error('Infobip returned 200 with no message result');
  }

  // -- Layer 3: the per-message status -----------------------------------
  //
  // THIS is where Infobip differs from Twilio and where a naive port breaks.
  // Twilio signals rejection with a non-2xx; Infobip returns HTTP 200 and puts
  // the rejection in the body. Branching on res.ok alone -- which the Twilio
  // implementation did, correctly, for Twilio -- would report success for every
  // rejected message.
  const group = message?.status?.groupName;
  if (!ALLOWED_STATUS_GROUPS.has(String(group))) {
    const description = message?.status?.description || message?.status?.name;
    throw new Error(
      `Infobip did not accept the message (${group || 'unknown status'})` +
        `${description ? `: ${description}` : ''}`,
    );
  }

  return {
    id: message?.messageId ? String(message.messageId) : null,
    provider: 'infobip',
    status: group ? String(group) : null,
  };
}

/**
 * The previous implementation, moved across unchanged.
 *
 * Branching on res.ok is correct HERE: Twilio returns a non-2xx for a rejected
 * message, so there is no second layer to check. The difference between the two
 * providers is the whole reason this file exists.
 */
async function sendViaTwilio(to: string, body: string): Promise<SmsResult> {
  const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
  const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
  const from = Deno.env.get('TWILIO_PHONE_NUMBER');

  if (!accountSid) throw new Error('TWILIO_ACCOUNT_SID not configured');
  if (!authToken) throw new Error('TWILIO_AUTH_TOKEN not configured');
  if (!from) throw new Error('TWILIO_PHONE_NUMBER not configured');

  const auth = btoa(`${accountSid}:${authToken}`);

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ From: from, To: to, Body: body }).toString(),
    },
  );

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || `Twilio error: ${res.status}`);
  }

  return {
    id: data?.sid ? String(data.sid) : null,
    provider: 'twilio',
    status: data?.status ? String(data.status) : null,
  };
}

/**
 * Send one SMS. Throws on anything that is not an accepted send.
 *
 * The signature is unchanged from the Twilio-only version, so the two callers
 * differ only in their import path and in reading `id` rather than `sid`.
 */
export async function sendSMS(
  { to, body }: { to: string; body: string },
): Promise<SmsResult> {
  // Default infobip. An unrecognised value falls back rather than throwing:
  // a typo in a secret must not take out SMS entirely, and the log line says
  // what happened.
  const configured = (Deno.env.get('SMS_PROVIDER') || 'infobip').trim().toLowerCase();
  const provider = configured === 'twilio' ? 'twilio' : 'infobip';
  if (configured !== provider) {
    console.warn(
      `sendSMS: unrecognised SMS_PROVIDER=${configured}, falling back to ${provider}`,
    );
  }

  try {
    const result = provider === 'twilio'
      ? await sendViaTwilio(to, body)
      : await sendViaInfobip(to, body);
    console.log(`sendSMS: ${result.provider} accepted for ${maskPhone(to)} (${result.status})`);
    return result;
  } catch (err) {
    // Masked number, never the body -- the body carries the client's name, the
    // amount and a live public link.
    console.error(
      `sendSMS: ${provider} failed for ${maskPhone(to)}:`,
      err instanceof Error ? err.message : err,
    );
    throw err;
  }
}
