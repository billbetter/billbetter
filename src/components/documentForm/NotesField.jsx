import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** The notes and terms printed on the document. */
export default function NotesField({
  formData,
  label,
  placeholder,
  setFormData,
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="notes"
        className="text-ink-700 dark:text-ink-300 font-medium text-sm"
      >
        {label}
      </Label>
      <Textarea
        id="notes"
        value={formData.notes}
        onChange={(e) =>
          setFormData({ ...formData, notes: e.target.value })
        }
        rows={3}
        placeholder={placeholder}
        className="border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20 resize-none text-sm"
      />
    </div>
  );
}
