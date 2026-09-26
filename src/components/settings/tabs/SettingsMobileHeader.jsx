import React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import PageHeader from "@/components/layout/PageHeader";

/** Phone header: title and the Save button (it submits #settings-form). */
export default function SettingsMobileHeader({
  saving,
  uploadingLogo,
}) {
  return (
    <div className="lg:hidden mb-5">
      <PageHeader
        className="flex-row items-center sm:items-center"
        title="Settings"
        description="Business configuration"
        actions={
          <Button
            type="submit"
            disabled={saving || uploadingLogo}
            className="min-w-16"
            form="settings-form"
          >
            {saving || uploadingLogo ? <Loader2 className="animate-spin" /> : "Save"}
          </Button>
        }
      />
    </div>
  );
}
