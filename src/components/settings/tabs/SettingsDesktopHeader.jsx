import React from "react";
import { BookOpen, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Desktop header: title, Feature Tour, Reset to Defaults and Save. */
export default function SettingsDesktopHeader({
  saving,
  setResetDialog,
  setShowFeatureTour,
  uploadingLogo,
}) {
  return (
    <div className="hidden lg:block mb-8">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-black text-content dark:text-content-inverted mb-1">
            Business Settings
          </h1>
          <p className="text-content-body dark:text-content-subtle">
            Configure your business information and invoice templates
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowFeatureTour(true)}
            className="gap-2 border-success-300 dark:border-success-700 text-success-700 dark:text-success-400 hover:bg-success-50 dark:hover:bg-success-900/30"
          >
            <BookOpen className="w-4 h-4" />
            Feature Tour
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setResetDialog(true)}
            className="gap-2 border-line-strong dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </Button>
          <Button
            type="submit"
            disabled={saving || uploadingLogo}
            className="bg-brand hover:bg-brand-hover min-w-[120px]"
            form="settings-form"
          >
            {saving || uploadingLogo ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {uploadingLogo ? "Uploading..." : "Saving..."}
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
