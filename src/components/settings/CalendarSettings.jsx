import React from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  Clock,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

const DAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
const DEFAULT_WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
];

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "America/Toronto", label: "Toronto (ET)" },
  { value: "America/Vancouver", label: "Vancouver (PT)" },
  { value: "America/Winnipeg", label: "Winnipeg (CT)" },
  { value: "America/Edmonton", label: "Edmonton (MT)" },
  { value: "America/Halifax", label: "Halifax (AT)" },
  { value: "America/St_Johns", label: "Newfoundland (NT)" },
];

export default function CalendarSettings({
  formData,
  setFormData,
  settings,
  setSaveMessage,
  loadSettings,
}) {
  const getDefaultDayData = (day) => ({
    enabled: DEFAULT_WEEKDAYS.includes(day),
    start: "09:00",
    end: "17:00",
  });

  const updateDay = (day, updates) => {
    const current = formData.available_hours?.[day] || getDefaultDayData(day);
    setFormData({
      ...formData,
      available_hours: {
        ...(formData.available_hours || {}),
        [day]: { ...current, ...updates },
      },
    });
  };

  const bookingUrl = `https://invoicium.ca/PublicBooking?slug=${formData.booking_slug || ""}`;

  return (
    <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
          <CalendarIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
          Google Calendar & Online Booking
        </CardTitle>
        <p className="text-sm text-content-body dark:text-content-subtle">
          Connect Google Calendar and create your public booking page
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Google Calendar Connection */}
        <div className="p-6 border-2 border-success-200 dark:border-success-800 rounded-lg bg-success-50 dark:bg-success-900/20">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="font-semibold text-content dark:text-content-inverted mb-1 flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-success-600 dark:text-success-400" />
                Google Calendar Sync
              </h3>
              <p className="text-sm text-content-body dark:text-content-subtle">
                Real-time two-way sync with automatic conflict prevention
              </p>
            </div>
            {formData.google_calendar_connected && (
              <Badge className="bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900/30">
                <CheckCircle className="w-3 h-3 mr-1" />
                Connected
              </Badge>
            )}
          </div>

          {formData.google_calendar_connected ? (
            <div className="space-y-3">
              <div className="p-3 bg-success-100 dark:bg-success-900/50 border border-success-200 dark:border-success-700 rounded-lg">
                <p className="text-sm text-success-900 dark:text-success-200 font-medium flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Google Calendar connected and syncing
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  if (settings) {
                    await sdk.entities.BusinessSettings.update(settings.id, {
                      google_calendar_connected: false,
                      google_calendar_id: null,
                      booking_enabled: false,
                    });
                    setSaveMessage("Google Calendar disconnected");
                    setTimeout(() => setSaveMessage(null), 3000);
                    await loadSettings();
                  }
                }}
                className="w-full text-danger-600 dark:text-danger-400 border-danger-300 dark:border-danger-800"
              >
                Disconnect
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              onClick={async () => {
                try {
                  const response = await sdk.functions.invoke(
                    "connectGoogleCalendar",
                    { calendar_id: "primary" },
                  );
                  if (response.data?.success) {
                    setSaveMessage("Google Calendar connected successfully!");
                    setTimeout(() => setSaveMessage(null), 3000);
                    await loadSettings();
                  }
                } catch (error) {
                  setSaveMessage("Failed to connect Google Calendar");
                  setTimeout(() => setSaveMessage(null), 3000);
                }
              }}
              className="w-full bg-brand hover:bg-brand-hover gap-2"
            >
              <CalendarIcon className="w-4 h-4" />
              Connect Google Calendar
            </Button>
          )}
        </div>

        {/* Public Booking Setup */}
        {formData.google_calendar_connected && (
          <div className="p-6 border-2 border-info-200 dark:border-info-800 rounded-lg bg-info-50 dark:bg-info-900/20">
            <h3 className="font-semibold text-content dark:text-content-inverted mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-brand-700 dark:text-brand-400" />
              Public Booking Page
            </h3>

            <div className="space-y-4">
              <div>
                <Label
                  htmlFor="timezone"
                  className="text-ink-700 dark:text-ink-300"
                >
                  Your Business Timezone
                </Label>
                <select
                  id="timezone"
                  value={formData.timezone || "America/New_York"}
                  onChange={(e) =>
                    setFormData({ ...formData, timezone: e.target.value })
                  }
                  className="mt-1 w-full px-3 py-2 border border-line-strong dark:border-ink-700 rounded-lg text-sm bg-surface dark:bg-ink-800 text-content dark:text-content-inverted focus:outline-none focus:ring-2 focus:ring-success-500"
                >
                  {TIMEZONES.map((tz) => (
                    <option key={tz.value} value={tz.value}>
                      {tz.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                  Used to display correct appointment times for you and your
                  clients.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="booking_slug"
                    className="text-ink-700 dark:text-ink-300"
                  >
                    Booking Page URL Slug
                  </Label>
                  <Input
                    id="booking_slug"
                    value={formData.booking_slug || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        booking_slug: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9\-]/g, ""),
                      })
                    }
                    placeholder="your-business"
                    className="mt-1 bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                  />
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                    Unique URL for your booking page
                  </p>
                </div>

                <div>
                  <Label
                    htmlFor="default_appointment_duration"
                    className="text-ink-700 dark:text-ink-300"
                  >
                    Default Duration (minutes)
                  </Label>
                  <Input
                    id="default_appointment_duration"
                    type="number"
                    min="15"
                    step="15"
                    value={formData.default_appointment_duration || 60}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        default_appointment_duration: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label
                    htmlFor="booking_buffer_time"
                    className="text-ink-700 dark:text-ink-300"
                  >
                    Buffer Between Appointments (minutes)
                  </Label>
                  <Input
                    id="booking_buffer_time"
                    type="number"
                    min="0"
                    step="15"
                    value={formData.booking_buffer_time || 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        booking_buffer_time: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                  />
                </div>

                <div>
                  <Label
                    htmlFor="booking_notice_time"
                    className="text-ink-700 dark:text-ink-300"
                  >
                    Minimum Notice (minutes)
                  </Label>
                  <Input
                    id="booking_notice_time"
                    type="number"
                    min="0"
                    step="30"
                    value={formData.booking_notice_time || 60}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        booking_notice_time: parseInt(e.target.value),
                      })
                    }
                    className="mt-1 bg-surface dark:bg-ink-800 border-line-strong dark:border-ink-700 text-content dark:text-content-inverted"
                  />
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                    How far in advance clients must book
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="booking_enabled"
                  checked={formData.booking_enabled || false}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      booking_enabled: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-success-600 rounded border-line-strong dark:border-ink-700"
                />
                <Label
                  htmlFor="booking_enabled"
                  className="cursor-pointer text-ink-700 dark:text-ink-300"
                >
                  Enable public booking page
                </Label>
              </div>

              {formData.booking_slug && (
                <div className="p-4 bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-lg">
                  <p className="text-sm text-success-900 dark:text-success-200 font-medium mb-2">
                    ✅ Your Public Booking Page
                  </p>
                  <p className="text-xs text-success-800 dark:text-success-300 mb-2">
                    Share this link with clients:
                  </p>
                  <div className="flex gap-2">
                    <code className="flex-1 px-3 py-2 bg-surface dark:bg-ink-800 rounded border dark:border-ink-700 text-xs break-all text-ink-800 dark:text-ink-200">
                      {bookingUrl}
                    </code>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(bookingUrl);
                        setSaveMessage("Link copied!");
                        setTimeout(() => setSaveMessage(null), 2000);
                      }}
                      className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
                    >
                      Copy
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Available Hours */}
        {formData.google_calendar_connected && (
          <div className="p-6 border-2 border-line dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800/50">
            <h3 className="font-semibold text-content dark:text-content-inverted mb-1 flex items-center gap-2">
              <Clock className="w-5 h-5 text-success-600 dark:text-success-400" />
              Available Hours
            </h3>
            <p className="text-sm text-content-body dark:text-content-subtle mb-4">
              Set which days and hours clients can book appointments
            </p>
            <div className="space-y-3">
              {DAYS.map((day) => {
                const dayData =
                  formData.available_hours?.[day] || getDefaultDayData(day);
                return (
                  <div key={day} className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 w-32">
                      <input
                        type="checkbox"
                        id={`day-${day}`}
                        checked={dayData.enabled}
                        onChange={(e) =>
                          updateDay(day, { enabled: e.target.checked })
                        }
                        className="w-4 h-4 text-success-600 rounded border-line-strong dark:border-ink-700"
                      />
                      <label
                        htmlFor={`day-${day}`}
                        className="text-sm font-medium text-ink-700 dark:text-ink-300 capitalize cursor-pointer w-20"
                      >
                        {day}
                      </label>
                    </div>
                    {dayData.enabled ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="time"
                          value={dayData.start}
                          onChange={(e) =>
                            updateDay(day, { start: e.target.value })
                          }
                          className="px-2 py-1 border border-line-strong dark:border-ink-700 rounded text-sm bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
                        />
                        <span className="text-content-muted dark:text-content-subtle text-sm">
                          to
                        </span>
                        <input
                          type="time"
                          value={dayData.end}
                          onChange={(e) =>
                            updateDay(day, { end: e.target.value })
                          }
                          className="px-2 py-1 border border-line-strong dark:border-ink-700 rounded text-sm bg-surface dark:bg-ink-800 text-content dark:text-content-inverted"
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-content-subtle dark:text-content-body italic dark:dark:text-ink-300">
                        Unavailable
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-content-muted dark:text-content-subtle mt-3">
              💡 Save settings after making changes. Google Calendar events will
              automatically block off booked times.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
