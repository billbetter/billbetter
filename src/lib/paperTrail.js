/**
 * Reading the paper trail.
 *
 * The record itself lives in public."AuditEvent" and is described at length in
 * supabase/migrations/20260908120000_paper_trail.sql. The short version: rows
 * are written only by database triggers, stamped only by the database clock,
 * hash-chained to each other, and refused to every UPDATE and DELETE by anyone
 * at all. This module is the read side.
 *
 * -- Why this does not go through localDataEngine ---------------------------
 *
 * Every other entity in the app is reached through sdk.entities.X, which falls
 * back to localStorage when a table is missing. For a paper trail that fallback
 * is a disaster: a "sealed, tamper-proof record" that is actually a JSON blob
 * in the contractor's own browser, editable from the console, invisible from
 * their other devices, and indistinguishable in the UI from the real thing.
 * Handing that to somebody in a payment dispute would be worse than having no
 * feature.
 *
 * So this talks to Supabase directly and, when the table is not there, says so.
 * An empty answer and a missing answer must not look alike here.
 *
 * -- The three sources, and why the distinction is kept visible -------------
 *
 * The temptation is to present every line under one heading and call the whole
 * thing proof. It is not, and a client's lawyer would take about a minute to
 * find that out -- at which point the entries that ARE independent get thrown
 * out along with the ones that are not.
 *
 *   system    Invoicium saw it happen and the contractor had no hand in it:
 *             the client's browser fetched the link, the client approved the
 *             quote, Stripe settled a card. This is the part that answers
 *             "I never received it".
 *   user      the contractor did it in the app. Sealed and timestamped by us,
 *             so they cannot have backdated it -- but it is their action.
 *   imported  reconstructed from the document's own columns on the day the
 *             ledger was created, and frozen from that point.
 *
 * Sorting the strong evidence to the top and labelling the rest honestly makes
 * the document more persuasive, not less.
 */

import { supabase } from "@/api/supabaseClient";

/** Rendering rules per event kind. `witnessKey` is only for grouping copy. */
const KINDS = {
  created: { label: "Document raised", tone: "neutral" },
  sent: { label: "Sent to the client", tone: "neutral" },
  viewed: { label: "Client opened it", tone: "strong" },
  reminded: { label: "Reminder sent", tone: "neutral" },
  payment: { label: "Payment received", tone: "money" },
  payment_removed: { label: "Payment record deleted", tone: "warn" },
  paid: { label: "Marked as paid", tone: "money" },
  status_changed: { label: "Status changed", tone: "neutral" },
  voided: { label: "Voided", tone: "warn" },
  link_revoked: { label: "Client link switched off", tone: "warn" },
  demand_letter: { label: "Demand letter issued", tone: "warn" },
  approved: { label: "Quote approved by the client", tone: "strong" },
  declined: { label: "Quote declined by the client", tone: "warn" },
};

/**
 * A kind we have never seen renders as itself rather than vanishing.
 *
 * The migration deliberately left `kind` as free text so a new event type is
 * not a schema change. The cost is that this map will one day be behind, and an
 * unknown kind dropping out of a legal record silently is far worse than one
 * showing up with an ugly label.
 */
export function kindLabel(kind) {
  if (KINDS[kind]) return KINDS[kind].label;
  return String(kind || "Event")
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export function kindTone(kind) {
  return KINDS[kind]?.tone || "neutral";
}

export const SOURCE_LABELS = {
  system: "Witnessed by Invoicium",
  user: "Recorded from your account",
  imported: "Reconstructed from your records",
};

export const SOURCE_EXPLAINERS = {
  system:
    "Invoicium observed this directly. Nobody with access to your account could have staged or backdated it.",
  user:
    "You did this in Invoicium. The date and time are ours, not yours, and cannot be edited afterwards -- but the action was yours.",
  imported:
    "Rebuilt from what the document itself recorded, on the day this log was created. Sealed from that moment, but the date shown is the one the document was carrying at the time.",
};

/** Whether the account has the sealed ledger at all. */
export class PaperTrailUnavailable extends Error {
  constructor(message) {
    super(message);
    this.name = "PaperTrailUnavailable";
  }
}

/** PostgREST codes for "there is no such table / no such function". */
function isMissing(error) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "PGRST202" ||
    error?.code === "42P01" ||
    error?.code === "42883"
  );
}

function rethrow(error) {
  if (isMissing(error)) {
    throw new PaperTrailUnavailable(
      "The sealed record needs a database update that has not been applied yet.",
    );
  }
  throw error;
}

/**
 * One row per document that has any sealed history.
 *
 * @returns {Promise<Array<object>>} rows from paper_trail_summary()
 */
