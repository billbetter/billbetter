import React from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, Play } from "lucide-react";

/** Back, Skip tour, and the button that moves you on: Start Tour, Next,
 * then Get Started. */
export default function TourFooter({
  currentTotalSlide,
  handleBack,
  handleNext,
  handleSkip,
  isFirstSlide,
  isLastSlide,
  totalSlides,
}) {
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-ink-700 bg-surface-inverted flex-shrink-0">
      <div>
        {!isFirstSlide && (
          <Button
            variant="ghost"
            onClick={handleBack}
            className="gap-1 text-sm text-content-subtle hover:text-content-inverted hover:bg-ink-800 h-9 px-3"
          >
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-content-muted">
          {currentTotalSlide}/{totalSlides}
        </span>
        {!isLastSlide && (
          <Button
            variant="ghost"
            onClick={handleSkip}
            className="text-xs text-ink-300 hover:text-content-inverted hover:bg-ink-700 h-8 px-3 border border-ink-600"
          >
            Skip tour
          </Button>
        )}
        <Button
          onClick={handleNext}
          className="bg-brand hover:bg-brand-hover text-content-inverted gap-1.5 h-9 px-4 text-sm shadow-sm"
        >
          {isLastSlide ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" /> Get Started
            </>
          ) : isFirstSlide ? (
            <>
              Start Tour <Play className="w-3.5 h-3.5" />
            </>
          ) : (
            <>
              Next <ChevronRight className="w-3.5 h-3.5" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
