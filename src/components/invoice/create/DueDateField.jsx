import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** The due date (one-off invoices only). */
export default function DueDateField({
  formData,
  isRecurring,
  setFormData,
}) {
  return <>
    {!isRecurring && (
      <div className="space-y-2">
        <Label
          htmlFor="due_date"
          className="text-ink-700 dark:text-ink-300 font-medium text-sm"
        >
          Payment Due Date
        </Label>
        <Input
          id="due_date"
          type="date"
          value={formData.due_date}
          onChange={(e) =>
            setFormData({ ...formData, due_date: e.target.value })
          }
          className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
        />
      </div>
    )}
    </>;
}
