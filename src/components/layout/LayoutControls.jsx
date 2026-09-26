import React from "react";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { FONT_OPTIONS } from "@/lib/preferences/fonts";
import { THEME_PRESET_OPTIONS } from "@/lib/preferences/theme-presets";
import {
  resetPreferences,
  setPreference,
  usePreferences,
  useResolvedThemeMode,
} from "@/lib/preferences/preferences";

/**
 * A native <select>, styled like the template's small select. Native on
 * purpose: the popover this sits in would otherwise have to host a second
 * floating layer, and a phone's own picker is the better control anyway.
 */
function PreferenceSelect({ id, value, onChange, children }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full cursor-pointer rounded-md border border-input bg-transparent !px-2 !py-0 text-xs shadow-sm"
    >
      {children}
    </select>
  );
}

function Row({ label, htmlFor, children }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Toggle({ label, value, options, onChange }) {
  return (
    <Row label={label}>
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={value}
        onValueChange={(v) => v && onChange(v)}
        aria-label={label}
      >
        {options.map(([v, text]) => (
          <ToggleGroupItem key={v} value={v} className="text-xs" aria-label={text}>
            {text}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </Row>
  );
}

/** The template's preferences popover: preset, font, mode and layout. */
export default function LayoutControls({ className = "" }) {
  const prefs = usePreferences();
  const resolved = useResolvedThemeMode();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="icon" className={`size-8 ${className}`} aria-label="Layout preferences">
          <Settings2 className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-5">
          <div className="space-y-1.5">
            <h4 className="text-sm font-medium leading-none">Preferences</h4>
            <p className="text-xs text-muted-foreground">
              Customize how Invoicium looks on this device.
            </p>
          </div>
          <div className="space-y-3">
            <Row label="Theme Preset" htmlFor="pref-preset">
              <div className="flex items-center gap-2">
                <span
                  aria-hidden
                  className="size-3 shrink-0 rounded-full border"
                  style={{
                    backgroundColor: (
                      THEME_PRESET_OPTIONS.find((p) => p.value === prefs.theme_preset) ??
                      THEME_PRESET_OPTIONS[0]
                    ).primary[resolved],
                  }}
                />
                <PreferenceSelect
                  id="pref-preset"
                  value={prefs.theme_preset}
                  onChange={(v) => setPreference("theme_preset", v)}
                >
                  {THEME_PRESET_OPTIONS.map((preset) => (
                    <option key={preset.value} value={preset.value}>
                      {preset.label}
                    </option>
                  ))}
                </PreferenceSelect>
              </div>
            </Row>
            <Row label="Font" htmlFor="pref-font">
              <PreferenceSelect id="pref-font" value={prefs.font} onChange={(v) => setPreference("font", v)}>
                {FONT_OPTIONS.map((font) => (
                  <option key={font.key} value={font.key}>
                    {font.label}
                  </option>
                ))}
              </PreferenceSelect>
            </Row>
            <Toggle
              label="Theme Mode"
              value={prefs.theme_mode}
              onChange={(v) => setPreference("theme_mode", v)}
              options={[
                ["light", "Light"],
                ["dark", "Dark"],
                ["system", "System"],
              ]}
            />
            <Toggle
              label="Page Layout"
              value={prefs.content_layout}
              onChange={(v) => setPreference("content_layout", v)}
              options={[
                ["centered", "Centered"],
                ["full-width", "Full Width"],
              ]}
            />
            <Toggle
              label="Navbar Behavior"
              value={prefs.navbar_style}
              onChange={(v) => setPreference("navbar_style", v)}
              options={[
                ["sticky", "Sticky"],
                ["scroll", "Scroll"],
              ]}
            />
            <Toggle
              label="Sidebar Style"
              value={prefs.sidebar_variant}
              onChange={(v) => setPreference("sidebar_variant", v)}
              options={[
                ["inset", "Inset"],
                ["sidebar", "Sidebar"],
                ["floating", "Floating"],
              ]}
            />
            <Toggle
              label="Sidebar Collapse Mode"
              value={prefs.sidebar_collapsible}
              onChange={(v) => setPreference("sidebar_collapsible", v)}
              options={[
                ["icon", "Icon"],
                ["offcanvas", "OffCanvas"],
              ]}
            />
            <Button type="button" size="sm" variant="outline" className="w-full text-xs" onClick={resetPreferences}>
              Restore Defaults
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
