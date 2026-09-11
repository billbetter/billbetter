import React, { useState } from "react";
import { token } from "@/lib/tokens";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Sparkles,
} from "lucide-react";
import SmartInsights from "@/components/analytics/SmartInsights";
import ChaseInvoiceBanner from "@/components/invoice/ChaseInvoiceBanner";
import FadeIn from "@/components/analytics/FadeIn";
import StatCard from "@/components/analytics/StatCard";
import { buildAnalytics } from "@/components/analytics/analyticsModel";
import useAnalyticsData from "@/components/analytics/useAnalyticsData";
import ListLoadingState from "@/components/documentList/ListLoadingState";
import AnalyticsHeader from "@/components/analytics/AnalyticsHeader";
import AnalyticsTabList from "@/components/analytics/AnalyticsTabList";
import RevenueHeroBanner from "@/components/analytics/overview/RevenueHeroBanner";
import InvoicePipelineCard from "@/components/analytics/overview/InvoicePipelineCard";
import RevenueTrendCard from "@/components/analytics/overview/RevenueTrendCard";
import RevenueByCategoryCard from "@/components/analytics/overview/RevenueByCategoryCard";
import QuoteFunnelCard from "@/components/analytics/overview/QuoteFunnelCard";
import MonthlyRevenueCard from "@/components/analytics/overview/MonthlyRevenueCard";
import TopClientsCard from "@/components/analytics/overview/TopClientsCard";
import RecentActivityCard from "@/components/analytics/overview/RecentActivityCard";
import HealthScoreHero from "@/components/analytics/insights/HealthScoreHero";
import RevenueInsightCard from "@/components/analytics/insights/RevenueInsightCard";
import CollectionInsightCard from "@/components/analytics/insights/CollectionInsightCard";
import ClientInsightCard from "@/components/analytics/insights/ClientInsightCard";
import RecommendationsCard from "@/components/analytics/insights/RecommendationsCard";

export default function Analytics() {
  const { invoices, payments, clients, quotes, jobs, loading } = useAnalyticsData();
  const [dateRange, setDateRange] = useState({
    preset: "all",
    start: null,
    end: null,
  });
  const [activeTab, setActiveTab] = useState("overview");

  const {
    filteredInvoices,
    paidInvoices,
    pendingInvoices,
    overdueInvoices,
    totalRevenue,
    pendingAmount,
    overdueAmount,
    collectionRate,
    monthlyData,
    revenueTrendData,
    jobsCompletedThisMonth,
    revenueByJobTypeWithPercent,
    revenueByClient,
    currentMonthRevenue,
    lastMonthRevenue,
    growthRate,
    healthScore,
    statsData,
  } = buildAnalytics({ invoices, payments, clients, jobs, dateRange });

  const catColors = [
    token("success-500"),
    token("accent-500"),
    token("success-600"),
    token("accent-600"),
    token("success-700"),
  ];

  if (loading) {
    return (
      <ListLoadingState
        label="Loading analytics"
        spinnerClassName="text-success-600 dark:text-success-400"
      />
    );
  }

  /* ═══ RENDER ═══ */
  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8 min-h-screen">
      <AnalyticsHeader
        dateRange={dateRange}
        setDateRange={setDateRange}
      />

      {/* ── Chase Invoice promo ── */}
      <FadeIn delay={0.03}>
        <div className="mb-4 sm:mb-6">
          <ChaseInvoiceBanner variant="analytics" />
        </div>
      </FadeIn>

      {/* ── Tabs ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <AnalyticsTabList />

        {/* ═══ OVERVIEW ═══ */}
        <TabsContent value="overview" className="space-y-6 mt-0">
          <RevenueHeroBanner
            growthRate={growthRate}
            monthlyData={monthlyData}
            paidInvoices={paidInvoices}
            totalRevenue={totalRevenue}
          />

          {/* ── Stat Cards ── */}
          <div className="grid grid-cols-2 gap-2 sm:gap-4 lg:grid-cols-4 lg:gap-5">
            {statsData.map((stat, idx) => (
              <StatCard key={stat.title} stat={stat} index={idx} />
            ))}
          </div>

          <InvoicePipelineCard
            collectionRate={collectionRate}
            overdueAmount={overdueAmount}
            overdueInvoices={overdueInvoices}
            paidInvoices={paidInvoices}
            pendingAmount={pendingAmount}
            pendingInvoices={pendingInvoices}
            totalRevenue={totalRevenue}
          />

          {/* ── Charts Row 1: Revenue Trend (2/3) + Categories (1/3) ── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <RevenueTrendCard
              currentMonthRevenue={currentMonthRevenue}
              growthRate={growthRate}
              lastMonthRevenue={lastMonthRevenue}
              revenueTrendData={revenueTrendData}
            />

            <RevenueByCategoryCard
              catColors={catColors}
              revenueByJobTypeWithPercent={revenueByJobTypeWithPercent}
            />
          </div>

          {/* ── Quote Conversion Funnel + Monthly Bar ── */}
          <div className="grid gap-5 lg:grid-cols-3">
            <QuoteFunnelCard
              quotes={quotes}
            />

            <MonthlyRevenueCard
              monthlyData={monthlyData}
            />
          </div>

          {/* ── Top Clients + Recent Activity ── */}
          <div className="grid gap-5 lg:grid-cols-2">
            <TopClientsCard
              revenueByClient={revenueByClient}
            />

            <RecentActivityCard
              invoices={invoices}
              jobs={jobs}
            />
          </div>
        </TabsContent>

        {/* ═══ INSIGHTS TAB ═══ */}
        <TabsContent value="insights" className="space-y-6 mt-0">
          <HealthScoreHero
            clients={clients}
            collectionRate={collectionRate}
            growthRate={growthRate}
            healthScore={healthScore}
            jobsCompletedThisMonth={jobsCompletedThisMonth}
          />

          {/* ── Key Insight Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <RevenueInsightCard
              growthRate={growthRate}
            />

            <CollectionInsightCard
              collectionRate={collectionRate}
              overdueAmount={overdueAmount}
              overdueInvoices={overdueInvoices}
              pendingInvoices={pendingInvoices}
            />

            <ClientInsightCard
              clients={clients}
              revenueByClient={revenueByClient}
            />
          </div>

          <RecommendationsCard
            clients={clients}
            growthRate={growthRate}
            overdueAmount={overdueAmount}
            overdueInvoices={overdueInvoices}
            pendingAmount={pendingAmount}
            pendingInvoices={pendingInvoices}
            quotes={quotes}
          />

          {/* ── AI Smart Insights (existing component) ── */}
          <FadeIn delay={0.3}>
            <div className="rounded-2xl border border-line/60 dark:border-ink-800 bg-surface dark:bg-surface-inverted p-5 sm:p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10 dark:bg-success-500/20">
                  <Sparkles className="h-5 w-5 text-success-600 dark:text-success-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-content dark:text-content-inverted">
                    AI Deep Analysis
                  </h3>
                  <p className="text-xs text-content-subtle dark:text-content-muted">
                    Advanced pattern recognition across your business data
                  </p>
                </div>
              </div>
              <SmartInsights
                invoices={filteredInvoices}
                clients={clients}
                jobs={jobs}
                quotes={quotes}
              />
            </div>
          </FadeIn>
        </TabsContent>
      </Tabs>
    </div>
  );
}
