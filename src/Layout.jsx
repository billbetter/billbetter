import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { hasAppAccess, resolveAppAccess } from "@/lib/access";
import { supabase } from "@/api/supabaseClient";
import { canAccessFeature } from "@/components/utils/permissions";
import { useShaderBackground } from "@/lib/appearance";
import { ShaderBackground } from "@/components/ui/waves-shader";
import { sdk } from "@/api/sdk";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  LogOut,
  ClipboardList,
  RefreshCw,
  Zap,
  Calendar as CalendarIcon,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Building2,
  CreditCard,
  ArrowLeft,
  Lock,
  Clock,
  UserCog,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import GlobalVoiceAssistant from "./components/voice/GlobalVoiceAssistant";
import NotificationPermissionPrompt from "./components/notifications/NotificationPermissionPrompt";
import NotificationBell from "./components/notifications/NotificationBell";

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
  const shaderBackground = useShaderBackground();
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [navigationStack, setNavigationStack] = useState([]);

  // Store refs for preserving scroll positions
  const scrollPositions = useRef({});
  const mainContentRef = useRef(null);

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
  const Logo = ({ className = "w-8 h-8", circular = false }) => {
    return (
      <img
        src="/logo-mark.png"
        alt="Invoicium Logo"
        className={`${className} object-contain ${circular ? "rounded-full" : ""}`}
      />
    );
  };

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

  const navigation = [
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

  return (
    <div className="flex h-screen bg-[hsl(210_20%_97%)] dark:bg-[hsl(220_20%_7%)]">
      {/* Desktop Sidebar */}
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
            const isActive = location.pathname === item.href;
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
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem
                onClick={() =>
                  navigate(createPageUrl("Settings") + "?tab=business")
                }
              >
                <Building2 className="w-4 h-4 mr-2" />
                Business Information
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => navigate(createPageUrl("Settings"))}
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  navigate(createPageUrl("Settings") + "?tab=billing")
                }
              >
                <CreditCard className="w-4 h-4 mr-2" />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-danger-600"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Top Bar */}
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
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  onClick={() =>
                    navigate(createPageUrl("Settings") + "?tab=business")
                  }
                >
                  <Building2 className="w-4 h-4 mr-2" />
                  Business Information
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => navigate(createPageUrl("Settings"))}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    navigate(createPageUrl("Settings") + "?tab=billing")
                  }
                >
                  <CreditCard className="w-4 h-4 mr-2" />
                  Billing
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="text-danger-600"
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

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
                {/* The toggle is the consent: someone who switched on a
                    setting called "Animated background" has asked for motion,
                    so the OS-wide default does not override it here. It still
                    pauses when the tab is hidden or scrolled out of view. */}
                <ShaderBackground
                  className="h-full w-full"
                  respectReducedMotion={false}
                />
              </div>
            </div>
          ) : null}
          <div className="relative z-10 pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
            {children}
          </div>
        </main>

        {/* Mobile Bottom Navigation */}
        <nav
          className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/95 dark:bg-surface-inverted/95 backdrop-blur-sm border-t border-line-subtle dark:border-ink-800 z-50"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 4px)" }}
        >
          <div className="grid grid-cols-5 px-1">
            {/* Dashboard */}
            <Link
              to={createPageUrl("Dashboard")}
              className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
                location.pathname === createPageUrl("Dashboard")
                  ? "text-success-600 dark:text-success-400"
                  : "text-content-muted dark:text-content-subtle"
              }`}
            >
              <LayoutDashboard
                className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Dashboard") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
              />
              <span
                className={`text-[11px] ${location.pathname === createPageUrl("Dashboard") ? "font-semibold" : "font-medium"}`}
              >
                Home
              </span>
            </Link>

            {/* Invoices */}
            <Link
              to={createPageUrl("Invoices")}
              className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
                location.pathname === createPageUrl("Invoices")
                  ? "text-success-600 dark:text-success-400"
                  : "text-content-muted dark:text-content-subtle"
              }`}
            >
              <FileText
                className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Invoices") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
              />
              <span
                className={`text-[11px] ${location.pathname === createPageUrl("Invoices") ? "font-semibold" : "font-medium"}`}
              >
                Invoices
              </span>
            </Link>

            {/* Quotes */}
            <Link
              to={createPageUrl("Quotes")}
              className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
                location.pathname === createPageUrl("Quotes")
                  ? "text-success-600 dark:text-success-400"
                  : "text-content-muted dark:text-content-subtle"
              }`}
            >
              <ClipboardList
                className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("Quotes") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
              />
              <span
                className={`text-[11px] ${location.pathname === createPageUrl("Quotes") ? "font-semibold" : "font-medium"}`}
              >
                Quotes
              </span>
            </Link>

            {/* Get Paid */}
            <Link
              to={createPageUrl("ChaseInvoice")}
              className={`flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg transition-all active:scale-95 ${
                location.pathname === createPageUrl("ChaseInvoice")
                  ? "text-success-600 dark:text-success-400"
                  : "text-content-muted dark:text-content-subtle"
              }`}
            >
              <Zap
                className={`w-5 h-5 mb-1 ${location.pathname === createPageUrl("ChaseInvoice") ? "stroke-[2.5]" : "stroke-[1.75]"}`}
              />
              <span
                className={`text-[11px] ${location.pathname === createPageUrl("ChaseInvoice") ? "font-semibold" : "font-medium"}`}
              >
                Get Paid
              </span>
            </Link>

            {/* More Menu */}
            <button
              onClick={() => {
                const sheet = document.getElementById("mobile-more-menu");
                sheet.classList.toggle("hidden");
              }}
              className="flex flex-col items-center justify-center py-2.5 min-h-[52px] rounded-lg text-content-muted dark:text-content-subtle active:scale-95 transition-all"
            >
              <div className="w-5 h-5 mb-1 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                >
                  <circle
                    cx="4"
                    cy="10"
                    r="1.25"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="10"
                    cy="10"
                    r="1.25"
                    fill="currentColor"
                    stroke="none"
                  />
                  <circle
                    cx="16"
                    cy="10"
                    r="1.25"
                    fill="currentColor"
                    stroke="none"
                  />
                </svg>
              </div>
              <span className="text-[11px] font-medium">More</span>
            </button>
          </div>
        </nav>

        {/* Mobile More Menu Sheet */}
        <div
          id="mobile-more-menu"
          className="lg:hidden fixed inset-0 z-50 hidden"
          onClick={(e) => {
            if (e.target.id === "mobile-more-menu") {
              document
                .getElementById("mobile-more-menu")
                .classList.add("hidden");
            }
          }}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-surface dark:bg-surface-inverted rounded-t-3xl shadow-2xl animate-slide-up"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom), 8px)" }}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-line dark:border-ink-800">
              <h3 className="text-lg font-semibold text-content dark:text-content-inverted">
                All Pages
              </h3>
              <button
                onClick={() =>
                  document
                    .getElementById("mobile-more-menu")
                    .classList.add("hidden")
                }
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-ink-100 active:bg-ink-200 dark:hover:bg-ink-800 dark:active:bg-ink-700 transition-colors"
              >
                <span className="text-2xl text-content-muted">&times;</span>
              </button>
            </div>
            <div className="px-4 py-3 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-3 gap-3">
                {navigation.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={() =>
                        document
                          .getElementById("mobile-more-menu")
                          .classList.add("hidden")
                      }
                      className={`flex flex-col items-center justify-center p-4 rounded-xl transition-all active:scale-95 ${
                        isActive
                          ? "bg-success-600 text-content-inverted shadow-lg shadow-success-200"
                          : "bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-300 active:bg-ink-100 dark:active:bg-ink-700"
                      }`}
                    >
                      <item.icon
                        className={`w-7 h-7 mb-2 ${isActive ? "stroke-[2.5]" : "stroke-[2]"}`}
                      />
                      <span
                        className={`text-xs text-center font-medium leading-tight ${isActive ? "font-semibold" : ""}`}
                      >
                        {item.name}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
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
