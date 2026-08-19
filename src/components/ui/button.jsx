import * as React from "react";

const Button = React.forwardRef(
  ({ className, variant, size, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background";

    const variants = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow",
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

    const sizes = {
      default: "h-10 py-2 px-4",
      sm: "h-9 px-3 rounded-xl",
      lg: "h-11 px-8 rounded-xl",
      icon: "h-10 w-10",
      // Homepage CTA sizes
      brand: "h-14 px-8 rounded-2xl",
      brandLg: "h-16 px-14 rounded-2xl text-lg",
      nav: "h-10 px-5 rounded-lg text-sm",
    };

    const variantStyle = variants[variant] || variants.default;
    const sizeStyle = sizes[size] || sizes.default;

    return (
      <button
        className={`${baseStyles} ${variantStyle} ${sizeStyle} ${className || ""}`}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
