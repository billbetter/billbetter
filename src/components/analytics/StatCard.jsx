import React from "react";
import { token } from "@/lib/tokens";
import { DollarSign, Users, Briefcase, Receipt, TrendingDown, TrendingUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import KpiCard from "@/components/layout/KpiCard";
import FadeIn from "./FadeIn";
import MiniSparkline from "./MiniSparkline";

// Each colour key names the card's default icon; the sparkline is drawn in
// the theme's chart colour, like the template's charts.
const ICONS = { emerald: DollarSign, blue: Receipt, amber: Briefcase, violet: Users };

/** One headline figure with its trend and optional sparkline, as a
 * dashboard-template section card. */
const StatCard = ({ stat, index }) => {
  const Icon = stat.icon || ICONS[stat.color] || DollarSign;
  const isPositive = stat.trend >= 0;
  const Trend = isPositive ? TrendingUp : TrendingDown;

  return (
    <FadeIn delay={index * 0.07} className="h-full">
      <KpiCard
        className="h-full"
        icon={Icon}
        label={stat.title}
        value={<span className="block truncate">{stat.value}</span>}
        badge={
          stat.trend !== undefined && (
            <Badge
              variant="outline"
              className={isPositive ? "text-success-700 dark:text-success-400" : "text-danger-600 dark:text-danger-400"}
            >
              <Trend />
              {isPositive ? "+" : "-"}
              {Math.abs(stat.trend).toFixed(1)}%
            </Badge>
          )
        }
        hint={
          <>
            <span className="block truncate text-xs">{stat.subtext}</span>
            {stat.sparkline && (
              <span className="mt-2 hidden sm:block">
                <MiniSparkline data={stat.sparkline} color={token("brand-500")} height={28} />
              </span>
            )}
          </>
        }
      />
    </FadeIn>
  );
};

export default StatCard;
