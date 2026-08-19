import React, { useState } from "react";
import { Lock, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import FreePlanLimitDialog from "./FreePlanLimitDialog";

/**
 * Badge to show locked features for free plan users
 */
export default function LockedFeatureBadge({ inline = false, onClick }) {
  const [showDialog, setShowDialog] = useState(false);

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      setShowDialog(true);
    }
  };

  if (inline) {
    return (
      <>
        <button
          onClick={handleClick}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-warning-100 hover:bg-warning-200 transition-colors cursor-pointer dark:bg-warning-900/30"
        >
          <Lock className="w-3 h-3 text-warning-700" />
          <span className="text-xs font-semibold text-warning-700">Locked</span>
        </button>
        <FreePlanLimitDialog
          isOpen={showDialog}
          onClose={() => setShowDialog(false)}
          type="feature"
        />
      </>
    );
  }

  return (
    <>
      <Badge
        onClick={handleClick}
        className="bg-warning-100 text-warning-800 hover:bg-warning-200 border-warning-300 cursor-pointer dark:bg-warning-900/30 dark:text-warning-300"
      >
        <Lock className="w-3 h-3 mr-1" />
        Locked - Start Trial
      </Badge>
      <FreePlanLimitDialog
        isOpen={showDialog}
        onClose={() => setShowDialog(false)}
        type="feature"
      />
    </>
  );
}
