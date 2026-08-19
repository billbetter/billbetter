import React, { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, GripVertical } from "lucide-react";
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
  parseISO,
  isPast,
} from "date-fns";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

export default function CalendarGridView({
  events,
  onEventClick,
  onEventDrop,
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewType, setViewType] = useState("month"); // 'month' or 'week'

  const renderHeader = () => {
    return (
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCurrentMonth(
                subMonths(currentMonth, viewType === "month" ? 1 : 0.25),
              )
            }
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-bold text-content min-w-[160px] text-center dark:text-content-inverted">
            {format(currentMonth, "MMMM yyyy")}
          </h2>
          <Button
            variant="outline"
            size="icon"
            onClick={() =>
              setCurrentMonth(
                addMonths(currentMonth, viewType === "month" ? 1 : 0.25),
              )
            }
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewType === "week" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("week")}
            className={viewType === "week" ? "bg-success-600" : ""}
          >
            Week
          </Button>
          <Button
            variant={viewType === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewType("month")}
            className={viewType === "month" ? "bg-success-600" : ""}
          >
            Month
          </Button>
        </div>
      </div>
    );
  };

  const renderDays = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return (
      <div className="grid grid-cols-7 mb-2">
        {days.map((day) => (
          <div
            key={day}
            className="text-center text-sm font-medium text-content-muted py-2"
          >
            {day}
          </div>
        ))}
      </div>
    );
  };

  const onDragEnd = (result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    const event = events.find(
      (e) => e.uri === draggableId || e.id === draggableId,
    );
    const newDate = new Date(destination.droppableId);

    if (event && onEventDrop) {
      onEventDrop(event, newDate);
    }
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate =
      viewType === "week" ? endOfWeek(currentMonth) : endOfWeek(monthEnd);

    const rows = [];
    let days = [];
    let day = startDate;

    while (day <= endDate) {
      for (let i = 0; i < 7; i++) {
        const cloneDay = day;
        const dayIso = cloneDay.toISOString();

        const dayEvents = events.filter((event) =>
          isSameDay(parseISO(event.start_time), cloneDay),
        );

        const isCurrentMonth = isSameMonth(day, monthStart);
        const isToday = isSameDay(day, new Date());

        days.push(
          <Droppable droppableId={dayIso} key={dayIso}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`min-h-[80px] sm:min-h-[100px] border border-line-subtle dark:border-ink-800 p-1 transition-colors ${
                  snapshot.isDraggingOver
                    ? "bg-success-50 ring-2 ring-success-500 ring-inset"
                    : !isCurrentMonth
                      ? "bg-surface-sunken"
                      : "bg-surface"
                } ${isToday && !snapshot.isDraggingOver ? "ring-2 ring-success-500 ring-inset" : ""}`}
              >
                <div
                  className={`text-sm font-medium mb-1 ${
                    isToday
                      ? "text-success-600"
                      : !isCurrentMonth
                        ? "text-content-subtle"
                        : "text-ink-700"
                  }`}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayEvents.map((event, index) => {
                    const invitee = event.invitees?.[0];
                    const isCanceled = event.status === "canceled";
                    const isCompleted =
                      isPast(parseISO(event.start_time)) && !isCanceled;
                    const isJob = event.type === "job";
                    // Only allow dragging jobs for now, unless we want to support calendly move (which is harder)
                    const isDraggable = isJob && !isCompleted && !isCanceled;
                    const eventId = event.uri || event.id;

                    return (
                      <Draggable
                        key={eventId}
                        draggableId={eventId}
                        index={index}
                        isDragDisabled={!isDraggable}
                      >
                        {(provided, snapshot) => (
                          <div
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            {...provided.dragHandleProps}
                            onClick={() => onEventClick(event)}
                            style={{ ...provided.draggableProps.style }}
                            className={`text-xs p-1 rounded cursor-pointer truncate shadow-sm flex items-center gap-1 ${
                              snapshot.isDragging
                                ? "opacity-50 ring-2 ring-success-500 z-50"
                                : ""
                            } ${
                              isCanceled
                                ? "bg-danger-100 text-danger-700 line-through"
                                : isCompleted
                                  ? "bg-ink-200 text-content-body"
                                  : isJob
                                    ? "bg-info-100 text-info-700 hover:bg-info-200"
                                    : "bg-success-100 text-success-700 hover:bg-success-200"
                            }`}
                          >
                            {isDraggable && (
                              <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
                            )}
                            <span className="font-medium">
                              {format(parseISO(event.start_time), "h:mm a")}
                            </span>
                            <span className="hidden sm:inline truncate">
                              -{" "}
                              {isJob
                                ? event.name
                                : invitee?.name?.split(" ")[0] || event.name}
                            </span>
                          </div>
                        )}
                      </Draggable>
                    );
                  })}
                  {provided.placeholder}
                </div>
              </div>
            )}
          </Droppable>,
        );
        day = addDays(day, 1);
      }
      rows.push(
        <div key={day.toString()} className="grid grid-cols-7">
          {days}
        </div>,
      );
      days = [];

      if (viewType === "week") break;
    }

    return (
      <div className="border border-line rounded-lg overflow-hidden dark:border-ink-700">
        {rows}
      </div>
    );
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <Card className="border-none shadow-lg">
        <CardHeader className="pb-2">{renderHeader()}</CardHeader>
        <CardContent>
          {renderDays()}
          {renderCells()}
        </CardContent>
      </Card>
    </DragDropContext>
  );
}
