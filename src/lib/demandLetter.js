/**
 * Deciding which overdue invoices are worth offering a demand letter about.
 *
 * -- What a demand letter is here -----------------------------------------
 *
 * The last step a contractor takes on their own, before deciding whether to
 * involve anyone else. It is not a reminder -- reminders.js already runs that
 * ladder, three emails and then it stops -- and it is not a legal filing. It
 * is a formal letter, written over the contractor's name, that says the money
 * is late and states a deadline.
 *
 * That framing is what sets every rule below. Nothing here sends anything,
 * nothing drafts anything, and nothing decides anything is owed. It only
 * answers "is this invoice far enough gone that offering to help would be
 * useful rather than pushy", and the contractor answers everything after that.
 *
 * -- The rules, and the reasons -------------------------------------------
 *
 *   21 days. Long enough that the reminder ladder has run its course -- its
 *   three emails land at 3, 7 and 14 days overdue -- so the letter is a genuine
 *   escalation rather than a fourth nag arriving in the same week.
 *
 *   Unpaid means the date, not the status. An invoice can sit at 'sent' months
 *   past its due date because nothing in this app reliably promotes it to
 *   'overdue'. Reading the status would skip exactly the invoices that have
 *   been ignored longest.
 *
 *   Never paid, void, cancelled or draft. Offering to demand payment for money
 *   that has already arrived, or on an invoice the contractor themselves
 *   retracted, is the worst thing this feature could do.
 *
 *   Asked once, then dropped. A prompt that returns every morning until it is
 *   obeyed is not a suggestion. One offer, one follow-up much later, and then
 *   silence -- see FOLLOW_UP_DAYS.
 */

import { ENTITY_COLUMNS } from "@/api/entityColumns";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days overdue before a demand letter is offered.
 *
 * Mirrored by DEMAND_LETTER_DAYS in supabase/functions/sweep-demand-letters,
 * which stamps the same threshold server-side. A Deno edge function and a Vite
 * bundle share no module, so the two copies must be changed together.
 */
export const DEMAND_LETTER_DAYS = 21;

/**
 * When the single follow-up is offered, for an invoice still unpaid after the
 * first offer was dismissed.
 *
 * A window rather than a day because the check runs whenever the app is opened,
 * not on a fixed schedule -- a contractor who does not open the app for a week
 * would miss a prompt pinned to day 35 exactly. Measured from the due date so
 * that "still unpaid five weeks on" means what it says.
 */
export const FOLLOW_UP_DAYS = { from: 35, to: 40 };

/** Statuses that mean the money has not arrived. Everything else is excluded. */
const UNPAID_STATUSES = new Set(["sent", "overdue"]);

/** The columns the prompt state is written to. All three, or the feature is off. */
export const DEMAND_LETTER_COLUMNS = [
  "demand_letter_prompted_at",
  "demand_letter_dismissed_at",
  "demand_letter_sent_at",
];

/**
 * Whether the database can actually record where an invoice sits in this flow.
 *
 * The same guard invoiceVoid.js uses, for the same reason: localDataEngine
 * strips keys that are not in ENTITY_COLUMNS before every write, so on a
 * database without the migration a dismissal would be silently dropped and the
 * banner would reappear on the next load, forever. Better to not offer the
 * prompt at all than to offer one that cannot be dismissed.
 */
export function demandLetterSupported() {
  const columns = ENTITY_COLUMNS.Invoice;
  // No map for the table means no stripping either, so nothing would be lost.
  if (!columns) return true;
  return DEMAND_LETTER_COLUMNS.every((c) => columns.includes(c));
}

/**
 * Whole days between a due date and now, or null if there is no usable date.
 *
 * Bare "YYYY-MM-DD" is parsed as a local calendar day rather than through
 * `new Date()`, which reads it as midnight UTC and lands on the day before for
 * anyone west of Greenwich. Both invoice forms write due dates in that shape,
 * so without this an invoice would cross the 21-day line a day early.
 */
const CALENDAR_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function daysOverdue(invoice, now = new Date()) {
  const raw = invoice?.due_date;
  if (!raw) return null;

  let due;
  if (typeof raw === "string" && CALENDAR_DATE.test(raw)) {
    const [year, month, day] = raw.split("-").map(Number);
    due = new Date(year, month - 1, day);
  } else {
    due = new Date(raw);
    if (Number.isNaN(due.getTime())) return null;
  }

  return Math.floor((now.getTime() - due.getTime()) / DAY_MS);
}

/**
 * Which prompt, if any, this invoice is due right now.
 *
 * @returns {"first"|"follow_up"|null}
 *
 * `null` is the answer for the overwhelming majority of invoices and is not an
 * error. The three closing states -- a letter exists, the invoice was paid, the
 * contractor said no twice -- are all silence, deliberately and permanently.
 */
export function demandLetterPrompt(invoice, now = new Date()) {
  if (!invoice) return null;
  if (!UNPAID_STATUSES.has(invoice.status)) return null;

  // A letter has been drafted for this invoice. The flow is over; whatever
  // happens next is between the contractor and their client.
  if (invoice.demand_letter_sent_at) return null;

  const overdue = daysOverdue(invoice, now);
  if (overdue === null || overdue < DEMAND_LETTER_DAYS) return null;

  if (!invoice.demand_letter_dismissed_at) return "first";

  // Dismissed once, and still unpaid five weeks on. Offered a second time and
  // never again -- the window closes on its own rather than waiting for another
  // dismissal, so an invoice that is simply never going to be paid stops
  // generating prompts instead of accumulating them.
  if (overdue >= FOLLOW_UP_DAYS.from && overdue <= FOLLOW_UP_DAYS.to) {
    const dismissedOverdue = daysOverdue(
      { due_date: invoice.due_date },
      new Date(invoice.demand_letter_dismissed_at),
    );
    // Only if the dismissal was of the FIRST prompt. Dismissing the follow-up
    // lands inside the same window, and without this it would re-offer itself
    // the next morning.
    if (dismissedOverdue !== null && dismissedOverdue < FOLLOW_UP_DAYS.from) {
      return "follow_up";
    }
  }

  return null;
}

/**
 * The invoices to prompt about, worst first.
 *
 * Capped by the caller rather than here. One banner at a time is the intended
 * shape -- a stack of five demand-letter prompts is a wall to be dismissed, not
 * a decision to be made -- but the full ordered list is what makes "and 4
 * others" possible without a second pass.
 */
export function demandLetterCandidates(invoices, now = new Date()) {
  if (!Array.isArray(invoices) || !demandLetterSupported()) return [];

  return invoices
    .map((invoice) => ({
      invoice,
      prompt: demandLetterPrompt(invoice, now),
      overdue: daysOverdue(invoice, now),
    }))
    .filter((row) => row.prompt !== null)
    .sort((a, b) => (b.overdue ?? 0) - (a.overdue ?? 0));
}

/** The patch that records "not now", so the same invoice is not re-offered. */
export function dismissPatch(now = new Date()) {
  return { demand_letter_dismissed_at: now.toISOString() };
}
