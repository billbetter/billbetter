import React from "react";
import { cn } from "@/lib/utils";

/**
 * A page's title row, as the dashboard template lays it out: a semibold
 * title and a muted line under it on the left, the page's actions on the
 * right, wrapping under the title on narrow screens.
 */
export default function PageHeader({ title, description, badge, actions, eyebrow, className }) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        )}
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
