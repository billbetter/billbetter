import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateTotals } from "@/components/documentForm/lineItemMath";

/** Tax rate; changing it recomputes the totals. */
export default function TaxRateField({
  formData,
  setFormData,
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="tax_rate"
        className="text-ink-700 dark:text-ink-300 font-medium text-sm"
      >
        Tax Rate (%)
      </Label>
      <Input
        id="tax_rate"
        type="number"
        min="0"
        step="0.01"
        value={formData.tax_rate}
        onChange={(e) => {
          const taxRate = parseFloat(e.target.value) || 0;
          const totals = calculateTotals(formData.items, taxRate);
          setFormData({
            ...formData,
            tax_rate: taxRate,
            ...totals,
          });
        }}
        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
      />
    </div>
  );
}
