import React from "react";
import { Badge } from "@/components/ui/badge";
import DateRangeFilter from "@/components/analytics/DateRangeFilter";
import FadeIn from "@/components/analytics/FadeIn";
import PageHeader from "@/components/layout/PageHeader";

/** Title block and the date-range picker. */
export default function AnalyticsHeader({
  dateRange,
  setDateRange,
}) {
  return (
    <FadeIn>
      <PageHeader
        className="mb-4 sm:mb-6"
        title="Analytics"
        description="Track revenue & performance"
        badge={
          <Badge variant="outline" className="gap-1.5 text-[10px] uppercase tracking-wider">
            <span className="size-1.5 rounded-full bg-success-500 animate-pulse" />
            Live
          </Badge>
        }
        actions={<DateRangeFilter dateRange={dateRange} setDateRange={setDateRange} />}
      />
    </FadeIn>
  );
}
