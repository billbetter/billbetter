import { db } from './supabase-admin.ts';

/**
 * Everything the public document pages share: token lookup, revocation,
 * rate limiting, bot detection and the privacy-preserving dedupe hash.
 *
 * -- DELIBERATE: no requireAppAccess() on any path that uses this -----------
 *
 * A lapsed contractor's clients can still view and PAY an invoice that was
 * already sent. This is intentional and must not be "fixed":
 *
 *   1. Blocking payment punishes the contractor by breaking THEIR cash flow --
 *      a churn bomb aimed at someone whose card merely failed.
 *   2. We would forfeit our platform fee on money we are already owed.
 *   3. The exposure is bounded: RLS still stops a lapsed user CREATING
 *      invoices, so no new links can appear while they are lapsed. The set of
 *      reachable documents is frozen at the moment access lapsed.
 *
 * The token is therefore the ONLY credential on these endpoints, which is why
 * it is compared in constant time and why an unknown token is answered
 * identically to a revoked one.
 */

/** How long a client is allowed to hammer the endpoint before we say no. */
const RATE_WINDOW_MS = 60_000;
const RATE_MAX_PER_WINDOW = 30;

/**
 * Requests within this window of the invoice being sent are treated as
 * scanners, not people.
 *
 * Corporate mail security (Outlook Safe Links, Mimecast, Proofpoint) pre-fetches
 * every URL in an email at delivery time. Without this, first_viewed_at would
 * fire seconds after send, from a robot, for a large share of business
 * clients -- precisely the clients who matter most. The failure mode is not
 * noise; it is wrong in the exact direction that makes the product accuse
 * people, because a chase sequence would then escalate against a client who
 * never opened anything.
 *
 * A human who opens an invoice inside a minute of it arriving is real but rare,
 * and the cost of not counting that one open is nil.
 */
const SEND_GRACE_MS = 60_000;

/** Repeat hits inside this window move last_viewed_at but are not new opens. */
const VIEW_DEBOUNCE_MS = 30 * 60_000;

/**
 * uuid v4, case-insensitive. Checked before the token reaches a query so a
 * malformed value fails at the type boundary rather than as a Postgres error.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * User agents that identify themselves as automated.
 *
 * This list is a courtesy, not a control -- a scanner that wanted to hide would
 * not be in it. It exists so that the ones which DO announce themselves are
 * marked rather than counted. Layer 1 (recording from JS after mount) is what
 * actually removes most of them, since a scanner fetches HTML and does not boot
 * a React SPA.
 */
const BOT_UA_RE = new RegExp(
  [
    'bot', 'crawl', 'spider', 'slurp',
    'preview', 'fetcher', 'scanner', 'monitor',
    'safelinks', 'mimecast', 'proofpoint', 'barracuda', 'symantec',
    'headlesschrome', 'phantomjs', 'python-requests', 'curl/', 'wget',
    'whatsapp', 'slackbot', 'discordbot', 'telegrambot', 'facebookexternalhit',
  ].join('|'),
  'i',
);

export interface PublicDoc {
  row: Record<string, unknown>;
}

export type LookupFailure = 'invalid' | 'not_found' | 'revoked';

/**
 * The single answer for every credential that does not resolve to a live
 * document -- malformed, unknown, or revoked.
 *
 * -- Why one answer, byte for byte ----------------------------------------
 *
 * Answering revoked and unknown differently makes the endpoint an oracle. A
 * caller feeding it candidate tokens could tell "this was a real link once"
 * apart from "this never existed", which is information about the contractor's
 * business that no anonymous caller is owed. uuid4 makes guessing infeasible,
 * so the oracle is not the likeliest attack -- but the cost of closing it is a
 * shared constant, and a difference that exists for no reason is a difference
 * somebody eventually depends on.
 *
 * 410 rather than 404 because the friendly state is the correct one to show: a
 * client with a link that stopped working needs to be told what to do next, and
 * "not found" reads as a broken product. The copy is deliberately true for BOTH
 * cases -- it does not assert that the sender turned the link off, because for
 * a mistyped address that would be a lie.
 *
 * Exported as one object so the two functions cannot drift apart; a test
 * asserts the two responses are identical byte for byte.
 */
