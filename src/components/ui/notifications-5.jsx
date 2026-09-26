import { cn } from "@/lib/utils";
import { CircleCheck, Info, TriangleAlert, CircleAlert, X } from "lucide-react";

/**
 * The notification card from 21st.dev's "notifications-5" block, and the
 * stack the app's pop-ups are drawn in (see components/ui/toaster.jsx and
 * lib/notify.js, which is what code should call).
 *
 * Adapted for this codebase:
 *  - JSX, not TSX: components.json sets "tsx": false and eslint only lints
 *    {js,jsx}.
 *  - The accents use the project's own success/warning palettes rather than
 *    the block's `--success`/`--warning` oklch variables, which this Tailwind 3
 *    config does not define; each has a lighter step for dark mode.
 *  - The block's demo data and full-screen wrapper are dropped: the stack is
 *    fed real notifications and sits in a corner of the screen.
 */

/** @typedef {"success" | "info" | "warning" | "error"} Variant */

const config = {
  success: {
    icon: CircleCheck,
    accent: "text-success-600 dark:text-success-400",
  },
  info: { icon: Info, accent: "text-foreground" },
  warning: {
    icon: TriangleAlert,
    accent: "text-warning-600 dark:text-warning-400",
  },
  error: { icon: CircleAlert, accent: "text-destructive" },
};

/**
 * One notification.
 *
 * Errors and warnings are announced assertively (role="alert"): they are the
 * reason something the person asked for did not happen. Successes and notes
 * are polite (role="status") so they never interrupt a screen reader.
 *
 * @param {{ variant?: Variant, title: import("react").ReactNode,
 *   body?: import("react").ReactNode, onDismiss?: () => void,
 *   className?: string } & import("react").HTMLAttributes<HTMLDivElement>} props
 */
export function NotificationCard({
  variant = "info",
  title,
  body,
  onDismiss,
  className,
  ...props
}) {
  const { icon: Icon, accent } = config[variant] || config.info;
  const urgent = variant === "error" || variant === "warning";
  return (
    <div
      role={urgent ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-foreground shadow-sm",
        className,
      )}
      {...props}
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", accent)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-sm font-semibold [overflow-wrap:anywhere]">{title}</span>
        {body ? (
          <span className="whitespace-pre-line text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {body}
          </span>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * A column of notifications.
 *
 * @param {{ notifications: { id: string|number, variant: Variant,
 *   title: import("react").ReactNode, body?: import("react").ReactNode }[],
 *   onDismiss?: (id: string|number) => void,
 *   cardProps?: (n: object) => object, className?: string }} props
 */
export default function NotificationsBlock({
  notifications,
  onDismiss,
  cardProps,
  className,
}) {
  return (
    <div className={cn("flex w-full max-w-sm flex-col gap-3", className)}>
      {notifications.map((n) => (
        <NotificationCard
          key={n.id}
          variant={n.variant}
          title={n.title}
          body={n.body}
          onDismiss={onDismiss ? () => onDismiss(n.id) : undefined}
          {...(cardProps ? cardProps(n) : null)}
        />
      ))}
    </div>
  );
}
