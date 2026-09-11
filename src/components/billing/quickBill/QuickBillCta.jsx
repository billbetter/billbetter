import React from "react";
import { ArrowRight, Check, Loader2, Mail, MessageSquare, Send, Wand2 } from "lucide-react";

/** The button at the bottom, which is a different button on each step:
 * Continue, Generate with AI, then Send or Save. */
export default function QuickBillCta({
  aiItems,
  aiLoading,
  canGenerate,
  creating,
  formatMoney,
  goNext,
  handleGenerate,
  handleSubmit,
  hasClient,
  isQuote,
  newClientEmail,
  photoFile,
  photoUrl,
  selectedClient,
  sendStatus,
  step,
  totalAmount,
}) {
  // Where this would go, and how. A client typed into step 0 has an email
  // and no phone; a client picked from the list may have either or both.
  const clientForSend = selectedClient || {
    email: newClientEmail,
    phone: null,
  };
  const canSend = !!(clientForSend.email || clientForSend.phone);
  const channelText =
    clientForSend.email && clientForSend.phone
      ? "email + SMS"
      : clientForSend.email
        ? "email"
        : clientForSend.phone
          ? "SMS"
          : "";
  const busyLabel =
    sendStatus === "sending"
      ? `Sending via ${channelText || "email"}...`
      : `Creating ${isQuote ? "quote" : "invoice"}...`;

  return (
    <div
      className="px-5 pt-3 bg-surface-sunken dark:bg-ink-800"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
    >
      {step === 0 && (
        <button
          onClick={goNext}
          disabled={!hasClient}
          className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base disabled:bg-ink-200 dark:disabled:bg-ink-800 disabled:text-content-subtle disabled:shadow-none active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2"
        >
          Continue
          <ArrowRight className="w-5 h-5" />
        </button>
      )}

      {step === 1 && (
        <button
          onClick={handleGenerate}
          disabled={!canGenerate || aiLoading}
          className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base disabled:text-content-subtle disabled:shadow-none active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2"
        >
          {aiLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {photoFile && !photoUrl
                ? "Uploading photo..."
                : "Reading the job..."}
            </>
          ) : (
            <>
              <Wand2 className="w-5 h-5" />
              Generate with AI
            </>
          )}
        </button>
      )}

      {step === 2 && creating && (
        <button
          disabled
          className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-center gap-2 opacity-90"
        >
          <Loader2 className="w-5 h-5 animate-spin" />
          {busyLabel}
        </button>
      )}

      {step === 2 && !creating && (
        <div className="space-y-2">
          <button
            onClick={() => handleSubmit(canSend)}
            disabled={aiItems.length === 0}
            className="w-full h-14 rounded-2xl bg-success-700 text-content-inverted font-bold text-base active:scale-[0.98] transition shadow-lg shadow-success-300/40 dark:shadow-success-900/30 flex items-center justify-between px-5 disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {canSend ? (
                <Send className="w-5 h-5" strokeWidth={2.5} />
              ) : (
                <Check className="w-5 h-5" strokeWidth={3} />
              )}
              {canSend
                ? `Send ${isQuote ? "quote" : "invoice"}`
                : `Save ${isQuote ? "quote" : "invoice"}`}
            </span>
            <span className="font-bold tabular-nums">
              {formatMoney(totalAmount)}
            </span>
          </button>

          {canSend ? (
            <div className="flex items-center justify-center gap-3">
              <div className="flex items-center gap-1 text-[11px] text-content-muted dark:text-content-subtle">
                {clientForSend.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    Email
                  </span>
                )}
                {clientForSend.email && clientForSend.phone && (
                  <span className="text-ink-300 dark:text-content-body dark:dark:text-ink-300">
                    ·
                  </span>
                )}
                {clientForSend.phone && (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="w-3 h-3" />
                    SMS
                  </span>
                )}
              </div>
              <span className="text-ink-300 dark:text-content-body text-[11px] dark:dark:text-ink-300">
                |
              </span>
              <button
                onClick={() => handleSubmit(false)}
                className="text-[11px] font-semibold text-content-muted dark:text-content-subtle active:text-success-600 transition"
              >
                Save as draft
              </button>
            </div>
          ) : (
            <p className="text-center text-[11px] text-content-subtle dark:text-content-muted">
              Add an email or phone to the client to send automatically
            </p>
          )}
        </div>
      )}
    </div>
  );
}