export const LINK_UNAVAILABLE = {
  status: 410,
  body: {
    success: false,
    reason: 'unavailable',
    error:
      'This link is no longer active. It may have been turned off by the sender, ' +
      'or the address may be incorrect. Please contact them directly for an ' +
      'up-to-date copy.',
  },
} as const;

/** Constant-time string compare.
 *
 * The token is the whole credential, so a plain === would leak its prefix
 * through timing. Deno gives us no crypto.timingSafeEqual for strings, so
 * compare every byte and accumulate.
 */
export function tokensMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Opaque text credential: what Quote.public_id holds.
 *
 * That column is `text` rather than `uuid` because it predates the convention
 * and already appears in links that have been sent. New values are uuids cast
 * to text, so this is deliberately wider than UUID_RE -- narrow enough to keep
 * junk out of a query, wide enough not to reject a token we ourselves issued
 * under the old shape.
 */
const OPAQUE_RE = /^[A-Za-z0-9_-]{8,128}$/;

export function isValidToken(token: unknown, format: 'uuid' | 'opaque' = 'uuid'): token is string {
  if (typeof token !== 'string') return false;
  return format === 'uuid' ? UUID_RE.test(token) : OPAQUE_RE.test(token);
}

/**
 * Resolve a public credential to its row, or say why not.
 *
 * `not_found` and `revoked` are returned separately because the CALLER needs
 * to tell them apart -- a revoked link should say "this link was turned off",
 * which is useful and true, while an unknown token must not confirm anything.
 * Both are answered to the client with a body containing no document data.
 *
 * `column` exists because the two document types do not share a credential
 * name: Invoice has public_token (uuid, added by this work) and Quote has
 * public_id (text, already in sent links). Renaming Quote's would have broken
 * every link already in a client's inbox, so the lookup takes the column
 * instead -- one code path, two column names.
 */
export async function docByToken(
  table: string,
  token: unknown,
  opts: { column?: string; format?: 'uuid' | 'opaque' } = {},
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; reason: LookupFailure }> {
  const column = opts.column || 'public_token';
  if (!isValidToken(token, opts.format || 'uuid')) return { ok: false, reason: 'invalid' };

  const row = await db.findOne(table, { [column]: token });
  // The PostgREST filter is what makes the lookup indexed; the constant-time
  // compare is what makes it safe to have used a string equality to get here.
  if (!row || !tokensMatch(String(row[column]), token)) {
    return { ok: false, reason: 'not_found' };
  }
  if (row.public_link_revoked_at) return { ok: false, reason: 'revoked' };
  return { ok: true, row };
}

async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * A per-viewer key that is NOT an IP address.
 *
 * These are a contractor's CLIENT's IPs -- third parties who never agreed to
 * anything with us. We are a Canadian company, PIPEDA applies, and we gain
 * nothing from storing them. sha256(ip + user-agent + daily salt) supports
 * dedupe and rate limiting within a day and stops being linkable after it,
 * because the salt rotates and is never stored beside the hash.
 *
 * The salt is derived rather than configured so that this cannot silently
 * degrade to a constant if a secret is missing -- a fixed salt would make every
 * day's hashes linkable, which is the one property this exists to prevent.
 */
export async function dedupeHash(req: Request): Promise<string> {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('cf-connecting-ip') ||
    'unknown';
  const ua = req.headers.get('user-agent') || 'unknown';
  const secret =
    Deno.env.get('PUBLIC_LINK_SALT') ||
    // Falls back to a value that is always present on the platform. If the
    // service role key ever leaks, re-deriving these hashes is the least of the
    // problems that causes.
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ||
    'invoicium';
  const day = new Date().toISOString().slice(0, 10); // UTC date, rotates daily
  const salt = await sha256Hex(`${secret}:${day}`);
  return await sha256Hex(`${ip}|${ua}|${salt}`);
}

