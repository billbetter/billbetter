import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Issue date and expiry date. */
export default function QuoteDatesFields({
  formData,
  setFormData,
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      <div className="space-y-2">
        <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
          Date Issued
        </Label>
        <Input
          type="date"
          value={formData.date_issued}
          onChange={(e) =>
            setFormData({
              ...formData,
              date_issued: e.target.value,
            })
          }
          className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
          Valid Until
        </Label>
        <Input
          type="date"
          value={formData.expiry_date}
          onChange={(e) =>
            setFormData({
              ...formData,
              expiry_date: e.target.value,
            })
          }
          className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
        />
      </div>
    </div>
  );
}
