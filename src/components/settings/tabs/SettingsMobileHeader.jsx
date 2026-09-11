import React from "react";
import { Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Phone header: title and the Save button (it submits #settings-form). */
export default function SettingsMobileHeader({
  saving,
  uploadingLogo,
}) {
  return (
    <div className="lg:hidden mb-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="w-10 h-10 rounded-xl bg-success-600 flex items-center justify-center shadow-lg flex-shrink-0">
            <Building2 className="w-5 h-5 text-content-inverted" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-content dark:text-content-inverted tracking-tight">
              Settings
            </h1>
            <p className="text-xs text-content-muted dark:text-content-subtle">
              Business configuration
            </p>
          </div>
        </div>
        <Button
          type="submit"
          disabled={saving || uploadingLogo}
          className="bg-brand hover:bg-brand-hover h-9 px-4 text-sm font-semibold shadow-lg flex-shrink-0"
          form="settings-form"
        >
          {saving || uploadingLogo ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}
