import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CreditCard } from "lucide-react";

/** The Connect Stripe step. Connecting is the page's handleConnectStripe,
 * passed in untouched. */
export default function TourStripePanel({
  connectingStripe,
  handleConnectStripe,
  slide,
  stripeConnected,
}) {
  return <>
    {slide.inputFields === "stripe" && (
      <div className="mb-4 p-4 rounded-xl border border-ink-700 bg-ink-800">
        {stripeConnected ? (
          <div className="flex items-center gap-2 text-sm text-success-300 bg-success-900/30 border border-success-700 rounded-lg p-3">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span className="font-medium">
              Stripe account connected!
            </span>
          </div>
        ) : (
          <>
            <Button
              onClick={handleConnectStripe}
              disabled={connectingStripe}
              className="w-full bg-brand-700 hover:bg-brand text-content-inverted gap-2"
            >
              <CreditCard className="w-3.5 h-3.5" />
              {connectingStripe
                ? "Connecting..."
                : "Connect Stripe Account"}
            </Button>
            <p className="text-xs text-content-muted text-center mt-2">
              Redirected to Stripe for secure onboarding
            </p>
          </>
        )}
      </div>
    )}
    </>;
}
