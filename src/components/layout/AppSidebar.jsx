import React from "react";
import { Link } from "react-router-dom";
import { EllipsisVertical } from "lucide-react";
import { createPageUrl } from "@/utils";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { usePreferences } from "@/lib/preferences/preferences";
import AccountMenuContent, { AccountAvatar } from "@/components/layout/AccountMenuContent";
import { NAV_GROUPS } from "@/components/layout/navigation";

/**
 * The app sidebar, after the dashboard template's AppSidebar: brand row,
 * grouped navigation, and the account menu at the foot.
 * On phones it is the sheet the header's menu button (and the tab bar's
 * More) opens.
 */
export default function AppSidebar({ navigation, isNavActive, navigate, handleLogout, settings, user }) {
  const { sidebar_variant, sidebar_collapsible } = usePreferences();
  const { isMobile, setOpenMobile } = useSidebar();
  // Following a link from the phone sheet should land on the page, not leave
  // the sheet covering it.
  const closeOnPhone = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar variant={sidebar_variant} collapsible={sidebar_collapsible}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="!p-1.5">
              <Link to={createPageUrl("Dashboard")} onClick={closeOnPhone}>
                <img src="/logo-mark.png" alt="" className="size-5 shrink-0 object-contain" />
                <span className="text-base font-semibold">Invoicium</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {NAV_GROUPS.map((group) => {
          const items = navigation.filter((item) => item.group === group.id);
          if (items.length === 0) return null;
          return (
            <SidebarGroup key={group.id}>
              {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => (
                    <SidebarMenuItem key={item.name}>
                      <SidebarMenuButton asChild tooltip={item.name} isActive={isNavActive(item)}>
                        <Link to={item.href} onClick={closeOnPhone}>
                          <item.icon />
                          <span>{item.name}</span>
                        </Link>
                      </SidebarMenuButton>
                      {item.badge && (
                        <SidebarMenuBadge className="rounded-sm border border-success-600 text-success-600 peer-hover/menu-button:text-success-600 peer-data-[active=true]/menu-button:text-success-600 dark:border-success-400 dark:text-success-400">
                          {item.badge}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                >
                  <AccountAvatar user={user} settings={settings} className="size-8" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.full_name}</span>
                    <span className="truncate text-xs text-muted-foreground">{user?.email}</span>
                  </div>
                  <EllipsisVertical className="ml-auto size-4" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <AccountMenuContent
                navigate={(to) => {
                  closeOnPhone();
                  navigate(to);
                }}
                onLogout={handleLogout}
                user={user}
                settings={settings}
                side={isMobile ? "bottom" : "right"}
              />
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
