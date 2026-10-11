import { getHomepageHero, mainNav } from "@/lib/site-data";
import { SECTION_CONFIG, loadSectionNavOverrides, mergeSectionNav } from "@/lib/section-nav";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

export interface PublicNavItem {
  href: string;
  label: string;
}

export interface HomepageHeroContent {
  title: string;
  body: string;
}

interface SiteSettingRow {
  setting_key: string;
  value_json: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseNavValue(value: unknown): PublicNavItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (!isObject(entry)) return null;
      const href = String(entry.href ?? "").trim();
      const label = String(entry.label ?? "").trim();
      if (!href || !label) return null;
      return { href, label };
    })
    .filter((entry): entry is PublicNavItem => Boolean(entry));
}

function parseHeroValue(value: unknown): Partial<HomepageHeroContent> {
  if (!isObject(value)) return {};
  const title = String(value.title ?? "").trim();
  const body = String(value.body ?? "").trim();
  return {
    title: title || undefined,
    body: body || undefined
  };
}

async function listPublicSettings(keys: string[]): Promise<Map<string, unknown>> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_site_settings")
      .select("setting_key, value_json")
      .in("setting_key", keys);
    if (error) throw error;
    return new Map(
      ((data ?? []) as SiteSettingRow[]).map((row) => [String(row.setting_key), row.value_json])
    );
  } catch {
    return new Map();
  }
}

/**
 * The top menu, with each section named the way the editors named it.
 *
 * The labels used to be a second copy, in code, of names that editors already
 * maintain in 页面内容 -> nav/section-tabs.json. So when one of them renamed
 * 我们的服务 to 三退登记与证明, the page said the new name and the menu that led
 * there still said the old one -- and nothing in the admin could fix it.
 *
 * Now the menu reads those same names. The hrefs stay exactly as they are:
 * a label is what a section is called, a href is where it lives, and renaming
 * the first must never touch the second.
 *
 * `site.nav` still wins when it is set, for a menu that needs an item the
 * sections do not cover.
 */
export async function getPublicNav(): Promise<PublicNavItem[]> {
  const settings = await listPublicSettings(["site.nav"]);
  const configured = parseNavValue(settings.get("site.nav"));
  const base = configured.length > 0 ? configured : mainNav;

  let sections: Record<string, { label: string }>;
  try {
    sections = mergeSectionNav(SECTION_CONFIG, await loadSectionNavOverrides());
  } catch {
    // The menu is not worth a 500; the shipped labels are a fine answer.
    return base;
  }

  return base.map((item) => {
    /* "/news" -> "news"; "/" has no section and keeps its own label. */
    const key = item.href.replace(/^\/+|\/+$/g, "");
    const named = key ? sections[key]?.label?.trim() : "";
    return named ? { ...item, label: named } : item;
  });
}

export async function getHomepageHeroContent(): Promise<HomepageHeroContent> {
  const defaults = getHomepageHero();
  const settings = await listPublicSettings(["site.homeHero"]);
  const configured = parseHeroValue(settings.get("site.homeHero"));
  return {
    title: configured.title ?? defaults.title,
    body: configured.body ?? defaults.body
  };
}
