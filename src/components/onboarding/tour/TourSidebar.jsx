import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock } from "lucide-react";

/** The sections, ticked as you pass them, with the ones your plan
 * does not include shown locked. */
export default function TourSidebar({
  LOCKED_SECTIONS,
  TOUR_SECTIONS,
  currentSection,
  jumpToSection,
}) {
  return (
    <div className="hidden sm:flex flex-col w-44 bg-surface-inverted-deep border-r border-ink-700 p-3 max-h-[calc(90vh-4px)] overflow-y-auto flex-shrink-0">
      <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-3 px-2">
        Features
      </p>
      <div className="space-y-0.5">
        {TOUR_SECTIONS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === currentSection;
          const isDone = i < currentSection;
          return (
            <button
              key={s.id}
              onClick={() => jumpToSection(i)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-all ${
                isActive
                  ? "bg-success-600 text-content-inverted font-semibold"
                  : isDone
                    ? "text-success-400 hover:bg-ink-800"
                    : "text-content-subtle hover:bg-ink-800 hover:text-ink-200"
              }`}
            >
              {isDone ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0" />
              ) : (
                <Icon
                  className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? "text-content-inverted" : ""}`}
                />
              )}
              <span className="truncate">
                {s.id === "welcome"
                  ? "Intro"
                  : s.id === "complete"
                    ? "Done"
                    : s.title.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>

      {LOCKED_SECTIONS.length > 0 && (
        <>
          <div className="border-t border-ink-700 my-3" />
          <p className="text-[10px] font-bold text-content-muted uppercase tracking-widest mb-2 px-2 flex items-center gap-1">
            <Lock className="w-2.5 h-2.5" /> Upgrade
          </p>
          <div className="space-y-0.5">
            {LOCKED_SECTIONS.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-content-body dark:text-ink-300"
              >
                <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate flex-1">
                  {s.title.split(" ")[0]}
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 border-warning-700 text-warning-400 bg-transparent"
                >
                  {s.minimumPlan}
                </Badge>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
