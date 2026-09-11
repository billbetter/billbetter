import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Copy, DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { formatMoney } from "@/lib/invoicePayments";

/** The client payment link card. Generating a link is the page's
 * handleGeneratePaymentLink (Stripe), passed in untouched. */
export default function PaymentLinkCard({
  copyToClipboard,
  generatingPaymentLink,
  handleGeneratePaymentLink,
  invoice,
  publicInvoiceUrl,
  summary,
  voided,
}) {
  return <>
    {invoice.status !== "paid" && invoice.status !== "cancelled" && !voided && (
      <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
        <CardHeader className="border-b border-line dark:border-ink-700 bg-info-50 p-4 sm:p-6 dark:bg-info-900/20">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
            <DollarSign className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            Payment Link
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {/* No stored URL is shown, and none is offered for copying.
              A Checkout session dies after 24 hours, so a stored one is
              a link that works for a day and then sends the client to
              "You've either completed your payment or this checkout
              session has timed out". This card used to display exactly
              that URL under the words "Payment link is active".
              The button below mints a fresh session at the moment it is
              pressed, which is the same rule pay-public-invoice already
              follows for the client side. */}
          <div className="space-y-4">
            <p className="text-sm text-content-body dark:text-ink-300">
              Opens a Stripe checkout page for{" "}
              <strong>{formatMoney(summary.balance)}</strong> so you can
              take a card payment yourself — over the phone, or on your
              device with the client standing there.
            </p>
            <Button
              onClick={() => {
                // Opened synchronously, then pointed at the URL. A
                // window.open() after the await is blocked by every popup
                // blocker.
                const tab = window.open("", "_blank");
                handleGeneratePaymentLink(tab);
              }}
              disabled={generatingPaymentLink}
              className="w-full bg-brand hover:bg-brand-hover gap-2 h-11"
            >
              {generatingPaymentLink ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Opening checkout…
                </>
              ) : (
                <>
                  <ExternalLink className="w-4 h-4" />
                  Take a card payment
                </>
              )}
            </Button>

            {/* What to actually SEND. This one never expires, and it is
                the link the emails and texts already use. */}
            {publicInvoiceUrl && (
              <div className="pt-4 border-t border-line dark:border-ink-700">
                <p className="text-sm font-semibold text-content dark:text-content-inverted mb-1">
                  Sending it to your client instead?
                </p>
                <p className="text-xs text-content-muted dark:text-content-subtle mb-3">
                  Use the client link below — it never expires and lets
                  them pay whenever they open it. A checkout page copied
                  from here would stop working tomorrow.
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={publicInvoiceUrl}
                    readOnly
                    className="flex-1 px-3 py-2 text-xs sm:text-sm border border-line-strong dark:border-ink-600 rounded-lg bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
                  />
                  <Button
                    onClick={() => copyToClipboard(publicInvoiceUrl)}
                    variant="outline"
                    className="gap-2 w-full sm:w-auto"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )}
    </>;
}
