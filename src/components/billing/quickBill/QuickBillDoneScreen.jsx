import React from "react";
import { Check, Send } from "lucide-react";
import { SHELL_POSITION } from "@/components/billing/quickBill/shell";

/** The last screen: what was saved or sent, for how much, to whom. */
export default function QuickBillDoneScreen({
  didSend,
  formatMoney,
  isQuote,
  newClientName,
  selectedClient,
  totalAmount,
}) {
  const clientName = selectedClient?.name || newClientName;
  const noun = isQuote ? "Quote" : "Invoice";
  const title = didSend ? `${noun} sent` : `${noun} saved`;
  const Icon = didSend ? Send : Check;
  return (
    <div
      className={`${SHELL_POSITION} z-[80] bg-surface dark:bg-surface-inverted-deep flex items-center justify-center px-6`}
    >
      <div className="flex flex-col items-center gap-6">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-success-400/30 blur-2xl scale-150 animate-pulse" />
          <div className="relative w-24 h-24 rounded-full bg-success-500 flex items-center justify-center shadow-2xl shadow-success-300/50 dark:shadow-success-900/50">
            <Icon
              className="w-12 h-12 text-content-inverted"
              strokeWidth={2.5}
            />
          </div>
        </div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-content dark:text-content-inverted">
            {title}
          </h2>
          <p className="text-content-muted dark:text-content-subtle mt-1.5 text-base">
            {formatMoney(totalAmount)} · {clientName}
          </p>
        </div>
      </div>
    </div>
  );
}
