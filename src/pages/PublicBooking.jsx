import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import SEO from "@/components/seo/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

export default function PublicBooking() {
  const [bookingSlug, setBookingSlug] = useState("");
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState(
    startOfWeek(new Date(), { weekStartsOn: 0 }),
  );

  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    client_phone: "",
    job_type: "",
    notes: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("slug");
    if (slug) {
      setBookingSlug(slug);
      loadBookingPage(slug);
    } else {
      setError("Invalid booking link");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (bookingSlug && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedDate, bookingSlug]);

  const loadBookingPage = async (slug) => {
    try {
      const settingsData = await sdk.entities.BusinessSettings.filter({
        booking_slug: slug,
      });

      if (settingsData.length === 0) {
        setError("Booking page not found");
        setLoading(false);
        return;
      }

      const userSettings = settingsData[0];

      if (
        !userSettings.booking_enabled ||
        !userSettings.google_calendar_connected
      ) {
        setError("Booking is not available at this time");
        setLoading(false);
        return;
      }

      setSettings(userSettings);
      setLoading(false);
    } catch (err) {
      console.error("Error loading booking page:", err);
      setError("Failed to load booking page");
      setLoading(false);
    }
  };

  const loadAvailableSlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await sdk.functions.invoke("getAvailableSlots", {
        booking_slug: bookingSlug,
        date: selectedDate.toISOString().split("T")[0],
        duration: settings?.default_appointment_duration || 60,
      });

      if (response.data?.available_slots) {
        setAvailableSlots(response.data.available_slots);
      }
    } catch (err) {
      console.error("Error loading slots:", err);
    }
    setLoadingSlots(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await sdk.functions.invoke("createBooking", {
        booking_slug: bookingSlug,
        start_time: selectedSlot.start,
        end_time: selectedSlot.end,
        ...formData,
      });

      if (response.data?.success) {
        setSuccess(true);
      } else if (response.data?.not_implemented) {
        // Previously invented a booking_id and showed a confirmation. A client
        // believing they have an appointment that does not exist is the worst
        // outcome on this page.
        setError(
          "Online booking isn't available yet. Please contact the business directly to arrange a time.",
        );
      } else {
        setError(response.data?.error || "Failed to create booking");
      }
    } catch (err) {
      setError(err.message || "Failed to create booking");
    }
    setSubmitting(false);
  };

  const weekDays = Array.from({ length: 7 }, (_, i) =>
    addDays(currentWeekStart, i),
  );

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "rgb(var(--accent-50))" }}
      >
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-success-600 mx-auto mb-3" />
          <p className="text-content-muted text-sm">Loading booking page...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "rgb(var(--accent-50))" }}
      >
        <div className="max-w-md w-full bg-surface rounded-2xl shadow-xl p-8 text-center">
          <div className="w-16 h-16 bg-danger-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-xl font-black text-content mb-2">
            Unable to Load Booking Page
          </h2>
          <p className="text-content-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: "rgb(var(--accent-50))" }}
      >
        <div className="max-w-md w-full bg-surface rounded-2xl shadow-xl p-8 text-center">
          <div className="w-20 h-20 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <h2 className="text-2xl font-black text-content mb-2">
            Booking Confirmed!
          </h2>
          <p className="text-content-muted mb-6">
            A confirmation email has been sent to{" "}
            <span className="font-medium text-ink-700">
              {formData.client_email}
            </span>
            .
          </p>
          <div className="bg-success-50 border border-success-100 rounded-xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <CalendarIcon className="w-4 h-4 text-success-600 flex-shrink-0" />
              <span>
                <strong>Date:</strong>{" "}
                {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <Clock className="w-4 h-4 text-success-600 flex-shrink-0" />
              <span>
                <strong>Time:</strong> {selectedSlot?.display_time} ·{" "}
                {settings?.default_appointment_duration || 60} min
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen py-8 px-4"
      style={{ background: "rgb(var(--accent-50))" }}
    >
      <SEO
        title={
          settings?.business_name
            ? `Book with ${settings.business_name}`
            : "Book an Appointment"
        }
        description={`Schedule an appointment with ${settings?.business_name || "your contractor"}.`}
        noindex={true}
      />
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          {settings?.logo_url && (
            <img
              src={settings.logo_url}
              alt="Logo"
              className="w-16 h-16 rounded-xl object-contain bg-surface shadow-md p-2 mx-auto mb-3"
            />
          )}
          <h1 className="text-3xl font-black text-content">
            {settings?.business_name}
          </h1>
          <p className="text-content-muted mt-1">Book an appointment online</p>
        </div>

        <div className="grid md:grid-cols-5 gap-6">
          {/* Left: Date & Time */}
          <div className="md:col-span-3 space-y-5">
            {/* Date Picker */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line-subtle p-6">
              <h3 className="font-black text-content mb-4 flex items-center gap-2 text-base">
                <div className="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                  <CalendarIcon className="w-4 h-4 text-success-600" />
                </div>
                Select a Date
              </h3>

              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() =>
                    setCurrentWeekStart(addDays(currentWeekStart, -7))
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:bg-surface-sunken transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-content-body" />
                </button>
                <span className="text-sm font-semibold text-ink-700">
                  {format(currentWeekStart, "MMM d")} –{" "}
                  {format(addDays(currentWeekStart, 6), "MMM d, yyyy")}
                </span>
                <button
                  onClick={() =>
                    setCurrentWeekStart(addDays(currentWeekStart, 7))
                  }
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-line hover:bg-surface-sunken transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-content-body" />
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1.5">
                {weekDays.map((day) => {
                  const isSelected = isSameDay(day, selectedDate);
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => {
                        setSelectedDate(day);
                        setSelectedSlot(null);
                      }}
                      className={`py-2.5 px-1 rounded-xl text-center transition-all ${
                        isSelected
                          ? "bg-brand text-content-inverted shadow-md shadow-brand-200"
                          : "hover:bg-success-50 text-ink-700 border border-line-subtle"
                      }`}
                    >
                      <div
                        className={`text-xs font-medium mb-0.5 ${isSelected ? "text-success-100" : "text-content-subtle"}`}
                      >
                        {format(day, "EEE")}
                      </div>
                      <div className="text-base font-bold">
                        {format(day, "d")}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Time Slots */}
            <div className="bg-surface rounded-2xl shadow-sm border border-line-subtle p-6">
              <h3 className="font-black text-content mb-4 flex items-center gap-2 text-base">
                <div className="w-8 h-8 bg-info-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-4 h-4 text-info-600" />
                </div>
                Select a Time
                <span className="ml-auto text-xs font-normal text-content-subtle">
                  {format(selectedDate, "EEE, MMM d")}
                </span>
              </h3>

              {loadingSlots ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-6 h-6 animate-spin text-success-600" />
                  <span className="ml-2 text-sm text-content-muted">
                    Loading times...
                  </span>
                </div>
              ) : availableSlots.length === 0 ? (
                <div className="text-center py-10">
                  <div className="w-12 h-12 bg-ink-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Clock className="w-5 h-5 text-content-subtle" />
                  </div>
                  <p className="text-content-muted text-sm font-medium">
                    No available times
                  </p>
                  <p className="text-content-subtle text-xs mt-1">
                    Try selecting a different date
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableSlots.map((slot, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedSlot(slot)}
                      className={`py-2.5 px-2 rounded-xl text-sm font-semibold transition-all border ${
                        selectedSlot?.start === slot.start
                          ? "bg-brand text-content-inverted border-brand-700 shadow-md shadow-brand-200"
                          : "bg-surface hover:bg-success-50 hover:border-success-300 text-ink-700 border-line"
                      }`}
                    >
                      {slot.display_time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Form */}
          <div className="md:col-span-2">
            <div className="bg-surface rounded-2xl shadow-sm border border-line-subtle p-6 sticky top-6">
              <h3 className="font-black text-content mb-5 text-base">
                Your Information
              </h3>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-1.5 block">
                    Full Name *
                  </Label>
                  <Input
                    required
                    value={formData.client_name}
                    onChange={(e) =>
                      setFormData({ ...formData, client_name: e.target.value })
                    }
                    placeholder="John Doe"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-1.5 block">
                    Email Address *
                  </Label>
                  <Input
                    type="email"
                    required
                    value={formData.client_email}
                    onChange={(e) =>
                      setFormData({ ...formData, client_email: e.target.value })
                    }
                    placeholder="john@example.com"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-1.5 block">
                    Phone Number
                  </Label>
                  <Input
                    type="tel"
                    value={formData.client_phone}
                    onChange={(e) =>
                      setFormData({ ...formData, client_phone: e.target.value })
                    }
                    placeholder="+1 (555) 123-4567"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-1.5 block">
                    Service Type
                  </Label>
                  <Input
                    value={formData.job_type}
                    onChange={(e) =>
                      setFormData({ ...formData, job_type: e.target.value })
                    }
                    placeholder="e.g., Plumbing, Electrical"
                    className="h-10"
                  />
                </div>

                <div>
                  <Label className="text-xs font-semibold text-content-muted uppercase tracking-wide mb-1.5 block">
                    Additional Notes
                  </Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                    placeholder="Any details we should know..."
                    className="resize-none"
                  />
                </div>

                {selectedSlot ? (
                  <div className="p-3 bg-success-50 border border-success-200 rounded-xl">
                    <p className="text-xs font-semibold text-success-700 uppercase tracking-wide mb-1">
                      Selected Appointment
                    </p>
                    <p className="text-sm font-medium text-success-900">
                      {format(selectedDate, "EEEE, MMMM d, yyyy")}
                    </p>
                    <p className="text-sm text-success-700">
                      {selectedSlot.display_time} ·{" "}
                      {settings?.default_appointment_duration || 60} min
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-surface-sunken border border-dashed border-line rounded-xl text-center">
                    <p className="text-xs text-content-subtle">
                      ← Select a date and time to continue
                    </p>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-danger-50 border border-danger-200 rounded-xl">
                    <p className="text-sm text-danger-700">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={!selectedSlot || submitting}
                  className="w-full h-11 bg-brand hover:bg-brand-hover text-content-inverted font-semibold rounded-xl transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
