import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle } from "lucide-react";

export default function TemplatePreviewModal({
  template,
  isOpen,
  onClose,
  onSelect,
  isSelected,
}) {
  if (!template) return null;

  const getPreviewContent = () => {
    switch (template.id) {
      case "professional":
        return (
          <div className="bg-surface p-8 rounded-lg shadow-sm border text-xs dark:bg-surface-inverted">
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-4">INVOICE</h1>
              <div className="border-t border-b py-3 mb-4">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold">From (Your Company)</p>
                    <p>Company Name</p>
                    <p>123 Business St, City, Province</p>
                    <p>Phone: (555) 123-4567</p>
                    <p>Email: info@company.com</p>
                  </div>
                  <div>
                    <p className="font-semibold">Bill To (Client)</p>
                    <p>Client Name</p>
                    <p>456 Client Ave, City, Province</p>
                    <p>client@email.com</p>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-4 text-xs">
                <div>
                  <p className="font-semibold">Invoice #</p>
                  <p>INV-001</p>
                </div>
                <div>
                  <p className="font-semibold">Date Issued</p>
                  <p>2025-01-15</p>
                </div>
                <div>
                  <p className="font-semibold">Due Date</p>
                  <p>2025-02-15</p>
                </div>
              </div>
            </div>
            <div className="mb-4">
              <p className="font-semibold mb-2">Services / Products</p>
              <table className="w-full text-xs">
                <thead className="bg-ink-100 dark:bg-ink-800">
                  <tr>
                    <th className="text-left p-1">Item</th>
                    <th className="text-right p-1">Qty</th>
                    <th className="text-right p-1">Rate</th>
                    <th className="text-right p-1">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1">Service Description 1</td>
                    <td className="text-right p-1">2</td>
                    <td className="text-right p-1">$50.00</td>
                    <td className="text-right p-1">$100.00</td>
                  </tr>
                  <tr>
                    <td className="p-1">Service Description 2</td>
                    <td className="text-right p-1">1</td>
                    <td className="text-right p-1">$75.00</td>
                    <td className="text-right p-1">$75.00</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="border-t pt-2 text-right">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>$175.00</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax (13%)</span>
                <span>$22.75</span>
              </div>
              <div className="flex justify-between py-2 font-bold border-t">
                <span>Total Due</span>
                <span>$197.75</span>
              </div>
            </div>
            <div className="mt-6 text-xs text-content-body dark:text-ink-300">
              <p className="font-semibold mb-1">Payment Information</p>
              <p>Payment Method: e-Transfer / Credit Card</p>
              <p>Reference: Please include invoice number</p>
            </div>
          </div>
        );

      case "compact":
        return (
          <div className="bg-surface p-6 rounded-lg shadow-sm border text-xs dark:bg-surface-inverted">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h1 className="text-2xl font-bold">INVOICE</h1>
                <div className="mt-2">
                  <p className="font-semibold">Company Name</p>
                  <p className="text-xs">123 Business St | info@company.com</p>
                </div>
              </div>
              <div className="w-16 h-16 bg-ink-200 rounded flex items-center justify-center text-content-body dark:bg-ink-700 dark:text-ink-300">
                LOGO
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 text-xs">
              <div>
                <p className="font-semibold">Invoice #</p>
                <p>INV-001</p>
              </div>
              <div>
                <p className="font-semibold">Date</p>
                <p>2025-01-15</p>
              </div>
              <div>
                <p className="font-semibold">Due Date</p>
                <p>2025-02-15</p>
              </div>
            </div>

            <div className="mb-4 text-xs">
              <p className="font-semibold">Bill To:</p>
              <p>Client Name</p>
              <p>client@email.com</p>
            </div>

            <div className="mb-4">
              <p className="font-semibold mb-2 text-xs">Order Details</p>
              <table className="w-full text-xs">
                <thead className="bg-surface-sunken dark:bg-ink-800">
                  <tr>
                    <th className="text-left p-1">Description</th>
                    <th className="text-right p-1">Qty</th>
                    <th className="text-right p-1">Price</th>
                    <th className="text-right p-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-1">Service 1</td>
                    <td className="text-right p-1">2</td>
                    <td className="text-right p-1">$50</td>
                    <td className="text-right p-1">$100</td>
                  </tr>
                  <tr>
                    <td className="p-1">Service 2</td>
                    <td className="text-right p-1">1</td>
                    <td className="text-right p-1">$75</td>
                    <td className="text-right p-1">$75</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="text-right text-xs">
              <div className="flex justify-between py-1">
                <span>Subtotal</span>
                <span>$175.00</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax</span>
                <span>$22.75</span>
              </div>
              <div className="flex justify-between py-2 font-bold border-t">
                <span>Total</span>
                <span>$197.75</span>
              </div>
            </div>
          </div>
        );

      case "simple":
        return (
          <div className="bg-surface p-6 rounded-lg shadow-sm border text-xs dark:bg-surface-inverted">
            <div className="mb-4">
              <h1 className="text-xl font-bold mb-2">
                Invoice From Company Name
              </h1>
              <p className="text-xs">
                123 Business St | info@company.com | (555) 123-4567
              </p>
            </div>

            <div className="flex justify-between mb-4 text-xs">
              <div>
                <span className="font-semibold">Invoice #:</span> INV-001
              </div>
              <div>
                <span className="font-semibold">Date:</span> 2025-01-15
              </div>
              <div>
                <span className="font-semibold">Due:</span> 2025-02-15
              </div>
            </div>

            <div className="mb-4 text-xs">
              <p className="font-semibold">Bill To:</p>
              <p>Client Name | client@email.com</p>
            </div>

            <table className="w-full mb-4 text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-1">Description</th>
                  <th className="text-right p-1">Qty</th>
                  <th className="text-right p-1">Price</th>
                  <th className="text-right p-1">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-1">Service 1</td>
                  <td className="text-right p-1">2</td>
                  <td className="text-right p-1">$50.00</td>
                  <td className="text-right p-1">$100.00</td>
                </tr>
                <tr>
                  <td className="p-1">Service 2</td>
                  <td className="text-right p-1">1</td>
                  <td className="text-right p-1">$75.00</td>
                  <td className="text-right p-1">$75.00</td>
                </tr>
              </tbody>
            </table>

            <div className="text-right text-xs border-t pt-2">
              <div className="flex justify-between py-1">
                <span>Subtotal:</span>
                <span>$175.00</span>
              </div>
              <div className="flex justify-between py-1">
                <span>Tax:</span>
                <span>$22.75</span>
              </div>
              <div className="flex justify-between py-2 font-bold">
                <span>Total:</span>
                <span>$197.75</span>
              </div>
            </div>

            <div className="mt-4 text-xs text-content-body dark:text-ink-300">
              <p>Payment: e-Transfer / Credit Card / Auto-Payment Link</p>
              <p className="mt-2">Thank you for choosing Company Name!</p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-content dark:text-content-inverted">
            <span>{template.name} Template</span>
            {isSelected && (
              <Badge className="bg-success-700 text-content-inverted dark:bg-success-700 dark:text-content-inverted hover:bg-success-700 dark:hover:bg-success-700">
                <CheckCircle className="w-3 h-3 mr-1" />
                Currently Selected
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-ink-300">
            {template.description}
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 bg-surface-sunken dark:bg-ink-800 p-4 rounded-lg">
          {getPreviewContent()}
        </div>

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-line dark:border-ink-600 text-content dark:text-content-inverted hover:bg-surface-sunken dark:hover:bg-ink-800"
          >
            Close
          </Button>
          <Button
            onClick={() => {
              onSelect(template.id);
              onClose();
            }}
            className="bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
            disabled={isSelected}
          >
            {isSelected ? "Already Selected" : "Use This Template"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
