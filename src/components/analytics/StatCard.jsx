import React from "react";
import { token } from "@/lib/tokens";
import {
  DollarSign,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  Receipt,
} from "lucide-react";
import FadeIn from "./FadeIn";
import MiniSparkline from "./MiniSparkline";

/** One headline figure with its trend and optional sparkline. */
const StatCard = ({ stat, index }) => {
  const palette = {
    emerald: {
      iconBg: "bg-success-500/10",
      iconText: "text-success-600",
      accent: token("success-500"),
      icon: DollarSign,
    },
    blue: {
      iconBg: "bg-accent-500/10",
      iconText: "text-accent-600",
      accent: token("accent-500"),
      icon: Receipt,
    },
    amber: {
      iconBg: "bg-success-500/10",
      iconText: "text-success-700",
      accent: token("success-600"),
      icon: Briefcase,
    },
    violet: {
      iconBg: "bg-accent-500/10",
      iconText: "text-accent-700",
      accent: token("accent-600"),
      icon: Users,
    },
  };

  const style = palette[stat.color] || palette.emerald;
  const Icon = stat.icon || style.icon;
  const isPositive = stat.trend >= 0;

  return (
    <FadeIn delay={index * 0.07}>
      <div className="group relative h-full overflow-hidden rounded-2xl border border-line-subtle dark:border-ink-800 bg-surface dark:bg-surface-inverted p-3 sm:p-5 transition-all duration-300 hover:border-line-strong dark:hover:border-ink-700 hover:shadow-md">
        {/* Accent line on hover */}
        <div
          className="absolute left-0 top-0 w-12 h-[2px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: style.accent,
          }}
        />

        {/* Icon top-right */}
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <div
            className={`flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${style.iconBg} dark:bg-opacity-20`}
          >
            <Icon
              className={`h-4 w-4 sm:h-5 sm:w-5 ${style.iconText} dark:text-success-400`}
              strokeWidth={1.8}
            />
          </div>
          {stat.trend !== undefined && (
            <span
              className={`inline-flex items-center gap-0.5 text-[11px] sm:text-xs font-semibold ${
                isPositive
                  ? "text-success-600 dark:text-success-400"
                  : "text-danger-500 dark:text-danger-400"
              }`}
            >
              {isPositive ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {Math.abs(stat.trend).toFixed(1)}%
            </span>
          )}
        </div>

        {/* Value */}
        <p className="text-lg sm:text-2xl lg:text-3xl font-bold tracking-tight text-content dark:text-content-inverted mb-0.5 leading-tight truncate">
          {stat.value}
        </p>

        {/* Title + subtext */}
        <p className="text-xs sm:text-sm font-medium text-content-body dark:text-ink-300 leading-snug">
          {stat.title}
        </p>
        <p className="text-[10px] sm:text-xs text-content-subtle dark:text-content-muted mt-0.5 truncate">
          {stat.subtext}
        </p>

        {/* Sparkline — bottom of card, hidden on very small screens */}
        {stat.sparkline && (
          <div className="hidden sm:block mt-3 -mb-1">
            <MiniSparkline
              data={stat.sparkline}
              color={style.accent}
              height={28}
            />
          </div>
        )}
      </div>
    </FadeIn>
  );
};

export default StatCard;
