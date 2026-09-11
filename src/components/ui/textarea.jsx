import * as React from "react";

// text-sm is the desktop size only. Touch screens get 16px from the rule in
// index.css ("No text field under 16px on a touch screen") because iOS zooms
// the page in on focus of anything smaller -- so changing this class will not
// change what phones show.
const Textarea = React.forwardRef(({ className, ...props }, ref) => {
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
