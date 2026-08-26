import React from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Calendar as CalendarIcon,
  CheckCircle,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

              {/*
                Online booking is not built, so there is nothing here to
                configure. The controls that used to sit here bound to
                `booking_slug` and `available_hours` -- neither of which is a
                column on BusinessSettings (PostgREST answers 42703) -- and
                getAvailableSlots and createBooking both return
                not_implemented. A client following a booking link reached a
                page that 400s before it renders. See docs/feature-audit.md
                section 9.3.

                Worse: because Settings.jsx spreads formData into its PATCH,
                merely TYPING in the booking URL field made the whole settings
                save fail, so every unrelated setting on this page stopped
                saving with only "Failed to save settings." localDataEngine now
                strips unknown keys so that no longer breaks the save -- but a
                dial that turns nothing is not worth offering either way.

                Same treatment recurring invoices got: say plainly that it is
                not running.
              */}
              <div className="p-4 rounded-lg border border-line dark:border-ink-700 bg-surface dark:bg-ink-800/50">
                <p className="text-sm font-semibold text-content dark:text-content-inverted mb-1">
                  Online booking isn&apos;t available yet
                </p>
                <p className="text-xs text-content-body dark:text-content-subtle">
                  Clients can&apos;t book their own appointments through
                  Invoicium at the moment. Your calendar sync above still works
                  normally &mdash; jobs you schedule appear in Google Calendar.
                  We&apos;ll enable this here when it&apos;s ready.
                </p>
              </div>
            </div>
          </div>
        )}

        {/*
          Available Hours edited `available_hours`, which is not a column, and
          it only ever fed the booking page above. Removed alongside it.
        */}
      </CardContent>
    </Card>
  );
}
