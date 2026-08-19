import React, { useMemo } from "react";
import { token } from "@/lib/tokens";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Briefcase,
  Users,
  Clock,
  PieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function ProfitabilityMetrics({ jobs, invoices, dateRange }) {
  const metrics = useMemo(() => {
    // Filter by date range
    const filterByDateRange = (items) => {
      if (!dateRange || dateRange.preset === "all") return items;
      return items.filter((item) => {
        const date = new Date(item.created_date);
        return date >= dateRange.start && date <= dateRange.end;
      });
    };

    const filteredJobs = filterByDateRange(jobs).filter(
      (j) => j.status === "completed",
    );
    const filteredInvoices = filterByDateRange(invoices).filter(
      (inv) => inv.status === "paid",
    );

    // Calculate profit per job
    const jobProfits = filteredJobs.map((job) => {
      const revenue = job.actual_cost || job.estimated_cost || 0;
      const materialsCost = job.materials_cost || 0;
      const laborCost = job.labor_cost || 0;
      const totalCost = materialsCost + laborCost;
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        ...job,
        revenue,
        totalCost,
        profit,
        margin,
      };
    });

    // Average profit per job
    const totalProfit = jobProfits.reduce((sum, j) => sum + j.profit, 0);
    const avgProfitPerJob =
      jobProfits.length > 0 ? totalProfit / jobProfits.length : 0;

    // Average profit margin
    const avgMargin =
      jobProfits.length > 0
        ? jobProfits.reduce((sum, j) => sum + j.margin, 0) / jobProfits.length
        : 0;

    // Group by job title for profitability analysis
    const jobTypeMap = {};
    jobProfits.forEach((job) => {
      const type = job.job_title || "Unnamed Job";
      if (!jobTypeMap[type]) {
        jobTypeMap[type] = { jobs: [], totalProfit: 0, totalRevenue: 0 };
      }
      jobTypeMap[type].jobs.push(job);
      jobTypeMap[type].totalProfit += job.profit;
      jobTypeMap[type].totalRevenue += job.revenue;
    });

    const jobTypeStats = Object.entries(jobTypeMap)
      .map(([type, data]) => ({
        type,
        count: data.jobs.length,
        totalProfit: data.totalProfit,
        avgProfit: data.totalProfit / data.jobs.length,
        margin:
          data.totalRevenue > 0
            ? (data.totalProfit / data.totalRevenue) * 100
            : 0,
      }))
      .filter((j) => j.count > 0);

    const mostProfitable = [...jobTypeStats]
      .sort((a, b) => b.avgProfit - a.avgProfit)
      .slice(0, 5);
    const leastProfitable = [...jobTypeStats]
      .sort((a, b) => a.avgProfit - b.avgProfit)
      .slice(0, 5);

    // Most profitable clients
    const clientProfitMap = {};
    jobProfits.forEach((job) => {
      const client = job.client_name || "Unknown";
      if (!clientProfitMap[client]) {
        clientProfitMap[client] = { jobs: 0, totalProfit: 0, totalRevenue: 0 };
      }
      clientProfitMap[client].jobs++;
      clientProfitMap[client].totalProfit += job.profit;
      clientProfitMap[client].totalRevenue += job.revenue;
    });

    const topClients = Object.entries(clientProfitMap)
      .map(([client, data]) => ({
        client,
        ...data,
        avgProfit: data.totalProfit / data.jobs,
      }))
      .sort((a, b) => b.totalProfit - a.totalProfit)
      .slice(0, 5);

    // Revenue per hour calculation
    const jobsWithHours = jobProfits.filter((j) => j.estimated_hours > 0);
    const totalHours = jobsWithHours.reduce(
      (sum, j) => sum + j.estimated_hours,
      0,
    );
    const totalJobRevenue = jobsWithHours.reduce(
      (sum, j) => sum + j.revenue,
      0,
    );
    const revenuePerHour = totalHours > 0 ? totalJobRevenue / totalHours : 0;

    return {
      avgProfitPerJob,
      avgMargin,
      mostProfitable,
      leastProfitable,
      topClients,
      revenuePerHour,
      totalJobs: filteredJobs.length,
      totalProfit,
    };
  }, [jobs, invoices, dateRange]);

  const COLORS = [
    token("success-500"),
    token("info-500"),
    token("brand-700"),
    token("warning-500"),
    token("magenta-500"),
  ];

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="border border-line-subtle shadow-sm lg:shadow-lg dark:border-ink-800">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-success-50 flex items-center justify-center flex-shrink-0 dark:bg-success-900/20">
                <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-success-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-2xl font-bold text-content mb-1 leading-none dark:text-content-inverted">
              ${metrics.avgProfitPerJob.toFixed(0)}
            </p>
            <p className="text-xs sm:text-sm font-medium text-content-muted">
              Avg Profit
            </p>
            <p className="text-[10px] sm:text-xs text-content-subtle mt-1">
              per job
            </p>
          </CardContent>
        </Card>

        <Card className="border border-line-subtle shadow-sm lg:shadow-lg dark:border-ink-800">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-info-50 flex items-center justify-center flex-shrink-0 dark:bg-info-900/20">
                <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-info-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-2xl font-bold text-content mb-1 leading-none dark:text-content-inverted">
              {metrics.avgMargin.toFixed(1)}%
            </p>
            <p className="text-xs sm:text-sm font-medium text-content-muted">
              Avg Margin
            </p>
            <p className="text-[10px] sm:text-xs text-content-subtle mt-1">
              profit margin
            </p>
          </CardContent>
        </Card>

        <Card className="border border-line-subtle shadow-sm lg:shadow-lg dark:border-ink-800">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0 dark:bg-brand-900/20">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-brand-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-2xl font-bold text-content mb-1 leading-none dark:text-content-inverted">
              ${metrics.revenuePerHour.toFixed(0)}
            </p>
            <p className="text-xs sm:text-sm font-medium text-content-muted">
              Revenue/Hour
            </p>
            <p className="text-[10px] sm:text-xs text-content-subtle mt-1">
              per hour
            </p>
          </CardContent>
        </Card>

        <Card className="border border-line-subtle shadow-sm lg:shadow-lg dark:border-ink-800">
          <CardContent className="p-4 sm:p-4">
            <div className="flex items-center justify-between mb-3 sm:mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-warning-50 flex items-center justify-center flex-shrink-0 dark:bg-warning-900/20">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-warning-600" />
              </div>
            </div>
            <p className="text-2xl sm:text-2xl font-bold text-content mb-1 leading-none dark:text-content-inverted">
              ${metrics.totalProfit.toFixed(0)}
            </p>
            <p className="text-xs sm:text-sm font-medium text-content-muted">
              Total Profit
            </p>
            <p className="text-[10px] sm:text-xs text-content-subtle mt-1">
              all jobs
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Most Profitable Job Types */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingUp className="w-5 h-5 text-success-600" />
              Most Profitable Job Types
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.mostProfitable.length > 0 ? (
              <div className="space-y-3">
                {metrics.mostProfitable.map((job, index) => (
                  <div
                    key={job.type}
                    className="flex items-center justify-between p-3 bg-surface-sunken rounded-lg dark:bg-ink-800"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-content-inverted font-bold text-sm"
                        style={{
                          backgroundColor: COLORS[index % COLORS.length],
                        }}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium text-content truncate max-w-[150px] dark:text-content-inverted">
                          {job.type}
                        </p>
                        <p className="text-xs text-content-muted">
                          {job.count} job{job.count > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-success-600">
                        ${job.avgProfit.toFixed(0)}
                      </p>
                      <p className="text-xs text-content-muted">
                        {job.margin.toFixed(0)}% margin
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-content-muted text-center py-8">
                Complete jobs with cost data to see profitability
              </p>
            )}
          </CardContent>
        </Card>

        {/* Least Profitable / Improvement Areas */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <TrendingDown className="w-5 h-5 text-warning-600" />
              Areas for Improvement
            </CardTitle>
          </CardHeader>
          <CardContent>
            {metrics.leastProfitable.length > 0 &&
            metrics.leastProfitable[0].avgProfit < metrics.avgProfitPerJob ? (
              <div className="space-y-3">
                {metrics.leastProfitable
                  .filter((j) => j.avgProfit < metrics.avgProfitPerJob)
                  .map((job, index) => (
                    <div
                      key={job.type}
                      className="flex items-center justify-between p-3 bg-warning-50 rounded-lg border border-warning-100 dark:bg-warning-900/20 dark:border-warning-800/50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-warning-100 flex items-center justify-center dark:bg-warning-900/30">
                          <Briefcase className="w-4 h-4 text-warning-600" />
                        </div>
                        <div>
                          <p className="font-medium text-content truncate max-w-[150px] dark:text-content-inverted">
                            {job.type}
                          </p>
                          <p className="text-xs text-content-muted">
                            {job.count} job{job.count > 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p
                          className={`font-bold ${job.avgProfit >= 0 ? "text-warning-600" : "text-danger-600"}`}
                        >
                          ${job.avgProfit.toFixed(0)}
                        </p>
                        <p className="text-xs text-content-muted">
                          {job.margin.toFixed(0)}% margin
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <TrendingUp className="w-12 h-12 text-success-300 mx-auto mb-2" />
                <p className="text-content-muted">
                  All job types are performing well!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Profitable Clients */}
      <Card className="border-none shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="w-5 h-5 text-info-600" />
            Most Profitable Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {metrics.topClients.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart
                data={metrics.topClients}
                layout="vertical"
                margin={{ left: 20, right: 20 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={token("ink-100")}
                />
                <XAxis
                  type="number"
                  stroke={token("ink-500")}
                  tickFormatter={(v) => `$${v}`}
                />
                <YAxis
                  dataKey="client"
                  type="category"
                  width={120}
                  stroke={token("ink-500")}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(v) =>
                    v.length > 15 ? v.substring(0, 15) + "..." : v
                  }
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgb(var(--color-surface))",
                    border: "1px solid rgb(var(--color-border))",
                    borderRadius: "8px",
                  }}
                  formatter={(value, name) => [
                    `$${value.toFixed(2)}`,
                    "Total Profit",
                  ]}
                />
                <Bar dataKey="totalProfit" radius={[0, 8, 8, 0]}>
                  {metrics.topClients.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={COLORS[index % COLORS.length]}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-content-muted text-center py-8">
              Complete jobs to see client profitability
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
