import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Sparkles, ArrowRight } from "lucide-react";

/**
 * Inline upgrade prompt component
 */
export default function UpgradePrompt({
  feature,
  requiredPlan = "higher plan",
  variant = "default", // 'default', 'compact', 'inline'
  className = "",
}) {
  if (variant === "compact") {
    return (
      <div
        className={`flex items-center justify-between gap-4 p-3 rounded-lg bg-warning-50 border border-warning-200 ${className}`}
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-warning-600" />
          <span className="text-sm font-medium text-content dark:text-content-inverted">
            Upgrade to access {feature}
          </span>
        </div>
        <Link to={createPageUrl("Pricing")}>
          <Button
            size="sm"
            className="bg-warning-500 hover:bg-warning-600 text-content"
          >
            Upgrade
          </Button>
        </Link>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span
        className={`inline-flex items-center gap-1 text-xs text-warning-700 ${className}`}
      >
        <Lock className="w-3 h-3" />
        Requires {requiredPlan}
      </span>
    );
  }

  return (
    <Alert className={`border-2 border-warning-200 bg-warning-50 ${className}`}>
      <Sparkles className="w-5 h-5 text-warning-600" />
      <AlertDescription className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="font-semibold text-content mb-1 dark:text-content-inverted">
            You'll need to upgrade your plan to use {feature}
          </p>
          <p className="text-sm text-ink-700 dark:text-ink-300">
            This feature is available on the{" "}
            <span className="font-bold text-warning-600">{requiredPlan}</span>{" "}
            plan and higher.
          </p>
        </div>
        <Link to={createPageUrl("Pricing")}>
          <Button className="bg-warning-500 text-content whitespace-nowrap">
            <ArrowRight className="w-4 h-4 mr-2" />
            View Plans
          </Button>
        </Link>
      </AlertDescription>
    </Alert>
  );
}
