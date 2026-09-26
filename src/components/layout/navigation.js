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

/**
 * The sidebar sections, in the template's grouped layout. `label` is the
 * section heading; the first group has none, like the template's.
 */
export const NAV_GROUPS = [
  { id: "overview", label: null },
  { id: "billing", label: "Billing" },
  { id: "work", label: "Work" },
  { id: "account", label: "Account" },
];

/** The sidebar, search and More-menu items, in order, for this subscription. */
export function buildNavigation(subscription) {
  return [
    {
      name: "Dashboard",
      href: createPageUrl("Dashboard"),
      icon: LayoutDashboard,
      group: "overview",
    },
    {
      name: "Analytics",
      href: createPageUrl("Analytics"),
      icon: BarChart3,
      group: "overview",
    },
    {
      name: "Invoices",
      href: createPageUrl("Invoices"),
      icon: FileText,
      group: "billing",
    },
    {
      name: "Quotes",
      href: createPageUrl("Quotes"),
      icon: ClipboardList,
      group: "billing",
    },
    {
      name: "Get Paid",
      href: createPageUrl("ChaseInvoice"),
      icon: Zap,
      badge: "AI",
      alsoActiveOn: [createPageUrl("PaperTrail")],
      group: "billing",
    },
    {
      name: "Recurring",
      href: createPageUrl("RecurringInvoices"),
      icon: RefreshCw,
      group: "billing",
    },
    {
      // Not ClipboardList -- Quotes already uses it, and two identical icons
      // in one sidebar is worse than no icon at all.
      name: "Plans",
      href: createPageUrl("PaymentPlans"),
      icon: Layers,
      group: "billing",
    },
    {
      name: "Clients",
      href: createPageUrl("Clients"),
      icon: Users,
      group: "work",
    },
    {
      name: "Calendar",
      href: createPageUrl("Calendar"),
      icon: CalendarIcon,
      group: "work",
    },
    { name: "Jobs", href: createPageUrl("JobPhotos"), icon: Building2, group: "work" },
    // Time is dormant (config/dormantFeatures.js). Unlike Team below it was not
    // gated on anything, so it needs its own check -- the page still exists and
    // works, it just has no way in.
    ...(canAccessFeature(subscription, "time_tracking")
      ? [{ name: "Time", href: createPageUrl("Timesheet"), icon: Clock, group: "work" }]
      : []),
    // Team is hidden rather than shown-and-refused on the single-operator
    // plans: a nav item that only ever leads to an upsell is a nav item that
    // wastes a tap every time. FeatureGate on the page is still the boundary --
    // this is just tidiness.
    ...(canAccessFeature(subscription, "crew_management")
      ? [{ name: "Team", href: createPageUrl("Team"), icon: UserCog, group: "work" }]
      : []),
    {
      name: "Settings",
      href: createPageUrl("Settings"),
      icon: Settings,
      group: "account",
    },
  ];
}
