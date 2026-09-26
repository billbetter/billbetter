import React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { usePreferences } from "@/lib/preferences/preferences";
import NotificationBell from "@/components/notifications/NotificationBell";
import AccountMenuContent, { AccountAvatar } from "@/components/layout/AccountMenuContent";
import LayoutControls from "@/components/layout/LayoutControls";
import SearchDialog from "@/components/layout/SearchDialog";
import ThemeSwitcher from "@/components/layout/ThemeSwitcher";

/**
 * The template's dashboard header, at every width: sidebar trigger, search,
 * then notifications, preferences, theme and the account menu. On phones it
 * also carries the back button the old phone-only top bar had.
 *
 * Layout places it: above the page scroller for "Navbar Behavior: Sticky",
 * inside it (so it scrolls away) for "Scroll".
 */
export default function AppHeader({
  handleLogout,
  handleMobileBack,
  navigate,
  navigation,
  navigationStack,
  settings,
  user,
}) {
  const { navbar_style } = usePreferences();
  const sticky = navbar_style === "sticky";

  return (
    <header
      data-app-header=""
      className={cn(
        "mobile-header box-content flex h-12 shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear",
        sticky ? "relative z-40 lg:rounded-t-[inherit]" : "relative",
      )}
    >
      <div className="flex w-full items-center justify-between gap-2 px-4 lg:px-6">
        <div className="flex min-w-0 items-center gap-1 lg:gap-2">
          {navigationStack.length > 1 && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMobileBack}
              className="-ml-2 size-9 lg:hidden"
              aria-label="Go back"
            >
              <ArrowLeft className="size-5" />
            </Button>
          )}
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mx-2 !h-4 self-center" />
          <SearchDialog navigation={navigation} />
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />
          <LayoutControls className="hidden lg:inline-flex" />
          <ThemeSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="rounded-lg outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                aria-label="Account menu"
              >
                <AccountAvatar user={user} settings={settings} className="size-8" />
              </button>
            </DropdownMenuTrigger>
            <AccountMenuContent navigate={navigate} onLogout={handleLogout} user={user} settings={settings} />
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
