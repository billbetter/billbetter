import React from "react";
import { createPageUrl } from "@/utils";
import { Building2, CreditCard, LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

export function initialsOf(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

/**
 * The business logo when there is one, else the owner's profile picture, else
 * their initials. The same order sent invoices use, so the picture here is the
 * one clients see.
 */
export function AccountAvatar({ user, settings, className = "" }) {
  const src = settings?.logo_url || user?.photo_url;
  return (
    <Avatar className={`rounded-lg ${className}`}>
      {src ? <AvatarImage src={src} alt="Profile" /> : null}
      <AvatarFallback className="rounded-lg bg-sidebar-accent text-xs font-medium text-sidebar-accent-foreground">
        {initialsOf(user?.full_name)}
      </AvatarFallback>
    </Avatar>
  );
}

/**
 * The account menu's items. One menu with two triggers -- the account row at
 * the foot of the sidebar and the avatar in the header -- so the items live
 * here once instead of being written out twice.
 */
function AccountMenuContent({ navigate, onLogout, user, settings, side = "bottom", align = "end" }) {
  return (
    <DropdownMenuContent className="min-w-56 rounded-lg" side={side} align={align} sideOffset={4}>
      <DropdownMenuLabel className="p-0 font-normal">
        <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
          <AccountAvatar user={user} settings={settings} className="size-8" />
          <div className="grid flex-1 text-left text-sm leading-tight">
            <span className="truncate font-medium">{user?.full_name || "Account"}</span>
            <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuGroup>
        <DropdownMenuItem onClick={() => navigate(createPageUrl("Settings") + "?tab=business")}>
          <Building2 />
          Business Information
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(createPageUrl("Settings"))}>
          <Settings />
          Settings
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate(createPageUrl("Settings") + "?tab=billing")}>
          <CreditCard />
          Billing
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
        <LogOut />
        Logout
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

export default AccountMenuContent;