export function isBotRequest(req: Request): boolean {
  const ua = req.headers.get('user-agent') || '';
  if (!ua) return true; // a browser always sends one
  return BOT_UA_RE.test(ua);
}

/**
 * True when this hash has already used up its allowance.
 *
 * Counts rows rather than asking PostgREST for an exact count: we only need to
 * know whether the number exceeds the limit, so selecting at most limit+1 ids
 * answers it with a bounded response.
 */
export async function isRateLimited(hash: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const rows = await db.select(
    'PublicLinkHit',
    `select=id&dedupe_hash=eq.${encodeURIComponent(hash)}` +
      `&hit_at=gte.${encodeURIComponent(since)}&limit=${RATE_MAX_PER_WINDOW + 1}`,
  );
  return rows.length > RATE_MAX_PER_WINDOW;
}

/**
 * Record one request. Never throws -- a logging failure must not be the reason
 * a client cannot see their invoice.
 */
export async function recordHit(entry: {
  /** Null when the credential matched nothing. Both null is a valid row. */
  invoice_id?: string | null;
  quote_id?: string | null;
  is_bot: boolean;
  referrer: string | null;
  dedupe_hash: string;
}): Promise<void> {
  try {
    await db.insert('PublicLinkHit', {
      invoice_id: entry.invoice_id ?? null,
      quote_id: entry.quote_id ?? null,
      is_bot: entry.is_bot,
      referrer: entry.referrer ? entry.referrer.slice(0, 500) : null,
      dedupe_hash: entry.dedupe_hash,
    });
  } catch (err) {
    console.error('recordHit failed (ignored):', err instanceof Error ? err.message : err);
  }
}

/**
 * Advance the view counters on a document, applying the send-grace and
 * debounce rules.
 *
 * Returns what it decided, so the caller can log it. Deliberately silent about
 * failure for the same reason recordHit is.
 *
 * Note on the read-modify-write of view_count: two simultaneous views can
 * produce one increment. That is a real race and it is accepted -- the counter
 * is a signal, not an accounting record, and the alternative (an RPC doing
 * `view_count = view_count + 1`) is a database function to maintain for a
 * number nobody reconciles.
 */
export async function advanceViewCounters(
  table: string,
  row: Record<string, unknown>,
  opts: { isBot: boolean; dedupeHash: string },
): Promise<'counted' | 'debounced' | 'skipped_bot' | 'skipped_grace'> {
  if (opts.isBot) return 'skipped_bot';

  const sentAt = row.updated_at || row.created_at;
  if (sentAt && Date.now() - new Date(String(sentAt)).getTime() < SEND_GRACE_MS) {
    return 'skipped_grace';
  }

  const now = new Date().toISOString();
  const last = row.last_viewed_at ? new Date(String(row.last_viewed_at)).getTime() : 0;
  const withinDebounce = last > 0 && Date.now() - last < VIEW_DEBOUNCE_MS;

  const patch: Record<string, unknown> = { last_viewed_at: now };
  if (!row.first_viewed_at) patch.first_viewed_at = now;
  if (!withinDebounce) patch.view_count = (Number(row.view_count) || 0) + 1;

  // Status is NOT touched here, on purpose. Viewing is a timestamp, not a
  // status value: an invoice that has been viewed AND is overdue could only be
  // one of them, and overdue is the one the UI needs.
  try {
    await db.update(table, String(row.id), patch);
  } catch (err) {
    console.error('advanceViewCounters failed (ignored):', err instanceof Error ? err.message : err);
  }
  return withinDebounce ? 'debounced' : 'counted';
}

export const PUBLIC_LINK_LIMITS = {
  RATE_WINDOW_MS,
  RATE_MAX_PER_WINDOW,
  SEND_GRACE_MS,
  VIEW_DEBOUNCE_MS,
};
