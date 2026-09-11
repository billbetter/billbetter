import React from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";

/**
 * Every settings panel, in strip order. `pill` is the shorter name the phone
 * layout's scrolling pills use, where it differs.
 */
export const SETTINGS_TABS = [
  { value: "business", label: "Business" },
  { value: "security", label: "Security" },
  { value: "billing", label: "Billing" },
  { value: "payments", label: "Payments" },
  { value: "calendar", label: "Calendar" },
  { value: "notifications", label: "Notifications", pill: "Alerts" },
  { value: "appearance", label: "Appearance", pill: "Theme" },
  { value: "template", label: "PDF Templates", pill: "PDF" },
  { value: "legal", label: "Legal" },
  { value: "contact", label: "Contact", pill: "Support" },
];

const TRIGGER_CLASS =
  "text-sm px-3 py-2 whitespace-nowrap flex-1 text-ink-700 data-[state=active]:bg-surface data-[state=active]:text-content dark:data-[state=active]:bg-ink-700 dark:text-ink-300 dark:data-[state=active]:text-content-inverted";

/**
 * The tab strip: a row of triggers from md up, and scrolling pills below it.
 * Both drive the same `activeTab`.
 */
export default function SettingsTabNav({ activeTab, setActiveTab }) {
  return (
    <>
      <TabsList className="hidden md:flex w-full overflow-x-auto scrollbar-hide bg-ink-100 dark:bg-ink-800 p-1 rounded-lg justify-start">
        {SETTINGS_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className={TRIGGER_CLASS}>
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <div className="md:hidden -mx-4 px-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {SETTINGS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                activeTab === tab.value
                  ? "bg-success-600 text-content-inverted shadow-md shadow-success-500/20"
                  : "bg-surface dark:bg-ink-800 text-content-body dark:text-content-subtle border border-line dark:border-ink-700"
              }`}
            >
              {tab.pill || tab.label}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
