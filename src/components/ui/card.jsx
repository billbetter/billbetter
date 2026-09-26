import * as React from "react";

import { cn } from "@/lib/utils";
import { useInAppShell } from "@/lib/preferences/shell-context";

// Inside the app these are the dashboard template's card parts; everywhere
// else (marketing, client links) the original ones, unchanged -- including
// the plain string concatenation, so no class conflict resolves differently.

const Card = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return inShell ? (
    <div
      ref={ref}
      data-slot="card"
      className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    />
  ) : (
    <div
      ref={ref}
      className={`rounded-2xl border bg-surface dark:bg-surface-inverted dark:border-ink-800 text-card-foreground shadow-sm ${className || ""}`}
      {...props}
    />
  );
});
Card.displayName = "Card";

const CardHeader = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return (
    <div
      ref={ref}
      data-slot={inShell ? "card-header" : undefined}
      className={
        inShell
          ? cn("flex flex-col space-y-1.5 p-6", className)
          : `flex flex-col space-y-1.5 p-6 ${className || ""}`
      }
      {...props}
    />
  );
});
CardHeader.displayName = "CardHeader";

const CardTitle = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return inShell ? (
    <h3
      ref={ref}
      data-slot="card-title"
      className={cn("text-lg font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  ) : (
    <h3
      ref={ref}
      className={`text-2xl font-black leading-none tracking-tight text-content dark:text-content-inverted ${className || ""}`}
      {...props}
    />
  );
});
CardTitle.displayName = "CardTitle";

const CardDescription = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return inShell ? (
    <p ref={ref} data-slot="card-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
  ) : (
    <p
      ref={ref}
      className={`text-sm text-muted-foreground dark:text-content-subtle ${className || ""}`}
      {...props}
    />
  );
});
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return inShell ? (
    <div ref={ref} data-slot="card-content" className={cn("p-6 pt-0", className)} {...props} />
  ) : (
    <div ref={ref} className={`p-6 pt-0 ${className || ""}`} {...props} />
  );
});
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef(({ className, ...props }, ref) => {
  const inShell = useInAppShell();
  return inShell ? (
    <div ref={ref} data-slot="card-footer" className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ) : (
    <div ref={ref} className={`flex items-center p-6 pt-0 ${className || ""}`} {...props} />
  );
});
CardFooter.displayName = "CardFooter";

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
