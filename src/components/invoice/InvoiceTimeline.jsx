/**
 * What happened to one invoice, newest first.
 *
 * The entries come from invoiceTimeline(), which MERGES what the invoice row
 * already knows -- created, first opened, reminders, voided, link revoked --
 * with the payments and the stored status changes. That merge is the reason
 * this shows anything at all for an invoice that existed before the history
 * table did, which on the day this ships is every invoice in the account.
 */

import React from "react";
import { format } from "date-fns";
import {
  Ban,
  Eye,
  FileText,
  Link2Off,
  RefreshCw,
  Send,
  Wallet,
} from "lucide-react";
import { formatMoney } from "@/lib/invoicePayments";

const ICONS = {
  created: FileText,
  payment: Wallet,
  viewed: Eye,
  reminder: Send,
  voided: Ban,
  link: Link2Off,
  status_changed: RefreshCw,
};

const TONE = {
  payment: "bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-400",
  voided: "bg-ink-200 dark:bg-ink-700 text-ink-700 dark:text-ink-200",
  reminder: "bg-alert-50 dark:bg-alert-900/30 text-alert-700 dark:text-alert-400",
};
const DEFAULT_TONE =
  "bg-surface-sunken dark:bg-ink-700 text-content-body dark:text-content-subtle";

/** A refund is a payment of a negative amount, and should not read as income. */
const isRefund = (entry) => entry.kind === "payment" && Number(entry.amount) < 0;

export default function InvoiceTimeline({ entries = [] }) {
  if (!entries.length) {
    return (
      <p className="text-sm text-content-muted dark:text-content-subtle">
        Nothing recorded yet.
      </p>
    );
  }

  return (
    <ol className="space-y-4">
      {entries.map((entry, i) => {
        const Icon = ICONS[entry.kind] || RefreshCw;
        const tone = isRefund(entry) ? TONE.voided : TONE[entry.kind] || DEFAULT_TONE;
        return (
          <li key={`${entry.at}-${i}`} className="flex gap-3">
            <div className="flex flex-col items-center flex-shrink-0">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center ${tone}`}
              >
                <Icon className="w-4 h-4" />
              </span>
              {/* The connecting rule, omitted on the last entry so the list
                  does not trail off into nothing. */}
              {i < entries.length - 1 && (
                <span className="flex-1 w-px bg-line dark:bg-ink-700 mt-1" />
              )}
            </div>

            <div className="min-w-0 pb-1">
              <p className="text-sm font-semibold text-content dark:text-content-inverted">
                {isRefund(entry)
                  ? `Refund of ${formatMoney(Math.abs(entry.amount))}`
                  : entry.title}
              </p>
              <p className="text-xs text-content-muted dark:text-content-subtle mt-0.5">
                {safeDate(entry.at)}
                {entry.actor ? ` · ${entry.actor}` : ""}
              </p>
              {entry.detail && (
                <p className="text-xs text-content-body dark:text-ink-300 mt-1 break-words">
                  {entry.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Formatting that cannot throw.
 *
 * A timeline is assembled from half a dozen columns of varying provenance, and
 * one unparseable date must not take down the whole panel -- date-fns `format`
 * throws on an invalid date rather than returning a placeholder.
 */
function safeDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date not recorded";
  return format(d, "d MMM yyyy, HH:mm");
}
