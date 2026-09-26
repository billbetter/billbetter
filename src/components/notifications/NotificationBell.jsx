import React, { useState, useEffect } from "react";
import { sdk } from "@/api/sdk";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { showBrowserNotification } from "@/lib/notificationSupport";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

export default function NotificationBell() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadNotifications();

    // Set up real-time subscription for notifications
    const setupRealtime = async () => {
      try {
        const user = await sdk.auth.me();
        if (!user) return;

        const unsubscribe = sdk.entities.Notification.subscribe((event) => {
          if (event.type === "create" && event.data?.user_id === user.id) {
            // Show browser notification if supported and permission granted
            showBrowserNotification(event.data.title || "New Notification", {
              body: event.data.message || "",
              icon: "/icon-192.png",
              tag: event.data.id,
            });
            // Reload notifications list
            loadNotifications();
          } else if (event.type === "update" || event.type === "delete") {
            loadNotifications();
          }
        });

        return unsubscribe;
      } catch (error) {
        console.error("Error setting up realtime notifications:", error);
      }
    };

    const unsubscribe = setupRealtime();

    // Also poll as backup every 30 seconds
    const interval = setInterval(loadNotifications, 30000);

    return () => {
      clearInterval(interval);
      if (unsubscribe) unsubscribe.then((unsub) => unsub?.());
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const user = await sdk.auth.me();
      if (!user) return;

      const data = await sdk.entities.Notification.filter(
        { user_id: user.id },
        "-created_at",
        20,
      );

      setNotifications(data);
      setUnreadCount(data.filter((n) => !n.is_read).length);
    } catch (error) {
      console.error("Error loading notifications:", error);
    }
  };

  const markAsRead = async (notificationId) => {
    try {
      await sdk.entities.Notification.update(notificationId, {
        is_read: true,
      });
      loadNotifications();
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.is_read);
      await Promise.all(
        unread.map((n) =>
          sdk.entities.Notification.update(n.id, { is_read: true }),
        ),
      );
      loadNotifications();
    } catch (error) {
      console.error("Error marking all as read:", error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      await markAsRead(notification.id);
    }
    if (notification.link) {
      navigate(notification.link);
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case "invoice_paid":
      case "payment_received":
        return "💰";
      case "quote_approved":
        return "✅";
      case "quote_declined":
        return "❌";
      case "invoice_sent":
        return "📧";
      case "invoice_overdue":
        return "⚠️";
      case "payment_failed":
        return "🚫";
      default:
        return "🔔";
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-8"
          aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <Badge className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-0 bg-destructive px-1 py-0 text-[10px] leading-none text-destructive-foreground">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-80 max-h-96 overflow-y-auto"
      >
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium">Notifications</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-7 text-xs text-muted-foreground"
            >
              <Check className="w-3 h-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <Bell className="w-8 h-8 text-ink-300 dark:text-content-body mx-auto mb-2 dark:dark:text-ink-300" />
            <p className="text-sm text-content-muted dark:text-content-subtle">
              No notifications yet
            </p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`px-3 py-3 cursor-pointer ${
                  !notification.is_read ? "bg-info-50 dark:bg-info-950/40" : ""
                }`}
              >
                <div className="flex gap-3 w-full">
                  <span className="text-xl flex-shrink-0">
                    {getNotificationIcon(notification.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm ${!notification.is_read ? "font-semibold" : "font-medium"} text-content dark:text-content-inverted mb-1`}
                    >
                      {notification.title}
                    </p>
                    <p className="text-xs text-content-body dark:text-ink-300 mb-1">
                      {notification.message}
                    </p>
                    <p className="text-xs text-content-subtle dark:text-content-muted">
                      {format(
                        new Date(notification.created_at),
                        "MMM d, h:mm a",
                      )}
                    </p>
                  </div>
                  {!notification.is_read && (
                    <div className="w-2 h-2 rounded-full bg-brand-600 flex-shrink-0 mt-1" />
                  )}
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
