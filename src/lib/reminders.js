/**
 * Deciding which overdue invoices are due a reminder.
 *
 * -- Why this is a schedule and not a button -------------------------------
 *
 * ChaseInvoice already sends reminders, one at a time, whenever the contractor
 * remembers to look. What it cannot do is tell them WHICH invoices are due
 * one, because its record of what it sent lives in localStorage: chase from
 * the van, open the laptop, and the laptop believes nothing was ever sent.
 *
 * The cadence lives here, as pure functions over an invoice row, so the rules
 * can be tested without a browser and read without tracing a component.
 *
 * -- The rules, and the reasons -------------------------------------------
 *
 *   Only overdue invoices. `sent` is not late, and a client who has had the
 *   invoice for two days does not need chasing.
 *
 *   Never paid or cancelled. Reminding someone about money they have already
 *   paid is the single worst thing this feature could do.
 *
 *   Three reminders, ever. After the third, it stops and stays stopped. A
 *   product that mails someone weekly forever is not chasing an invoice, it is
 *   harassing a customer, and the contractor's name is on it.
 *
 *   Spacing is measured from the LAST REMINDER, not from the due date, so an
 *   invoice that sat unchased for two months gets a first reminder and then a
 *   proper gap -- not three in one afternoon because all three thresholds are
 *   in the past.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses that may be reminded about. Everything else is excluded. */
const REMINDABLE = new Set(["overdue"]);

/**
 * The ladder. Index is the number of reminders already sent.
 *
 *   0 sent -> due once 3 days overdue
 *   1 sent -> due 4 days after that reminder
 *   2 sent -> due 7 days after that reminder
 *   3 sent -> never again
 *
 * Tones escalate but stay civil. The last one says it is the last one, because
 * a final notice that does not announce itself is just another email.
 */
export const REMINDER_LADDER = [
  { after_days: 3, from: "due_date", tone: "gentle", label: "First reminder" },
  { after_days: 4, from: "last_reminder", tone: "firm", label: "Second reminder" },
  { after_days: 7, from: "last_reminder", tone: "final", label: "Final notice" },
];

export const MAX_REMINDERS = REMINDER_LADDER.length;

function daysBetween(from, to) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.floor((b - a) / DAY_MS);
}

/**
 * Whether an invoice is due a reminder right now, and which one.
 *
 * @param {object} invoice
 * @param {Date|number} [now]
 * @returns {{ due: boolean, step?: object, sentSoFar: number, reason?: string,
 *             daysOverdue?: number|null }}
 */
export function reminderStatus(invoice, now = Date.now()) {
  const status = String(invoice?.status || "").toLowerCase();
  const sentSoFar = Number(invoice?.reminder_count) || 0;

  if (!REMINDABLE.has(status)) {
    return { due: false, sentSoFar, reason: status === "paid" ? "Paid" : "Not overdue" };
  }
  if (!invoice?.client_email && !invoice?.client_phone) {
    return { due: false, sentSoFar, reason: "No email or phone on file" };
  }
  if (sentSoFar >= MAX_REMINDERS) {
    return { due: false, sentSoFar, reason: "All reminders sent" };
  }

  const step = REMINDER_LADDER[sentSoFar];
  const daysOverdue = invoice?.due_date ? daysBetween(invoice.due_date, now) : null;

  // No due date means nothing can be measured from. Treated as not due rather
  // than as due immediately: guessing produces a reminder the contractor never
  // asked for, about a deadline that was never agreed.
  if (daysOverdue === null) {
    return { due: false, sentSoFar, reason: "No due date", daysOverdue: null };
  }

  if (step.from === "due_date") {
    return daysOverdue >= step.after_days
      ? { due: true, step, sentSoFar, daysOverdue }
      : {
          due: false,
          sentSoFar,
          daysOverdue,
          reason: `Due in ${step.after_days - daysOverdue} day(s)`,
        };
  }

  // Spacing from the previous reminder.
  const since = invoice?.last_reminder_sent_at
    ? daysBetween(invoice.last_reminder_sent_at, now)
    : null;
  // A count above zero with no timestamp is a row written before this feature
  // existed. Allowing it through would fire the next rung immediately, so it
  // waits for a timestamp instead -- one reminder late beats one unexplained.
  if (since === null) {
    return { due: false, sentSoFar, daysOverdue, reason: "Waiting on reminder history" };
  }
  return since >= step.after_days
    ? { due: true, step, sentSoFar, daysOverdue }
    : {
        due: false,
        sentSoFar,
        daysOverdue,
        reason: `Due in ${step.after_days - since} day(s)`,
      };
}

/**
 * Every invoice that is due a reminder, worst first.
 *
 * Ordered by how overdue they are, because that is the order a contractor
 * would work through them, and the top of the list is the money most at risk.
 */
export function dueReminders(invoices = [], now = Date.now()) {
  return invoices
    .map((invoice) => ({ invoice, status: reminderStatus(invoice, now) }))
    .filter((r) => r.status.due)
    .sort((a, b) => (b.status.daysOverdue || 0) - (a.status.daysOverdue || 0));
}

/**
 * The patch recording that a reminder went out.
 *
 * Only ever applied to invoices that were ACTUALLY delivered -- a reminder
 * that failed to send must not consume a rung of the ladder, or a bounced
 * first reminder silently promotes the client to a final notice.
 */
export function reminderSentPatch(invoice, now = new Date()) {
  return {
    reminder_count: (Number(invoice?.reminder_count) || 0) + 1,
    last_reminder_sent_at: new Date(now).toISOString(),
  };
}
