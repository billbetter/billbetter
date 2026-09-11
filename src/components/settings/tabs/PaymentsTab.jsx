import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { TabsContent } from "@/components/ui/tabs";

/** Stripe Connect status and fees. Connect, refresh and disconnect are the
 * page's own handlers, passed in untouched. */
export default function PaymentsTab({
  checkStripeAccountStatus,
  connectingStripe,
  disconnectingStripe,
  handleConnectStripe,
  handleDisconnectStripe,
  settings,
}) {
  return (
    <TabsContent value="payments">
      <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
            <CreditCard className="w-5 h-5" />
            Payment Settings
          </CardTitle>
          <p className="text-sm text-content-body dark:text-content-subtle">
            Connect your Stripe account to receive payments from
            clients
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stripe Connection Status */}
          <div className="p-6 border-2 rounded-lg dark:border-ink-700 bg-surface dark:bg-ink-800/50">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-brand-100 dark:bg-brand-900/50 flex items-center justify-center">
                  <CreditCard className="w-6 h-6 text-brand-600 dark:text-brand-400" />
                </div>
                <div>
                  <h3 className="font-black text-content dark:text-content-inverted">
                    Stripe Account
                  </h3>
                  <p className="text-sm text-content-body dark:text-content-subtle">
                    Accept credit card payments online
                  </p>
                </div>
              </div>
              {settings?.stripe_account_status === "active" && (
                <CheckCircle className="w-6 h-6 text-success-600 dark:text-success-400" />
              )}
            </div>

            {settings?.stripe_account_status === "active" ? (
              <div className="space-y-4">
                <div className="p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <p className="text-sm text-success-800 dark:text-success-200 font-medium flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Your Stripe account is connected and active!
                  </p>
                  <p className="text-xs text-success-700 dark:text-success-300 mt-1">
                    You can now send payment links to clients and
                    receive payments directly.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleConnectStripe}
                    disabled={connectingStripe}
                    className="flex-1 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                  >
                    {connectingStripe ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Manage
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={checkStripeAccountStatus}
                    className="flex-1 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                  >
                    Refresh
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleDisconnectStripe}
                    disabled={disconnectingStripe}
                    className="flex-1 text-danger-600 dark:text-danger-400 hover:text-danger-700 dark:hover:text-danger-300 border-danger-300 dark:border-danger-800"
                  >
                    {disconnectingStripe ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      "Disconnect"
                    )}
                  </Button>
                </div>
              </div>
            ) : settings?.stripe_account_status === "pending" ? (
              <div className="space-y-4">
                <div className="p-4 bg-caution-50 dark:bg-caution-900/20 border border-caution-200 dark:border-caution-800 rounded-lg">
                  <p className="text-sm text-caution-800 dark:text-caution-200 font-medium">
                    Stripe account setup in progress
                  </p>
                  <p className="text-xs text-caution-700 dark:text-caution-300 mt-1">
                    Complete your Stripe onboarding to start accepting
                    payments.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  className="w-full bg-brand-600 hover:bg-brand dark:bg-brand dark:hover:bg-brand-hover"
                >
                  {connectingStripe ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Opening Stripe...
                    </>
                  ) : (
                    "Complete Stripe Setup"
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-brand-50 dark:bg-brand-900/20 border border-info-200 dark:border-info-800 rounded-lg">
                  <p className="text-sm text-info-800 dark:text-info-200 mb-2">
                    <strong>Why connect Stripe?</strong>
                  </p>
                  <ul className="text-xs text-brand-800 dark:text-brand-300 space-y-1">
                    <li>
                      • Generate payment links for your invoices
                    </li>
                    <li>
                      • Accept credit and debit card payments online
                    </li>
                    <li>
                      • Automatic payment tracking and invoice updates
                    </li>
                    <li>
                      • Receive payouts directly to your bank account
                    </li>
                    <li>
                      • Only 1% platform fee + Stripe's standard rates
                    </li>
                  </ul>
                </div>

                <Button
                  type="button"
                  onClick={handleConnectStripe}
                  disabled={connectingStripe}
                  className="w-full bg-brand-600 hover:bg-brand"
                >
                  {connectingStripe ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4 mr-2" />
                      Connect Stripe Account
                    </>
                  )}
                </Button>

                <p className="text-xs text-content-muted dark:text-content-subtle text-center">
                  You'll be redirected to Stripe to complete the
                  secure onboarding process
                </p>
              </div>
            )}
          </div>

          {/* Payment Information */}
          <div className="p-4 bg-surface-sunken dark:bg-ink-800 rounded-lg border dark:border-ink-700">
            <h4 className="font-semibold text-content dark:text-content-inverted mb-3">
              Payment Processing Fees
            </h4>
            <div className="space-y-2 text-sm text-ink-700 dark:text-ink-300">
              <div className="flex justify-between">
                <span>Invoicium Platform Fee:</span>
                <span className="font-medium">1%</span>
              </div>
              <div className="flex justify-between">
                <span>Stripe Processing Fee:</span>
                <span className="font-medium">2.9% + $0.30</span>
              </div>
              <div className="pt-2 border-t dark:border-ink-700 flex justify-between font-semibold text-content dark:text-content-inverted">
                <span>Total Fees:</span>
                <span>~3.9% + $0.30 per transaction</span>
              </div>
            </div>
            <p className="text-xs text-content-body dark:text-content-subtle mt-3">
              Example: For a $100 invoice, you receive ~$96.10 after
              fees
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
