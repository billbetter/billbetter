/**
 * Calendar days, read as the day they say.
 *
 * `due_date`, `date_issued`, `expiry_date` and the recurring schedule's dates
 * are DATE-ONLY columns: "2026-09-20" means the twentieth, for everyone. The
 * language disagrees -- `new Date("2026-09-20")` is UTC midnight, which in
 * Halifax is the evening of the nineteenth. So every screen that formatted one
 * showed the day before, and every comparison against `now` called an invoice
 * overdue a day early.
 *
 * A value that carries a time (created_date, paid_at) is parsed normally; only
 * a bare y-m-d is pinned to local midnight.
 */
import { differenceInCalendarDays, format, startOfDay } from "date-fns";

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The day `value` names, at local midnight. Null if there isn't one. */
export function parseCalendarDay(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = String(value).trim();
  const parts = DATE_ONLY.exec(text);
  const parsed = parts
    ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    : new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * `format()` for a calendar day, which never throws: a missing or unreadable
 * date returns `fallback` rather than taking the screen down with a
 * RangeError.
 */
export function formatCalendarDay(value, pattern, fallback = "") {
  const day = parseCalendarDay(value);
  return day ? format(day, pattern) : fallback;
}

/** Whole days from today to that day: 0 today, 1 tomorrow, -2 two days ago. */
export function daysUntilDay(value, now = new Date()) {
  const day = parseCalendarDay(value);
  return day ? differenceInCalendarDays(day, startOfDay(now)) : null;
}

/**
 * Is that day already behind us? Compares days, not instants, so an invoice
 * due today is not overdue until tomorrow.
 */
export function isPastDay(value, now = new Date()) {
  const days = daysUntilDay(value, now);
  return days !== null && days < 0;
}
