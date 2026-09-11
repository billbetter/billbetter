import React from "react";
import { Badge } from "@/components/ui/badge";
import { Calendar, Mail, MessageSquare, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { statusColors, statusIcons } from "@/components/quote/detail/quoteDetailStatus";
import { formatCalendarDay } from "@/lib/calendarDate";

/** The quote's headline card: number, status and response, client, dates, total. */
export default function QuoteSummaryCard({
  client,
  quote,
  responseRecord,
}) {
  return (
    <Card className="border-none shadow-lg">
      <CardContent className="p-4 sm:p-8">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-0 mb-6 sm:mb-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl font-black text-content dark:text-content-inverted mb-2">
              Quote {quote.quote_number}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                className={`${statusColors[quote.status]} flex items-center gap-1.5`}
              >
                {statusIcons[quote.status]}
                <span className="capitalize">{quote.status}</span>
              </Badge>
              {responseRecord && (
                <span className="text-sm text-content-body dark:text-content-subtle">
                  {responseRecord.short}
                </span>
              )}
            </div>
          </div>
          <div className="text-left sm:text-right w-full sm:w-auto">
            <p className="text-2xl sm:text-3xl font-bold text-content dark:text-content-inverted">
              ${quote.total?.toFixed(2)}
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
              {quote.client_name}
            </p>
            {client && (
              <>
                {client.email && (
                  <p className="text-sm text-content-body dark:text-content-subtle flex items-center gap-2 mt-1 break-all">
                    <Mail className="w-3 h-3 flex-shrink-0" />
                    <span className="break-all">{client.email}</span>
                  </p>
                )}
                {client.phone && (
                  <p className="text-sm text-content-body dark:text-content-subtle flex items-center gap-2 mt-1">
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
              <span className="font-medium">Issued:</span>{" "}
              {formatCalendarDay(quote.date_issued, "MMM d, yyyy")}
            </p>
            {quote.expiry_date && (
              <p className="text-sm text-content-body dark:text-ink-300 mt-1">
                <span className="font-medium">Expires:</span>{" "}
                {formatCalendarDay(quote.expiry_date, "MMM d, yyyy")}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
