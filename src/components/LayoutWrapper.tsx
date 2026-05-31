"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

// Public routes that should NOT have the sidebar (marketing pages, auth pages)
const PUBLIC_ROUTES = [
  "/",                 // Homepage
  "/features",         // Features page
  "/pricing",          // Pricing page
  "/contact",          // Contact page
  "/book-demo",        // Demo booking page
  "/approve-quote",    // Public quote approval
  "/login",            // Login page
  "/signup",           // Signup page
  "/join-crew",        // Crew invite acceptance
  "/find-contractors", // Public contractor search
  "/invoice/success",  // Invoice payment success page
  "/payment/success",  // Subscription payment success page
  "/leave-review",     // Contractor review page
  "/privacy",          // Privacy policy
  "/terms",            // Terms of service
  "/booking",          // Public booking page
  "/quote",            // Public quote viewing
  "/shared-photos",    // Public photo gallery
  "/upgrade-required", // Upgrade prompt page
];

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Check if current path is a public route
  const isPublic = PUBLIC_ROUTES.some((r) => {
    // Exact match for root, or exact match / prefix with trailing slash
    if (r === "/") return pathname === "/";
    return pathname === r || pathname?.startsWith(`${r}/`);
  });

  if (isPublic) {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar />
      <main className="pt-14 pb-20 lg:pt-0 lg:pb-0 lg:ml-64 min-h-screen">
        {children}
      </main>
    </>
  );
}
