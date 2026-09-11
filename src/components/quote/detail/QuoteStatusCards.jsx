import React from "react";
import { Building2, CheckCircle, ExternalLink, FileCheck, FileText, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createPageUrl } from "@/utils";

/** What to do next, given where the quote stands: convert an approved quote,
 * the client's decline, the linked invoice, and creating or viewing its job. */
export default function QuoteStatusCards({
  handleConvertToInvoice,
  handleCreateJob,
  navigate,
  quote,
  responseRecord,
}) {
  return (
    <>
    {quote.status === "approved" && !quote.linked_invoice_id && (
      <Card className="border-success-200 bg-success-50 border-none shadow-lg dark:border-success-800/50 dark:bg-success-900/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <CheckCircle className="w-6 h-6 text-success-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-success-900">
              {responseRecord?.byName
                ? "Approved by your client"
                : "Quote Approved"}
            </p>
            <p className="text-xs text-success-800">
              {responseRecord?.full || "No approval date on record."}
            </p>
          </div>
          <Button
            onClick={handleConvertToInvoice}
            size="sm"
            className="bg-brand hover:bg-brand-hover w-full sm:w-auto"
          >
            <FileText className="w-4 h-4 mr-2" />
            Convert to Invoice
          </Button>
        </CardContent>
      </Card>
    )}

    {/*
      The decline, with the same standing as the approval above.
      Deliberately neutral rather than danger-red: a client saying no is
      an ordinary commercial outcome, not a fault or an error, and this
      card is the contractor's record of it -- not an alert.
    */}
    {(quote.status === "declined" || quote.status === "rejected") && (
      <Card className="border-none shadow-lg bg-surface-sunken dark:bg-ink-800/50">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4">
          <XCircle className="w-6 h-6 text-content-muted dark:text-content-subtle flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-content dark:text-content-inverted">
              {responseRecord?.byName
                ? "Declined by your client"
                : "Quote Declined"}
            </p>
            <p className="text-xs text-content-body dark:text-content-subtle">
              {responseRecord?.full || "No decline date on record."}
            </p>
            {responseRecord?.reason && (
              <div className="mt-3 rounded-lg border border-line dark:border-ink-700 bg-surface dark:bg-ink-900 p-3">
                <p className="text-xs font-medium text-content-muted dark:text-content-subtle mb-1">
                  Reason given
                </p>
                <p className="text-sm text-content-body dark:text-content-subtle whitespace-pre-wrap">
                  {responseRecord.reason}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )}

    {quote.status === "converted" && quote.linked_invoice_id && (
      <Card className="border-accent-200 bg-accent-50 border-none shadow-lg dark:border-accent-800/50 dark:bg-accent-900/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <FileCheck className="w-6 h-6 text-accent-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-accent-900">
              Quote Converted to Invoice
            </p>
            <p className="text-xs text-accent-800">
              This quote has been converted to an invoice.
            </p>
          </div>
          <Button
            onClick={() =>
              navigate(
                createPageUrl("InvoiceDetail") +
                  `?id=${quote.linked_invoice_id}`,
              )
            }
            size="sm"
            variant="outline"
            className="border-accent-300 hover:bg-accent-100 w-full sm:w-auto dark:hover:bg-accent-900/30"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Invoice
          </Button>
        </CardContent>
      </Card>
    )}

    {!quote.job_id && quote.status !== "draft" && (
      <Card className="border-info-200 bg-info-50 border-none shadow-lg dark:border-info-800/50 dark:bg-info-900/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Building2 className="w-6 h-6 text-info-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-info-900">
              Create Job
            </p>
            <p className="text-xs text-info-800">
              Start a job from this quote
            </p>
          </div>
          <Button
            onClick={handleCreateJob}
            size="sm"
            variant="outline"
            className="border-info-300 hover:bg-info-100 w-full sm:w-auto dark:hover:bg-info-900/30"
          >
            <Building2 className="w-4 h-4 mr-2" />
            Create Job
          </Button>
        </CardContent>
      </Card>
    )}

    {quote.job_id && (
      <Card className="border-success-200 bg-success-50 border-none shadow-lg dark:border-success-800/50 dark:bg-success-900/20">
        <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <Building2 className="w-6 h-6 text-success-600 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-success-900">
              Job Created
            </p>
            <p className="text-xs text-success-800">
              A job has been created from this quote
            </p>
          </div>
          <Button
            onClick={() => navigate(createPageUrl("JobPhotos"))}
            size="sm"
            variant="outline"
            className="border-success-300 hover:bg-success-100 w-full sm:w-auto dark:hover:bg-success-900/30"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            View Job
          </Button>
        </CardContent>
      </Card>
    )}
    </>
  );
}
