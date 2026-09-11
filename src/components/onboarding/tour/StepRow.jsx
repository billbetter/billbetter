import React from "react";

/** One labelled step inside a simulated screen. */
const StepRow = ({
  icon: Icon,
  label,
  iconBg = "bg-success-800",
  iconColor = "text-success-300",
}) => (
  <div className="flex items-center gap-3 p-2.5 bg-ink-700 rounded-lg border border-ink-600">
    <div
      className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center flex-shrink-0`}
    >
      <Icon className={`w-3.5 h-3.5 ${iconColor}`} />
    </div>
    <span className="text-sm font-medium text-ink-100">{label}</span>
  </div>
);

export default StepRow;
