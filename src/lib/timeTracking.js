/**
 * Time tracking: the clock, and what an hour costs.
 *
 * Job has carried estimated_hours, hourly_rate, labor_cost and actual_cost
 * since the original schema, and ProfitabilityMetrics has been charting profit
 * per job off them the whole time -- but nothing ever recorded an actual hour,
 * so labor_cost was whatever someone typed. This is the missing half.
 *
 * Two rules the rest of the app depends on:
 *
 *   1. A running entry has ended_at = null and no duration. Duration is
 *      computed from the clock only while running, and FROZEN on stop. A
 *      timesheet that silently changes every time you look at it is not a
 *      record of anything.
 *   2. hourly_rate is snapshotted onto the entry at stop time. Giving someone
 *      a raise must not restate the cost of work they already did, or of an
 *      invoice already sent.
 */

import { sdk } from "@/api/sdk";
import { getBusinessContext } from "@/lib/crew";

const MS_PER_MINUTE = 60000;

/** Whole minutes between two instants, never negative. */
export function minutesBetween(start, end) {
  const from = new Date(start).getTime();
  const to = new Date(end).getTime();
  if (!isFinite(from) || !isFinite(to)) return 0;
  return Math.max(0, Math.round((to - from) / MS_PER_MINUTE));
}

/** Minutes on an entry: stored once stopped, live off the clock while running. */
export function entryMinutes(entry, now = Date.now()) {
  if (!entry) return 0;
  if (entry.ended_at) {
    return Number(entry.duration_minutes) || minutesBetween(entry.started_at, entry.ended_at);
  }
  return minutesBetween(entry.started_at, now);
}

/** Cost of an entry at its snapshotted rate. */
export function entryCost(entry, now = Date.now()) {
  const rate = Number(entry?.hourly_rate) || 0;
  return (entryMinutes(entry, now) / 60) * rate;
}

