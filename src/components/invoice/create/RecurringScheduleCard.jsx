import React from "react";
import { Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** The recurring schedule: frequency, start, and how it ends. */
export default function RecurringScheduleCard({
  isRecurring,
  recurringSettings,
  setRecurringSettings,
}) {
  return <>
    {isRecurring && (
      <Card className="border-0 shadow-lg bg-surface dark:bg-surface-inverted overflow-hidden ring-1 ring-ink-200 dark:ring-ink-700">
        <CardHeader className="bg-surface-sunken dark:bg-ink-800 border-b border-line-subtle dark:border-ink-700 py-3 sm:py-4 px-4 sm:px-6">
          <CardTitle className="text-content dark:text-ink-50 flex items-center gap-2 text-base sm:text-lg">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-brand-700 dark:text-brand-400" />
            Schedule Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-5 p-4 sm:p-6">
          <div className="space-y-2">
            <Label
              htmlFor="template_name"
              className="text-ink-700 dark:text-ink-300 font-medium text-sm"
            >
              Contract Name{" "}
              <span className="text-content-muted font-normal">
                (Optional)
              </span>
            </Label>
            <Input
              id="template_name"
              value={recurringSettings.template_name}
              onChange={(e) =>
                setRecurringSettings({
                  ...recurringSettings,
                  template_name: e.target.value,
                })
              }
              placeholder="e.g., Monthly HVAC Maintenance"
              className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div className="space-y-2">
              <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                Frequency *
              </Label>
              <Select
                value={recurringSettings.frequency}
                onValueChange={(value) =>
                  setRecurringSettings({
                    ...recurringSettings,
                    frequency: value,
                  })
                }
              >
                <SelectTrigger className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-surface dark:bg-surface-inverted border-line dark:border-ink-700">
                  <SelectItem
                    value="weekly"
                    className="dark:text-ink-200 dark:focus:bg-ink-800"
                  >
                    Weekly
                  </SelectItem>
                  <SelectItem
                    value="biweekly"
                    className="dark:text-ink-200 dark:focus:bg-ink-800"
                  >
                    Bi-weekly
                  </SelectItem>
                  <SelectItem
                    value="monthly"
                    className="dark:text-ink-200 dark:focus:bg-ink-800"
                  >
                    Monthly
                  </SelectItem>
                  <SelectItem
                    value="quarterly"
                    className="dark:text-ink-200 dark:focus:bg-ink-800"
                  >
                    Quarterly
                  </SelectItem>
                  <SelectItem
                    value="yearly"
                    className="dark:text-ink-200 dark:focus:bg-ink-800"
                  >
                    Yearly
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
                Start Date *
              </Label>
              <Input
                id="start_date"
                type="date"
                value={recurringSettings.start_date}
                onChange={(e) =>
                  setRecurringSettings({
                    ...recurringSettings,
                    start_date: e.target.value,
                  })
                }
                className="h-10 sm:h-11 border-line dark:border-ink-600 bg-surface dark:bg-surface-inverted-deep text-content dark:text-ink-50 focus:border-info-500 focus:ring-info-500/20"
              />
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-ink-700 dark:text-ink-300 font-medium text-sm">
              End Condition
            </Label>
            <div className="space-y-3 bg-surface-sunken dark:bg-ink-800/50 p-3 sm:p-4 rounded-xl border border-line dark:border-ink-700">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={recurringSettings.end_type === "never"}
                  onChange={() =>
                    setRecurringSettings({
                      ...recurringSettings,
                      end_type: "never",
                    })
                  }
                  className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                />
                <span className="text-ink-700 dark:text-ink-300 text-sm">
                  Never ends
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={recurringSettings.end_type === "after"}
                  onChange={() =>
                    setRecurringSettings({
                      ...recurringSettings,
                      end_type: "after",
                    })
                  }
                  className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                />
                <span className="text-ink-700 dark:text-ink-300 text-sm">
                  After
                </span>
                <Input
                  type="number"
                  min="1"
                  value={recurringSettings.occurrences}
                  onChange={(e) =>
                    setRecurringSettings({
                      ...recurringSettings,
                      occurrences: parseInt(e.target.value) || 1,
                    })
                  }
                  disabled={recurringSettings.end_type !== "after"}
                  className="w-16 sm:w-20 h-8 sm:h-9 disabled:opacity-50 bg-surface dark:bg-surface-inverted-deep border-line dark:border-ink-600 text-content dark:text-ink-50 text-sm"
                />
                <span className="text-ink-700 dark:text-ink-300 text-sm">
                  occurrences
                </span>
              </label>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  checked={recurringSettings.end_type === "on_date"}
                  onChange={() =>
                    setRecurringSettings({
                      ...recurringSettings,
                      end_type: "on_date",
                    })
                  }
                  className="w-4 h-4 sm:w-5 sm:h-5 text-info-600 dark:text-info-300 border-line-strong dark:border-ink-600 focus:ring-info-500 dark:bg-ink-700"
                />
                <span className="text-ink-700 dark:text-ink-300 text-sm">
                  On date
                </span>
                <Input
                  type="date"
                  value={recurringSettings.end_date}
                  onChange={(e) =>
                    setRecurringSettings({
                      ...recurringSettings,
                      end_date: e.target.value,
                    })
                  }
                  disabled={recurringSettings.end_type !== "on_date"}
                  className="h-8 sm:h-9 disabled:opacity-50 bg-surface dark:bg-surface-inverted-deep border-line dark:border-ink-600 text-content dark:text-ink-50 text-sm"
                />
              </label>
            </div>
          </div>
        </CardContent>
      </Card>
    )}
    </>;
}
