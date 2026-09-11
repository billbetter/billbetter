import React from "react";
import { Download, Loader2 } from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** The quote list's Actions menu (Export to Excel), opened from either header. */
export default function QuoteActionsMenuContent({
  exporting,
  handleExportToExcel,
}) {
  return (
    <DropdownMenuContent
      align="end"
      className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
    >
      <DropdownMenuItem
        onClick={handleExportToExcel}
        disabled={exporting}
        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
      >
        {exporting && (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        )}
        {!exporting && (
          <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
        )}
        Export to Excel
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
