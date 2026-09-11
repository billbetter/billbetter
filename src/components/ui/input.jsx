import * as React from "react";

// text-sm is the desktop size only. Touch screens get 16px from the rule in
// index.css ("No text field under 16px on a touch screen") because iOS zooms
// the page in on focus of anything smaller -- so changing this class will not
// change what phones show.
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
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
