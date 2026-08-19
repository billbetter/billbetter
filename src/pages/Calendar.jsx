import React, { useState, useEffect, useMemo, useRef } from "react";
import { sdk } from "@/api/sdk";
import { Button } from "@/components/ui/button";
import {
  Calendar as CalendarIcon,
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  Filter as FilterIcon,
  X,
  Plus,
  MapPin,
  Clock,
  User,
  ChevronLeft,
  ChevronRight,
  Grid3X3,
  List,
  CalendarDays,
} from "lucide-react";
import {
  parseISO,
  isPast,
  isToday,
  isTomorrow,
  addDays,
  isWithinInterval,
  set,
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
} from "date-fns";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion, AnimatePresence } from "framer-motion";
import EventDetailsDialog from "@/components/calendar/EventDetailsDialog";
import MonthView from "@/components/calendar/MonthView";
import WeekView from "@/components/calendar/WeekView";
import DayView from "@/components/calendar/DayView";

const STATUS_COLORS = {
  planning: "bg-ink-100 dark:bg-ink-700 text-ink-700 dark:text-ink-300",
  in_progress:
    "bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300",
  completed:
    "bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300",
  cancelled:
    "bg-danger-100 dark:bg-danger-900/40 text-danger-600 dark:text-danger-300",
  active:
    "bg-success-100 dark:bg-success-900/40 text-success-700 dark:text-success-300",
  google_calendar:
    "bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-300",
};

const EVENT_DOT_COLORS = {
  job: "bg-success-500",
  google_calendar: "bg-brand-600",
  default: "bg-brand-500",
};

