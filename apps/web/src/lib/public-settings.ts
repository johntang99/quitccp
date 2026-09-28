import { getHomepageHero, mainNav } from "@/lib/site-data";
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

export async function getPublicNav(): Promise<PublicNavItem[]> {
  const settings = await listPublicSettings(["site.nav"]);
  const configured = parseNavValue(settings.get("site.nav"));
  return configured.length > 0 ? configured : mainNav;
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
