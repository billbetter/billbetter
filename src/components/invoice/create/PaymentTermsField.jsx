import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Payment terms, with the business default as the placeholder. */
export default function PaymentTermsField({
  formData,
  setFormData,
  settings,
}) {
  return (
    <div className="space-y-2">
      <Label
        htmlFor="payment_terms"
        className="text-ink-700 dark:text-ink-300 font-medium text-sm"
      >
        Payment Terms
      </Label>
      <Input
        id="payment_terms"
        value={formData.payment_terms}
        onChange={(e) =>
          setFormData({
            ...formData,
            payment_terms: e.target.value,
          })
        }
        placeholder={
          settings?.payment_terms ||
          "e.g., Net 30, Due on Receipt"
        }
        className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
      />
      {settings?.payment_terms && (
        <p className="text-xs text-content-muted flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-600"></span>
          Default: {settings.payment_terms}
        </p>
      )}
    </div>
  );
}
