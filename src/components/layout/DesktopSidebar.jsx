import React from "react";
import AccountMenuContent from "@/components/layout/AccountMenuContent";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import NotificationBell from "../notifications/NotificationBell";

/** The sidebar: the nav list, the notification bell and the account menu.
 * Collapses to icons, and publishes its width for the flows that inset
 * themselves off it. */
export default function DesktopSidebar({
  handleLogout,
  isNavActive,
  navigate,
  navigation,
  setSidebarCollapsed,
  settings,
  sidebarCollapsed,
  user,
}) {
  return (
    <aside
      className={`hidden lg:flex flex-col bg-surface-inverted dark:bg-surface-inverted-deep text-content-inverted ${sidebarCollapsed ? "w-16" : "w-64"} transition-all duration-300 flex-shrink-0`}
    >
      <div
        className={`flex items-center border-b border-ink-800 dark:border-ink-800 ${sidebarCollapsed ? "h-16 justify-center px-2" : "h-16 px-4 justify-between"}`}
      >
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <img
              src="/logo-mark.png"
              alt="Invoicium"
              className="w-7 h-7 flex-shrink-0"
            />
            <span className="text-lg font-bold text-content-inverted tracking-tight truncate">
              Invoicium
            </span>
          </div>
        )}
        {!sidebarCollapsed && <NotificationBell />}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-content-subtle hover:text-content-inverted hover:bg-ink-800 transition-colors ${sidebarCollapsed ? "" : "ml-2"}`}
          aria-label={
            sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
          }
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = isNavActive(item);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
                isActive
                  ? "bg-brand text-content-inverted shadow-sm"
                  : "text-content-subtle hover:bg-ink-800 hover:text-content-inverted"
              } ${sidebarCollapsed ? "justify-center" : ""}`}
              title={sidebarCollapsed ? item.name : ""}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium truncate flex-1">
                  {item.name}
                </span>
              )}
              {!sidebarCollapsed && item.badge && (
                <Badge className="ml-auto bg-success-700 text-content-inverted text-[10px] px-1.5 py-0">
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-ink-800">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-content-subtle hover:bg-ink-800 hover:text-content-inverted transition-colors ${sidebarCollapsed ? "justify-center" : ""}`}
            >
              {settings?.logo_url ? (
                <img
                  src={settings?.logo_url}
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-success-700 flex items-center justify-center text-content-inverted font-semibold text-sm flex-shrink-0">
                  {user?.full_name?.[0]?.toUpperCase() || "U"}
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="flex-1 text-left min-w-0">
                  <p className="text-sm font-medium text-content-inverted truncate">
                    {user?.full_name}
                  </p>
                  <p className="text-xs text-content-muted truncate">Owner</p>
                </div>
              )}
              {!sidebarCollapsed && (
                <ChevronDown className="w-4 h-4 flex-shrink-0" />
              )}
            </button>
          </DropdownMenuTrigger>
          <AccountMenuContent navigate={navigate} onLogout={handleLogout} />
        </DropdownMenu>
      </div>
    </aside>
  );
}
