import React from "react";
import { BookOpen, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";

/** Desktop header: title, Feature Tour, Reset to Defaults and Save. */
export default function SettingsDesktopHeader({
  saving,
  setResetDialog,
  setShowFeatureTour,
  uploadingLogo,
}) {
  return (
    <div className="hidden lg:block mb-8">
      <PageHeader
        title="Business Settings"
        description="Configure your business information and invoice templates"
        actions={
          <>
            <Button type="button" variant="outline" onClick={() => setShowFeatureTour(true)}>
              <BookOpen />
              Feature Tour
            </Button>
            <Button type="button" variant="outline" onClick={() => setResetDialog(true)}>
              <RotateCcw />
              Reset to Defaults
            </Button>
            <Button
              type="submit"
              disabled={saving || uploadingLogo}
              className="min-w-[120px]"
              form="settings-form"
            >
              {saving || uploadingLogo ? (
                <>
                  <Loader2 className="animate-spin" />
                  {uploadingLogo ? "Uploading..." : "Saving..."}
                </>
              ) : (
                "Save Settings"
              )}
            </Button>
          </>
        }
      />
    </div>
  );
}
