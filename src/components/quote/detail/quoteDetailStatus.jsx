import React from "react";
import { CheckCircle2, Clock, FileCheck, FileText, XCircle } from "lucide-react";
import { format } from "date-fns";

/** Badge colour for each quote status. */
export const statusColors = {
  draft: "bg-ink-100 text-ink-800",
  sent: "bg-info-100 text-info-800",
  approved: "bg-success-100 text-success-800",
  declined: "bg-danger-100 text-danger-800",
  converted: "bg-accent-100 text-accent-800",
};

/** Badge icon for each quote status. */
export const statusIcons = {
  draft: <FileText className="w-4 h-4" />,
  sent: <Clock className="w-4 h-4" />,
  approved: <CheckCircle2 className="w-4 h-4" />,
  declined: <XCircle className="w-4 h-4" />,
  converted: <FileCheck className="w-4 h-4" />,
};

/**
 * What actually happened to this quote, and who said so.
 *
 * -- Why the name is the whole point ------------------------------------
 *
 * This used to read `quote.approval_date`, a column that has never existed.
 * The migration added `approved_at`, so the "Approved [date]" line has never
 * rendered once, and `approved_by_name` was displayed nowhere in the app at
 * all. The record a contractor needs when a client disputes the scope three
 * months later was being collected and never shown.
 *
 * -- Two records that must not look alike -------------------------------
 *
 * A client typing their name into the confirmation and a contractor flipping
 * the status from a dropdown are not the same event, and they carry opposite
 * evidentiary weight. So only the client path ever writes a NAME; a manual
 * flip stamps the timestamp alone. The presence of the name is therefore what
 * distinguishes them, and the copy says which one you are looking at:
 *
 *     "Approved by Dana Marchetti on 4 September"   <- the client agreed
 *     "Marked approved by you on 4 September"       <- you set the status
 *
 * Nothing is inferred from another column. A quote approved before this
 * record existed has neither a name nor a date, and says so rather than
 * borrowing `updated_at` -- manufacturing evidence for exactly the dispute
 * this is meant to settle would be worse than showing nothing.
 */
export function quoteResponseRecord(quote) {
  if (!quote) return null;

  const isApproved = quote.status === "approved";
  // "declined" is the app's vocabulary; "rejected" is read for safety only.
  const isDeclined =
    quote.status === "declined" || quote.status === "rejected";
  if (!isApproved && !isDeclined) return null;

  const verb = isApproved ? "Approved" : "Declined";
  const byName = isApproved ? quote.approved_by_name : quote.declined_by_name;
  const at = isApproved ? quote.approved_at : quote.declined_at;

  const stamp = at ? new Date(at) : null;
  const valid = stamp && !Number.isNaN(stamp.getTime());

  const shortDate = valid ? ` ${format(stamp, "MMM d, yyyy")}` : "";
  const fullDate = valid
    ? ` on ${format(stamp, "MMMM d, yyyy 'at' h:mm a")}`
    : "";

  if (byName) {
    return {
      byName,
      reason: isDeclined ? quote.decline_reason || "" : "",
      short: `${verb} by ${byName}${shortDate}`,
      full: `${verb} by ${byName}${fullDate}`,
    };
  }

  return {
    byName: null,
    reason: isDeclined ? quote.decline_reason || "" : "",
    short: `Marked ${verb.toLowerCase()}${shortDate}`,
    full: valid
      ? `Marked ${verb.toLowerCase()} by you${fullDate}`
      : `Marked ${verb.toLowerCase()}. No date on record.`,
  };
}
