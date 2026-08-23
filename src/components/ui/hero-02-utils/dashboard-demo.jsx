import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

/**
 * The panel hero-02 floats over its wash image.
 *
 * hero-02 imports this but the file was not supplied with it. Its shape is
 * inferable from the task's dependency list: hero-02 itself uses none of card,
 * badge, avatar or separator, so those four were what this file was built from.
 *
 * It is a still image made of DOM, not a live dashboard -- the hero renders it
 * behind a gradient at a third of full size, so anything that fetches, animates
 * or paginates would cost real work nobody can see. Every number is a constant.
 *
 * Marked aria-hidden for the same reason: to a screen reader this is decoration
 * sitting under a heading that already says what the product does, and reading
 * out twelve fake figures would be noise. If it ever becomes a real dashboard,
 * that attribute has to come off.
 */

// Two labels per stat. At 390px each column is ~110px, where "Paid this month"
// truncated to "PAID THIS ..." -- an ellipsis in a screenshot meant to look like
// a finished product. The short form is shown until there is room for the long.
const STATS = [
  { label: "Revenue", short: "Revenue", value: "$48,120", delta: "+12.4%", up: true },
  { label: "Outstanding", short: "Due", value: "$6,430", delta: "-8.1%", up: false },
  { label: "Paid this month", short: "Paid", value: "38", delta: "+5", up: true },
];

const ACTIVITY = [
  { name: "Marcus Webb", detail: "INV-4471 · paid", amount: "$2,400", tone: "paid" },
  { name: "Rivera Interiors", detail: "INV-4468 · sent", amount: "$1,150", tone: "sent" },
  { name: "Dana Kowalski", detail: "INV-4462 · overdue", amount: "$980", tone: "overdue" },
];

const TONE = {
  paid: "bg-success-100 text-success-800",
  // shadcn's own muted pair rather than the project's surface/content scales:
  // those are NAMED (surface-sunken, content-muted), not numeric, so
  // bg-surface-200 compiled to nothing at all and the badge lost its fill.
  sent: "bg-muted text-muted-foreground",
  overdue: "bg-warning-100 text-warning-800",
};

/** Bar heights as percentages. Fixed, so the panel never reflows. */
const BARS = [38, 52, 44, 67, 58, 81, 72, 94];

function initials(name) {
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardDemo({ className }) {
  return (
    <Card
      aria-hidden
      className={`w-full max-w-3xl border-black/5 shadow-xl backdrop-blur-sm dark:border-white/10 ${className || ""}`}
    >
      <CardHeader className="pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Overview</CardTitle>
            <CardDescription>Last 30 days</CardDescription>
          </div>
          <Badge variant="secondary" className="border-0">
            Live
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-3 gap-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:text-xs">
                <span className="sm:hidden">{stat.short}</span>
                <span className="hidden sm:inline">{stat.label}</span>
              </p>
              <p className="mt-1 truncate text-base font-black tabular-nums text-foreground sm:text-xl">
                {stat.value}
              </p>
              <p
                className={`mt-0.5 flex items-center gap-0.5 text-[10px] font-semibold sm:text-xs ${
                  stat.up ? "text-success-700" : "text-warning-700"
                }`}
              >
                {stat.up ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                {stat.delta}
              </p>
            </div>
          ))}
        </div>

        <Separator />

        {/* items-end so the bars sit on a common baseline regardless of height */}
        <div className="flex h-20 items-end gap-1.5 sm:h-24 sm:gap-2">
          {BARS.map((height, i) => (
            <div
              key={height}
              className={`flex-1 rounded-t-sm ${
                i === BARS.length - 1 ? "bg-primary" : "bg-primary/25"
              }`}
              style={{ height: `${height}%` }}
            />
          ))}
        </div>

        <Separator />

        <ul className="space-y-2.5">
          {ACTIVITY.map((row) => (
            <li key={row.name} className="flex items-center gap-3">
              <Avatar className="h-7 w-7 flex-shrink-0 sm:h-8 sm:w-8">
                <AvatarFallback className="text-[10px] font-bold">
                  {initials(row.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-foreground sm:text-sm">
                  {row.name}
                </p>
                <p className="truncate text-[10px] text-muted-foreground sm:text-xs">
                  {row.detail}
                </p>
              </div>
              <span
                className={`hidden flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide sm:inline ${TONE[row.tone]}`}
              >
                {row.tone}
              </span>
              <span className="flex-shrink-0 text-xs font-bold tabular-nums text-foreground sm:text-sm">
                {row.amount}
              </span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export default DashboardDemo;
