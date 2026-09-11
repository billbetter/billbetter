import React from "react";
import { AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** What happened when the quote was resent: per-channel success or the
 * reason it failed, plus the PDF link to copy. */
export default function QuoteNotificationResultDialog({
  client,
  copyToClipboard,
  notificationResult,
  quote,
  setNotificationResult,
}) {
  return <>
    {notificationResult && (
      <Dialog open={true} onOpenChange={() => setNotificationResult(null)}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle className="text-center">
              Notification Status
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-4">
            {!notificationResult.hasPdf ? (
              <div className="p-4 bg-caution-50 rounded-lg border border-caution-200 dark:bg-caution-900/20 dark:border-caution-800/50">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-caution-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-caution-800">
                      No PDF Available
                    </p>
                    <p className="text-sm text-caution-700 mt-1">
                      This quote doesn't have a PDF yet. Please regenerate to
                      create a PDF before sending notifications.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* SMS Status */}
                <div className="p-3 bg-surface rounded-lg border dark:bg-surface-inverted">
                  <div className="flex items-start gap-2">
                    {notificationResult.sms ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-content dark:text-content-inverted">
                            SMS Sent Successfully
                          </p>
                          <p className="text-sm text-content-body dark:text-ink-300">
                            Text message with PDF link delivered
                          </p>
                        </div>
                      </>
                    ) : notificationResult.hasPhone ? (
                      <>
                        <AlertCircle className="w-5 h-5 text-caution-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-caution-800">
                            SMS Not Sent
                          </p>
                          <p className="text-sm text-caution-700 mb-2">
                            {notificationResult.smsError ||
                              "Failed to send SMS"}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-line-strong flex-shrink-0 mt-0.5 dark:border-ink-600" />
                        <div>
                          <p className="font-medium text-content-body dark:text-ink-300">
                            No Phone Number
                          </p>
                          <p className="text-sm text-content-muted">
                            Add a phone number to the client to send SMS
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Email Status */}
                <div className="p-3 bg-surface rounded-lg border dark:bg-surface-inverted">
                  <div className="flex items-start gap-2">
                    {notificationResult.email ? (
                      <>
                        <CheckCircle className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-content dark:text-content-inverted">
                            Email Sent Successfully
                          </p>
                          <p className="text-sm text-content-body dark:text-ink-300">
                            Email delivered to {client?.email}
                          </p>
                        </div>
                      </>
                    ) : notificationResult.hasEmail ? (
                      <>
                        <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-danger-800">
                            Email Not Sent
                          </p>
                          <p className="text-sm text-danger-700">
                            {notificationResult.emailError}
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-5 h-5 rounded-full border-2 border-line-strong flex-shrink-0 mt-0.5 dark:border-ink-600" />
                        <div>
                          <p className="font-medium text-content-body dark:text-ink-300">
                            No Email Address
                          </p>
                          <p className="text-sm text-content-muted">
                            Add an email to the client to send notifications
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          {quote.pdf_url && (
            <Button
              onClick={() => copyToClipboard(quote.pdf_url)}
              variant="outline"
              className="w-full"
            >
              📋 Copy PDF Link to Share
            </Button>
          )}

          <Button
            onClick={() => setNotificationResult(null)}
            className="w-full"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    )}
    </>;
}
