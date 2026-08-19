import React from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Sparkles, Lock, ArrowRight, CheckCircle } from "lucide-react";

/**
 * Dialog shown when free plan users hit the 10 document limit
 * or try to access locked features
 */
export default function FreePlanLimitDialog({
  isOpen,
  onClose,
  type = "limit",
}) {
  const navigate = useNavigate();

  const handleStartTrial = () => {
    onClose();
    navigate(createPageUrl("Pricing"));
  };

  const isFeatureLocked = type === "feature";
  const isDocumentLimit = type === "limit";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            {isFeatureLocked ? (
              <div className="w-16 h-16 rounded-full bg-warning-100 flex items-center justify-center dark:bg-warning-900/30">
                <Lock className="w-8 h-8 text-warning-600" />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center dark:bg-success-900/30">
                <Sparkles className="w-8 h-8 text-success-600" />
              </div>
            )}
          </div>
          <DialogTitle className="text-center text-2xl">
            {isFeatureLocked
              ? "Premium Feature Locked"
              : "You've Hit Your Free Plan Limit"}
          </DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {isFeatureLocked ? (
              <span>
                This feature is available on paid plans. Start your{" "}
                <strong>7-day free trial</strong> to unlock it and explore
                everything Invoicium has to offer.
              </span>
            ) : (
              <span>
                You've created 10 documents on the Free plan. Start your{" "}
                <strong>7-day free trial</strong> to continue creating invoices
                and quotes, plus unlock premium features.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-4">
          <h3 className="font-semibold text-content text-center mb-4 dark:text-content-inverted">
            ✨ Unlock with a 7-Day Free Trial:
          </h3>
          <div className="grid gap-3">
            <div className="flex items-start gap-3 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-content dark:text-content-inverted">
                  Unlimited Documents
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Create as many invoices and quotes as you need
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-content dark:text-content-inverted">
                  AI-Assisted Creation
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Generate invoices faster with AI suggestions
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-content dark:text-content-inverted">
                  Client Approval Workflows
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Send quotes for one-click client approval
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-content dark:text-content-inverted">
                  Online Payments
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Get paid faster with integrated Stripe payments
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-surface-sunken rounded-lg dark:bg-ink-800">
              <CheckCircle className="w-5 h-5 text-success-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-content dark:text-content-inverted">
                  Recurring Invoices & More
                </p>
                <p className="text-sm text-content-body dark:text-ink-300">
                  Automate billing and access advanced analytics
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-auto border-line-strong dark:border-ink-600"
          >
            Stay on Free Plan
          </Button>
          <Button
            onClick={handleStartTrial}
            className="w-full sm:w-auto bg-brand hover:bg-brand-hover text-content-inverted font-bold"
          >
            Start 7-Day Free Trial
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </DialogFooter>

        <p className="text-xs text-center text-content-muted mt-4">
          Cancel anytime during the trial. No credit card required.
        </p>
      </DialogContent>
    </Dialog>
  );
}
