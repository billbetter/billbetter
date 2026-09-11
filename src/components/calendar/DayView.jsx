import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import PeriodNavigation from "./PeriodNavigation";
import { jobStatusColor } from "./jobStatusColor";
import { format, addDays, subDays, isSameDay } from "date-fns";

export default function DayView({ events, currentDate, setCurrentDate }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, currentDate) && eventDate.getHours() === hour;
    });
  };

  return (
    <Card className="border-none shadow-lg">
      <CardContent className="p-6">
        <PeriodNavigation
          title={format(currentDate, "EEEE, MMMM d, yyyy")}
          onPrevious={() => setCurrentDate(subDays(currentDate, 1))}
          onNext={() => setCurrentDate(addDays(currentDate, 1))}
          spacingClassName="mb-6"
          titleSizeClassName="text-2xl"
        />

        {/* Day Schedule */}
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {hours.map((hour) => {
            const hourEvents = getEventsForHour(hour);
            return (
              <div key={hour} className="flex gap-4 border-b pb-2">
                <div className="w-20 text-sm font-medium text-content-body pt-2 dark:text-ink-300">
                  {format(new Date().setHours(hour, 0), "h:mm a")}
                </div>
                <div className="flex-1 min-h-16 space-y-2">
                  {hourEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-lg text-content-inverted shadow-sm cursor-pointer hover:opacity-90 transition-opacity ${jobStatusColor(event.status)}`}
                    >
                      <div className="font-semibold text-sm">
                        {format(new Date(event.start), "h:mm a")} -{" "}
                        {event.title}
                      </div>
                      <div className="text-xs mt-1 opacity-90">
                        {event.client_name && `Client: ${event.client_name}`}
                        {event.location && ` • ${event.location}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
