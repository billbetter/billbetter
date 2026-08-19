import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, X, CheckCircle, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  isBrowserNotificationSupported,
  requestNotificationPermission,
  showBrowserNotification,
  getNotificationPermission,
} from "@/lib/notificationSupport";

export default function NotificationPermissionPrompt() {
  const [show, setShow] = useState(false);
  const [permission, setPermission] = useState("default");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    checkNotificationStatus();
  }, []);

  const checkNotificationStatus = () => {
    // If the browser Notification API is not supported (WebView / APK), never show this prompt
    if (!isBrowserNotificationSupported()) return;

    const currentPermission = getNotificationPermission();
    setPermission(currentPermission);

    const hasBeenPrompted = localStorage.getItem("notification_prompted");

    if (currentPermission === "default" && !hasBeenPrompted) {
      setTimeout(() => setShow(true), 3000);
    }
  };

  const requestPermission = async () => {
    setLoading(true);

    const result = await requestNotificationPermission();
    setPermission(result);
    localStorage.setItem("notification_prompted", "true");

    if (result === "granted") {
      showBrowserNotification("Notifications Enabled!", {
        body: "You'll now receive important updates from Invoicium",
        icon: "/icon-192.png",
        tag: "permission-granted",
      });
    }

    setLoading(false);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem("notification_prompted", "true");
    setShow(false);
  };

  // Only render if supported and in the right state
  if (!show || permission !== "default") return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-4 right-4 z-50 max-w-md"
      >
        <Card className="border-2 border-success-200 shadow-2xl">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center dark:bg-success-900/30">
                  <Bell className="w-5 h-5 text-success-600" />
                </div>
                <CardTitle className="text-lg">Stay Updated</CardTitle>
              </div>
              <button
                onClick={handleDismiss}
                className="text-content-subtle hover:text-content-body transition-colors dark:hover:text-ink-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-content-body dark:text-ink-300">
              Get instant notifications for:
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                <CheckCircle className="w-4 h-4 text-success-600" />
                Invoice payments & updates
              </li>
              <li className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                <CheckCircle className="w-4 h-4 text-success-600" />
                Quote approvals & responses
              </li>
              <li className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                <CheckCircle className="w-4 h-4 text-success-600" />
                Payment confirmations
              </li>
              <li className="flex items-center gap-2 text-ink-700 dark:text-ink-300">
                <CheckCircle className="w-4 h-4 text-success-600" />
                Due date reminders
              </li>
            </ul>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={requestPermission}
                disabled={loading}
                className="flex-1 bg-brand hover:bg-brand-hover"
              >
                {loading ? "Enabling..." : "Enable Notifications"}
              </Button>
              <Button
                onClick={handleDismiss}
                variant="outline"
                className="flex-1"
              >
                Maybe Later
              </Button>
            </div>

            <p className="text-xs text-content-muted text-center">
              You can change this anytime in Settings
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </AnimatePresence>
  );
}
