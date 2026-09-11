import React from "react";
import { X } from "lucide-react";

/** The current section's name and this slide's title, and the close button. */
export default function TourSlideHeader({
  SectionIcon,
  handleSkip,
  section,
}) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 ${section.color} rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm`}
        >
          <SectionIcon className="w-5 h-5 text-content-inverted" />
        </div>
        <div>
          <h2 className="text-base font-bold text-content-inverted leading-tight">
            {section.title}
          </h2>
          <p className="text-xs text-content-subtle mt-0.5">
            {section.subtitle}
          </p>
        </div>
      </div>
      <button
        onClick={handleSkip}
        className="text-ink-300 hover:text-ink-300 transition-colors p-1.5 rounded-lg hover:bg-ink-800"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
