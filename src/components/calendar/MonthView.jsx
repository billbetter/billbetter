import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
} from "date-fns";

export default function MonthView({
  events,
  currentDate,
  setCurrentDate,
  onEventClick,
}) {
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const rows = [];
  let days = [];
  let day = startDate;

  while (day <= endDate) {
    for (let i = 0; i < 7; i++) {
      days.push(day);
      day = addDays(day, 1);
    }
    rows.push(days);
    days = [];
  }

  const getEventsForDay = (date) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date);
    });
  };

  const getStatusColor = (status) => {
    const colors = {
      planning: "bg-brand-600",
      in_progress: "bg-caution-500",
      completed: "bg-positive-500",
      cancelled: "bg-danger-500",
    };
    return colors[status] || "bg-ink-500";
  };

  return (
    <Card className="border-none shadow-lg dark:bg-ink-800 dark:border-ink-700">
      <CardContent className="p-3 sm:p-6">
        {/* Month Navigation */}
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            className="h-8 w-8 sm:h-10 sm:w-auto sm:px-4 dark:bg-surface-inverted dark:border-ink-700 dark:text-ink-300"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg sm:text-2xl font-bold text-content dark:text-content-inverted">
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            className="h-8 w-8 sm:h-10 sm:w-auto sm:px-4 dark:bg-surface-inverted dark:border-ink-700 dark:text-ink-300"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Weekday Headers */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-[10px] sm:text-sm font-semibold text-content-body dark:text-ink-300 py-1 sm:py-2"
            >
              <span className="hidden sm:inline">{day}</span>
              <span className="sm:hidden">{day.charAt(0)}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="space-y-1 sm:space-y-2">
          {rows.map((week, weekIdx) => (
            <div key={weekIdx} className="grid grid-cols-7 gap-1 sm:gap-2">
              {week.map((day, dayIdx) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isCurrentDay = isToday(day);

                return (
                  <div
                    key={dayIdx}
                    className={`min-h-[60px] sm:min-h-24 p-1 sm:p-2 border rounded-lg transition-all ${
                      !isCurrentMonth
                        ? "bg-surface-sunken dark:bg-surface-inverted text-content-subtle dark:text-content-body border-line dark:border-ink-700"
                        : isCurrentDay
                          ? "bg-success-50 dark:bg-success-900/30 border-success-500 dark:border-success-600 border-2"
                          : "bg-surface dark:bg-ink-800 hover:bg-surface-sunken dark:hover:bg-ink-700 border-line dark:border-ink-700"
                    }`}
                  >
                    <div
                      className={`text-[11px] sm:text-sm font-semibold mb-0.5 sm:mb-1 ${isCurrentDay ? "text-success-600 dark:text-success-400" : "text-content dark:text-ink-100"}`}
                    >
                      {format(day, "d")}
                    </div>
                    <div className="space-y-0.5 sm:space-y-1">
                      {dayEvents
                        .slice(0, window.innerWidth < 640 ? 1 : 3)
                        .map((event, idx) => (
                          <button
                            key={idx}
                            onClick={() => onEventClick?.(event)}
                            className={`text-[9px] sm:text-xs px-1 sm:px-2 py-0.5 sm:py-1 rounded text-content-inverted truncate cursor-pointer hover:opacity-80 w-full text-left ${getStatusColor(event.status)}`}
                            title={`${event.title}\n${format(new Date(event.start), "h:mm a")}`}
                          >
                            <span className="hidden sm:inline">
                              {format(new Date(event.start), "h:mm a")}{" "}
                            </span>
                            {event.title}
                          </button>
                        ))}
                      {dayEvents.length > (window.innerWidth < 640 ? 1 : 3) && (
                        <div className="text-[9px] sm:text-xs text-content-muted dark:text-content-subtle font-medium">
                          +
                          {dayEvents.length - (window.innerWidth < 640 ? 1 : 3)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
