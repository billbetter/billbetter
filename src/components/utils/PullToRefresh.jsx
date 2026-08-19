import React, { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";

/**
 * PullToRefresh — attaches to the window scroll, not a container.
 * This avoids the "glitch when scrolling up" issue caused by nested
 * overflow-auto containers fighting each other.
 */
export default function PullToRefresh({ onRefresh, children }) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const startY = useRef(0);
  const isPulling = useRef(false);
  const threshold = 72;

  const handleTouchStart = useCallback((e) => {
    // Only start pull if the page is scrolled to the very top
    if (window.scrollY === 0) {
      startY.current = e.touches[0].clientY;
      isPulling.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e) => {
      if (!isPulling.current || isRefreshing) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy > 0 && window.scrollY === 0) {
        // Don't call preventDefault here — it breaks normal scroll on iOS.
        // Instead just track the pull distance for the indicator.
        setPullDistance(Math.min(dy, threshold * 1.5));
      } else {
        // User is scrolling down or page is no longer at top — stop tracking
        isPulling.current = false;
        setPullDistance(0);
      }
    },
    [isRefreshing],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling.current) return;
    isPulling.current = false;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(threshold);
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 400);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, isRefreshing, onRefresh]);

  useEffect(() => {
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  const progress = Math.min(pullDistance / threshold, 1);

  return (
    <div className="relative">
      {/* Pull indicator */}
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed top-14 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center lg:hidden"
          style={{ opacity: progress }}
        >
          <div
            className="bg-success-600 rounded-full p-2 shadow-xl"
            style={{ transform: `scale(${0.4 + progress * 0.6})` }}
          >
            <RefreshCw
              className={`w-5 h-5 text-content-inverted ${isRefreshing ? "animate-spin" : ""}`}
            />
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
