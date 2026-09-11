import React from "react";
import { ArrowRight, Calendar as CalendarIcon, Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { addDays, format } from "date-fns";
import { initials } from "@/components/billing/quickBill/initials";

/** Step 2: what the AI came back with -- total, due date, line items to
 * edit, its note, and who it is billed to. */
export default function ReviewStep({
  addBlankItem,
  aiItems,
  aiNotes,
  dueDate,
  formatMoney,
  isQuote,
  newClientEmail,
  newClientName,
  removeItem,
  selectedClient,
  setDueDate,
  setStep,
  totalAmount,
  updateItem,
}) {
  return (
    <div className="w-full flex-shrink-0 overflow-y-auto px-5 pb-6">
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[11px] font-bold uppercase tracking-widest text-success-600 dark:text-success-400">
          {isQuote ? "Quote review" : "Checkout"}
        </span>
        <div className="flex items-center gap-1 text-[11px] text-content-subtle">
          <Lock className="w-3 h-3" />
          Secure draft
        </div>
      </div>
      <h1 className="text-3xl font-bold text-content dark:text-content-inverted tracking-tight mt-1">
        {isQuote ? "Send quote" : "Send invoice"}
      </h1>

      {/* Total card */}
      <div className="mt-5 rounded-3xl bg-success-700 p-6 text-content-inverted shadow-xl shadow-success-200/50 dark:shadow-success-900/30 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-surface/10 blur-2xl dark:bg-surface-inverted/10" />
        <div className="absolute -bottom-16 -left-12 w-44 h-44 rounded-full bg-accent-300/20 blur-2xl" />
        <div className="relative">
          <p className="text-[11px] font-bold uppercase tracking-widest text-success-100">
            {isQuote ? "Estimate total" : "Total due"}
          </p>
          <p className="mt-2 text-5xl font-bold tracking-tight tabular-nums leading-none">
            {formatMoney(totalAmount)}
          </p>
          <label className="mt-4 flex items-center justify-between text-sm gap-3 cursor-pointer group/date">
            <span className="text-success-50/80 flex items-center gap-1.5">
              <CalendarIcon className="w-3.5 h-3.5" />
              {isQuote ? "Valid through" : "Due date"}
            </span>
            <span className="relative">
              <span className="font-semibold text-content-inverted underline decoration-success-200/40 underline-offset-4 group-hover/date:decoration-white transition">
                {dueDate
                  ? format(new Date(dueDate + "T00:00:00"), "MMM d, yyyy")
                  : "Pick a date"}
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="absolute inset-0 opacity-0 cursor-pointer w-full"
                aria-label={isQuote ? "Expiry date" : "Due date"}
              />
            </span>
          </label>

          {/* Quick date presets */}
          <div className="mt-3 flex gap-1.5 flex-wrap">
            {[7, 14, 30, 60].map((days) => {
              const presetDate = format(
                addDays(new Date(), days),
                "yyyy-MM-dd",
              );
              const isActive = dueDate === presetDate;
              return (
                <button
                  key={days}
                  type="button"
                  onClick={() => setDueDate(presetDate)}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition ${
                    isActive
                      ? "bg-surface text-success-700"
                      : "bg-surface/15 text-content-inverted hover:bg-surface/25"
                  }`}
                >
                  {days}d
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="mt-4 rounded-2xl bg-surface dark:bg-surface-inverted border border-line-subtle dark:border-ink-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-line-subtle dark:border-ink-800 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">
            Line items
          </span>
          <button
            onClick={() => setStep(1)}
            className="text-xs font-semibold text-success-600 dark:text-success-400 active:opacity-60"
          >
            Regenerate
          </button>
        </div>
        <div className="divide-y divide-line-subtle dark:divide-ink-800">
          {aiItems.map((item, idx) => (
            <div key={idx} className="p-4 space-y-2.5">
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={item.description}
                  onChange={(e) =>
                    updateItem(idx, "description", e.target.value)
                  }
                  className="flex-1 bg-transparent text-sm font-semibold text-content dark:text-content-inverted focus:outline-none"
                  placeholder="Description"
                />
                <button
                  onClick={() => removeItem(idx)}
                  className="w-7 h-7 flex items-center justify-center rounded-full text-ink-300 active:bg-danger-50 active:text-danger-500 dark:active:bg-danger-900/20 transition"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(
                      idx,
                      "quantity",
                      parseFloat(e.target.value) || 0,
                    )
                  }
                  className="w-16 h-9 px-2 rounded-lg bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-success-500"
                />
                <span className="text-content-subtle">×</span>
                <div className="relative flex-1 max-w-[110px]">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-content-subtle text-sm">
                    $
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    value={item.rate}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        "rate",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-full h-9 pl-5 pr-2 rounded-lg bg-surface-sunken dark:bg-ink-800 border border-line-subtle dark:border-ink-700 tabular-nums focus:outline-none focus:ring-1 focus:ring-success-500"
                  />
                </div>
                <span className="ml-auto text-sm font-bold text-content dark:text-content-inverted tabular-nums">
                  {formatMoney(item.amount)}
                </span>
              </div>
            </div>
          ))}
          <button
            onClick={addBlankItem}
            className="w-full px-4 py-3 text-sm font-semibold text-success-600 dark:text-success-400 flex items-center justify-center gap-1.5 active:bg-surface-sunken dark:active:bg-ink-800/50 transition"
          >
            <Plus className="w-4 h-4" />
            Add line item
          </button>
        </div>
        <div className="px-4 py-3 border-t border-line-subtle dark:border-ink-800 flex items-center justify-between bg-surface-sunken/60 dark:bg-ink-800/30">
          <span className="text-sm font-bold text-content dark:text-content-inverted">
            Total
          </span>
          <span className="text-base font-bold text-content dark:text-content-inverted tabular-nums">
            {formatMoney(totalAmount)}
          </span>
        </div>
      </div>

      {/* AI notes */}
      {aiNotes && (
        <div className="mt-3 px-4 py-3 rounded-xl bg-success-50 dark:bg-success-900/20 border border-success-100 dark:border-success-900/40">
          <p className="text-[11px] font-bold uppercase tracking-widest text-success-700 dark:text-success-300 mb-1">
            AI note
          </p>
          <p className="text-sm text-success-900 dark:text-success-100">
            {aiNotes}
          </p>
        </div>
      )}

      {/* Bill-to */}
      <button
        onClick={() => setStep(0)}
        className="mt-3 w-full rounded-2xl bg-surface dark:bg-surface-inverted border border-line-subtle dark:border-ink-800 p-4 flex items-center gap-3 active:bg-surface-sunken dark:active:bg-ink-800/50 transition text-left"
      >
        <div className="w-11 h-11 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center font-bold text-sm text-content-body dark:text-ink-300 flex-shrink-0">
          {initials(selectedClient?.name || newClientName)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest text-content-subtle">
            {isQuote ? "Quote for" : "Bill to"}
          </p>
          <p className="font-semibold text-content dark:text-content-inverted truncate">
            {selectedClient?.name || newClientName}
          </p>
          {(selectedClient?.email || newClientEmail) && (
            <p className="text-xs text-content-muted dark:text-content-subtle truncate">
              {selectedClient?.email || newClientEmail}
            </p>
          )}
        </div>
        <ArrowRight className="w-4 h-4 text-ink-300 flex-shrink-0" />
      </button>

      <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-content-subtle dark:text-content-muted">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Saved as draft · You can edit before sending</span>
      </div>
    </div>
  );
}
