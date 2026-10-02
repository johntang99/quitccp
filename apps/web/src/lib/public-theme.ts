import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { type Theme, themeDefaults } from "@/lib/theme-css";

export { themeToCss, FONT_ROLES, themeDefaults } from "@/lib/theme-css";
export type { Theme } from "@/lib/theme-css";

export const THEME_SETTING_KEY = "site.theme";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Merge a stored theme over the defaults, one level per nested group. */
export function mergeTheme(stored: unknown): Theme {
  if (!isObject(stored)) return themeDefaults;
  const out: Record<string, unknown> = {};
  for (const [group, defaults] of Object.entries(themeDefaults)) {
    const override = (stored as Record<string, unknown>)[group];
    if (!isObject(defaults)) {
      out[group] = override ?? defaults;
      continue;
    }
    const merged: Record<string, unknown> = { ...(defaults as Record<string, unknown>) };
    if (isObject(override)) {
      for (const [key, value] of Object.entries(override)) {
        const base = merged[key];
        merged[key] = isObject(base) && isObject(value) ? { ...base, ...value } : value;
      }
    }
    out[group] = merged;
  }
  return out as Theme;
}

export async function loadTheme(): Promise<Theme> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", THEME_SETTING_KEY)
      .maybeSingle();
    if (error) throw error;
    return mergeTheme(data?.value_json);
  } catch {
    // An unreachable DB must never take the site's styling down with it.
    return themeDefaults;
  }
}
