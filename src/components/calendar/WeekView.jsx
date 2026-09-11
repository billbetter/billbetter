import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import PeriodNavigation from "./PeriodNavigation";
import { jobStatusColor } from "./jobStatusColor";
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

  return (
    <Card className="border-none shadow-lg">
      <CardContent className="p-6">
        <PeriodNavigation
          title={
            <>
              {format(weekStart, "MMM d")} -{" "}
              {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </>
          }
          onPrevious={() => setCurrentDate(subWeeks(currentDate, 1))}
          onNext={() => setCurrentDate(addWeeks(currentDate, 1))}
          spacingClassName="mb-6"
          titleSizeClassName="text-xl"
        />

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
                            className={`text-xs p-2 rounded mb-1 text-content-inverted truncate cursor-pointer hover:opacity-80 ${jobStatusColor(event.status)}`}
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
