import React from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createPageUrl } from "@/utils";
import { getTransactionAllowance, isUnlimited } from "@/components/utils/permissions";

/** Shown when the plan's monthly invoice allowance is used up; offers the upgrade. */
export default function LimitReachedDialog({
  navigate,
  setShowLimitReached,
  showLimitReached,
  subscription,
}) {
  return (
    <Dialog open={showLimitReached} onOpenChange={setShowLimitReached}>
      <DialogContent className="sm:max-w-md border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-danger-600 dark:text-danger-400">
            <div className="w-10 h-10 rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-6 h-6" />
            </div>
            Monthly Limit Reached
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-ink-100 dark:bg-ink-800 rounded-xl p-4 border border-line dark:border-ink-700">
            <p className="text-content dark:text-ink-100 font-semibold mb-2">
              You've reached your monthly transaction limit
            </p>
            <p className="text-sm text-content-body dark:text-content-subtle">
              You've used{" "}
              <strong className="text-content dark:text-ink-50">
                {subscription?.transactions_used_this_month || 0}
              </strong>{" "}
              of{" "}
              <strong className="text-content dark:text-ink-50">
                {isUnlimited(subscription)
                  ? "unlimited"
                  : getTransactionAllowance(subscription)}
              </strong>{" "}
              transactions this month.
            </p>
          </div>
          <Button
            onClick={() => {
              setShowLimitReached(false);
              navigate(createPageUrl("Pricing"));
            }}
            className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted shadow-lg h-11"
          >
            Upgrade Your Plan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
