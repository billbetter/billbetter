import React from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPreference, usePreferences } from "@/lib/preferences/preferences";

const THEME_CYCLE = ["light", "dark", "system"];
const ICONS = { light: Moon, dark: Sun, system: Monitor };

/** The template's one-button theme cycle: light -> dark -> system. */
export default function ThemeSwitcher() {
  const { theme_mode } = usePreferences();
  const next = THEME_CYCLE[(THEME_CYCLE.indexOf(theme_mode) + 1) % THEME_CYCLE.length];
  const Icon = ICONS[theme_mode] || Moon;

  return (
    <Button
      size="icon"
      className="size-8"
      onClick={() => setPreference("theme_mode", next)}
      aria-label={`Current theme: ${theme_mode}. Switch to ${next}`}
      title={`Theme: ${theme_mode}`}
    >
      <Icon className="size-4" />
    </Button>
  );
}
