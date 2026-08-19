import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { format, addDays, subDays, isSameDay } from "date-fns";

export default function DayView({ events, currentDate, setCurrentDate }) {
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getEventsForHour = (hour) => {
    return events.filter((event) => {
      const eventDate = new Date(event.start);
      return isSameDay(eventDate, currentDate) && eventDate.getHours() === hour;
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
        {/* Day Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(subDays(currentDate, 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-2xl font-bold text-content dark:text-content-inverted">
            {format(currentDate, "EEEE, MMMM d, yyyy")}
          </h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentDate(addDays(currentDate, 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

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
                      className={`p-3 rounded-lg text-content-inverted shadow-sm cursor-pointer hover:opacity-90 transition-opacity ${getStatusColor(event.status)}`}
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
