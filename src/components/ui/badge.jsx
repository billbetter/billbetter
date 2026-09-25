import * as React from "react";

import { cn } from "@/lib/utils";
import { useInAppShell } from "@/lib/preferences/shell-context";

// The dashboard template's badge inside the app; the original elsewhere.
const shellVariants = {
  default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/90",
  secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90",
  destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
  outline: "text-foreground",
};

const legacyVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/80",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/80",
  outline: "text-foreground",
};

const Badge = ({ className, variant, ...props }) => {
  const inShell = useInAppShell();

  if (inShell) {
    return (
      <div
        data-slot="badge"
        className={cn(
          "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 [&>svg]:pointer-events-none [&>svg]:size-3",
          shellVariants[variant] || shellVariants.default,
          className,
        )}
        {...props}
      />
    );
  }

  const baseStyles =
    "inline-flex items-center rounded-xl border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  const variantStyle = legacyVariants[variant] || legacyVariants.default;

  return <div className={`${baseStyles} ${variantStyle} ${className || ""}`} {...props} />;
};

export { Badge };
