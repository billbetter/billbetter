import { createPageUrl } from "@/utils";
import {
  BarChart3,
  Building2,
  Calendar as CalendarIcon,
  ClipboardList,
  Clock,
  FileText,
  Layers,
  LayoutDashboard,
  RefreshCw,
  Settings,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { canAccessFeature } from "@/components/utils/permissions";

/** The sidebar and More-menu items, in order, for this subscription. */
export function buildNavigation(subscription) {
  return [
    {
      name: "Dashboard",
      href: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
    },
    {
      name: "Invoices",
      href: createPageUrl("Invoices"),
      icon: FileText,
    },
    {
      name: "Clients",
      href: createPageUrl("Clients"),
      icon: Users,
    },
    {
      name: "Quotes",
      href: createPageUrl("Quotes"),
      icon: ClipboardList,
    },
    {
      name: "Analytics",
      href: createPageUrl("Analytics"),
      icon: BarChart3,
    },
    {
      name: "Get Paid",
      href: createPageUrl("ChaseInvoice"),
      icon: Zap,
      badge: "AI",
      alsoActiveOn: [createPageUrl("PaperTrail")],
    },
    {
      name: "Calendar",
      href: createPageUrl("Calendar"),
      icon: CalendarIcon,
    },
    { name: "Jobs", href: createPageUrl("JobPhotos"), icon: Building2 },
    // Time is dormant (config/dormantFeatures.js). Unlike Team below it was not
    // gated on anything, so it needs its own check -- the page still exists and
    // works, it just has no way in.
    ...(canAccessFeature(subscription, "time_tracking")
      ? [{ name: "Time", href: createPageUrl("Timesheet"), icon: Clock }]
      : []),
    {
      // Not ClipboardList -- Quotes already uses it, and two identical icons
      // in one sidebar is worse than no icon at all.
      name: "Plans",
      href: createPageUrl("PaymentPlans"),
      icon: Layers,
    },
    {
      name: "Recurring",
      href: createPageUrl("RecurringInvoices"),
      icon: RefreshCw,
    },
    // Team is hidden rather than shown-and-refused on the single-operator
    // plans: a nav item that only ever leads to an upsell is a nav item that
    // wastes a tap every time. FeatureGate on the page is still the boundary --
    // this is just tidiness.
    ...(canAccessFeature(subscription, "crew_management")
      ? [{ name: "Team", href: createPageUrl("Team"), icon: UserCog }]
      : []),
    {
      name: "Settings",
      href: createPageUrl("Settings"),
      icon: Settings,
    },
  ];
}
