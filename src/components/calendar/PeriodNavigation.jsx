import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Previous / title / next, above the day, week and month views.
 *
 * The three views size it differently, so spacing, title size and button
 * classes are passed in rather than guessed; everything else is shared.
 */
export default function PeriodNavigation({
  title,
  onPrevious,
  onNext,
  spacingClassName,
  titleSizeClassName,
  buttonClassName,
}) {
  return (
    <div className={`flex items-center justify-between ${spacingClassName}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevious}
        className={buttonClassName}
      >
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <h2
        className={`${titleSizeClassName} font-bold text-content dark:text-content-inverted`}
      >
        {title}
      </h2>
      <Button variant="outline" size="sm" onClick={onNext} className={buttonClassName}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}
