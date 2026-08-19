import React from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Filter } from "lucide-react";
import {
  subDays,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfYear,
} from "date-fns";

export default function DateRangeFilter({ dateRange, setDateRange }) {
  const presets = [
    { value: "all", label: "All Time" },
    { value: "7days", label: "Last 7 Days" },
    { value: "30days", label: "Last 30 Days" },
    { value: "90days", label: "Last 90 Days" },
    { value: "thisMonth", label: "This Month" },
    { value: "lastMonth", label: "Last Month" },
    { value: "thisYear", label: "This Year" },
    { value: "custom", label: "Custom Range" },
  ];

  const handlePresetChange = (preset) => {
    const now = new Date();
    let start, end;

    switch (preset) {
      case "7days":
        start = subDays(now, 7);
        end = now;
        break;
      case "30days":
        start = subDays(now, 30);
        end = now;
        break;
      case "90days":
        start = subDays(now, 90);
        end = now;
        break;
      case "thisMonth":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "lastMonth":
        const lastMonth = subMonths(now, 1);
        start = startOfMonth(lastMonth);
        end = endOfMonth(lastMonth);
        break;
      case "thisYear":
        start = startOfYear(now);
        end = now;
        break;
      case "custom":
        // Keep existing dates if switching to custom
        setDateRange({
          preset: "custom",
          start: dateRange?.start || subDays(now, 30),
          end: dateRange?.end || now,
        });
        return;
      default:
        setDateRange({ preset: "all", start: null, end: null });
        return;
    }

    setDateRange({ preset, start, end });
  };

  const handleCustomDateChange = (field, value) => {
    if (!value) return;
    setDateRange({
      ...dateRange,
      preset: "custom",
      [field]: new Date(value),
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      <div className="flex items-center gap-2 text-content-inverted dark:text-ink-300">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Date Range:</span>
      </div>

      <Select
        value={dateRange?.preset || "all"}
        onValueChange={handlePresetChange}
      >
        <SelectTrigger className="w-[160px] bg-surface dark:bg-ink-800 border-line dark:border-ink-700 text-content dark:text-content-inverted">
          <Calendar className="w-4 h-4 mr-2 text-content-body dark:text-content-subtle" />
          <SelectValue placeholder="Select range" />
        </SelectTrigger>
        <SelectContent
          position="popper"
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-[100] max-w-[calc(100vw-2rem)] bg-surface dark:bg-surface-inverted border-line dark:border-ink-700"
        >
          {presets.map((preset) => (
            <SelectItem
              key={preset.value}
              value={preset.value}
              className="text-content dark:text-ink-100 focus:bg-ink-100 dark:focus:bg-ink-800"
            >
              {preset.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {dateRange?.preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={
              dateRange?.start
                ? dateRange.start.toISOString().split("T")[0]
                : ""
            }
            onChange={(e) => handleCustomDateChange("start", e.target.value)}
            className="w-[140px] bg-surface dark:bg-ink-800 border-line dark:border-ink-700 text-content dark:text-content-inverted"
          />
          <span className="text-content-inverted dark:text-content-subtle">
            to
          </span>
          <Input
            type="date"
            value={
              dateRange?.end ? dateRange.end.toISOString().split("T")[0] : ""
            }
            onChange={(e) => handleCustomDateChange("end", e.target.value)}
            className="w-[140px] bg-surface dark:bg-ink-800 border-line dark:border-ink-700 text-content dark:text-content-inverted"
          />
        </div>
      )}
    </div>
  );
}
