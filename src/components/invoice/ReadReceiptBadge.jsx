import React from "react";
import { Eye } from "lucide-react";
import { readReceipt } from "@/lib/readReceipt";

/**
 * "Your client opened this." One badge, four surfaces.
 *
 * Lives beside PublicLinkControls and serves both document types for the same
 * reason that component does: an invoice and a quote differ here in nothing at
 * all, and two copies would be the start of them disagreeing.
 *
 * -- Renders NOTHING when the document has not been opened -----------------
 *
 * Not a muted "Not opened yet" -- nothing. In a list, the negative case is
 * every row of a healthy account, so printing it would put a column of grey
 * text down the whole table and bury the handful of rows that are actually
 * saying something. It would also be a claim we cannot support: a client who
 * read the attached PDF without clicking the link leaves no trace, so an
 * absent receipt means "we did not see it", not "they ignored you". The
 * detail pages, which have room to explain that, pass `showUnopened`.
 *
 * The full sentence -- how many times, and when -- is always on the title
 * attribute, so the dense form never costs the contractor the detail.
 */
export default function ReadReceiptBadge({
  document: doc,
  showUnopened = false,
  className = "",
}) {
  const receipt = readReceipt(doc);

  if (!receipt.opened) {
    if (!showUnopened) return null;
    return (
      <span
        className={`inline-flex items-center gap-1.5 text-xs text-content-muted dark:text-content-subtle ${className}`}
      >
        <Eye className="w-3.5 h-3.5" />
        {receipt.label}
      </span>
    );
  }

  const title = receipt.reopened
    ? `${receipt.label}, last on ${receipt.lastAt.toLocaleString()}`
    : receipt.label;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        // A receipt from today is the one worth a colour: it is the difference
        // between "chase them" and "give them the afternoon".
        receipt.fresh
          ? "bg-info-50 text-info-700 dark:bg-info-950/50 dark:text-info-300"
          : "bg-surface-sunken text-content-muted dark:bg-ink-800 dark:text-ink-300"
      } ${className}`}
    >
      <Eye className="w-3 h-3" />
      {receipt.shortLabel}
    </span>
  );
}
