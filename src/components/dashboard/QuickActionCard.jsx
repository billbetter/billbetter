import React from "react";
import { Link } from "react-router-dom";

/**
 * Dashboard shortcut tile.
 *
 * The four tiles used to be copy-pasted blocks carrying an inline
 * `backgroundColor: rgb(var(--color-surface-inverted-deep))`. Inline styles
 * can't respond to the `dark` class, so the tiles stayed near-black on the
 * light dashboard. The surface is a token class now and follows the theme;
 * the accent only drives the icon chip and the border tint.
 */
export default function QuickActionCard({
  to,
  icon: Icon,
  title,
  description,
  accent,
}) {
  return (
    <Link to={to} className="group block">
      <div
        className={`relative flex h-full min-h-[130px] sm:min-h-[150px] flex-col overflow-hidden rounded-xl sm:rounded-2xl border p-4 sm:p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg bg-surface dark:bg-surface-inverted-deep ${accent.border}`}
      >
        <div className="mb-3 sm:mb-4">
          <div
            className={`flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-105 ${accent.chip} ${accent.glow}`}
          >
            <Icon className="h-5 w-5 sm:h-6 sm:w-6 text-content-inverted" />
          </div>
        </div>
        <h3 className="mb-0.5 text-sm sm:text-base font-black text-content dark:text-content-inverted">
          {title}
        </h3>
        <p className="hidden text-xs text-content-muted dark:text-content-subtle sm:block">
          {description}
        </p>
      </div>
    </Link>
  );
}
