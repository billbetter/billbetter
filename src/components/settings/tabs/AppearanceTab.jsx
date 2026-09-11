import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Info, Monitor, Moon, Palette, Sun, Waves } from "lucide-react";
import { Label } from "@/components/ui/label";
import { SHADER_PRESETS } from "@/components/ui/shader-presets";
import { TabsContent } from "@/components/ui/tabs";
import {
  useShaderAppearance,
  setShaderBackgroundEnabled,
  setShaderPreset,
} from "@/lib/appearance";

/** Apply and remember a theme. "system" forgets the choice. */
const toggleDarkMode = (mode) => {
  if (mode === "system") {
    // "System" resets to the product default, which is light — matching the
    // marketing site. Dark stays available as an explicit choice below.
    localStorage.removeItem("invoicium-dark-mode");
    document.documentElement.classList.remove("dark");
  } else {
    const isDark = mode === "dark";
    localStorage.setItem("invoicium-dark-mode", isDark.toString());
    document.documentElement.classList.toggle("dark", isDark);
  }
};

/** Light/dark/system theme and the animated background, both saved to this browser. */
export default function AppearanceTab() {
  const { enabled: shaderBackground, preset: shaderPreset } =
    useShaderAppearance();
  return (
    <TabsContent value="appearance">
      <Card className="border-none shadow-lg bg-surface dark:bg-surface-inverted dark:border dark:border-ink-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-content dark:text-content-inverted">
            <Palette className="w-5 h-5 text-success-600 dark:text-success-400" />
            Appearance
          </CardTitle>
          <p className="text-sm text-content-body dark:text-content-subtle">
            Customize how Invoicium looks on your device
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-ink-700 dark:text-ink-300 mb-4 block">
              Theme Preference
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "light",
                  icon: Sun,
                  label: "Light Mode",
                  desc: "Clean and bright interface",
                  color: "bg-warning-400",
                },
                {
                  id: "dark",
                  icon: Moon,
                  label: "Dark Mode",
                  desc: "Easy on the eyes",
                  color: "bg-brand-600",
                },
                {
                  id: "system",
                  icon: Monitor,
                  label: "System Default",
                  desc: "Follow device settings",
                  color: "bg-ink-600",
                },
              ].map((theme) => {
                const Icon = theme.icon;
                const stored = localStorage.getItem(
                  "invoicium-dark-mode",
                );
                const isSystem = stored === null;
                const isActive =
                  (theme.id === "system" && isSystem) ||
                  (theme.id === "light" &&
                    !isSystem &&
                    stored === "false") ||
                  (theme.id === "dark" &&
                    !isSystem &&
                    stored === "true");

                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => toggleDarkMode(theme.id)}
                    className={`relative border-2 rounded-xl p-6 transition-all text-left ${
                      isActive
                        ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                        : "border-line dark:border-ink-700 hover:border-line-strong dark:hover:border-ink-600 bg-surface dark:bg-ink-800"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute top-3 right-3">
                        <CheckCircle className="w-5 h-5 text-success-600 dark:text-success-400" />
                      </div>
                    )}

                    <div
                      className={`w-12 h-12 rounded-xl ${theme.color} flex items-center justify-center mb-4 shadow-lg`}
                    >
                      <Icon className="w-6 h-6 text-content-inverted" />
                    </div>

                    <h3 className="font-black text-content dark:text-content-inverted mb-1">
                      {theme.label}
                    </h3>
                    <p className="text-sm text-content-body dark:text-content-subtle">
                      {theme.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 bg-brand-50 dark:bg-brand-900/20 rounded-lg border border-info-200 dark:border-info-800">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-brand-700 dark:text-brand-400" />
              <div className="text-sm text-info-800 dark:text-info-200">
                <p className="font-medium mb-1">
                  Theme applies across all devices
                </p>
                <p className="text-xs text-brand-800 dark:text-brand-300">
                  Your theme preference is saved to your browser. Use
                  "System Default" to automatically match your
                  device's dark mode setting.
                </p>
              </div>
            </div>
          </div>

          {/* Animated background ------------------------------- */}
          <div>
            <Label className="text-ink-700 dark:text-ink-300 mb-4 block">
              Background
            </Label>
            <button
              type="button"
              role="switch"
              aria-checked={shaderBackground}
              onClick={() => setShaderBackgroundEnabled(!shaderBackground)}
              className={`flex w-full items-center gap-4 rounded-xl border-2 p-6 text-left transition-all ${
                shaderBackground
                  ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                  : "border-line bg-surface hover:border-line-strong dark:border-ink-700 dark:bg-ink-800 dark:hover:border-ink-600"
              }`}
            >
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#1b6ba8] to-[#5ad2f4] shadow-lg">
                <Waves className="h-5 w-5 text-white" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold text-content dark:text-content-inverted">
                  Animated background
                </span>
                <span className="block text-sm text-content-body dark:text-content-subtle">
                  Slow movement behind your pages instead of the flat
                  colour. Your cards and text are unchanged.
                </span>
              </span>
              <span
                className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
                  shaderBackground
                    ? "bg-success-600"
                    : "bg-ink-300 dark:bg-ink-600"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                    shaderBackground ? "left-[1.375rem]" : "left-0.5"
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
              <div
                role="radiogroup"
                aria-label="Background style"
                className="mt-3 grid gap-3 sm:grid-cols-2"
              >
                {Object.values(SHADER_PRESETS).map((option) => {
                  const active = shaderPreset === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setShaderPreset(option.id)}
                      className={`flex items-center gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                        active
                          ? "border-success-500 bg-success-50 dark:bg-success-900/30"
                          : "border-line bg-surface hover:border-line-strong dark:border-ink-700 dark:bg-ink-800 dark:hover:border-ink-600"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="h-10 w-10 flex-shrink-0 rounded-lg shadow-inner"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${option.swatch[0]}, ${option.swatch[1]})`,
                        }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold text-content dark:text-content-inverted">
                          {option.label}
                        </span>
                        <span className="block text-xs text-content-body dark:text-content-subtle">
                          {option.description}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-content-muted dark:text-content-subtle">
              Saved to this browser, like your theme. It pauses when
              the tab is hidden or scrolled out of view, so it costs
              nothing while you are not looking at it.
            </p>
          </div>
        </CardContent>
      </Card>
    </TabsContent>
  );
}