// A clean mobile event card
function MobileEventCard({ event, onClick }) {
  const start = parseISO(event.start_time);
  const isPastEvent = isPast(start);
  const isJobEvent = event.type === "job";
  const jobStatus = event.originalJob?.status;

  const dotColor = EVENT_DOT_COLORS[event.type] || EVENT_DOT_COLORS.default;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left bg-surface dark:bg-ink-800 rounded-2xl border border-line-subtle dark:border-ink-700 shadow-sm overflow-hidden active:shadow-md transition-all"
    >
      {/* Top color bar */}
      <div
        className={`h-1 w-full ${isJobEvent ? "bg-success-500" : "bg-brand-600"}`}
      />
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Date badge */}
          <div
            className={`flex-shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-sm ${
              isToday(start)
                ? "bg-success-600 text-content-inverted"
                : isPastEvent
                  ? "bg-ink-100 dark:bg-ink-700 text-content-muted dark:text-content-subtle"
                  : "bg-success-50 dark:bg-success-900/30 text-success-700 dark:text-success-300"
            }`}
          >
            <span className="text-[10px] font-bold uppercase leading-none">
              {format(start, "MMM")}
            </span>
            <span className="text-lg font-black leading-tight">
              {format(start, "d")}
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <div
                className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`}
              />
              <h3
                className={`text-sm font-bold truncate ${isPastEvent ? "text-content-muted dark:text-content-subtle" : "text-content dark:text-content-inverted"}`}
              >
                {event.name}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
              <span className="flex items-center gap-1 text-xs text-content-muted dark:text-content-subtle">
                <Clock className="w-3 h-3 flex-shrink-0" />
                {format(start, "h:mm a")}
              </span>

              {event.invitees?.[0]?.name &&
                event.invitees[0].name !== "Google Calendar" && (
                  <span className="flex items-center gap-1 text-xs text-content-muted dark:text-content-subtle truncate max-w-[160px]">
                    <User className="w-3 h-3 flex-shrink-0" />
                    {event.invitees[0].name}
                  </span>
                )}

              {event.location?.location && (
                <span className="flex items-center gap-1 text-xs text-content-subtle dark:text-content-muted truncate max-w-[140px]">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {event.location.location}
                </span>
              )}
            </div>
          </div>

          {/* Status badge */}
          {isJobEvent && jobStatus && (
            <span
              className={`flex-shrink-0 text-[10px] font-bold px-2 py-1 rounded-lg capitalize ${STATUS_COLORS[jobStatus] || STATUS_COLORS.active}`}
            >
              {jobStatus.replace("_", " ")}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

// Section header for grouped lists
function DateSectionHeader({ label, count }) {
  return (
    <div className="flex items-center gap-2 px-1 mt-2 mb-1">
      <span className="text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider">
        {label}
      </span>
      <span className="text-xs font-bold text-content-body dark:text-ink-300 bg-ink-100 dark:bg-ink-800 rounded-full px-2 py-0.5">
        {count}
      </span>
    </div>
  );
}

export default function Calendar() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  // View & filter state
  const [viewMode, setViewMode] = useState("list");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dateFilter, setDateFilter] = useState("upcoming");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const isLoadingRef = useRef(false);

  useEffect(() => {
    loadCalendarData();
  }, []);

  const loadCalendarData = async (isRefresh = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const user = await sdk.auth.me();
      const settingsData = await sdk.entities.BusinessSettings.filter({
        user_id: user.id,
      });
      const s = settingsData.length > 0 ? settingsData[0] : null;
      if (s) setSettings(s);

      let jobs = await sdk.entities.Job.filter({ user_id: user.id });
      if (profile) jobs = jobs.filter((j) => j.assigned_to === user.id);

      const jobEvents = jobs
        .filter((job) => job.scheduled_start_time)
        .map((job) => ({
          id: job.id,
          uri: `job_${job.id}`,
          name: job.job_title,
          start_time: job.scheduled_start_time,
          end_time: job.scheduled_end_time || job.scheduled_start_time,
          status: job.status === "cancelled" ? "canceled" : "active",
          type: "job",
          invitees: [{ name: job.client_name, email: "" }],
          location: { type: "physical", location: job.location },
          originalJob: job,
        }));

      let allEvents = [...jobEvents];

      if (s?.google_calendar_connected) {
        setIsConnected(true);
        try {
          const gcalResponse = await sdk.functions.invoke(
            "fetchGoogleCalendarEvents",
            {
              time_min: new Date().toISOString(),
              time_max: addDays(new Date(), 90).toISOString(),
            },
          );
          if (gcalResponse.data?.events) {
            const gcalEvents = gcalResponse.data.events
              .filter((ev) => ev.start?.dateTime)
              .map((ev) => ({
                id: ev.id,
                uri: ev.htmlLink || `gcal_${ev.id}`,
                name: ev.summary || "Google Calendar Event",
                start_time: ev.start.dateTime,
                end_time: ev.end?.dateTime || ev.start.dateTime,
                status: ev.status === "cancelled" ? "canceled" : "active",
                type: "google_calendar",
                invitees: [
                  {
                    name: ev.organizer?.displayName || "Google Calendar",
                    email: ev.organizer?.email || "",
                  },
                ],
                location: { type: "physical", location: ev.location || "" },
                description: ev.description || "",
              }));
            allEvents = [...allEvents, ...gcalEvents];
          }
        } catch (e) {
          console.warn("Google Calendar fetch error", e);
        }
      } else {
        setIsConnected(false);
      }

      setEvents(allEvents);
      setError(null);
    } catch (err) {
      console.error("Error loading calendar:", err);
      setError("Failed to load calendar events");
    } finally {
      setLoading(false);
      setRefreshing(false);
      isLoadingRef.current = false;
    }
  };

  const handleEventDrop = async (event, newDate) => {
    if (event.type !== "job") return;
    try {
      const oldStart = parseISO(event.start_time);
      const oldEnd = parseISO(event.end_time);
      const duration = oldEnd.getTime() - oldStart.getTime();
      const newStart = set(newDate, {
        hours: oldStart.getHours(),
        minutes: oldStart.getMinutes(),
        seconds: oldStart.getSeconds(),
      });
      const newEnd = new Date(newStart.getTime() + duration);

      setEvents((prev) =>
        prev.map((e) =>
          e.id === event.id
            ? {
                ...e,
                start_time: newStart.toISOString(),
                end_time: newEnd.toISOString(),
              }
            : e,
        ),
      );
      await sdk.entities.Job.update(event.id, {
        scheduled_start_time: newStart.toISOString(),
        scheduled_end_time: newEnd.toISOString(),
      });
      try {
        await sdk.functions.invoke("syncJobToGoogleCalendar", {
          job_id: event.id,
          action: "update",
        });
      } catch {}
    } catch (err) {
      console.error("Error rescheduling job:", err);
      loadCalendarData();
    }
  };

  const handleConvertToJob = (event, clientName, clientEmail) => {
    const params = new URLSearchParams({
      client_name: clientName || "",
      client_email: clientEmail || "",
      job_title: event.name || "New Job",
      from_calendly: "true",
    });
    navigate(`${createPageUrl("CreateJob")}?${params.toString()}`);
  };

  const handleConvertToInvoice = (event, clientName, clientEmail) => {
    const params = new URLSearchParams({
      client_name: clientName || "",
      client_email: clientEmail || "",
      description: event.name || "",
      from_calendly: "true",
    });
    navigate(`${createPageUrl("CreateInvoice")}?${params.toString()}`);
  };

  const filteredEvents = useMemo(() => {
    let result = [...events];
    const now = new Date();

    if (dateFilter !== "all") {
      result = result.filter((event) => {
        const eventDate = parseISO(event.start_time);
        switch (dateFilter) {
          case "today":
            return isToday(eventDate);
          case "tomorrow":
            return isTomorrow(eventDate);
          case "week":
            return isWithinInterval(eventDate, {
              start: now,
              end: addDays(now, 7),
            });
          case "month":
            return isWithinInterval(eventDate, {
              start: now,
              end: addDays(now, 30),
            });
          case "upcoming":
            return !isPast(eventDate) || isToday(eventDate);
          default:
            return true;
        }
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((event) => {
        const eventDate = parseISO(event.start_time);
        switch (statusFilter) {
          case "upcoming":
            return !isPast(eventDate) && event.status === "active";
          case "completed":
            return isPast(eventDate) && event.status === "active";
          case "canceled":
            return event.status === "canceled";
          default:
            return true;
        }
      });
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (event) =>
          event.name?.toLowerCase().includes(q) ||
          event.invitees?.[0]?.name?.toLowerCase().includes(q),
      );
    }

    result.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    return result;
  }, [events, dateFilter, statusFilter, searchQuery]);

  // Group events by date label for mobile list
  const groupedEvents = useMemo(() => {
    const groups = {};
    filteredEvents.forEach((event) => {
      const d = parseISO(event.start_time);
      let label;
      if (isToday(d)) label = "Today";
      else if (isTomorrow(d)) label = "Tomorrow";
      else label = format(d, "EEEE, MMM d");
      if (!groups[label]) groups[label] = [];
      groups[label].push(event);
    });
    return Object.entries(groups);
  }, [filteredEvents]);

  const upcomingCount = events.filter(
    (e) => !isPast(parseISO(e.start_time)) || isToday(parseISO(e.start_time)),
  ).length;
  const todayCount = events.filter((e) =>
    isToday(parseISO(e.start_time)),
  ).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-surface-sunken dark:bg-surface-inverted-deep">
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface dark:bg-ink-800 shadow-lg flex items-center justify-center border border-line-subtle dark:border-ink-700">
            <Loader2 className="w-7 h-7 animate-spin text-success-600" />
          </div>
          <p className="text-content-muted dark:text-content-subtle text-sm font-medium">
            Loading schedule...
          </p>
        </div>
      </div>
    );
  }

  const viewModes = [
    { id: "list", label: "List", icon: List },
    { id: "day", label: "Day", icon: CalendarDays },
    { id: "week", label: "Week", icon: Grid3X3 },
    { id: "month", label: "Month", icon: CalendarIcon },
  ];

  const calendarViewEvents = filteredEvents.map((e) => ({
    ...e,
    start: e.start_time,
    end: e.end_time,
    title: e.name,
    status: e.originalJob?.status || e.status,
    client_name: e.invitees?.[0]?.name,
    location: e.location?.location || "",
  }));

  return (
    <div className="min-h-screen bg-surface-sunken dark:bg-surface-inverted-deep">
      {/* ── Mobile Header ── */}
      <div className="lg:hidden bg-surface dark:bg-surface-inverted border-b border-line-subtle dark:border-ink-800 sticky top-0 z-30">
        <div className="px-4 pt-4 pb-3 space-y-3">
          {/* Title row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-success-600 flex items-center justify-center shadow-md">
                <CalendarIcon
                  className="w-4.5 h-4.5 text-content-inverted"
                  style={{ width: 18, height: 18 }}
                />
              </div>
              <div>
                <h1 className="text-xl font-black text-content dark:text-content-inverted leading-tight">
                  Schedule
                </h1>
                <p className="text-xs text-content-muted dark:text-content-subtle font-medium">
                  {todayCount > 0
                    ? `${todayCount} today`
                    : upcomingCount > 0
                      ? `${upcomingCount} upcoming`
                      : "No upcoming events"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadCalendarData(true)}
                disabled={refreshing}
                className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-content-body dark:text-ink-300 active:bg-ink-200 dark:active:bg-ink-700 transition-colors"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
              </button>
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className="w-9 h-9 rounded-xl bg-ink-100 dark:bg-ink-800 flex items-center justify-center text-content-body dark:text-ink-300 active:bg-ink-200 dark:active:bg-ink-700 transition-colors"
              >
                <FilterIcon className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* View mode pills */}
          <div className="flex gap-1.5 bg-ink-100 dark:bg-ink-800 rounded-xl p-1">
            {viewModes.map((v) => (
              <button
                key={v.id}
                onClick={() => setViewMode(v.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === v.id
                    ? "bg-surface dark:bg-ink-700 text-content dark:text-content-inverted shadow-sm"
                    : "text-content-muted dark:text-content-subtle active:bg-surface/50 dark:active:bg-ink-700/50"
                }`}
              >
                <v.icon className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">{v.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Desktop Header ── */}
      <div className="hidden lg:block px-6 pt-6 pb-0 max-w-7xl mx-auto">
        <div className="bg-surface dark:bg-surface-inverted rounded-2xl border border-line-subtle dark:border-ink-800 p-5 mb-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-success-600 flex items-center justify-center shadow-md">
                <CalendarIcon className="w-5 h-5 text-content-inverted" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-content dark:text-content-inverted">
                  My Schedule
                </h1>
                <p className="text-sm text-content-muted dark:text-content-subtle">
                  {upcomingCount} upcoming · {todayCount} today
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex bg-ink-100 dark:bg-ink-800 rounded-xl p-1 gap-1">
                {viewModes.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setViewMode(v.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                      viewMode === v.id
                        ? "bg-surface dark:bg-ink-700 text-content dark:text-content-inverted shadow-sm"
                        : "text-content-muted dark:text-content-subtle hover:text-ink-700 dark:hover:text-ink-300"
                    }`}
                  >
                    <v.icon className="w-4 h-4" />
                    {v.label}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadCalendarData(true)}
                disabled={refreshing}
                className="gap-2 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
              >
                <RefreshCw
                  className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
                />
                Sync
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="lg:px-6 lg:pb-6 max-w-7xl mx-auto">
        {/* Booking Page Banner */}
        {settings?.booking_enabled &&
          settings?.booking_slug &&
          viewMode === "list" && (
            <div className="mx-4 lg:mx-0 mb-4">
              <div className="bg-success-600 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-lg">
                <div className="text-content-inverted min-w-0">
                  <p className="font-bold text-sm">
                    Public Booking Page Active
                  </p>
                  <p className="text-success-100 text-xs truncate">
                    {window.location.origin}/booking?slug=
                    {settings.booking_slug}
                  </p>
                </div>
                <a
                  href={`/booking?slug=${settings.booking_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0"
                >
                  <button className="bg-surface/20 hover:bg-surface/30 text-content-inverted text-xs font-semibold px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5 dark:bg-surface-inverted/20 dark:hover:bg-surface-inverted/30">
                    <ExternalLink className="w-3.5 h-3.5" />
                    View
                  </button>
                </a>
              </div>
            </div>
          )}

        {/* ── List View ── */}
        {viewMode === "list" && (
          <div className="px-4 lg:px-0 pb-24 lg:pb-6">
            {groupedEvents.length === 0 ? (
              <div className="bg-surface dark:bg-ink-800 rounded-2xl border border-line-subtle dark:border-ink-700 shadow-sm mt-4">
                <div className="p-10 text-center">
                  <div className="w-16 h-16 bg-ink-100 dark:bg-ink-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <CalendarIcon className="w-8 h-8 text-content-subtle dark:text-content-muted" />
                  </div>
                  <h3 className="text-lg font-black text-content dark:text-content-inverted mb-2">
                    No Events Found
                  </h3>
                  <p className="text-content-muted dark:text-content-subtle text-sm mb-6 max-w-xs mx-auto">
                    {events.length === 0
                      ? "You don't have any scheduled jobs yet. Create a job and schedule it to see it here."
                      : "No events match your current filters. Try changing the date range or clearing filters."}
                  </p>
                  {events.length === 0 && (
                    <Link to={createPageUrl("JobPhotos")}>
                      <Button className="bg-brand hover:bg-brand-hover text-content-inverted h-10 px-6 rounded-xl font-semibold">
                        <Plus className="w-4 h-4 mr-2" />
                        Create a Job
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-1">
                <AnimatePresence>
                  {groupedEvents.map(([label, dayEvents]) => (
                    <div key={label}>
                      <DateSectionHeader
                        label={label}
                        count={dayEvents.length}
                      />
                      <div className="space-y-2">
                        {dayEvents.map((event) => (
                          <MobileEventCard
                            key={event.uri}
                            event={event}
                            onClick={() => setSelectedEvent(event)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ── Calendar Views ── */}
        {viewMode === "month" && (
          <div className="px-4 lg:px-0 pb-24 lg:pb-0">
            <MonthView
              events={calendarViewEvents}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              onEventClick={(ev) => {
                const full = filteredEvents.find((e) => e.id === ev.id);
                setSelectedEvent(full);
              }}
            />
          </div>
        )}

        {viewMode === "week" && (
          <div className="px-0 pb-24 lg:pb-0">
            <WeekView
              events={calendarViewEvents}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
            />
          </div>
        )}

        {viewMode === "day" && (
          <div className="px-4 lg:px-0 pb-24 lg:pb-0">
            <DayView
              events={calendarViewEvents}
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
            />
          </div>
        )}
      </div>

      {/* ── Event Details Dialog ── */}
      <EventDetailsDialog
        event={selectedEvent}
        isOpen={!!selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />

      {/* ── Mobile Filters Bottom Sheet ── */}
      <AnimatePresence>
        {mobileFiltersOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="lg:hidden fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setMobileFiltersOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface dark:bg-surface-inverted rounded-t-3xl shadow-2xl z-50 overflow-hidden"
              style={{
                paddingBottom: "max(env(safe-area-inset-bottom), 24px)",
              }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 bg-ink-300 dark:bg-ink-600 rounded-full" />
              </div>
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-line-subtle dark:border-ink-800">
                <h3 className="text-base font-black text-content dark:text-content-inverted">
                  Filters
                </h3>
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-8 h-8 rounded-full bg-ink-100 dark:bg-ink-800 flex items-center justify-center active:bg-ink-200 dark:active:bg-ink-700 transition-colors"
                >
                  <X className="w-4 h-4 text-content-body dark:text-ink-300" />
                </button>
              </div>

              <div className="px-5 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* Date Range */}
                <div>
                  <p className="text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider mb-2">
                    Date Range
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      "upcoming",
                      "today",
                      "tomorrow",
                      "week",
                      "month",
                      "all",
                    ].map((f) => (
                      <button
                        key={f}
                        onClick={() => setDateFilter(f)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                          dateFilter === f
                            ? "bg-success-600 text-content-inverted shadow-md"
                            : "bg-ink-100 dark:bg-ink-800 text-content-body dark:text-ink-300 active:bg-ink-200 dark:active:bg-ink-700"
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status */}
                <div>
                  <p className="text-xs font-bold text-content-muted dark:text-content-subtle uppercase tracking-wider mb-2">
                    Status
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {["all", "upcoming", "completed", "canceled"].map((s) => (
                      <button
                        key={s}
                        onClick={() => setStatusFilter(s)}
                        className={`py-2.5 rounded-xl text-sm font-semibold transition-all capitalize ${
                          statusFilter === s
                            ? "bg-success-600 text-content-inverted shadow-md"
                            : "bg-ink-100 dark:bg-ink-800 text-content-body dark:text-ink-300 active:bg-ink-200 dark:active:bg-ink-700"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-5 pt-2">
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="w-full bg-brand hover:bg-brand-hover text-content-inverted py-3.5 rounded-2xl font-bold text-base shadow-lg active:scale-[0.99] transition-all"
                >
                  Apply Filters
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
