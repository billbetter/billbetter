import React from "react";
import { Info } from "lucide-react";

/**
 * Where prefilled figures came from.
 * Worth saying out loud rather than leaving the numbers to
 * speak for themselves: quote figures are ones the client
 * has already been shown and often agreed, so editing them
 * means sending something different from what they
 * approved. Job figures are a fresh calculation from hours
 * and materials and carry no such promise. The contractor
 * should know which they are looking at before sending.
 */
export default function PrefillSourceNotice({ prefillData }) {
  return (
    prefillData?.prefill_source === "quote" ? (
      <div className="flex items-start gap-2 rounded-lg border border-info-200 bg-info-50 p-3 text-sm dark:border-info-800 dark:bg-info-900/20">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info-700 dark:text-info-300" />
        <p className="text-info-800 dark:text-info-200">
          These lines came from the job&apos;s quote — the
          figures your client was shown. Change them and the
          invoice will no longer match the quote.
        </p>
      </div>
    ) : prefillData?.prefill_source === "plan" ? (
      <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-sunken p-3 text-sm dark:border-ink-700 dark:bg-ink-800/50">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-body dark:text-content-subtle" />
        <p className="text-content-body dark:text-content-subtle">
          One stage of a payment plan. The stage is marked
          released once this invoice is saved.
        </p>
      </div>
    ) : prefillData?.prefill_source === "job" ? (
      <div className="flex items-start gap-2 rounded-lg border border-line bg-surface-sunken p-3 text-sm dark:border-ink-700 dark:bg-ink-800/50">
        <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-content-body dark:text-content-subtle" />
        <p className="text-content-body dark:text-content-subtle">
          Worked out from the job&apos;s hours and materials.
          Check it before sending.
        </p>
      </div>
    ) : null
  );
}
