import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { format } from "date-fns";

export default function InvoicePreview({ invoice, settings }) {
  return (
    <Card className="border-none shadow-lg dark:!bg-surface">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Preview
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="border-b pb-4">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-2xl font-bold text-content">INVOICE</h3>
              {settings?.business_name && (
                <p className="text-sm text-content-body mt-1">
                  {settings.business_name}
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-content-body">Invoice #</p>
              <p className="font-medium">Draft</p>
            </div>
          </div>

          {invoice.client_name && (
            <div>
              <p className="text-sm text-content-body mb-1">Bill To:</p>
              <p className="font-medium">{invoice.client_name}</p>
              {invoice.client_email && (
                <p className="text-sm text-content-body">
                  {invoice.client_email}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <div className="space-y-2 mb-4">
            {invoice.items.map((item, index) => (
              <div key={index} className="flex justify-between text-sm">
                <div className="flex-1">
                  <p className="font-medium text-content">
                    {item.description || "Item description"}
                  </p>
                  <p className="text-content-body text-xs">
                    {item.quantity} × ${item.rate.toFixed(2)}
                  </p>
                </div>
                <p className="font-medium">${item.amount.toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <p className="text-content-body">Subtotal</p>
              <p className="font-medium">${invoice.subtotal.toFixed(2)}</p>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex justify-between text-sm">
                <p className="text-content-body">Tax ({invoice.tax_rate}%)</p>
                <p className="font-medium">${invoice.tax_amount.toFixed(2)}</p>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <p>Total</p>
              <p>${invoice.total.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {invoice.due_date && (
          <div className="text-sm">
            <p className="text-content-body">Due Date</p>
            <p className="font-medium">
              {format(new Date(invoice.due_date), "MMMM d, yyyy")}
            </p>
          </div>
        )}

        {invoice.notes && (
          <div className="text-sm">
            <p className="text-content-body mb-1">Notes</p>
            <p className="text-ink-700">{invoice.notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
