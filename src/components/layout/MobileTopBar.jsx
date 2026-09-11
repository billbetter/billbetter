import React from "react";
import AccountMenuContent from "@/components/layout/AccountMenuContent";
import { ArrowLeft } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import NotificationBell from "../notifications/NotificationBell";
import { createPageUrl } from "@/utils";

/** The phone header: back, the business name, the bell and the avatar. */
export default function MobileTopBar({
  handleLogout,
  handleMobileBack,
  navigate,
  navigationStack,
  settings,
  user,
}) {
  return (
    <div className="lg:hidden mobile-header bg-surface dark:bg-surface-inverted border-b border-line dark:border-ink-800 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-2">
        {navigationStack.length > 1 && (
          <button
            onClick={handleMobileBack}
            className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full flex items-center justify-center text-ink-700 dark:text-ink-300 active:bg-ink-100 dark:active:bg-ink-800 transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
        )}
        <Link
          to={createPageUrl("Dashboard")}
          className="flex items-center gap-2 py-1"
        >
          <img src="/logo-mark.png" alt="Invoicium" className="w-7 h-7" />
          <span className="text-xl font-bold text-content dark:text-content-inverted tracking-tight">
            Invoicium
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <NotificationBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="w-11 h-11 min-w-[44px] min-h-[44px] rounded-full bg-success-100 flex items-center justify-center text-success-700 font-semibold text-sm active:bg-success-200 transition-colors overflow-hidden dark:bg-success-900/30 dark:text-success-400">
              {settings?.logo_url ? (
                <img
                  src={settings?.logo_url}
                  alt="Profile"
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{user?.full_name?.[0]?.toUpperCase() || "U"}</span>
              )}
            </button>
          </DropdownMenuTrigger>
          <AccountMenuContent navigate={navigate} onLogout={handleLogout} />
        </DropdownMenu>
      </div>
    </div>
  );
}
