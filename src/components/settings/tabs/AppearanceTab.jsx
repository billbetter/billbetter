import React from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Info, Monitor, Moon, Sun, Waves } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SHADER_PRESETS } from "@/components/ui/shader-presets";
import { TabsContent } from "@/components/ui/tabs";
import { useShaderAppearance, setShaderBackgroundEnabled, setShaderPreset } from "@/lib/appearance";
import { FONT_OPTIONS } from "@/lib/preferences/fonts";
import { THEME_PRESET_OPTIONS } from "@/lib/preferences/theme-presets";
import { setPreference, usePreferences, useResolvedThemeMode } from "@/lib/preferences/preferences";

const THEME_MODES = [
  { id: "light", icon: Sun, label: "Light Mode", desc: "Clean and bright interface" },
  { id: "dark", icon: Moon, label: "Dark Mode", desc: "Easy on the eyes" },
  { id: "system", icon: Monitor, label: "System Default", desc: "Follow device settings" },
];

/** A selectable option card, in the template's bordered style. */
function OptionCard({ active, onClick, children, className = "", ...props }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-lg border p-4 text-left transition-colors ${
        active ? "border-primary bg-accent ring-1 ring-primary" : "hover:bg-accent/50"
      } ${className}`}
      {...props}
    >
      {active && (
        <span className="absolute right-3 top-3 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-3" />
        </span>
      )}
      {children}
    </button>
  );
}

/** Theme mode, preset and font, and the animated background -- all saved to
 * this browser (the same preferences as the header's layout controls). */
export default function AppearanceTab() {
  const prefs = usePreferences();
  const resolved = useResolvedThemeMode();
  const { enabled: shaderBackground, preset: shaderPreset } = useShaderAppearance();

  return (
    <TabsContent value="appearance">
      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Customize how Invoicium looks on this device.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div>
            <Label className="mb-3 block">Theme Preference</Label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {THEME_MODES.map((theme) => {
                const Icon = theme.icon;
                return (
                  <OptionCard
                    key={theme.id}
                    active={prefs.theme_mode === theme.id}
                    onClick={() => setPreference("theme_mode", theme.id)}
                  >
                    <span className="mb-3 flex size-9 items-center justify-center rounded-md border bg-background">
                      <Icon className="size-4" />
                    </span>
                    <span className="block font-medium">{theme.label}</span>
                    <span className="block text-sm text-muted-foreground">{theme.desc}</span>
                  </OptionCard>
                );
              })}
            </div>
          </div>

          <div>
            <Label className="mb-3 block">Theme Preset</Label>
            <div role="radiogroup" aria-label="Theme preset" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {THEME_PRESET_OPTIONS.map((preset) => (
                <OptionCard
                  key={preset.value}
                  role="radio"
                  aria-checked={prefs.theme_preset === preset.value}
                  active={prefs.theme_preset === preset.value}
                  onClick={() => setPreference("theme_preset", preset.value)}
                  className="p-3"
                >
                  <span
                    aria-hidden
                    className="mb-2 block h-8 w-full rounded-md border"
                    style={{ backgroundColor: preset.primary[resolved] }}
                  />
                  <span className="block text-sm font-medium">{preset.label}</span>
                </OptionCard>
              ))}
            </div>
          </div>

          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-start gap-2">
              <Info className="mt-0.5 size-4 flex-shrink-0 text-muted-foreground" />
              <div className="text-sm">
                <p className="mb-1 font-medium">Saved to this browser</p>
                <p className="text-xs text-muted-foreground">
                  Your theme preference is saved to your browser. Use &quot;System Default&quot; to
                  automatically match your device&apos;s dark mode setting.
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-xs">
            <Label htmlFor="appearance-font" className="mb-3 block">
              Font
            </Label>
            <select
              id="appearance-font"
              value={prefs.font}
              onChange={(e) => setPreference("font", e.target.value)}
              className="h-9 w-full cursor-pointer rounded-md border border-input bg-transparent text-sm shadow-sm"
            >
              {FONT_OPTIONS.map((font) => (
                <option key={font.key} value={font.key}>
                  {font.label}
                </option>
              ))}
            </select>
          </div>

          {/* Animated background ------------------------------- */}
          <div>
            <Label className="mb-3 block">Background</Label>
            <button
              type="button"
              role="switch"
              aria-checked={shaderBackground}
              onClick={() => setShaderBackgroundEnabled(!shaderBackground)}
              className={`flex w-full items-center gap-4 rounded-lg border p-4 text-left transition-colors ${
                shaderBackground ? "border-primary bg-accent ring-1 ring-primary" : "hover:bg-accent/50"
              }`}
            >
              <span className="flex size-10 flex-shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-[#1b6ba8] to-[#5ad2f4]">
                <Waves className="size-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">Animated background</span>
                <span className="block text-sm text-muted-foreground">
                  Slow movement behind your pages instead of the flat colour. Your cards and text
                  are unchanged.
                </span>
              </span>
              <span
                className={`relative h-5 w-9 flex-shrink-0 rounded-full transition-colors ${
                  shaderBackground ? "bg-primary" : "bg-input"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-4 rounded-full bg-background shadow transition-all ${
                    shaderBackground ? "left-[1.125rem]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
            {/*
              Only shown while the background is on. A style picker
              above a switch that is off is a choice with nothing to
              apply to -- and the styles cannot be previewed here, so
              offering them with the canvas hidden would be asking
              for a decision blind.
            */}
            {shaderBackground && (
              <div role="radiogroup" aria-label="Background style" className="mt-3 grid gap-3 sm:grid-cols-2">
                {Object.values(SHADER_PRESETS).map((option) => {
                  const active = shaderPreset === option.id;
                  return (
                    <OptionCard
                      key={option.id}
                      role="radio"
                      aria-checked={active}
                      active={active}
                      onClick={() => setShaderPreset(option.id)}
                      className="flex items-center gap-3"
                    >
                      <span
                        aria-hidden
                        className="size-10 flex-shrink-0 rounded-md"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`,
                        }}
                      />
                      <span className="min-w-0 flex-1 pr-6">
                        <span className="block text-sm font-medium">{option.label}</span>
                        <span className="block text-xs text-muted-foreground">{option.description}</span>
                      </span>
                    </OptionCard>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Saved to this browser, like your theme. It pauses when the tab is hidden or scrolled
              out of view, so it costs nothing while you are not looking at it.
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
