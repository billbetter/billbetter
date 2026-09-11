import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreditCard } from "lucide-react";

/** Saved cards on the subscription, when there are any. */
export default function PaymentMethodsCard({
  billingHistory,
}) {
  return <>
    {billingHistory.payment_methods.length > 0 && (
      <Card className="border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-content dark:text-content-inverted">
            <CreditCard className="w-5 h-5 text-content-body dark:text-content-subtle" />
            Payment Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {billingHistory.payment_methods.map((pm) => (
              <div
                key={pm.id}
                className="flex items-center justify-between p-4 border dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800/50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ink-100 dark:bg-ink-700 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-content-body dark:text-content-subtle" />
                  </div>
                  <div>
                    <p className="font-medium text-content dark:text-content-inverted capitalize">
                      {pm.brand} •••• {pm.last4}
                    </p>
                    <p className="text-sm text-content-muted dark:text-content-subtle">
                      Expires {pm.exp_month}/{pm.exp_year}
                    </p>
                  </div>
                </div>
                {pm.is_default && (
                  <Badge className="bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900">
                    Default
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </>;
}
