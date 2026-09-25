import React from "react";
import { ClipboardList, Ellipsis, FileText, LayoutDashboard, Zap } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/components/ui/sidebar";

function Tab({ to, icon: Icon, label, active }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[52px] flex-col items-center justify-center rounded-lg py-2.5 transition-all active:scale-95",
        active ? "text-foreground" : "text-muted-foreground",
      )}
    >
      <Icon className={cn("mb-1 size-5", active ? "stroke-[2.5]" : "stroke-[1.75]")} />
      <span className={cn("text-[11px]", active ? "font-semibold" : "font-medium")}>{label}</span>
    </Link>
  );
}

/** The phone tab bar. Four fixed tabs and More, which opens the full sidebar;
 * its height is published for the flows that sit above it. */
export default function MobileBottomNav({ bottomNavRef, getPaidActive }) {
  const location = useLocation();
  const { setOpenMobile } = useSidebar();
  const at = (page) => location.pathname === createPageUrl(page);

  return (
    <nav
      ref={bottomNavRef}
      className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
    >
      <div className="grid grid-cols-5 px-1">
        <Tab to={createPageUrl("Dashboard")} icon={LayoutDashboard} label="Home" active={at("Dashboard")} />
        <Tab to={createPageUrl("Invoices")} icon={FileText} label="Invoices" active={at("Invoices")} />
        <Tab to={createPageUrl("Quotes")} icon={ClipboardList} label="Quotes" active={at("Quotes")} />
        {/*
          Get Paid.

          Active for the Paper Trail too, which lives under this tab rather
          than beside it. A tab that goes dark when you follow a link from
          its own page reads as "you have left the section", and the user
          then has no idea which of the five tabs to press to get back.
        */}
        <Tab to={createPageUrl("ChaseInvoice")} icon={Zap} label="Get Paid" active={getPaidActive} />
        <button
          type="button"
          onClick={() => setOpenMobile(true)}
          className="flex min-h-[52px] flex-col items-center justify-center rounded-lg py-2.5 text-muted-foreground transition-all active:scale-95"
        >
          <Ellipsis className="mb-1 size-5 stroke-[1.75]" />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </div>
    </nav>
  );
}
