import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { createPageUrl } from "@/utils";

/** Cancel and the submit button. Submitting runs the page's handleSubmit, untouched. */
export default function QuoteFormActions({
  editMode,
  formData,
  loading,
  navigate,
  sendingNotifications,
}) {
  return (
    <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 pt-4 border-t border-line-subtle dark:border-ink-700">
      <Button
        type="button"
        variant="outline"
        onClick={() => navigate(createPageUrl("Quotes"))}
        className="w-full sm:flex-1 h-10 sm:h-11 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 font-medium text-sm"
        disabled={loading || sendingNotifications}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        disabled={
          loading ||
          sendingNotifications ||
          !formData.client_id ||
          formData.items.length === 0
        }
        className="w-full sm:flex-1 h-10 sm:h-11 bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted font-semibold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
      >
        {loading || sendingNotifications ? (
          <div className="flex items-center gap-2 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs sm:text-sm">
              {sendingNotifications
                ? "Sending..."
                : "Creating..."}
            </span>
          </div>
        ) : (
          <span className="flex items-center justify-center gap-2">
            {editMode ? "Update Quote" : "Create & Send Quote"}
            {!editMode && <CheckCircle className="w-4 h-4" />}
          </span>
        )}
      </Button>
    </div>
  );
}
