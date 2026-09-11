import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MessageSquare, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { format } from "date-fns";

const statusColors = {
  draft: "bg-ink-100 text-ink-800",
  sent: "bg-info-100 text-info-800",
  paid: "bg-success-100 text-success-800",
  overdue: "bg-danger-100 text-danger-800",
  cancelled: "bg-ink-100 text-content-body",
  // Struck through as well as greyed. Colour alone is not a status for a
  // contractor reading this in a van in daylight, and this is the one status
  // where mistaking it for "sent" means chasing money nobody owes.
  void: "bg-ink-200 text-ink-700 line-through dark:bg-ink-700 dark:text-ink-200",
};

/** The invoice's headline card: number, status, client, dates, total. */
export default function InvoiceSummaryCard({
  client,
  invoice,
}) {
  return (
    <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
      <CardContent className="p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-6 sm:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-2">
              {invoice.invoice_number}
            </h1>
            <Badge className={`${statusColors[invoice.status]}`}>
              {invoice.status}
            </Badge>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
              ${invoice.total.toFixed(2)}
            </p>
            <p className="text-sm text-content-body dark:text-content-subtle mt-1">
              Total Amount
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
          <div>
            <div className="flex items-center gap-2 text-content-body dark:text-content-subtle mb-2">
              <User className="w-4 h-4" />
              <span className="font-medium">Client</span>
            </div>
            <p className="text-base sm:text-lg font-semibold text-content dark:text-content-inverted">
              {invoice.client_name}
            </p>
            {client && (
              <>
                {client.email && (
                  <p className="text-sm text-content-body dark:text-ink-300 flex items-center gap-2 mt-1 break-all">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="break-all">{client.email}</span>
                  </p>
                )}
                {client.phone && (
                  <p className="text-sm text-content-body dark:text-ink-300 flex items-center gap-2 mt-1">
                    <MessageSquare className="w-3 h-3 flex-shrink-0" />
                    {client.phone}
                  </p>
                )}
              </>
            )}
          </div>

          <div>
            <div className="flex items-center gap-2 text-content-body dark:text-content-subtle mb-2">
              <Calendar className="w-4 h-4" />
              <span className="font-medium">Dates</span>
            </div>
            <p className="text-sm text-content-body dark:text-ink-300">
              <span className="font-medium text-content dark:text-content-inverted">
                Created:
              </span>{" "}
              {format(new Date(invoice.created_date), "MMM d, yyyy")}
            </p>
            {invoice.due_date && (
              <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                <span className="font-medium text-content dark:text-content-inverted">
                  Due:
                </span>{" "}
                {format(new Date(invoice.due_date), "MMM d, yyyy")}
              </p>
            )}
            {invoice.paid_date && (
              <p className="text-sm text-success-600 dark:text-success-400 mt-1">
                <span className="font-medium">Paid:</span>{" "}
                {format(new Date(invoice.paid_date), "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
