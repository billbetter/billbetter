import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import {
  isBrowserNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  showBrowserNotification,
  getEnvironmentType,
} from "@/lib/notificationSupport";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellOff,
  CheckCircle,
  AlertCircle,
  Calendar,
  Clock,
  Mail,
} from "lucide-react";

export default function NotificationSettings() {
  const [preferences, setPreferences] = useState({
    invoice_sent: true,
    invoice_paid: true,
    invoice_overdue: true,
    quote_approved: true,
    quote_declined: true,
    payment_received: true,
    payment_failed: true,
    due_date_reminder: true,
    new_client: false,
    system_alerts: true,
  });
  const [pushSupported] = useState(() => isBrowserNotificationSupported());
  const [envType] = useState(() => getEnvironmentType());
  const [browserPermission, setBrowserPermission] = useState(() =>
    getNotificationPermission(),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [analyticsFrequency, setAnalyticsFrequency] = useState("biweekly");
  const [analyticsDay, setAnalyticsDay] = useState(1);
  const [analyticsTime, setAnalyticsTime] = useState("09:00");
  const [sendingTest, setSendingTest] = useState(false);
  const [sendReviewRequests, setSendReviewRequests] = useState(false);

  useEffect(() => {
    loadSettings();
    checkBrowserPermission();
  }, []);

  const checkBrowserPermission = () => {
    setBrowserPermission(getNotificationPermission());
  };

  const loadSettings = async () => {
    setLoading(true);
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      // Load preferences from user record or database
      if (currentUser.notification_preferences) {
        try {
          const parsed =
            typeof currentUser.notification_preferences === "string"
              ? JSON.parse(currentUser.notification_preferences)
              : currentUser.notification_preferences;
          setPreferences((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
          // ignore malformed preferences
        }
      }

      // Load business settings for analytics frequency
      const businessSettings = await sdk.entities.BusinessSettings.filter({
        user_id: currentUser.id,
      });
      if (businessSettings.length > 0) {
        setSettings(businessSettings[0]);
        setAnalyticsFrequency(
          businessSettings[0].analytics_email_frequency || "biweekly",
        );
        setAnalyticsDay(
          businessSettings[0].analytics_email_day !== undefined
            ? businessSettings[0].analytics_email_day
            : 1,
        );
        setAnalyticsTime(businessSettings[0].analytics_email_time || "09:00");
        setSendReviewRequests(
          businessSettings[0].send_review_requests === true,
        );
      }
    } catch (error) {
      console.error("Error loading notification settings:", error);
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await sdk.functions.invoke("saveNotificationSettings", {
        analytics_email_frequency: analyticsFrequency,
        analytics_email_day: analyticsDay,
        analytics_email_time: analyticsTime,
        send_review_requests: sendReviewRequests,
      });
      alert("Settings saved successfully!");
    } catch (error) {
      console.error(
        "Error saving notification settings:",
        error?.message || error,
      );
      alert(`Failed to save: ${error?.message || "Unknown error"}`);
    }
    setSaving(false);
  };

  const requestBrowserPermission = async () => {
    const result = await requestNotificationPermission();
    setBrowserPermission(result);
    if (result === "granted") {
      showBrowserNotification("Notifications Enabled!", {
        body: "You'll now receive updates from Invoicium",
        icon: "/icon-192.png",
      });
    }
  };

  const disableNotifications = () => {
    alert(
      "To disable notifications, please update your browser or device notification settings for this app.",
    );
  };

  const togglePreference = (key) => {
    setPreferences({
      ...preferences,
      [key]: !preferences[key],
    });
  };

  const sendTestEmail = async () => {
    setSendingTest(true);
    try {
      const response = await sdk.functions.invoke("sendTestAnalyticsEmail", {});
      alert(
        "✅ Test email sent! Check your inbox for a preview of your analytics report.",
      );
    } catch (error) {
      console.error("Error sending test email:", error);
      alert("❌ Failed to send test email. Please try again.");
    } finally {
      setSendingTest(false);
    }
  };

  const notificationTypes = [
    {
      key: "invoice_sent",
      label: "Invoice Sent",
      description: "When you send an invoice to a client",
    },
    {
      key: "invoice_paid",
      label: "Invoice Paid",
      description: "When a client pays an invoice",
    },
    {
      key: "invoice_overdue",
      label: "Invoice Overdue",
      description: "When an invoice becomes overdue",
    },
    {
      key: "quote_approved",
      label: "Quote Approved",
      description: "When a client approves a quote",
    },
    {
      key: "quote_declined",
      label: "Quote Declined",
      description: "When a client declines a quote",
    },
    {
      key: "payment_received",
      label: "Payment Received",
      description: "When you receive an online payment",
    },
    {
      key: "payment_failed",
      label: "Payment Failed",
      description: "When a payment attempt fails",
    },
    {
      key: "due_date_reminder",
      label: "Due Date Reminders",
      description: "Reminders for upcoming invoice due dates",
    },
    {
      key: "new_client",
      label: "New Client",
      description: "When a new client is added",
    },
    {
      key: "system_alerts",
      label: "System Alerts",
      description: "Important system updates and announcements",
    },
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-content-body dark:text-ink-300">
            Loading notification settings...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Browser Permission Status */}
      <Card className="bg-surface dark:bg-surface-inverted border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
            <Bell className="w-5 h-5 text-content dark:text-content-inverted" />
            Push Notifications
          </CardTitle>
          <CardDescription className="text-content-body dark:text-content-subtle">
            Control whether Invoicium can send you browser push notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!pushSupported ? (
            /* ── Unsupported environment (WebView / APK) ── */
            <div className="flex items-start gap-3 p-4 bg-warning-50 dark:bg-warning-900/20 rounded-lg border border-warning-200 dark:border-warning-800">
              <AlertCircle className="w-5 h-5 text-warning-600 dark:text-warning-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-warning-800 dark:text-warning-300 mb-1">
                  Push notifications are not available in this version yet.
                </p>
                <p className="text-sm text-warning-700 dark:text-warning-400">
                  Please use SMS, email, or in-app notifications instead. You
                  still receive all updates through the notification bell above.
                </p>
              </div>
            </div>
          ) : (
            /* ── Supported environment (desktop / mobile browser) ── */
            <>
              <div className="flex items-center justify-between p-4 bg-surface-sunken dark:bg-ink-800 rounded-lg">
                <div>
                  <p className="font-medium text-content dark:text-content-inverted">
                    Permission Status
                  </p>
                  <p className="text-sm text-content-body dark:text-content-subtle">
                    {browserPermission === "granted" &&
                      "Notifications are enabled"}
                    {browserPermission === "denied" &&
                      "Notifications are blocked. Enable them in your browser settings."}
                    {browserPermission === "default" &&
                      "Notifications not yet enabled"}
                  </p>
                </div>
                <Badge
                  className={
                    browserPermission === "granted"
                      ? "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 hover:bg-success-100 dark:hover:bg-success-900"
                      : browserPermission === "denied"
                        ? "bg-danger-100 text-danger-700 dark:bg-danger-900 dark:text-danger-300 hover:bg-danger-100 dark:hover:bg-danger-900"
                        : "bg-ink-100 text-ink-700 dark:bg-ink-800 dark:text-ink-300 hover:bg-ink-100 dark:hover:bg-ink-800"
                  }
                >
                  {browserPermission === "granted" && (
                    <CheckCircle className="w-4 h-4 mr-1" />
                  )}
                  {browserPermission === "denied" && (
                    <AlertCircle className="w-4 h-4 mr-1" />
                  )}
                  {browserPermission === "granted"
                    ? "Enabled"
                    : browserPermission === "denied"
                      ? "Blocked"
                      : "Not Set"}
                </Badge>
              </div>

              {browserPermission !== "granted" && (
                <Button
                  onClick={requestBrowserPermission}
                  className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
                >
                  <Bell className="w-4 h-4 mr-2" />
                  Enable Browser Notifications
                </Button>
              )}

              {browserPermission === "granted" && (
                <Button
                  onClick={disableNotifications}
                  variant="outline"
                  className="w-full border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-400 hover:bg-danger-50 dark:hover:bg-danger-900/20"
                >
                  <BellOff className="w-4 h-4 mr-2" />
                  Disable Notifications
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Analytics Email Frequency */}
      <Card className="bg-surface dark:bg-surface-inverted border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="text-content dark:text-content-inverted">
            Analytics Email Reports
          </CardTitle>
          <CardDescription className="text-content-body dark:text-content-subtle">
            Choose how often you receive monthly analytics summaries (available
            on Essential plan and above)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label className="text-sm font-medium text-content dark:text-content-inverted">
              Email Frequency
            </Label>
            <div className="grid gap-3">
              {[
                {
                  value: "weekly",
                  label: "Weekly",
                  description: "Every Monday at 9 AM",
                },
                {
                  value: "biweekly",
                  label: "Every 2 Weeks (Recommended)",
                  description: "Every other Monday at 9 AM",
                },
                {
                  value: "monthly",
                  label: "Monthly",
                  description: "First Monday of each month at 9 AM",
                },
                {
                  value: "disabled",
                  label: "Disabled",
                  description: "Do not send analytics emails",
                },
              ].map((option) => (
                <div
                  key={option.value}
                  onClick={() => setAnalyticsFrequency(option.value)}
                  className={`flex items-center justify-between p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    analyticsFrequency === option.value
                      ? "border-success-500 bg-success-50 dark:bg-success-900/30 dark:border-success-600"
                      : "border-line dark:border-ink-700 hover:border-line-strong dark:hover:border-ink-600 bg-surface dark:bg-ink-800"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-content dark:text-content-inverted">
                      {option.label}
                    </p>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      {option.description}
                    </p>
                  </div>
                  {analyticsFrequency === option.value && (
                    <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Day and Time Selection */}
          {analyticsFrequency !== "disabled" && (
            <div className="space-y-4 pt-4 border-t border-line dark:border-ink-700">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium text-content dark:text-content-inverted mb-2 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-success-600 dark:text-success-400" />
                    Preferred Day
                  </Label>
                  <select
                    value={analyticsDay}
                    onChange={(e) => setAnalyticsDay(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-line-strong dark:border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 bg-surface dark:bg-ink-800 text-content dark:text-content-inverted text-sm"
                  >
                    <option value={0}>Sunday</option>
                    <option value={1}>Monday</option>
                    <option value={2}>Tuesday</option>
                    <option value={3}>Wednesday</option>
                    <option value={4}>Thursday</option>
                    <option value={5}>Friday</option>
                    <option value={6}>Saturday</option>
                  </select>
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                    Day of the week to receive emails
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-content dark:text-content-inverted mb-2 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-success-600 dark:text-success-400" />
                    Preferred Time
                  </Label>
                  <input
                    type="time"
                    value={analyticsTime}
                    onChange={(e) => setAnalyticsTime(e.target.value)}
                    className="w-full px-3 py-2 border border-line-strong dark:border-ink-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-success-500 bg-surface dark:bg-ink-800 text-content dark:text-content-inverted text-sm"
                  />
                  <p className="text-xs text-content-muted dark:text-content-subtle mt-1">
                    Time of day (America/New_York timezone)
                  </p>
                </div>
              </div>

              <div className="p-3 bg-success-50 dark:bg-success-900/30 rounded-lg border border-success-200 dark:border-success-800">
                <p className="text-sm text-success-800 dark:text-success-200">
                  📧 Your analytics emails will be sent{" "}
                  <strong>
                    every{" "}
                    {analyticsFrequency === "weekly"
                      ? "week"
                      : analyticsFrequency === "biweekly"
                        ? "2 weeks"
                        : "month"}
                  </strong>{" "}
                  on{" "}
                  <strong>
                    {
                      [
                        "Sunday",
                        "Monday",
                        "Tuesday",
                        "Wednesday",
                        "Thursday",
                        "Friday",
                        "Saturday",
                      ][analyticsDay]
                    }
                  </strong>{" "}
                  at <strong>{analyticsTime}</strong>
                </p>
              </div>
            </div>
          )}

          <div className="p-4 bg-info-50 dark:bg-info-900/30 rounded-lg border border-info-200 dark:border-info-800">
            <p className="text-sm text-info-800 dark:text-info-200">
              <strong>Note:</strong> Analytics emails include statistics for the
              previous calendar month (paid invoices, pending amounts, total
              revenue, and top clients). Emails are sent based on your chosen
              frequency, day, and time.
            </p>
          </div>

          {/* Test Email Button */}
          <div className="pt-4 border-t border-line dark:border-ink-700">
            <Button
              onClick={sendTestEmail}
              disabled={sendingTest || analyticsFrequency === "disabled"}
              variant="outline"
              className="w-full border-success-300 dark:border-success-700 text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/30"
            >
              {sendingTest ? (
                <>
                  <div className="w-4 h-4 mr-2 border-2 border-success-600 dark:border-success-400 border-t-transparent rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Send Test Analytics Email
                </>
              )}
            </Button>
            <p className="text-xs text-content-muted dark:text-content-subtle mt-2 text-center">
              Preview how your analytics email will look with your actual data
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="bg-surface dark:bg-surface-inverted border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="text-content dark:text-content-inverted">
            Notification Preferences
          </CardTitle>
          <CardDescription className="text-content-body dark:text-content-subtle">
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {notificationTypes.map((type) => (
            <div
              key={type.key}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors"
            >
              <div className="flex-1">
                <Label
                  htmlFor={type.key}
                  className="font-medium text-content dark:text-content-inverted cursor-pointer"
                >
                  {type.label}
                </Label>
                <p className="text-sm text-content-body dark:text-content-subtle">
                  {type.description}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id={type.key}
                  checked={preferences[type.key]}
                  onChange={() => togglePreference(type.key)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-ink-200 dark:bg-ink-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-success-300 dark:peer-focus:ring-success-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-content-inverted after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong dark:after:border-ink-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-600 dark:peer-checked:bg-success-600 dark:after:bg-surface-inverted"></div>
              </label>
            </div>
          ))}

          {/* Contractor Review Requests */}
          <div className="pt-2 border-t border-line dark:border-ink-700">
            <div className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors">
              <div className="flex-1">
                <Label className="font-medium text-content dark:text-content-inverted cursor-pointer">
                  Contractor Review Requests
                </Label>
                <p className="text-sm text-content-body dark:text-content-subtle">
                  Automatically send review request SMS/email to clients 12
                  hours after invoice is paid
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={sendReviewRequests}
                  onChange={() => setSendReviewRequests(!sendReviewRequests)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-ink-200 dark:bg-ink-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-success-300 dark:peer-focus:ring-success-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-content-inverted after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:border-line-strong dark:after:border-ink-600 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-success-600 dark:peer-checked:bg-success-600 dark:after:bg-surface-inverted"></div>
              </label>
            </div>
          </div>

          <div className="pt-4">
            <Button
              onClick={saveSettings}
              disabled={saving}
              className="w-full bg-brand hover:bg-brand-hover dark:bg-brand dark:hover:bg-brand-hover"
            >
              {saving ? "Saving..." : "Save All Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