/** "2h 45m", or "45m" under an hour. Zero reads as "0m", not "". */
export function formatDuration(minutes) {
  const total = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Decimal hours, for invoice line items. Rounded to 2dp. */
export function toHours(minutes) {
  return Math.round(((Number(minutes) || 0) / 60) * 100) / 100;
}

/**
 * The entry this person currently has running, if any.
 *
 * Scoped by member_user_id rather than user_id: on a crew account the rows
 * belong to the employer, and "am I clocked in?" is a question about the
 * person, not the business.
 */
export async function getRunningEntry() {
  const ctx = await getBusinessContext();
  if (!ctx.authUserId) return null;
  const rows = await sdk.entities.TimeEntry.filter(
    { member_user_id: ctx.authUserId },
    "-started_at",
    20,
  );
  return (rows || []).find((r) => !r.ended_at) || null;
}

/**
 * Start the clock on a job.
 *
 * Any entry already running for this person is stopped first. The database has
 * a partial unique index enforcing one open entry per member, so without this
 * the insert would simply fail -- and "start" failing because you forgot to
 * stop yesterday is not a useful thing to tell someone standing on a roof.
 *
 * @param {{ job?: any, hourlyRate?: number|null, notes?: string|null }} [options]
 */
export async function clockIn({ job, hourlyRate, notes } = {}) {
  const ctx = await getBusinessContext();
  if (!ctx.authUserId) throw new Error("You must be signed in to track time.");

  const running = await getRunningEntry();
  if (running) await clockOut(running);

  // user_id is stamped with the owning business by localDataEngine.
  return sdk.entities.TimeEntry.create({
    member_user_id: ctx.authUserId,
    member_name: ctx.displayName || null,
    job_id: job?.id || null,
    client_id: job?.client_id || null,
    started_at: new Date().toISOString(),
    hourly_rate:
      hourlyRate ??
      ctx.membership?.hourly_rate ??
      Number(job?.hourly_rate) ??
      null,
    billable: true,
    notes: notes || null,
  });
}

/** Stop the clock and freeze the duration. */
export async function clockOut(entry) {
  if (!entry?.id) return null;
  const endedAt = new Date().toISOString();
  return sdk.entities.TimeEntry.update(entry.id, {
    ended_at: endedAt,
    duration_minutes: minutesBetween(entry.started_at, endedAt),
  });
}

/**
 * Add a timesheet row after the fact -- "3 hours on Tuesday".
 *
 * Arrives already closed, so it never collides with the one-running-entry
 * index and never appears as a phantom clock somebody has to go and stop.
 *
 * @param {{ job?: any, startedAt?: Date|string|number, minutes: number,
 *           hourlyRate?: number|null, notes?: string|null }} options
 */
export async function logManualEntry({ job, startedAt, minutes, hourlyRate, notes }) {
  const ctx = await getBusinessContext();
  if (!ctx.authUserId) throw new Error("You must be signed in to log time.");

  const start = new Date(startedAt || Date.now());
  const duration = Math.max(1, Math.round(Number(minutes) || 0));

  return sdk.entities.TimeEntry.create({
    member_user_id: ctx.authUserId,
    member_name: ctx.displayName || null,
    job_id: job?.id || null,
    client_id: job?.client_id || null,
    started_at: start.toISOString(),
    ended_at: new Date(start.getTime() + duration * MS_PER_MINUTE).toISOString(),
    duration_minutes: duration,
    hourly_rate: hourlyRate ?? ctx.membership?.hourly_rate ?? null,
    billable: true,
    notes: notes || null,
  });
}

/**
 * Roll a job's tracked hours up into its costing fields.
 *
 * actual_cost is labour plus materials rather than labour alone -- it is what
 * the profitability chart subtracts from revenue, so leaving materials out
 * would overstate profit on every job that bought anything.
 */
export async function recalculateJobCost(jobId) {
  if (!jobId) return null;
  const entries = await sdk.entities.TimeEntry.filter({ job_id: jobId });
  const closed = (entries || []).filter((e) => e.ended_at);

  const minutes = closed.reduce((sum, e) => sum + entryMinutes(e), 0);
  const labour = closed.reduce((sum, e) => sum + entryCost(e), 0);

  const job = await sdk.entities.Job.get(jobId);
  const materials = Number(job?.materials_cost) || 0;

  return sdk.entities.Job.update(jobId, {
    actual_hours: toHours(minutes),
    labor_cost: Math.round(labour * 100) / 100,
    actual_cost: Math.round((labour + materials) * 100) / 100,
  });
}

/** Group entries by job id, with totals. Used by the timesheet and job views. */
export function summariseByJob(entries, now = Date.now()) {
  const byJob = new Map();
  for (const entry of entries || []) {
    const key = entry.job_id || "unassigned";
    const bucket = byJob.get(key) || { jobId: entry.job_id || null, minutes: 0, cost: 0, entries: [] };
    bucket.minutes += entryMinutes(entry, now);
    bucket.cost += entryCost(entry, now);
    bucket.entries.push(entry);
    byJob.set(key, bucket);
  }
  return [...byJob.values()].sort((a, b) => b.minutes - a.minutes);
}

/** Unbilled, billable, closed entries -- the ones an invoice can draw from. */
export function billableEntries(entries) {
  return (entries || []).filter((e) => e.ended_at && e.billable && !e.invoiced);
}

/**
 * Turn tracked time into invoice line items, one per job.
 *
 * One line per job rather than per entry: a client does not want to read
 * fourteen separate clock-ins, they want "Kitchen refit — 22.5 hrs".
 */
export function entriesToLineItems(entries, jobsById = {}) {
  return summariseByJob(billableEntries(entries)).map((group) => {
    const hours = toHours(group.minutes);
    const rate = hours ? Math.round((group.cost / hours) * 100) / 100 : 0;
    const job = group.jobId ? jobsById[group.jobId] : null;
    return {
      description: job?.job_title ? `${job.job_title} — labour` : "Labour",
      quantity: hours,
      rate,
      amount: Math.round(hours * rate * 100) / 100,
      time_entry_ids: group.entries.map((e) => e.id),
    };
  });
}

/**
 * Mark hours as billed, once the invoice they went onto actually exists.
 *
 * Called from CreateInvoice after the row is written, never when the "bill
 * these hours" button is pressed -- a user who backs out of the invoice screen
 * must not find their work marked as billed.
 *
 * Failures are swallowed deliberately. The invoice is already saved and the
 * client is already going to be charged; refusing to finish because a
 * bookkeeping flag would not set is the wrong trade. The hours simply stay
 * billable and show up again next time, which is the safe direction to fail.
 *
 * @param {string[]} ids
 * @param {string} invoiceId
 */
export async function markTimeEntriesInvoiced(ids, invoiceId) {
  const results = await Promise.allSettled(
    (ids || []).map((id) =>
      sdk.entities.TimeEntry.update(id, { invoiced: true, invoice_id: invoiceId }),
    ),
  );
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    console.warn(
      `Invoice ${invoiceId}: ${failed.length} of ${ids.length} time entries could not be marked billed`,
      failed,
    );
  }
  return { marked: results.length - failed.length, failed: failed.length };
}
