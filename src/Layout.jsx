import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import Logo from "@/components/layout/Logo";
import { buildNavigation } from "@/components/layout/navigation";
import { hasAppAccess, resolveAppAccess } from "@/lib/access";
import { supabase } from "@/api/supabaseClient";
import { useShaderAppearance } from "@/lib/appearance";
import { ShaderBackground } from "@/components/ui/shader-background";
import { sdk } from "@/api/sdk";
import {
  Lock,
} from "lucide-react";
import GlobalVoiceAssistant from "./components/voice/GlobalVoiceAssistant";
import NotificationPermissionPrompt from "./components/notifications/NotificationPermissionPrompt";
import DesktopSidebar from "@/components/layout/DesktopSidebar";
import MobileTopBar from "@/components/layout/MobileTopBar";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import MobileMoreSheet from "@/components/layout/MobileMoreSheet";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);
  const [subscription, setSubscription] = useState(null);
  // Crew members have no Subscription row of their own -- their employer holds
  // it, and it stays owner-only. null means "not asked yet"; the database
  // answers via my_app_access(). See lib/access.js resolveAppAccess.
  const [crewAccess, setCrewAccess] = useState(null);
  const {
    enabled: shaderBackground,
    chosen: shaderChosen,
    preset: shaderPreset,
  } = useShaderAppearance();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [navigationStack, setNavigationStack] = useState([]);

  // Store refs for preserving scroll positions
  const scrollPositions = useRef({});
  const mainContentRef = useRef(null);

  // Published to the page as CSS variables on the shell below.
  //
  // The full-screen page flows -- Quick Invoice and Quick Quote -- were
  // `fixed inset-0`, and `fixed` is measured against the VIEWPORT, not against
  // the column they live in. So the flow painted an opaque backdrop over the
  // desktop sidebar: every nav item was still there, still focusable, and
  // completely unclickable, which left the flow's own Back button as the only
  // way out of it. On a phone it reached under the bottom tab bar instead and
  // hid the flow's primary button behind it.
  //
  // The flow now insets itself against these two numbers rather than against
  // the viewport. Only the shell knows them: the sidebar's width depends on
  // whether it is collapsed, and the tab bar's height depends on the device's
  // safe area, so it is measured rather than guessed.
  const bottomNavRef = useRef(null);
  const [bottomNavHeight, setBottomNavHeight] = useState(0);

  // Public pages that DON'T require authentication
  const publicPages = [
    "Home",
    "Pricing",
    "PublicQuote",
    "TermsOfService",
    "PaymentSuccess",
    "InvoicePaymentSuccess",
    "PublicBooking",
    "PhoneVerification",
    "Contact",
    "BookDemo",
  ];
  const publicPaths = [
    "/",
    "/invoice-payment-success",
    createPageUrl("Home"),
    createPageUrl("Pricing"),
    createPageUrl("PublicQuote"),
    createPageUrl("TermsOfService"),
    createPageUrl("PaymentSuccess"),
    createPageUrl("InvoicePaymentSuccess"),
    createPageUrl("PublicBooking"),
    createPageUrl("PhoneVerification"),
    createPageUrl("Contact"),
  ];

  const isPublicPage =
    publicPages.includes(currentPageName) ||
    publicPaths.includes(location.pathname);

  // Requires a signed-in user but deliberately not a subscription -- this is
  // where someone goes to buy one, so the paywall must not bounce them off it.
  // Reachable while blocked: Checkout is how they pay, UpgradeRequired is
  // the billing screen itself. Anything else redirects, so a blocked user
  // can never render a data screen.
  const subscriptionExemptPages = ["Checkout", "UpgradeRequired"];

  // Rendered without the sidebar or the marketing header -- see the standalone
  // layout branch below.
  const standalonePages = ["Checkout"];

  // Measured, not hard-coded: the tab bar pads itself with the device safe
  // area, so its height differs between a notched phone and a desktop window
  // narrowed past the lg breakpoint. Re-runs on navigation because the bar is
  // only in the tree on the app layout branch -- the standalone and public
  // branches return before it, and there the ref is null and the variable
  // stays 0, which is exactly right.
  useEffect(() => {
    const el = bottomNavRef.current;
    if (!el) {
      setBottomNavHeight(0);
      return;
    }
    const measure = () => setBottomNavHeight(el.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [currentPageName]);

  useEffect(() => {
    checkAuthAndSubscription();
  }, []); // Only check auth once on mount, not on every route change

  // The mount-only check above cannot re-run on navigation -- it redirects to
  // login and would fight the router. But the subscription is created AFTER
  // Layout has mounted: checkout activates it, then navigates client-side, so
  // Layout kept the `null` it read at mount and the gate below bounced the user
  // straight back to Pricing. Re-read it on route change, but only while access
  // is not yet granted, so ordinary in-app navigation costs no extra queries.
  useEffect(() => {
    if (!user || hasAppAccess(subscription)) return;
    let cancelled = false;
    (async () => {
      try {
        const rows = await sdk.entities.Subscription.filter({
          user_id: user.id,
        });
        if (!cancelled && rows.length > 0) setSubscription(rows[0]);
      } catch {
        // Keep the last known value. A transient query failure must never be
        // the reason someone loses access to the app they paid for.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subscription, location.pathname]);

  // Asked once per signed-in user, and only when the local answer was no --
  // a paying owner never issues this call at all.
  useEffect(() => {
    if (!user || hasAppAccess(subscription) || crewAccess !== null) return;
    let cancelled = false;
    (async () => {
      const allowed = await resolveAppAccess(subscription, supabase);
      if (!cancelled) setCrewAccess(allowed);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, subscription, crewAccess]);

  useEffect(() => {
    // Only load settings if user is authenticated and we've checked employee status
    if (user && !loading) {
      loadSettings();
    }
  }, [user, loading]);

  useEffect(() => {
    // Handle authentication and subscription flow
    if (!loading && !isPublicPage) {
      if (!user) {
        // NOT LOGGED IN - redirect to login, then bring them back to where they were trying to go
        console.log("🔒 User not logged in, redirecting to login");
        // Prevent showing error by staying in loading state during redirect
        setLoading(true);
        sdk.auth.redirectToLogin(location.pathname);
        return; // Stop execution to prevent state updates
      } else {
        // LOGGED IN - but an account alone does not grant access. Without a
        // live subscription send them to Pricing to choose a plan; feature
        // gates within pages then handle plan-level restrictions.
        const hasLiveSubscription = hasAppAccess(subscription) || crewAccess === true;
        if (
          // crewAccess === null means the database has not answered yet.
          // Redirecting on a pending answer would bounce every crew member on
          // their first paint, before the one query that admits them returns.
          crewAccess !== null &&
          !hasLiveSubscription &&
          !subscriptionExemptPages.includes(currentPageName)
        ) {
          navigate(createPageUrl("UpgradeRequired"), { replace: true });
        }
        return;
      }
    }
  }, [
    user,
    subscription,
    crewAccess,
    loading,
    isPublicPage,
    navigate,
    location.pathname,
    currentPageName,
  ]);

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Dark mode is an explicit opt-in only (Settings -> Appearance).
  // The marketing site and Home.jsx are light-only, so following the OS
  // preference here made the signed-in app look like a different product.
  useEffect(() => {
    const stored = localStorage.getItem("invoicium-dark-mode");
    setDarkMode(stored === "true");
  }, []);

  // Apply dark mode class to document
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [darkMode]);

  // Preserve scroll position when navigating between pages
  useEffect(() => {
    const currentPath = location.pathname;

    // Save current scroll position before leaving
    return () => {
      if (mainContentRef.current) {
        scrollPositions.current[currentPath] = mainContentRef.current.scrollTop;
      }
    };
  }, [location.pathname]);

  // Restore scroll position when returning to a page
  useEffect(() => {
    const currentPath = location.pathname;

    if (
      mainContentRef.current &&
      scrollPositions.current[currentPath] !== undefined
    ) {
      setTimeout(() => {
        if (mainContentRef.current) {
          mainContentRef.current.scrollTop =
            scrollPositions.current[currentPath];
        }
      }, 0);
    } else if (mainContentRef.current) {
      mainContentRef.current.scrollTop = 0;
    }
  }, [location.pathname]);

  // Track navigation stack for mobile back button
  useEffect(() => {
    setNavigationStack((prev) => {
      const newStack = [...prev];
      // Don't add if it's the same as the last page (prevent duplicates on refresh)
      if (
        newStack.length === 0 ||
        newStack[newStack.length - 1] !== location.pathname
      ) {
        newStack.push(location.pathname);
        // Keep stack manageable (max 20 pages)
        if (newStack.length > 20) {
          newStack.shift();
        }
      }
      return newStack;
    });
  }, [location.pathname]);

  const handleMobileBack = () => {
    if (navigationStack.length > 1) {
      setNavigationStack((prev) => {
        const newStack = [...prev];
        newStack.pop(); // Remove current page
        const previousPage = newStack[newStack.length - 1];
        navigate(previousPage);
        return newStack;
      });
    }
  };

  const checkAuthAndSubscription = async () => {
    try {
      const currentUser = await sdk.auth.me();
      setUser(currentUser);

      // ✅ Small delay for database propagation - reduced from 200ms
      await new Promise((resolve) => setTimeout(resolve, 100));

      // ✅ Check subscription status
      let subscriptionData = await sdk.entities.Subscription.filter({
        user_id: currentUser.id,
      });

      // ✅ If coming from payment, retry once. Checkout now returns straight to
      // the dashboard with ?from=payment instead of stopping at PaymentSuccess,
      // so the retry has to follow both landings.
      if (
        subscriptionData.length === 0 &&
        (location.pathname.includes("PaymentSuccess") ||
          location.search.includes("from=payment"))
      ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        subscriptionData = await sdk.entities.Subscription.filter({
          user_id: currentUser.id,
        });
      }

      if (subscriptionData.length > 0) {
        setSubscription(subscriptionData[0]);
      } else {
        setSubscription(null);
      }
    } catch (error) {
      // Only clear user state if it's actually an auth error, not a network/API error
      if (
        error?.message?.includes("not authenticated") ||
        error?.status === 401
      ) {
        console.log(
          "ℹ️ User not authenticated (this is normal for public pages)",
        );
        setUser(null);
        setSubscription(null);
      } else if (
        error?.code === "PGRST205" ||
        error?.message?.includes("Could not find the table")
      ) {
        console.warn(
          "⚠️ Supabase tables missing, allowing access with local fallback",
        );
        setSubscription(null);
      } else {
        // Network or other error - keep existing user state, don't log out
        console.warn("Auth check failed but keeping user logged in:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSettings = async () => {
    try {
      // Load settings from the data owner (boss's settings for employees)
      const data = await sdk.entities.BusinessSettings.filter({
        user_id: user.id,
      });
      if (data.length > 0) {
        setSettings(data[0]);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await sdk.auth.logout();
    } catch (error) {
      console.error("Logout error:", error);
    }
    window.location.href = window.location.origin + createPageUrl("Home");
  };

  const handleLogin = () => {
    // After login, send them to Dashboard - employees will go straight there,
    // bosses without subscription will be redirected to Pricing by the useEffect
    sdk.auth.redirectToLogin(createPageUrl("Dashboard"));
  };

  const handleRegister = () => {
    navigate(`${createPageUrl("Login")}?mode=signup`);
  };

  // Logo component - always shows Invoicium logo for company branding
  // ---------- STANDALONE LAYOUT ----------
  // Checkout gets a page to itself. The sidebar is app furniture that invites
  // wandering off mid-payment, and the marketing header re-pitches plans to
  // someone already buying one.
  if (standalonePages.includes(currentPageName)) {
    return (
      <div className="min-h-screen bg-surface-sunken dark:bg-ink-950">
        <header className="w-full border-b border-line bg-surface dark:border-ink-800 dark:bg-ink-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <button
              onClick={() => navigate(createPageUrl("Dashboard"))}
              className="flex items-center gap-2"
              aria-label="Invoicium home"
            >
              <Logo className="w-8 h-8" />
              <span className="text-lg font-bold text-ink-900 dark:text-white">
                Invoicium
              </span>
            </button>
            <span className="flex items-center gap-1.5 text-sm font-medium text-ink-500 dark:text-ink-400">
              <Lock className="w-4 h-4" />
              Secure checkout
            </span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    );
  }
  // The paywall screen renders standalone. Wrapping it in the app shell would
  // show a sidebar of pages a blocked user cannot reach -- and the brief is
  // that a blocked account gets no peek into the app at all.
  if (currentPageName === "UpgradeRequired") {
    return <>{children}</>;
  }

  // ---------- PUBLIC LAYOUT ----------
  if (isPublicPage) {
    const isLoggedIn = !!user;
    const hasActiveSub = hasAppAccess(subscription);

    return (
      /* audit:light-only:start — the signed-out marketing shell renders for
         visitors who have no theme preference, so it stays light in both. */
      <div className="min-h-screen bg-surface-sunken">
        <header
          className={`sticky top-0 z-50 w-full border-b border-line bg-surface transition-shadow duration-300 ${isScrolled ? "shadow-sm" : ""}`}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* Mark plus real text, not the baked-in logo-full lockup. The
                  wordmark in that bitmap renders about 13px tall here, which is
                  soft on every display and cannot follow the dark-mode token.
                  Live text is sharp at any zoom, selectable, and matches the
                  app-nav lockup further down this file. */}
              <Link
                to={createPageUrl("Home")}
                className="flex items-center gap-2.5 py-2"
              >
                <img
                  src="/logo-mark.png"
                  alt=""
                  className="h-8 w-8 object-contain"
                />
                <span className="text-xl font-bold tracking-tight text-content dark:text-content-inverted sm:text-2xl">
                  Invoicium
                </span>
              </Link>

              <div className="flex items-center gap-2">
                <Link
                  to={createPageUrl("Contact")}
                  className="hidden sm:inline-flex items-center text-sm font-medium text-content-body hover:text-content transition-colors px-3 py-2 rounded-lg hover:bg-surface-sunken"
                >
                  Support
                </Link>
                <Link
                  to={createPageUrl("BookDemo")}
                  className="hidden sm:inline-flex items-center text-sm font-medium text-success-700 hover:text-success-800 transition-colors px-3 py-2 rounded-lg hover:bg-success-50 border border-success-200 dark:text-success-400 dark:hover:text-success-300 dark:hover:bg-success-900/20 dark:border-success-800/50"
                >
                  Book a Demo
                </Link>

                {isLoggedIn ? (
                  hasActiveSub ? (
                    <button
                      onClick={() => navigate(createPageUrl("Dashboard"))}
                      className="h-10 px-5 rounded-lg bg-brand hover:bg-brand-hover text-content-inverted text-sm font-semibold transition-colors"
                    >
                      Dashboard
                    </button>
                  ) : (
                    <button
                      onClick={() => navigate(createPageUrl("Pricing"))}
                      className="h-10 px-5 rounded-lg bg-brand hover:bg-brand-hover text-content-inverted text-sm font-semibold transition-colors"
                    >
                      Choose Plan
                    </button>
                  )
                ) : (
                  <>
                    <button
                      onClick={handleLogin}
                      className="hidden sm:inline-flex h-10 px-4 items-center justify-center rounded-lg border border-line bg-surface text-content-body hover:bg-surface-sunken hover:text-content text-sm font-semibold transition-colors"
                    >
                      Sign In
                    </button>
                    <button
                      onClick={handleRegister}
                      className="h-10 px-5 rounded-lg bg-brand hover:bg-brand-hover text-content-inverted text-sm font-semibold transition-colors"
                    >
                      Register
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        <div>{children}</div>
      </div>
      /* audit:light-only:end */
    );
  }

  // ---------- LOADING STATE ----------
  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(210_20%_97%)] dark:bg-[hsl(220_20%_7%)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-surface dark:bg-ink-800 shadow-sm border border-line-subtle dark:border-ink-700 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-success-600 border-t-transparent animate-spin" />
          </div>
          <p className="text-sm text-content-muted dark:text-content-subtle font-medium">
            Loading Invoicium...
          </p>
        </div>
      </div>
    );
  }

  // A nav item stays lit for the pages that hang off it, listed in
  // `alsoActiveOn`. Exact-match alone made Get Paid go dark the moment you
  // followed its own Paper Trail link, which reads as having left the section
  // -- and leaves no clue which of the five tabs gets you back.
  const navigation = buildNavigation(subscription);

  const isNavActive = (item) =>
    location.pathname === item.href ||
    (item.alsoActiveOn || []).includes(location.pathname);

  // The Paper Trail is reached from Get Paid and belongs to it, so both paths
  // light the same tab.
  const getPaidActive =
    location.pathname === createPageUrl("ChaseInvoice") ||
    location.pathname === createPageUrl("PaperTrail");

  // 100dvh, not h-screen. Mobile Safari and Chrome size 100vh as if their
  // toolbar were hidden, but <main> is the scroller here, so the document
  // never scrolls and the toolbar never hides: an h-screen shell overhangs the
  // visible screen by the toolbar's height, and the whole app lurches when a
  // scroll reaches the end of <main>. dvh tracks what is actually visible.
  return (
    <div
      className="flex h-[100dvh] bg-[hsl(210_20%_97%)] dark:bg-[hsl(220_20%_7%)]"
      style={{
        // Read by full-screen page flows so they cover the app without
        // covering the app's navigation -- see the note by bottomNavRef.
        "--app-sidebar-width": sidebarCollapsed ? "4rem" : "16rem",
        "--app-bottom-nav-height": `${bottomNavHeight}px`,
      }}
    >
      <DesktopSidebar
        handleLogout={handleLogout}
        isNavActive={isNavActive}
        navigate={navigate}
        navigation={navigation}
        setSidebarCollapsed={setSidebarCollapsed}
        settings={settings}
        sidebarCollapsed={sidebarCollapsed}
        user={user}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <MobileTopBar
          handleLogout={handleLogout}
          handleMobileBack={handleMobileBack}
          navigate={navigate}
          navigationStack={navigationStack}
          settings={settings}
          user={user}
        />

        {/* Main Content */}
        <main
          ref={mainContentRef}
          className="relative flex-1 overflow-y-auto lg:pb-0 bg-[hsl(210_20%_97%)] dark:bg-[hsl(220_20%_7%)]"
        >
          {/* The animated background replaces the flat page colour and nothing
              else. It sits behind the content, never receives a pointer event,
              and is aria-hidden, so every card, table and control above it
              behaves exactly as before.

              Positioning is a zero-height sticky wrapper, not `fixed` and not
              `absolute`. <main> is the scroll container: `absolute` would scroll
              away with the content and leave bare colour below the fold, while
              `fixed` is positioned against the VIEWPORT and so spilled across
              the sidebar, tinting a block that was supposed to stay untouched.
              `sticky top-0` with `h-0` stays pinned to the top of this scroller
              while taking no layout space, and stays inside <main>'s box, so
              the canvas only ever covers one screen and only this column.

              Held at 30% over the existing light background rather than drawn
              at full strength. The palette runs to near-black at one end, and
              page headings sit directly on this surface in dark text -- at full
              strength they would be unreadable. */}
          {shaderBackground ? (
            <div
              aria-hidden
              className="pointer-events-none sticky top-0 z-0 h-0 overflow-visible"
            >
              <div className="h-[100dvh] w-full opacity-30 dark:opacity-40">
                {/* The toggle is the consent -- and ONLY the toggle. Someone
                    who switched on a setting called "Animated background" has
                    asked for motion, so the OS-wide default does not override
                    their specific choice. The background is now on by default
                    though, and a default is nobody's consent, so anyone who
                    has not touched the switch still gets prefers-reduced-motion
                    honoured: one static frame, same palette, no animation.
                    Either way it pauses when the tab is hidden or scrolled out
                    of view. */}
                <ShaderBackground
                  className="h-full w-full"
                  preset={shaderPreset}
                  respectReducedMotion={!shaderChosen}
                />
              </div>
            </div>
          ) : null}
          <div className="relative z-10 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </div>
        </main>

        <MobileBottomNav
          bottomNavRef={bottomNavRef}
          getPaidActive={getPaidActive}
        />

        <MobileMoreSheet
          isNavActive={isNavActive}
          navigation={navigation}
        />
      </div>

      <GlobalVoiceAssistant />
      <NotificationPermissionPrompt />

      <style>{`
 /* Prevent overscroll bounce on body */
 body {
 overscroll-behavior-y: none;
 }
 
 /* Mobile safe area handling */
 .mobile-header {
 padding-top: env(safe-area-inset-top);
 }
 
 /* Prevent text selection on buttons and nav */
 button, a, nav, .nav-item {
 user-select: none;
 -webkit-user-select: none;
 -webkit-touch-callout: none;
 }
 
 .scrollbar-hide::-webkit-scrollbar {
 display: none;
 }
 .scrollbar-hide {
 -ms-overflow-style: none;
 scrollbar-width: none;
 }
 @keyframes slide-up {
 from {
 transform: translateY(100%);
 }
 to {
 transform: translateY(0);
 }
 }
 .animate-slide-up {
 animation: slide-up 0.3s ease-out;
 }
 @supports (-webkit-touch-callout: none) {
 main {
 padding-bottom: calc(8rem + env(safe-area-inset-bottom));
 }
 }
 
 /* Dark mode support */
 .dark {
 color-scheme: dark;
 }
 `}</style>
    </div>
  );
}
