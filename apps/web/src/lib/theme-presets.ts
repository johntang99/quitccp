import moJin from "@/data/theme-presets/mo-jin.json";
import moLan from "@/data/theme-presets/mo-lan.json";
import ziJin from "@/data/theme-presets/zi-jin.json";
import type { Theme } from "@/lib/theme-css";

export interface ThemePreset extends Theme {
  _preset: { id: string; name: string; description: string };
}

/** Order matters: the first is what a fresh install looks like. */
export const THEME_PRESETS = [ziJin, moLan, moJin] as unknown as ThemePreset[];
