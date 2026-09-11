import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { getProcessingFeePercent, getTransactionAllowance, isUnlimited } from "@/components/utils/permissions";

/** The current plan: name, status, allowance, usage, fee and next billing date. */
export default function CurrentPlanCard({
  subscription,
}) {
  return (
    <Card className="border-2 border-success-200 dark:border-success-800 bg-success-50/30 dark:bg-success-900/20">
      <CardContent className="mx-1 pt-0 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-2xl font-black text-content dark:text-content-inverted capitalize mb-1">
              {subscription.plan_name} Plan
            </h3>
            <p className="text-sm text-content-body dark:text-content-subtle capitalize">
              {subscription.billing_cycle === "yearly"
                ? "Annual"
                : "Monthly"}{" "}
              Billing
            </p>
          </div>
          <Badge
            className={`${
              subscription.status === "active"
                ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900"
                : subscription.status === "trial" ||
                    subscription.status === "trialing"
                  ? "bg-info-100 text-info-700 dark:bg-info-900 dark:text-info-300 hover:bg-info-100 dark:hover:bg-info-900"
                  : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
            }`}
          >
            {subscription.status === "trialing"
              ? "Trial"
              : subscription.status}
          </Badge>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-content-body dark:text-content-subtle">
              Invoice Limit
            </p>
            <p className="text-lg font-semibold text-content dark:text-content-inverted">
              {isUnlimited(subscription)
                ? "Unlimited"
                : `${getTransactionAllowance(subscription)} / month`}
            </p>
          </div>
          <div>
            <p className="text-sm text-content-body dark:text-content-subtle">
              Invoices Used This Month
            </p>
            <p className="text-lg font-semibold text-content dark:text-content-inverted">
              {subscription.transactions_used_this_month !==
                undefined &&
              subscription.transactions_used_this_month !==
                null ? (
                subscription.transactions_used_this_month
              ) : (
                <span className="text-danger-600 dark:text-danger-400">
                  Not Set
                </span>
              )}
            </p>
          </div>
          <div>
            <p className="text-sm text-content-body dark:text-content-subtle">
              Platform Processing Fee
            </p>
            <p className="text-lg font-semibold text-content dark:text-content-inverted">
              {getProcessingFeePercent(subscription)}%
            </p>
          </div>
        </div>

        {subscription.next_billing_date && (
          <div className="pt-4 border-t border-success-200 dark:border-success-800">
            <p className="text-sm text-content-body dark:text-content-subtle">
              Next Billing Date
            </p>
            <p className="font-medium text-content dark:text-content-inverted">
              {format(
                new Date(subscription.next_billing_date),
                "MMMM d, yyyy",
              )}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
