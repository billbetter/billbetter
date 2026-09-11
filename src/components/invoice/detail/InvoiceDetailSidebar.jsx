import React from "react";
import { Ban, History } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import InvoiceTimeline from "@/components/invoice/InvoiceTimeline";
import PublicLinkControls from "@/components/invoice/PublicLinkControls";

/** Side column: sharing controls (or the void notice) and the history timeline. */
export default function InvoiceDetailSidebar({
  invoice,
  loadInvoiceData,
  timeline,
  voided,
}) {
  return (
    <div className="lg:col-span-1 space-y-6">
      {/*
        The hosted invoice page a client actually opens. Distinct from the
        Payment Link card above: that one is a Stripe Checkout URL, which
        expires after 24 hours and does nothing but take money. This link
        never expires, shows the invoice itself, and mints the Checkout
        session at the moment the client clicks Pay.
      */}
      {voided ? (
        /* Not PublicLinkControls. That component offers Restore, which
           clears public_link_revoked_at -- and voiding sets exactly that
           field to kill the link. Leaving the control there would put an
           "undo" next to a one-way door. Payment would still be refused by
           buildInvoiceCheckoutSession, but the client would be looking at a
           live page for an invoice that no longer exists. */
        <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
          <CardHeader className="border-b border-line dark:border-ink-700 p-4 sm:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
              <Ban className="w-5 h-5 text-content-body dark:text-ink-300" />
              Client link
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6">
            <p className="text-sm text-content-body dark:text-ink-300">
              Switched off when this invoice was voided. Anyone opening the
              link they were sent now sees that it is no longer available.
            </p>
          </CardContent>
        </Card>
      ) : (
        <PublicLinkControls
          document={invoice}
          kind="invoice"
          onChange={loadInvoiceData}
        />
      )}

      {/* Everything that has happened to this invoice.
          Most of it is derived from columns the invoice already carries --
          see invoiceTimeline -- which is why this is populated for
          invoices that existed long before any history was stored. */}
      <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
        <CardHeader className="border-b border-line dark:border-ink-700 p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg text-content dark:text-content-inverted">
            <History className="w-5 h-5 text-content-body dark:text-content-subtle" />
            History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          <InvoiceTimeline entries={timeline} />
        </CardContent>
      </Card>
    </div>
  );
}
