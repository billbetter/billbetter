import React, { useState, useEffect } from "react";
import {
  Home,
  DollarSign,
  Monitor,
  ShoppingCart,
  Tag,
  BarChart3,
  Users,
  ChevronDown,
  ChevronsRight,
  Moon,
  Sun,
  TrendingUp,
  Activity,
  Package,
  Bell,
  Settings,
  HelpCircle,
  User,
} from "lucide-react";

export const Example = () => {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  return (
    <div className={`flex min-h-screen w-full ${isDark ? "dark" : ""}`}>
      <div className="flex w-full bg-surface-sunken dark:bg-surface-inverted-deep text-content dark:text-ink-100">
        <Sidebar />
        <ExampleContent isDark={isDark} setIsDark={setIsDark} />
      </div>
    </div>
  );
};

const Sidebar = () => {
  const [open, setOpen] = useState(true);
  const [selected, setSelected] = useState("Dashboard");

  return (
    <nav
      className={`sticky top-0 h-screen shrink-0 border-r transition-all duration-300 ease-in-out ${
        open ? "w-64" : "w-16"
      } border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted p-2 shadow-sm`}
    >
      <TitleSection open={open} />

      <div className="space-y-1 mb-8">
        <Option
          Icon={Home}
          title="Dashboard"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={DollarSign}
          title="Sales"
          selected={selected}
          setSelected={setSelected}
          open={open}
          notifs={3}
        />
        <Option
          Icon={Monitor}
          title="View Site"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={ShoppingCart}
          title="Products"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={Tag}
          title="Tags"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={BarChart3}
          title="Analytics"
          selected={selected}
          setSelected={setSelected}
          open={open}
        />
        <Option
          Icon={Users}
          title="Members"
          selected={selected}
          setSelected={setSelected}
          open={open}
          notifs={12}
        />
      </div>

      {open && (
        <div className="border-t border-line dark:border-ink-800 pt-4 space-y-1">
          <div className="px-3 py-2 text-xs font-medium text-content-muted dark:text-content-subtle uppercase tracking-wide">
            Account
          </div>
          <Option
            Icon={Settings}
            title="Settings"
            selected={selected}
            setSelected={setSelected}
            open={open}
          />
          <Option
            Icon={HelpCircle}
            title="Help & Support"
            selected={selected}
            setSelected={setSelected}
            open={open}
          />
        </div>
      )}

      <ToggleClose open={open} setOpen={setOpen} />
    </nav>
  );
};

