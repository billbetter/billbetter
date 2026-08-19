import React, { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sun, Moon, Sunrise, Sunset, Activity } from "lucide-react";

export default function JobHeatmap({ jobs, invoices, dateRange }) {
  const [dataSource, setDataSource] = useState("jobs"); // 'jobs' or 'invoices'

  const heatmapData = useMemo(() => {
    const items = dataSource === "jobs" ? jobs : invoices;

    // Filter by date range
    const filtered = items.filter((item) => {
      if (!dateRange || dateRange.preset === "all") return true;
      const date = new Date(item.created_date);
      return date >= dateRange.start && date <= dateRange.end;
    });

    // Initialize grid: 7 days x 24 hours
    const grid = Array(7)
      .fill(null)
      .map(() => Array(24).fill(0));

    filtered.forEach((item) => {
      const date = new Date(item.start_date || item.created_date);
      const dayOfWeek = date.getDay(); // 0 = Sunday
      const hour = date.getHours();
      grid[dayOfWeek][hour]++;
    });

    // Find max for color scaling
    const maxCount = Math.max(...grid.flat(), 1);

    return { grid, maxCount };
  }, [jobs, invoices, dataSource, dateRange]);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const timeLabels = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

  const getColor = (count, max) => {
    if (count === 0) return "bg-ink-100";
    const intensity = count / max;
    if (intensity > 0.75) return "bg-success-600";
    if (intensity > 0.5) return "bg-success-500";
    if (intensity > 0.25) return "bg-success-400";
    return "bg-success-200";
  };

  const getTextColor = (count, max) => {
    if (count === 0) return "text-content-subtle";
    const intensity = count / max;
    if (intensity > 0.5) return "text-content-inverted";
    return "text-success-800";
  };

  // Calculate peak hours summary
  const peakHours = useMemo(() => {
    const hourTotals = Array(24).fill(0);
    const dayTotals = Array(7).fill(0);

    heatmapData.grid.forEach((day, dayIdx) => {
      day.forEach((count, hour) => {
        hourTotals[hour] += count;
        dayTotals[dayIdx] += count;
      });
    });

    const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
    const peakDay = dayTotals.indexOf(Math.max(...dayTotals));
    const slowHour = hourTotals.indexOf(
      Math.min(...hourTotals.filter((h) => h > 0)) || 0,
    );
    const slowDay = dayTotals.indexOf(
      Math.min(...dayTotals.filter((d) => d > 0)) || 0,
    );

    const formatHour = (h) => {
      if (h === 0) return "12 AM";
      if (h < 12) return `${h} AM`;
      if (h === 12) return "12 PM";
      return `${h - 12} PM`;
    };

    return {
      peakHour: formatHour(peakHour),
      peakDay: days[peakDay],
      slowHour: formatHour(slowHour),
      slowDay: days[slowDay],
      totalActivity: hourTotals.reduce((a, b) => a + b, 0),
    };
  }, [heatmapData]);

  const getTimeIcon = (hour) => {
    if (hour >= 5 && hour < 8) return Sunrise;
    if (hour >= 8 && hour < 17) return Sun;
    if (hour >= 17 && hour < 20) return Sunset;
    return Moon;
  };

  return (
    <Card className="border-none shadow-lg">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-success-600" />
              Activity Heatmap
            </CardTitle>
            <p className="text-sm text-content-muted mt-1">
              See when you're busiest
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={dataSource === "jobs" ? "default" : "outline"}
              size="sm"
              onClick={() => setDataSource("jobs")}
              className={dataSource === "jobs" ? "bg-success-600" : ""}
            >
              Jobs
            </Button>
            <Button
              variant={dataSource === "invoices" ? "default" : "outline"}
              size="sm"
              onClick={() => setDataSource("invoices")}
              className={dataSource === "invoices" ? "bg-success-600" : ""}
            >
              Invoices
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Peak/Slow Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="p-3 bg-success-50 rounded-lg border border-success-100 dark:bg-success-900/20 dark:border-success-800/50">
            <p className="text-xs text-content-muted mb-1">Peak Day</p>
            <p className="font-bold text-success-700">{peakHours.peakDay}</p>
          </div>
          <div className="p-3 bg-success-50 rounded-lg border border-success-100 dark:bg-success-900/20 dark:border-success-800/50">
            <p className="text-xs text-content-muted mb-1">Peak Hour</p>
            <p className="font-bold text-success-700">{peakHours.peakHour}</p>
          </div>
          <div className="p-3 bg-warning-50 rounded-lg border border-warning-100 dark:bg-warning-900/20 dark:border-warning-800/50">
            <p className="text-xs text-content-muted mb-1">Slow Day</p>
            <p className="font-bold text-warning-700">{peakHours.slowDay}</p>
          </div>
          <div className="p-3 bg-warning-50 rounded-lg border border-warning-100 dark:bg-warning-900/20 dark:border-warning-800/50">
            <p className="text-xs text-content-muted mb-1">Slow Hour</p>
            <p className="font-bold text-warning-700">{peakHours.slowHour}</p>
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px]">
            {/* Hour labels */}
            <div className="flex mb-2">
              <div className="w-12 flex-shrink-0"></div>
              <div className="flex-1 flex">
                {timeLabels.map((label, i) => (
                  <div
                    key={label}
                    className="flex-1 text-xs text-content-muted text-center"
                  >
                    {label}
                  </div>
                ))}
              </div>
            </div>

            {/* Grid rows */}
            {days.map((day, dayIdx) => (
              <div key={day} className="flex mb-1 items-center">
                <div className="w-12 flex-shrink-0 text-xs font-medium text-content-body text-right pr-2 dark:text-ink-300">
                  {day}
                </div>
                <div className="flex-1 flex gap-0.5">
                  {heatmapData.grid[dayIdx].map((count, hour) => {
                    const TimeIcon = getTimeIcon(hour);
                    return (
                      <div
                        key={hour}
                        className={`flex-1 aspect-square rounded-sm ${getColor(count, heatmapData.maxCount)} 
                          flex items-center justify-center cursor-pointer hover:ring-2 hover:ring-success-400 
                          transition-all group relative`}
                        title={`${day} ${hour}:00 - ${count} ${dataSource}`}
                      >
                        <span
                          className={`text-[10px] font-medium ${getTextColor(count, heatmapData.maxCount)} hidden sm:block`}
                        >
                          {count > 0 ? count : ""}
                        </span>

                        {/* Tooltip */}
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-surface-inverted text-content-inverted text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                          {day} {hour}:00 - {count}{" "}
                          {dataSource === "jobs" ? "job" : "invoice"}
                          {count !== 1 ? "s" : ""}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Legend */}
            <div className="flex items-center justify-end gap-2 mt-4">
              <span className="text-xs text-content-muted">Less</span>
              <div className="flex gap-0.5">
                <div className="w-4 h-4 rounded-sm bg-ink-100 dark:bg-ink-800"></div>
                <div className="w-4 h-4 rounded-sm bg-success-200"></div>
                <div className="w-4 h-4 rounded-sm bg-success-400"></div>
                <div className="w-4 h-4 rounded-sm bg-success-500"></div>
                <div className="w-4 h-4 rounded-sm bg-success-600"></div>
              </div>
              <span className="text-xs text-content-muted">More</span>
            </div>
          </div>
        </div>

        {peakHours.totalActivity === 0 && (
          <div className="text-center py-8 text-content-muted">
            <Activity className="w-12 h-12 text-ink-300 mx-auto mb-2" />
            <p>
              No activity data yet. Create jobs or invoices to see patterns!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
