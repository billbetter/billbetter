import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Save, Edit, Trash2, Loader2 } from "lucide-react";

export function SaveTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onNameChange,
  onSave,
  saving,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4 sm:mx-auto border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl text-content dark:text-ink-50">
            <Save className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            Save as Template
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-content-subtle text-sm">
            Save this service configuration for quick reuse on future jobs.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
              Template Name *
            </Label>
            <Input
              placeholder="e.g., Standard Service Call"
              value={templateName}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onNameChange("");
            }}
            disabled={saving}
            className="border-line-strong dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800 h-10 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || !templateName.trim()}
            className="bg-brand hover:bg-brand-hover text-content-inverted shadow-lg h-10 sm:h-11"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Template"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function EditTemplateDialog({
  open,
  onOpenChange,
  templateName,
  onNameChange,
  editingTemplate,
  onUpdate,
  saving,
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md mx-4 sm:mx-auto border-line dark:border-ink-700 bg-surface dark:bg-surface-inverted shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl text-content dark:text-ink-50">
            <Edit className="w-5 h-5 text-brand-700 dark:text-brand-400" />
            Edit Template
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-content-subtle text-sm">
            Update your service template details.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
              Template Name *
            </Label>
            <Input
              placeholder="Template name"
              value={templateName}
              onChange={(e) => onNameChange(e.target.value)}
              className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
            />
          </div>
          {editingTemplate && (
            <div className="bg-surface-sunken dark:bg-ink-800 p-3 rounded-lg border border-line dark:border-ink-700">
              <p className="text-xs text-content-muted dark:text-content-subtle mb-2">
                Items in this template:
              </p>
              <div className="space-y-1">
                {editingTemplate.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between text-xs sm:text-sm text-ink-700 dark:text-ink-300"
                  >
                    <span className="truncate max-w-[200px]">
                      {item.description}
                    </span>
                    <span className="font-medium">
                      ${item.amount?.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-line-strong dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800 h-10 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={onUpdate}
            disabled={saving || !templateName.trim()}
            className="bg-brand hover:bg-brand-hover text-content-inverted shadow-lg h-10 sm:h-11"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              "Update Template"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteTemplateDialog({
  open,
  onOpenChange,
  template,
  onDelete,
  deleting,
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => onOpenChange({ open: o, template })}
    >
      <DialogContent className="sm:max-w-md mx-4 sm:mx-auto border-danger-200 dark:border-danger-800 bg-surface dark:bg-surface-inverted shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl text-danger-600 dark:text-danger-400">
            <Trash2 className="w-5 h-5" />
            Delete Template
          </DialogTitle>
          <DialogDescription className="text-content-body dark:text-content-subtle text-sm">
            Are you sure you want to delete "{template?.template_name}"? This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-3 mt-4">
          <Button
            variant="outline"
            onClick={() => onOpenChange({ open: false, template: null })}
            disabled={deleting}
            className="border-line-strong dark:border-ink-600 dark:text-ink-300 dark:hover:bg-ink-800 h-10 sm:h-11"
          >
            Cancel
          </Button>
          <Button
            onClick={onDelete}
            disabled={deleting}
            className="bg-danger-600 hover:bg-danger-700 text-content-inverted shadow-lg h-10 sm:h-11"
          >
            {deleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              "Delete"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
