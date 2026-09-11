import React from "react";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

/** Saves the current line items as a reusable template (opens the dialog). */
export default function SaveTemplateButton({ formData, setSaveTemplateDialog }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setSaveTemplateDialog(true)}
      className="gap-1.5 sm:gap-2 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-8 sm:h-9 text-xs sm:text-sm"
      disabled={formData.items.length === 0}
    >
      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-700 dark:text-brand-400" />
      <span className="hidden sm:inline">Save Template</span>
      <span className="sm:hidden">Save</span>
    </Button>
  );
}
