import React from "react";
import { cn } from "@/lib/utils";
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * One headline figure, as the dashboard template's section cards draw it:
 * a muted label, a large tabular number, an optional badge in the corner
 * (a trend, a status) and an optional footer line.
 */
export default function KpiCard({
  label,
  icon: Icon,
  value,
  valueClassName,
  badge,
  footer,
  hint,
  className,
  compact = false,
  // Room kept clear of the corner badge. Only when there is one -- and a
  // caller whose badge is hidden on phones passes "sm:pr-16".
  badgeReserve = "pr-16",
}) {
  return (
    <Card
      data-kpi=""
      className={cn("bg-gradient-to-t from-primary/5 to-card shadow-sm dark:bg-card", className)}
    >
      <CardHeader className={cn("relative space-y-1.5", compact ? "p-4" : "p-5 pb-4")}>
        <CardDescription className={cn("flex items-center gap-1.5", badge && badgeReserve)}>
          {Icon && <Icon className="size-4 shrink-0" />}
          <span className="truncate">{label}</span>
        </CardDescription>
        <CardTitle
          className={cn(
            "font-semibold tabular-nums tracking-tight",
            compact ? "text-xl" : "text-2xl xl:text-3xl",
            valueClassName,
          )}
        >
          {value}
        </CardTitle>
        {badge && <div className={cn("absolute", compact ? "right-3 top-3" : "right-4 top-4")}>{badge}</div>}
      </CardHeader>
      {(footer || hint) && (
        <CardFooter className={cn("flex-col items-start gap-1 text-sm", compact ? "px-4 pb-4" : "px-5 pb-5")}>
          {footer && <div className="line-clamp-1 flex items-center gap-2 font-medium">{footer}</div>}
          {hint && <div className="text-muted-foreground">{hint}</div>}
        </CardFooter>
      )}
    </Card>
  );
}
