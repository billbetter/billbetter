import React from "react";

/** How far through the tour you are. */
export default function TourProgressBar({
  progress,
}) {
  return (
    <div className="h-1 bg-ink-700">
      <div
        className="h-full bg-success-500 transition-all duration-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