const Option = ({ Icon, title, selected, setSelected, open, notifs }) => {
  const isSelected = selected === title;

  return (
    <button
      onClick={() => setSelected(title)}
      className={`relative flex h-11 w-full items-center rounded-md transition-all duration-200 ${
        isSelected
          ? "bg-info-50 dark:bg-info-900/50 text-brand-800 dark:text-brand-300 shadow-sm border-l-2 border-info-500"
          : "text-content-body dark:text-content-subtle hover:bg-surface-sunken dark:hover:bg-ink-800 hover:text-content dark:hover:text-ink-200"
      }`}
    >
      <div className="grid h-full w-12 place-content-center">
        <Icon className="h-4 w-4" />
      </div>

      {open && (
        <span
          className={`text-sm font-medium transition-opacity duration-200 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        >
          {title}
        </span>
      )}

      {notifs && open && (
        <span className="absolute right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-700 dark:bg-info-600 text-xs text-content-inverted font-medium">
          {notifs}
        </span>
      )}
    </button>
  );
};

const TitleSection = ({ open }) => {
  return (
    <div className="mb-6 border-b border-line dark:border-ink-800 pb-4">
      <div className="flex cursor-pointer items-center justify-between rounded-md p-2 transition-colors hover:bg-surface-sunken dark:hover:bg-ink-800">
        <div className="flex items-center gap-3">
          <Logo />
          {open && (
            <div
              className={`transition-opacity duration-200 ${open ? "opacity-100" : "opacity-0"}`}
            >
              <div className="flex items-center gap-2">
                <div>
                  <span className="block text-sm font-semibold text-content dark:text-ink-100">
                    Invoicium
                  </span>
                  <span className="block text-xs text-content-muted dark:text-content-subtle">
                    Pro Plan
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
        {open && (
          <ChevronDown className="h-4 w-4 text-content-subtle dark:text-content-muted" />
        )}
      </div>
    </div>
  );
};

const Logo = () => {
  return (
    <div className="grid size-10 shrink-0 place-content-center rounded-lg bg-brand shadow-sm">
      <svg
        width="20"
        height="auto"
        viewBox="0 0 50 39"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="fill-white"
      >
        <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" />
        <path d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z" />
      </svg>
    </div>
  );
};

const ToggleClose = ({ open, setOpen }) => {
  return (
    <button
      onClick={() => setOpen(!open)}
      className="absolute bottom-0 left-0 right-0 border-t border-line dark:border-ink-800 transition-colors hover:bg-surface-sunken dark:hover:bg-ink-800"
    >
      <div className="flex items-center p-3">
        <div className="grid size-10 place-content-center">
          <ChevronsRight
            className={`h-4 w-4 transition-transform duration-300 text-content-muted dark:text-content-subtle ${
              open ? "rotate-180" : ""
            }`}
          />
        </div>
        {open && (
          <span
            className={`text-sm font-medium text-content-body dark:text-ink-300 transition-opacity duration-200 ${
              open ? "opacity-100" : "opacity-0"
            }`}
          >
            Hide
          </span>
        )}
      </div>
    </button>
  );
};

const ExampleContent = ({ isDark, setIsDark }) => {
  return (
    <div className="flex-1 bg-surface-sunken dark:bg-surface-inverted-deep p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-content dark:text-ink-100">
            Dashboard
          </h1>
          <p className="text-content-body dark:text-content-subtle mt-1">
            Welcome back to your dashboard
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="relative p-2 rounded-lg bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-content-body dark:text-content-subtle hover:text-content dark:hover:text-ink-100 transition-colors">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-danger-500 rounded-full"></span>
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted text-content-body dark:text-content-subtle hover:bg-surface-sunken dark:hover:bg-ink-800 hover:text-content dark:hover:text-ink-100 transition-colors"
          >
            {isDark ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </button>
          <button className="p-2 rounded-lg bg-surface dark:bg-surface-inverted border border-line dark:border-ink-800 text-content-body dark:text-content-subtle hover:text-content dark:hover:text-ink-100 transition-colors">
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="p-6 rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <DollarSign className="h-5 w-5 text-brand-700 dark:text-brand-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-positive-500" />
          </div>
          <h3 className="font-medium text-content-body dark:text-content-subtle mb-1">
            Total Sales
          </h3>
          <p className="text-2xl font-bold text-content dark:text-ink-100">
            $24,567
          </p>
          <p className="text-sm text-positive-600 dark:text-positive-400 mt-1">
            +12% from last month
          </p>
        </div>

        <div className="p-6 rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-positive-50 dark:bg-positive-900/20 rounded-lg">
              <Users className="h-5 w-5 text-positive-600 dark:text-positive-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-positive-500" />
          </div>
          <h3 className="font-medium text-content-body dark:text-content-subtle mb-1">
            Active Users
          </h3>
          <p className="text-2xl font-bold text-content dark:text-ink-100">
            1,234
          </p>
          <p className="text-sm text-positive-600 dark:text-positive-400 mt-1">
            +5% from last week
          </p>
        </div>

        <div className="p-6 rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
              <ShoppingCart className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-positive-500" />
          </div>
          <h3 className="font-medium text-content-body dark:text-content-subtle mb-1">
            Orders
          </h3>
          <p className="text-2xl font-bold text-content dark:text-ink-100">
            456
          </p>
          <p className="text-sm text-positive-600 dark:text-positive-400 mt-1">
            +8% from yesterday
          </p>
        </div>

        <div className="p-6 rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-alert-50 dark:bg-alert-900/20 rounded-lg">
              <Package className="h-5 w-5 text-alert-600 dark:text-alert-400" />
            </div>
            <TrendingUp className="h-4 w-4 text-positive-500" />
          </div>
          <h3 className="font-medium text-content-body dark:text-content-subtle mb-1">
            Products
          </h3>
          <p className="text-2xl font-bold text-content dark:text-ink-100">
            89
          </p>
          <p className="text-sm text-positive-600 dark:text-positive-400 mt-1">
            +3 new this week
          </p>
        </div>
      </div>

      {/* Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Activity */}
        <div className="lg:col-span-2">
          <div className="rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-content dark:text-ink-100">
                Recent Activity
              </h3>
              <button className="text-sm text-brand-700 dark:text-brand-400 hover:text-info-700 dark:hover:text-info-300 font-medium">
                View all
              </button>
            </div>
            <div className="space-y-4">
              {[
                {
                  icon: DollarSign,
                  title: "New sale recorded",
                  desc: "Order #1234 completed",
                  time: "2 min ago",
                  color: "green",
                },
                {
                  icon: Users,
                  title: "New user registered",
                  desc: "john.doe@example.com joined",
                  time: "5 min ago",
                  color: "blue",
                },
                {
                  icon: Package,
                  title: "Product updated",
                  desc: "iPhone 15 Pro stock updated",
                  time: "10 min ago",
                  color: "purple",
                },
                {
                  icon: Activity,
                  title: "System maintenance",
                  desc: "Scheduled backup completed",
                  time: "1 hour ago",
                  color: "orange",
                },
                {
                  icon: Bell,
                  title: "New notification",
                  desc: "Marketing campaign results",
                  time: "2 hours ago",
                  color: "red",
                },
              ].map((activity, i) => (
                <div
                  key={i}
                  className="flex items-center space-x-4 p-3 rounded-lg hover:bg-surface-sunken dark:hover:bg-ink-800 transition-colors cursor-pointer"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      activity.color === "green"
                        ? "bg-positive-50 dark:bg-positive-900/20"
                        : activity.color === "blue"
                          ? "bg-brand-50 dark:bg-brand-900/20"
                          : activity.color === "purple"
                            ? "bg-brand-50 dark:bg-brand-900/20"
                            : activity.color === "orange"
                              ? "bg-alert-50 dark:bg-alert-900/20"
                              : "bg-danger-50 dark:bg-danger-900/20"
                    }`}
                  >
                    <activity.icon
                      className={`h-4 w-4 ${
                        activity.color === "green"
                          ? "text-positive-600 dark:text-positive-400"
                          : activity.color === "blue"
                            ? "text-brand-700 dark:text-brand-400"
                            : activity.color === "purple"
                              ? "text-brand-600 dark:text-brand-400"
                              : activity.color === "orange"
                                ? "text-alert-600 dark:text-alert-400"
                                : "text-danger-600 dark:text-danger-400"
                      }`}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-content dark:text-ink-100 truncate">
                      {activity.title}
                    </p>
                    <p className="text-xs text-content-muted dark:text-content-subtle truncate">
                      {activity.desc}
                    </p>
                  </div>
                  <div className="text-xs text-content-subtle dark:text-content-muted">
                    {activity.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-6">
          <div className="rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-content dark:text-ink-100 mb-4">
              Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-content-body dark:text-content-subtle">
                  Conversion Rate
                </span>
                <span className="text-sm font-medium text-content dark:text-ink-100">
                  3.2%
                </span>
              </div>
              <div className="w-full bg-ink-200 dark:bg-ink-700 rounded-full h-2">
                <div
                  className="bg-brand-600 h-2 rounded-full"
                  style={{ width: "32%" }}
                ></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-content-body dark:text-content-subtle">
                  Bounce Rate
                </span>
                <span className="text-sm font-medium text-content dark:text-ink-100">
                  45%
                </span>
              </div>
              <div className="w-full bg-ink-200 dark:bg-ink-700 rounded-full h-2">
                <div
                  className="bg-alert-500 h-2 rounded-full"
                  style={{ width: "45%" }}
                ></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-content-body dark:text-content-subtle">
                  Page Views
                </span>
                <span className="text-sm font-medium text-content dark:text-ink-100">
                  8.7k
                </span>
              </div>
              <div className="w-full bg-ink-200 dark:bg-ink-700 rounded-full h-2">
                <div
                  className="bg-positive-500 h-2 rounded-full"
                  style={{ width: "87%" }}
                ></div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line dark:border-ink-800 bg-surface dark:bg-surface-inverted p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-content dark:text-ink-100 mb-4">
              Top Products
            </h3>
            <div className="space-y-3">
              {[
                "iPhone 15 Pro",
                "MacBook Air M2",
                "AirPods Pro",
                "iPad Air",
              ].map((product, i) => (
                <div key={i} className="flex items-center justify-between py-2">
                  <span className="text-sm text-content-body dark:text-content-subtle">
                    {product}
                  </span>
                  <span className="text-sm font-medium text-content dark:text-ink-100">
                    ${Math.floor(Math.random() * 1000 + 500)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Example;
