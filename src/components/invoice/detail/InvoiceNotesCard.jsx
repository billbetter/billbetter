import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** The invoice's notes, when it has any. */
export default function InvoiceNotesCard({
  invoice,
}) {
  return <>
    {invoice.notes && (
      <Card className="border-none shadow-lg dark:bg-surface-inverted dark:border-ink-700">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg text-content dark:text-content-inverted">
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 pt-0">
          <p className="text-sm sm:text-base text-ink-700 dark:text-ink-300 whitespace-pre-wrap break-words">
            {invoice.notes}
          </p>
        </CardContent>
      </Card>
    )}
    </>;
}
