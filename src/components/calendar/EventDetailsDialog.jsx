import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, ExternalLink } from "lucide-react";
import { format, parseISO, differenceInMinutes } from "date-fns";

export default function EventDetailsDialog({ event, isOpen, onClose }) {
  if (!event) return null;

  const startTime = parseISO(event.start_time || event.start);
  const endTime = parseISO(event.end_time || event.end);
  const duration = differenceInMinutes(endTime, startTime);

  const getTypeColor = () => {
    if (event.type === "job") return "bg-info-100 text-info-700";
    if (event.type === "google_calendar") return "bg-brand-100 text-brand-700";
    return "bg-ink-100 text-ink-700";
  };

  const getStatusColor = () => {
    if (event.status === "completed") return "bg-success-100 text-success-700";
    if (event.status === "in_progress")
      return "bg-caution-100 text-caution-700";
    if (event.status === "canceled" || event.status === "cancelled")
      return "bg-danger-100 text-danger-700";
    return "bg-ink-100 text-ink-700";
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {event.name || event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge className={getTypeColor()}>
              {event.type === "job"
                ? "Internal Job"
                : event.type === "google_calendar"
                  ? "Google Calendar"
                  : "Event"}
            </Badge>
            <Badge className={getStatusColor()}>
              {event.status || "scheduled"}
            </Badge>
            <Badge variant="outline">{duration} minutes</Badge>
          </div>

          {/* Event Details */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-content dark:text-content-inverted">
                  {format(startTime, "EEEE, MMMM d, yyyy")}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-info-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-content dark:text-content-inverted">
                  {format(startTime, "h:mm a")} - {format(endTime, "h:mm a")}
                </p>
              </div>
            </div>

            {event.client_name && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-content dark:text-content-inverted">
                    {event.client_name}
                  </p>
                  {event.invitees?.[0]?.email && (
                    <p className="text-xs text-content-body dark:text-ink-300">
                      {event.invitees[0].email}
                    </p>
                  )}
                </div>
              </div>
            )}

            {(event.location?.location || event.location) && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-content dark:text-content-inverted">
                    {typeof event.location === "string"
                      ? event.location
                      : event.location?.location || ""}
                  </p>
                </div>
              </div>
            )}

            {event.description && (
              <div className="pt-3 border-t">
                <p className="text-sm text-ink-700 dark:text-ink-300">
                  {event.description}
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            {event.uri && (
              <a
                href={event.uri}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-4 h-4" />
                  View in Calendar
                </Button>
              </a>
            )}
            <Button
              onClick={onClose}
              className="flex-1 bg-brand hover:bg-brand-hover"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
