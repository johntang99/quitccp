import { cache } from "react";
import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * The tab row under each section's masthead, as something an editor can change.
 *
 * These labels used to live only in `InteriorScaffold.tsx`. Renaming one meant
 * editing code -- and renaming 历史阿革 to 退党大事记 turned out to touch eleven
 * places across four files and two tables, because the same words were also
 * typed into the "related" panels and the seed content. A name that appears in
 * eleven places is data wearing a code costume.
 *
 * So the row is read from the content entry below, which shows up in 页面内容
 * like any other, and falls back to the table shipped here when the entry is
 * missing or malformed. The fallback is not a nicety: this renders on every
 * interior page, and a bad row of JSON must not take the site down.
 *
 * Only labels and order are editable. `slug` is what the tab points at, and
 * changing it would break the link rather than rename it -- so a slug that is
 * not already known is ignored.
 */

export const SECTION_NAV_PATH = "nav/section-tabs.json";

export interface SectionTab {
  slug: string;
  label: string;
  href?: string;
  /** Leaves this site for the production service on another subdomain. */
  externalHref?: string;
}

export interface SectionNav {
  label: string;
  baseHref: string;
  tabs: SectionTab[];
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Overlay the stored labels onto the shipped table.
 *
 * A merge rather than a replacement, so the entry only has to carry what an
 * editor changed. Anything it does not mention keeps the built-in value, and
 * an entry naming a section or slug that no longer exists is skipped instead
 * of creating a tab that points nowhere.
 */
export function mergeSectionNav(
  base: Record<string, SectionNav>,
  stored: unknown
): Record<string, SectionNav> {
  const overrides = asRecord(asRecord(stored).sections);
  if (Object.keys(overrides).length === 0) return base;

  const merged: Record<string, SectionNav> = {};
  for (const [section, config] of Object.entries(base)) {
    const override = asRecord(overrides[section]);
    const labels = asRecord(override.tabs);
    const order = Array.isArray(override.order) ? override.order.map(String) : null;

    let tabs = config.tabs.map((tab) => {
      const label = labels[tab.slug];
      return typeof label === "string" && label.trim() ? { ...tab, label: label.trim() } : tab;
    });

    if (order) {
      const known = new Map(tabs.map((tab) => [tab.slug, tab]));
      const reordered = order.map((slug) => known.get(slug)).filter((tab): tab is SectionTab => Boolean(tab));
      /* Anything the order forgot stays, at the end: losing a tab because
         somebody edited a list is worse than an unexpected position. */
      const missing = tabs.filter((tab) => !order.includes(tab.slug));
      if (reordered.length > 0) tabs = [...reordered, ...missing];
    }

    const sectionLabel = typeof override.label === "string" && override.label.trim()
      ? override.label.trim()
      : config.label;

    merged[section] = { ...config, label: sectionLabel, tabs };
  }
  return merged;
}

/**
 * Read once per request.
 *
 * `cache` dedupes this across the several places on a page that ask -- the tab
 * row and the breadcrumb both do -- so a page costs one query, not six.
 */
export const loadSectionNavOverrides = cache(async (): Promise<unknown> => {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data")
      .eq("path", SECTION_NAV_PATH)
      .eq("locale", "zh")
      .maybeSingle();
    if (error || !data) return null;
    return (data as { data?: unknown }).data ?? null;
  } catch {
    /* A missing table or a database hiccup leaves the shipped labels in
       place, which is the right answer: the menu is not worth a 500. */
    return null;
  }
});
