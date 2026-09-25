import React from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";

/**
 * Dashboard shortcut tile, as a dashboard-template card: an icon, a title and
 * a muted line, the whole card a link.
 *
 * `accent` is still accepted from the tile list but no longer painted: the
 * template's cards are one neutral surface, and the icon says which tile is
 * which.
 */
// eslint-disable-next-line no-unused-vars
export default function QuickActionCard({ to, icon: Icon, title, description, accent }) {
  return (
    <Link to={to} className="group block h-full">
      <div className="relative flex h-full min-h-[110px] flex-col rounded-xl border bg-card surface-gradient p-4 text-card-foreground shadow-sm transition-shadow group-hover:shadow-md sm:min-h-[128px] sm:p-5">
        <div className="mb-3 flex items-start justify-between sm:mb-4">
          <div className="flex size-9 items-center justify-center rounded-lg border bg-background shadow-sm">
            <Icon className="size-4" />
          </div>
          <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        <h3 className="mb-0.5 text-sm font-semibold sm:text-base">{title}</h3>
        <p className="hidden text-xs text-muted-foreground sm:block">{description}</p>
      </div>
    </Link>
  );
}
