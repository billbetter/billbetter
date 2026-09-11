import React from "react";
import { AlertCircle, Loader2, Mail, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Choose email or SMS for an overdue reminder. The send itself is the
 * page's handleSendOverdueNotification, passed in untouched. */
export default function OverdueReminderDialog({
  handleSendOverdueNotification,
  notificationDialog,
  sendingNotification,
  setNotificationDialog,
}) {
  return (
    <Dialog
      open={notificationDialog.open}
      onOpenChange={(open) =>
        setNotificationDialog({ open, invoice: null })
      }
    >
      <DialogContent className="sm:max-w-sm rounded-2xl border border-line dark:border-ink-700 p-6 shadow-2xl dark:bg-ink-800">
        <DialogHeader className="space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-alert-100 flex items-center justify-center mx-auto shadow-sm dark:bg-alert-900/30">
            <AlertCircle className="w-7 h-7 text-alert-600 dark:text-alert-400" />
          </div>
          <DialogTitle className="text-center text-xl font-bold text-content dark:text-content-inverted">
            Send Reminder
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-content-muted dark:text-content-subtle leading-relaxed">
            Notify{" "}
            <span className="font-bold text-content dark:text-content-inverted">
              {notificationDialog.invoice?.client_name}
            </span>{" "}
            about their overdue payment
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 mt-8">
          <Button
            onClick={() =>
              handleSendOverdueNotification(
                notificationDialog.invoice,
                "email",
              )
            }
            disabled={
              sendingNotification === notificationDialog.invoice?.id
            }
            className="w-full h-12 text-sm font-semibold bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover text-content-inverted rounded-xl shadow-lg shadow-brand-200 dark:shadow-brand-900/30"
          >
            {sendingNotification === notificationDialog.invoice?.id ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <Mail className="w-5 h-5 mr-2" />
            )}
            Send via Email
          </Button>

          <Button
            onClick={() =>
              handleSendOverdueNotification(
                notificationDialog.invoice,
                "sms",
              )
            }
            disabled={
              sendingNotification === notificationDialog.invoice?.id
            }
            variant="outline"
            className="w-full h-12 text-sm font-semibold border-line dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300 rounded-xl hover:bg-surface-sunken dark:hover:bg-ink-700"
          >
            {sendingNotification === notificationDialog.invoice?.id ? (
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            ) : (
              <MessageSquare className="w-5 h-5 mr-2" />
            )}
            Send via SMS
          </Button>

          <Button
            variant="ghost"
            onClick={() =>
              setNotificationDialog({ open: false, invoice: null })
            }
            className="w-full h-12 text-sm font-semibold hover:bg-ink-100 dark:hover:bg-ink-700 dark:text-ink-300 rounded-xl"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
