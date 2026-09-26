import * as React from "react";

import { cn } from "@/lib/utils";
import { useInAppShell } from "@/lib/preferences/shell-context";

// text-sm is the desktop size only. Touch screens get 16px from the rule in
// index.css ("No text field under 16px on a touch screen") because iOS zooms
// the page in on focus of anything smaller -- so changing this class will not
// change what phones show.
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();

  if (inShell) {
    // The dashboard template's textarea.
    return (
      <textarea
        data-slot="textarea"
        className={cn(
          "flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive dark:bg-input/30",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }

  return (
    <textarea
      className={`flex min-h-[80px] w-full rounded-xl border border-input bg-surface dark:bg-ink-800 dark:border-ink-700 dark:text-content-inverted dark:placeholder:text-content-muted px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className || ""}`}
      ref={ref}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
