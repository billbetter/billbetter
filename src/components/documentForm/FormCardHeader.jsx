import React from "react";
import { Button } from "@/components/ui/button";
import { CardHeader, CardTitle } from "@/components/ui/card";
import { ClipboardList, Mic } from "lucide-react";

/** The form card's title and Voice Input; `children` are extra actions before it. */
export default function FormCardHeader({
  children,
  setShowVoiceInput,
  title,
}) {
  return (
    <CardHeader className="border-b border-line-subtle dark:border-ink-700 bg-surface-sunken/50 dark:bg-ink-800/50 py-3 sm:py-4 px-4 sm:px-6">
      <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 text-base sm:text-lg lg:text-xl text-content dark:text-ink-50">
        <span className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
          {title}
        </span>
        <div className="flex gap-2">
          {children}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowVoiceInput(true)}
            className="gap-1.5 sm:gap-2 border-line-strong dark:border-ink-600 hover:bg-surface-sunken dark:hover:bg-ink-800 text-ink-700 dark:text-ink-300 h-8 sm:h-9 text-xs sm:text-sm"
          >
            <Mic className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-700 dark:text-brand-400" />
            <span className="hidden sm:inline">Voice Input</span>
            <span className="sm:hidden">Voice</span>
          </Button>
        </div>
      </CardTitle>
    </CardHeader>
  );
}
