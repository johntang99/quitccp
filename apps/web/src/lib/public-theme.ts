import { createSupabasePublicClient } from "@/lib/supabase/admin-client";
import { type Theme, themeDefaults } from "@/lib/theme-css";
import { unstable_cache } from "next/cache";
import { SITE_CHROME_TAG, SITE_CHROME_TTL_SECONDS } from "@/lib/site-chrome-cache";
import { SITE_LOCALE } from "@/lib/site-config";

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

/*
 * Cached across requests, not just within one: the root layout reads this on
 * every dynamic render. Throws on a database error so that nothing is stored
 * -- see the note in site-chrome-cache.ts; caching the fallback would pin the
 * default palette in place for an hour after a blip.
 */
const loadThemeUncached = unstable_cache(
  async (): Promise<Theme> => {
    const supabase = createSupabasePublicClient();
    const { data, error } = await supabase
      .from("cms_site_settings")
      .select("value_json")
      .eq("setting_key", THEME_SETTING_KEY)
      /* 四个站共用一张设置表，各站有各站的主题。 */
      .eq("locale", SITE_LOCALE)
      .maybeSingle();
    if (error) throw error;
    return mergeTheme(data?.value_json);
  },
  ["site-theme"],
  { tags: [SITE_CHROME_TAG], revalidate: SITE_CHROME_TTL_SECONDS }
);

export async function loadTheme(): Promise<Theme> {
  try {
    return await loadThemeUncached();
  } catch {
    // An unreachable DB must never take the site's styling down with it.
    return themeDefaults;
  }
}
