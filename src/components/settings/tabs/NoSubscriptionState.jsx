import React from "react";
import { Button } from "@/components/ui/button";
import { CreditCard } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

/** The Billing tab with no subscription: a pointer to the plans. */
export default function NoSubscriptionState() {
  return (
    <div className="text-center py-12 bg-surface dark:bg-surface-inverted rounded-lg border dark:border-ink-800">
      <CreditCard className="w-12 h-12 text-ink-300 dark:text-ink-700 mx-auto mb-4 dark:dark:text-ink-300" />
      <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
        No Active Subscription
      </h3>
      <p className="text-content-body dark:text-content-subtle mb-6">
        Choose a plan to start using Invoicium
      </p>
      <Link to={createPageUrl("Pricing")}>
        <Button className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover">
          View Pricing Plans
        </Button>
      </Link>
    </div>
  );
}
