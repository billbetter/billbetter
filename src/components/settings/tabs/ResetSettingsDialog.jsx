import React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

/** Confirm resetting every setting except the business name. */
export default function ResetSettingsDialog({
  handleResetToDefaults,
  resetDialog,
  resetting,
  setResetDialog,
}) {
  return (
    <Dialog open={resetDialog} onOpenChange={setResetDialog}>
      <DialogContent className="bg-surface dark:bg-surface-inverted border dark:border-ink-800">
        <DialogHeader>
          <DialogTitle className="text-content dark:text-content-inverted">
            Reset to Default Settings
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-content-subtle">
            This will reset all settings to their default values except your
            business name. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => setResetDialog(false)}
            disabled={resetting}
            className="dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleResetToDefaults}
            disabled={resetting}
            className="bg-danger-600 hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-600"
          >
            {resetting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Resetting...
              </>
            ) : (
              "Reset Settings"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
