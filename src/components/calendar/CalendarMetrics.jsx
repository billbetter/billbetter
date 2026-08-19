import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  RefreshCw,
} from "lucide-react";

export default function CalendarMetrics({ events, lastSynced }) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const thisWeekEvents = events.filter((e) => {
    const date = new Date(e.start_time);
    return date >= startOfWeek && date < endOfWeek && e.status === "active";
  });

  const thisMonthEvents = events.filter((e) => {
    const date = new Date(e.start_time);
    return date >= startOfMonth && date <= endOfMonth && e.status === "active";
  });

  const newBookings = events.filter((e) => {
    const created = new Date(e.created_at);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return created >= sevenDaysAgo;
  });

  const cancellations = events.filter((e) => e.status === "canceled");

  const metrics = [
    {
      label: "This Week",
      value: thisWeekEvents.length,
      icon: Calendar,
      color: "text-brand-700 dark:text-brand-400",
      bgColor: "bg-info-50 dark:bg-info-900/30",
    },
    {
      label: "This Month",
      value: thisMonthEvents.length,
      icon: CalendarCheck,
      color: "text-success-600 dark:text-success-400",
      bgColor: "bg-success-50 dark:bg-success-900/30",
    },
    {
      label: "New Bookings (7d)",
      value: newBookings.length,
      icon: CalendarPlus,
      color: "text-brand-600 dark:text-brand-400",
      bgColor: "bg-brand-50 dark:bg-brand-900/30",
    },
    {
      label: "Cancellations",
      value: cancellations.length,
      icon: CalendarX,
      color: "text-danger-600 dark:text-danger-400",
      bgColor: "bg-danger-50 dark:bg-danger-900/30",
    },
  ];

  return (
    <div className="space-y-3 mb-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <Card
            key={metric.label}
            className="border-none shadow-md dark:bg-ink-800 dark:border-ink-700"
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div
                className={`p-2.5 rounded-lg ${metric.bgColor} flex-shrink-0`}
              >
                <metric.icon className={`w-5 h-5 ${metric.color}`} />
              </div>
              <div className="min-w-0">
                <p className="text-content dark:text-content-inverted my-1 text-2xl font-bold leading-tight">
                  {metric.value}
                </p>
                <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                  {metric.label}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {lastSynced && (
        <div className="flex items-center justify-end gap-2 text-xs text-content-muted dark:text-content-subtle">
          <RefreshCw className="w-3 h-3" />
          Last synced: {new Date(lastSynced).toLocaleTimeString()}
        </div>
      )}
    </div>
  );
}
