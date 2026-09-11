import React from "react";
import { BarChart3, Zap } from "lucide-react";
import FadeIn from "@/components/analytics/FadeIn";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/** Overview / AI Insights tabs. */
export default function AnalyticsTabList() {
  return (
    <FadeIn delay={0.05}>
      <TabsList className="mb-4 sm:mb-6 w-full sm:w-auto inline-flex rounded-xl bg-ink-100 dark:bg-ink-800 p-1 border border-line/50 dark:border-ink-700/50 relative z-20">
        <TabsTrigger
          value="overview"
          className="flex-1 sm:flex-none rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-surface dark:data-[state=active]:bg-surface-inverted data-[state=active]:shadow-sm data-[state=active]:text-content dark:data-[state=active]:text-content-inverted text-content-body dark:text-content-subtle"
        >
          <BarChart3 className="h-4 w-4" />
          Overview
        </TabsTrigger>
        <TabsTrigger
          value="insights"
          className="flex-1 sm:flex-none rounded-lg px-4 sm:px-5 py-2 sm:py-2.5 text-sm font-semibold gap-2 data-[state=active]:bg-surface dark:data-[state=active]:bg-surface-inverted data-[state=active]:shadow-sm data-[state=active]:text-content dark:data-[state=active]:text-content-inverted text-content-body dark:text-content-subtle"
        >
          <Zap className="h-4 w-4" />
          AI Insights
        </TabsTrigger>
      </TabsList>
    </FadeIn>
  );
}
