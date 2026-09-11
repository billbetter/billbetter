import React from "react";
import { FileText } from "lucide-react";
import InvoicePreview from "@/components/invoice/create/InvoicePreview";

/** The desktop live preview beside the form. */
export default function LivePreviewPanel({
  formData,
  settings,
}) {
  return (
    <div className="hidden lg:block lg:sticky lg:top-24 w-full">
      <div className="bg-surface dark:bg-surface-inverted rounded-2xl shadow-xl overflow-hidden border border-line dark:border-ink-700">
        <div className="bg-surface-sunken dark:bg-ink-800 px-4 sm:px-6 py-3 sm:py-4 border-b border-line-subtle dark:border-ink-700 flex items-center justify-between">
          <h3 className="font-black text-content dark:text-ink-50 flex items-center gap-2 text-sm">
            <FileText className="w-4 h-4 text-content-subtle dark:text-content-muted" />
            Live Preview
          </h3>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success-500 animate-pulse"></div>
            <span className="text-xs text-content-muted dark:text-content-subtle font-medium">
              Real-time
            </span>
          </div>
        </div>
        <div className="p-3 sm:p-4 bg-surface-sunken dark:bg-surface-inverted-deep">
          <InvoicePreview invoice={formData} settings={settings} />
        </div>
      </div>
    </div>
  );
}
