import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  format,
  startOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  isSameDay,
} from "date-fns";

export default function WeekView({ events, currentDate, setCurrentDate }) {
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForDayAndHour = (date, hour) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, date) && eventDate.getHours() === hour;
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
    <Card className="border-none shadow-lg">
      <CardContent className="p-6">
        {/* Week Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subWeeks(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-xl font-bold text-content dark:text-content-inverted">
            {format(weekStart, "MMM d")} -{" "}
            {format(addDays(weekStart, 6), "MMM d, yyyy")}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addWeeks(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Week Grid */}
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Day Headers */}
            <div className="grid grid-cols-8 gap-1 mb-2">
              <div className="text-xs font-semibold text-content-body p-2 dark:text-ink-300"></div>
              {weekDays.map((day, idx) => (
                <div
                  key={idx}
                  className="text-center p-2 border-b-2 border-line dark:border-ink-700"
                >
                  <div className="text-xs font-semibold text-content-body dark:text-ink-300">
                    {format(day, "EEE")}
                  </div>
                  <div className="text-lg font-bold text-content dark:text-content-inverted">
                    {format(day, "d")}
                  </div>
                </div>
              ))}
            </div>

            {/* Time Grid */}
            <div className="max-h-[600px] overflow-y-auto">
              {hours.map((hour) => (
                <div key={hour} className="grid grid-cols-8 gap-1 border-b">
                  <div className="text-xs text-content-muted p-2 font-medium">
                    {format(new Date().setHours(hour, 0), "h a")}
                  </div>
                  {weekDays.map((day, dayIdx) => {
                    const hourEvents = getEventsForDayAndHour(day, hour);
                    return (
                      <div
                        key={dayIdx}
                        className="min-h-16 p-1 border-l hover:bg-surface-sunken transition-colors dark:hover:bg-ink-800"
                      >
                        {hourEvents.map((event, eventIdx) => (
                          <div
                            key={eventIdx}
                            className={`text-xs p-2 rounded mb-1 text-content-inverted truncate cursor-pointer hover:opacity-80 ${getStatusColor(event.status)}`}
                            title={`${event.title}\n${format(new Date(event.start), "h:mm a")}`}
                          >
                            <div className="font-semibold">
                              {format(new Date(event.start), "h:mm a")}
                            </div>
                            <div className="truncate">{event.title}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
