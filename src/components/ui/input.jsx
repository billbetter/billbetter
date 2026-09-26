import * as React from "react";

import { cn } from "@/lib/utils";
import { useInAppShell } from "@/lib/preferences/shell-context";

// text-sm is the desktop size only. Touch screens get 16px from the rule in
// index.css ("No text field under 16px on a touch screen") because iOS zooms
// the page in on focus of anything smaller -- so changing this class will not
// change what phones show.
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  const inShell = useInAppShell();

  if (inShell) {
    // The dashboard template's input.
    return (
      <input
        type={type}
        data-slot="input"
        className={cn(
          "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20 dark:bg-input/30",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  }

  return (
    <input
      type={type}
      className={`flex h-10 w-full rounded-xl border border-input bg-surface dark:bg-ink-800 dark:border-ink-700 dark:text-content-inverted px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground dark:placeholder:text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors ${className || ""}`}
      ref={ref}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
