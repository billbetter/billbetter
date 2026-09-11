import React from "react";
import { CheckCircle2, Zap } from "lucide-react";

/** The tips beside a slide, when it has any. */
export default function TourTips({
  slide,
}) {
  return (
    <div className="rounded-xl border border-warning-700/50 bg-warning-900/20 p-4">
      <p className="text-xs font-bold text-warning-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
        <Zap className="w-3 h-3" /> Pro Tips
      </p>
      <ul className="space-y-2">
        {slide.tips.map((tip, i) => (
          <li
            key={i}
            className="flex items-start gap-2 text-sm text-ink-300"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-success-400 flex-shrink-0 mt-0.5" />
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
