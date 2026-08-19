import React from "react";
import { Card, CardContent } from "@/components/ui/card";

export default function CustomTemplatePreview({ config, settings }) {
  const {
    show_logo = true,
    show_company_address = true,
    show_client_address = true,
    show_invoice_details = true,
    show_payment_info = true,
    show_notes = true,
    header_style = "modern",
    layout_style = "two-column",
    accent_color = "#10b981",
    secondary_color = "#6b7280",
  } = config || {};

  const sampleInvoice = {
    invoice_number: "INV-001",
    client_name: "Sample Client",
    client_email: "client@example.com",
    client_phone: "+1 (555) 123-4567",
    client_address: "123 Client St, City, Province A1B 2C3",
    created_date: new Date().toISOString(),
    due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    items: [
      { description: "Service Item 1", quantity: 2, rate: 50, amount: 100 },
      { description: "Service Item 2", quantity: 1, rate: 75, amount: 75 },
    ],
    subtotal: 175,
    tax_rate: 13,
    tax_amount: 22.75,
    total: 197.75,
    notes: "Thank you for your business!",
  };

  const getHeaderClass = () => {
    switch (header_style) {
      case "classic":
        return "border-b-4";
      case "minimal":
        return "border-b";
      default:
        return "bg-opacity-10 border-b-2";
    }
  };

  return (
    <Card
      className="bg-surface dark:!bg-surface shadow-lg border-2"
      style={{ borderColor: accent_color }}
    >
      <CardContent className="p-3 sm:p-6">
        {/* Header */}
        <div
          className={`pb-4 mb-4 ${getHeaderClass()}`}
          style={{
            borderColor: accent_color,
            backgroundColor:
              header_style === "modern" ? `${accent_color}10` : "transparent",
          }}
        >
          <div
            className={
              layout_style === "two-column"
                ? "flex flex-col sm:flex-row justify-between items-start gap-3"
                : "space-y-4"
            }
          >
            <div>
              <h1
                className="text-xl sm:text-3xl font-bold mb-2"
                style={{ color: accent_color }}
              >
                INVOICE
              </h1>
              {show_logo && (
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-ink-200 rounded flex items-center justify-center text-xs text-content-body">
                  Logo
                </div>
              )}
            </div>

            {show_company_address && (
              <div className="text-left sm:text-right text-xs sm:text-sm">
                <p className="font-semibold" style={{ color: secondary_color }}>
                  {settings?.business_name || "Your Company Name"}
                </p>
                <p className="text-content-body">
                  {settings?.email || "email@company.com"}
                </p>
                <p className="text-content-body">
                  {settings?.phone || "(555) 123-4567"}
                </p>
                {settings?.address && (
                  <p className="text-content-body text-xs mt-1">
                    {settings.address}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Invoice Details & Client Info */}
        <div
          className={
            layout_style === "two-column"
              ? "grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6"
              : "space-y-4 mb-4 sm:mb-6"
          }
        >
          {show_invoice_details && (
            <div>
              <h3
                className="text-xs sm:text-sm font-semibold mb-2"
                style={{ color: accent_color }}
              >
                Invoice Details
              </h3>
              <div className="text-xs space-y-1">
                <p>
                  <span className="font-medium">Number:</span>{" "}
                  {sampleInvoice.invoice_number}
                </p>
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {new Date(sampleInvoice.created_date).toLocaleDateString()}
                </p>
                <p>
                  <span className="font-medium">Due:</span>{" "}
                  {new Date(sampleInvoice.due_date).toLocaleDateString()}
                </p>
              </div>
            </div>
          )}

          {show_client_address && (
            <div>
              <h3
                className="text-xs sm:text-sm font-semibold mb-2"
                style={{ color: accent_color }}
              >
                Bill To
              </h3>
              <div className="text-xs space-y-1">
                <p className="font-medium">{sampleInvoice.client_name}</p>
                <p className="text-content-body">
                  {sampleInvoice.client_email}
                </p>
                <p className="text-content-body">
                  {sampleInvoice.client_phone}
                </p>
                <p className="text-content-body text-xs">
                  {sampleInvoice.client_address}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="mb-4 sm:mb-6 overflow-x-auto">
          <div
            className="grid grid-cols-4 gap-1 sm:gap-2 py-2 px-1 sm:px-2 rounded text-xs font-semibold mb-2 min-w-[280px]"
            style={{
              backgroundColor: `${accent_color}15`,
              color: secondary_color,
            }}
          >
            <div className="col-span-2">Description</div>
            <div className="text-center">Qty</div>
            <div className="text-right">Amount</div>
          </div>

          {sampleInvoice.items.map((item, index) => (
            <div
              key={index}
              className="grid grid-cols-4 gap-1 sm:gap-2 py-2 px-1 sm:px-2 text-xs border-b min-w-[280px]"
            >
              <div className="col-span-2 text-ink-800 break-words">
                {item.description}
              </div>
              <div className="text-center text-content-body">
                {item.quantity}
              </div>
              <div className="text-right font-medium">
                ${item.amount.toFixed(2)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="flex justify-end mb-4 sm:mb-6">
          <div className="w-full sm:w-64 space-y-2 text-xs sm:text-sm">
            <div className="flex justify-between">
              <span className="text-content-body">Subtotal:</span>
              <span>${sampleInvoice.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-content-body">
                Tax ({sampleInvoice.tax_rate}%):
              </span>
              <span>${sampleInvoice.tax_amount.toFixed(2)}</span>
            </div>
            <div
              className="flex justify-between font-bold text-base sm:text-lg pt-2 border-t-2"
              style={{ borderColor: accent_color, color: accent_color }}
            >
              <span>Total:</span>
              <span>${sampleInvoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        {show_payment_info && (
          <div
            className="mb-3 sm:mb-4 p-2 sm:p-3 rounded text-xs"
            style={{ backgroundColor: `${accent_color}10` }}
          >
            <h4 className="font-semibold mb-1" style={{ color: accent_color }}>
              Payment Information
            </h4>
            <p className="text-ink-700 text-xs">
              Payment Method: e-Transfer, Credit Card, Bank Transfer
            </p>
            <p className="text-ink-700 text-xs">
              Reference: Please include invoice number
            </p>
          </div>
        )}

        {/* Notes */}
        {show_notes && sampleInvoice.notes && (
          <div className="text-xs mb-3 sm:mb-4">
            <h4
              className="font-semibold mb-1"
              style={{ color: secondary_color }}
            >
              Notes
            </h4>
            <p className="text-ink-700">{sampleInvoice.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t text-center text-xs text-content-muted">
          Powered by Invoicium
        </div>
      </CardContent>
    </Card>
  );
}
