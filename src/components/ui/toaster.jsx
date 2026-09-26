import NotificationsBlock from "@/components/ui/notifications-5";
import { dismiss, pause, resume, useNotifications } from "@/lib/notify";

/**
 * Where lib/notify.js pop-ups appear: top of the screen on a phone, clear of
 * the bottom tab bar and under the notch; bottom-right on a wider screen.
 *
 * The strip is mounted for the life of the app, so it takes no pointer events
 * itself -- on a phone it lies across the header, and an empty strip that
 * swallowed taps would disable the back button and avatar beneath it. Each
 * card turns them back on for itself.
 *
 * Newest is nearest the edge it enters from: first on a phone (top), last on
 * a desktop (bottom).
 */
export function Toaster() {
  const notifications = useNotifications();

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] sm:inset-x-auto sm:bottom-0 sm:right-0 sm:top-auto sm:justify-end sm:pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <NotificationsBlock
        notifications={notifications}
        onDismiss={dismiss}
        className="sm:flex-col-reverse"
        cardProps={(n) => ({
          className:
            "pointer-events-auto shadow-lg motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2 sm:motion-safe:slide-in-from-bottom-2",
          onMouseEnter: () => pause(n.id),
          onMouseLeave: () => resume(n.id),
          onFocus: () => pause(n.id),
          onBlur: () => resume(n.id),
        })}
      />
    </div>
  );
}
