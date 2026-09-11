import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** The quote's notes, when it has any. */
export default function QuoteNotesCard({
  quote,
}) {
  return <>
    {quote.notes && (
      <Card className="border-none shadow-lg">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Notes</CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <p className="text-sm sm:text-base text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words">
            {quote.notes}
          </p>
        </CardContent>
      </Card>
    )}
    </>;
}