export async function loadTrailSummary() {
  const { data, error } = await supabase.rpc("paper_trail_summary");
  if (error) rethrow(error);
  return data || [];
}

/**
 * Every sealed entry for one document, oldest first.
 *
 * Oldest first, unlike every list screen in the app, because this one is read
 * as a narrative rather than scanned for the latest thing.
 */
export async function loadDocumentTrail(documentId) {
  if (!documentId) return [];
  const { data, error } = await supabase
    .from("AuditEvent")
    .select("*")
    .eq("document_id", documentId)
    .order("seq", { ascending: true });
  if (error) rethrow(error);
  return data || [];
}

/**
 * Recompute the hash chain server-side.
 *
 * @returns {Promise<{ entries: number, intact: boolean, firstBrokenSeq: number|null,
 *                     sealedFrom: string|null, sealedTo: string|null }>}
 */
export async function verifyChain() {
  const { data, error } = await supabase.rpc("audit_verify");
  if (error) rethrow(error);
  const rows = data || [];
  if (!rows.length) {
    return { entries: 0, intact: true, firstBrokenSeq: null, sealedFrom: null, sealedTo: null };
  }
  // One row per accessible owner. A crew member reading their employer's
  // account gets one row; anything broken anywhere is reported as broken.
  return {
    entries: rows.reduce((n, r) => n + Number(r.entries || 0), 0),
    intact: rows.every((r) => r.intact === true),
    firstBrokenSeq: rows.find((r) => r.intact !== true)?.first_broken_seq ?? null,
    sealedFrom: rows.map((r) => r.sealed_from).filter(Boolean).sort()[0] || null,
    sealedTo: rows.map((r) => r.sealed_to).filter(Boolean).sort().pop() || null,
  };
}

// ---- Shaping for display -------------------------------------------------

const parse = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Was this entry recorded well after the thing it describes?
 *
 * The gap between occurred_at and recorded_at is the single most useful number
 * in the whole record and the reason the two columns exist. A payment dated the
 * 3rd and entered on the 20th is a legitimate thing to do -- but a reader is
 * entitled to know, and a record that hid it would deserve to be doubted.
 *
 * A day of slack, because entering Friday's cheque on Monday is normal
 * bookkeeping and flagging it would cry wolf on almost every row.
 */
const BACKDATE_MS = 24 * 60 * 60 * 1000;

export function entryView(entry) {
  const occurred = parse(entry?.occurred_at);
  const recorded = parse(entry?.recorded_at);
  const source = entry?.source || "user";
  const gapMs = occurred && recorded ? recorded.getTime() - occurred.getTime() : 0;

  return {
    id: entry?.id,
    seq: Number(entry?.seq) || 0,
    kind: entry?.kind || "event",
    label: kindLabel(entry?.kind),
    tone: kindTone(entry?.kind),
    detail: entry?.detail || "",
    amount: entry?.amount === null || entry?.amount === undefined ? null : Number(entry.amount),
    occurred,
    recorded,
    source,
    sourceLabel: SOURCE_LABELS[source] || source,
    witnessed: source === "system",
    // Imported rows are reconstructions, so their gap is an artefact of the
    // import rather than anything the contractor did. Flagging those would
    // paint every pre-existing invoice as suspicious on day one.
    backdated: source !== "imported" && gapMs > BACKDATE_MS,
    hash: entry?.hash || "",
  };
}

/**
 * The headline a contractor needs before they send this to anyone.
 *
 * `witnessed` is the number that matters. A trail of twenty entries that are
 * all the contractor's own actions proves diligence and nothing else; one line
 * saying the client opened the link is the thing that ends the argument.
 */
export function trailStrength(entries = []) {
  const views = entries.filter((e) => e.kind === "viewed");
  const witnessed = entries.filter((e) => e.source === "system");
  const sent = entries.find((e) => e.kind === "sent");
  const opened = views[0];

  let headline;
  if (opened) {
    headline =
      views.length > 1
        ? `The client opened this ${views.length} times.`
        : "The client opened this.";
  } else if (sent) {
    headline = "Sent, but never opened from the link.";
  } else {
    headline = "Not sent yet.";
  }

  return {
    entries: entries.length,
    witnessed: witnessed.length,
    views: views.length,
    sentAt: sent?.occurred || null,
    firstOpenedAt: opened?.occurred || null,
    headline,
  };
}

/** A short, quotable identifier for one document's record. */
export function recordReference(entries = []) {
  const last = entries[entries.length - 1];
  if (!last?.hash) return "";
  return last.hash.slice(0, 12).toUpperCase();
}
