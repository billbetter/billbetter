import React from "react";
import { Link } from "react-router-dom";

/** Everything that does not fit in the four tabs. */
export default function MobileMoreSheet({
  isNavActive,
  navigation,
}) {
  return (
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
              const isActive = isNavActive(item);
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
  );
}
