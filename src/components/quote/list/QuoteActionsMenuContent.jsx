import React from "react";
import { Download } from "lucide-react";
import { DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

/** The quote list's Actions menu (Export CSV), opened from either header. */
export default function QuoteActionsMenuContent({
  handleExportQuotes,
}) {
  return (
    <DropdownMenuContent
      align="end"
      className="w-48 rounded-xl shadow-lg dark:bg-ink-800 dark:border-ink-700"
    >
      <DropdownMenuItem
        onClick={handleExportQuotes}
        className="rounded-lg dark:text-ink-300 dark:focus:bg-ink-700"
      >
        <Download className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
        Export CSV
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}
