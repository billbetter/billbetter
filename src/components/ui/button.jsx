import * as React from "react";
import { Slot } from "@radix-ui/react-slot";

import { cn } from "@/lib/utils";
import { useInAppShell } from "@/lib/preferences/shell-context";

// ---- Inside the app: the dashboard template's button ------------------------
// `[&>svg]:mx-0` because pages written for the old button space their icons
// with mr-2 / ml-2; the gap now does that, and both together double it.
const shellBase =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg]:mx-0";

const shellVariants = {
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
  destructive:
    "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 focus-visible:ring-destructive/20",
  outline:
    "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:hover:bg-input/50",
  secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
  ghost: "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
  link: "text-primary underline-offset-4 hover:underline",
};
// The homepage variants keep their meaning in the app: a strong call to action.
shellVariants.brand = shellVariants.default;
shellVariants.brandOnDark = shellVariants.default;
shellVariants.brandOutline = shellVariants.outline;
shellVariants.brandDark = shellVariants.default;

const shellSizes = {
  default: "h-9 px-4 py-2 has-[>svg]:px-3",
  sm: "h-8 gap-1.5 px-3 has-[>svg]:px-2.5",
  lg: "h-10 px-6 has-[>svg]:px-4",
  icon: "size-9",
  brand: "h-10 px-6",
  brandLg: "h-11 px-8 text-base",
  nav: "h-9 px-4",
};

// ---- Everywhere else: the original button, unchanged ------------------------
const legacyBase =
  "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

const legacyVariants = {
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow",
  outline:
    "border-2 border-ink-900 bg-surface text-content hover:bg-surface-inverted hover:text-content-inverted shadow-sm font-semibold dark:border-ink-600 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700 dark:hover:text-content-inverted",
  secondary:
    "bg-surface-inverted text-content-inverted hover:bg-ink-800 shadow font-semibold dark:bg-ink-700 dark:hover:bg-ink-600",
  ghost:
    "text-content hover:bg-ink-100 border border-line font-medium dark:text-ink-100 dark:hover:bg-ink-800 dark:border-ink-700",
  link: "underline-offset-4 hover:underline text-content font-medium dark:text-ink-100",
  // Homepage design system (design-system/invoicium/HOMEPAGE.md)
  brand:
    "bg-brand hover:bg-brand-hover text-content-inverted font-black shadow-2xl shadow-brand-600/25 hover:scale-[1.02] active:scale-[0.98] transition-all",
  brandOnDark:
    "bg-brand-500 hover:bg-brand-400 text-content font-black shadow-2xl shadow-brand-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all",
  brandOutline:
    "border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content font-black transition-colors dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200 dark:hover:bg-ink-700 dark:hover:text-content-inverted",
  brandDark:
    "bg-surface-inverted hover:bg-ink-800 text-content-inverted font-bold transition-colors dark:bg-ink-700 dark:hover:bg-ink-600",
};

const legacySizes = {
  default: "h-10 py-2 px-4",
  sm: "h-9 px-3 rounded-xl",
  lg: "h-11 px-8 rounded-xl",
  icon: "h-10 w-10",
  // Homepage CTA sizes
  brand: "h-14 px-8 rounded-2xl",
  brandLg: "h-16 px-14 rounded-2xl text-lg",
  nav: "h-10 px-5 rounded-lg text-sm",
};

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const inShell = useInAppShell();
  const Comp = asChild ? Slot : "button";
  // A link rendered through asChild has no real `disabled`. It used to be
  // nested inside a disabled <button>, which swallowed the click; keep that.
  const linkDisabled = asChild && props.disabled;

  if (inShell) {
    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(
          shellBase,
          shellVariants[variant] || shellVariants.default,
          shellSizes[size] || shellSizes.default,
          linkDisabled && "pointer-events-none opacity-50",
          className,
        )}
        {...props}
        {...(linkDisabled ? { "aria-disabled": true, tabIndex: -1 } : {})}
      />
    );
  }

  // Plain concatenation, as before: outside the shell nothing may change,
  // including which of two conflicting classes wins.
  const variantStyle = legacyVariants[variant] || legacyVariants.default;
  const sizeStyle = legacySizes[size] || legacySizes.default;
  return (
    <Comp
      className={`${legacyBase} ${variantStyle} ${sizeStyle} ${className || ""}`}
      ref={ref}
      {...props}
    />
  );
});
Button.displayName = "Button";

export { Button };
