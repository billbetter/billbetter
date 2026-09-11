import React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Edit, MoreVertical, Trash2, Zap } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

/** Saved line-item templates: apply one, or rename / delete it. */
export default function ServiceTemplatesCard({
  handleLoadTemplate,
  handleOpenEditTemplate,
  setDeleteTemplateDialog,
  templates,
}) {
  return <>
    {templates.length > 0 && (
      <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center gap-3 mb-4 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center shrink-0 dark:bg-brand-900/30">
              <Zap className="w-5 h-5 text-brand-600 dark:text-brand-400" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-content dark:text-ink-50 truncate">
                Service Templates
              </h3>
              <p className="text-xs sm:text-sm text-content-muted dark:text-content-subtle truncate">
                Quick-start common jobs
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-1 group"
              >
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleLoadTemplate(template)}
                  className="gap-2 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3 border-line dark:border-ink-600 hover:border-brand-400 dark:hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/20 bg-surface-sunken dark:bg-ink-800 text-ink-700 dark:text-ink-200"
                >
                  <ClipboardList className="w-3.5 h-3.5 text-brand-600 dark:text-brand-400" />
                  <span className="truncate max-w-[100px] sm:max-w-[150px]">
                    {template.template_name}
                  </span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-content-subtle hover:text-content-body dark:hover:text-ink-300"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-48 bg-surface dark:bg-surface-inverted border-line dark:border-ink-700"
                  >
                    <DropdownMenuItem
                      onClick={() => handleOpenEditTemplate(template)}
                      className="dark:text-ink-200 dark:focus:bg-ink-800 cursor-pointer"
                    >
                      <Edit className="w-4 h-4 mr-2 text-brand-700 dark:text-brand-400" />
                      Edit Template
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        setDeleteTemplateDialog({
                          open: true,
                          template,
                        })
                      }
                      className="text-danger-600 dark:text-danger-400 dark:focus:bg-danger-900/20 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete Template
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
    </>;
}
