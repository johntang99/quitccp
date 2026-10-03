import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * The live registry figures, as captured from santui.tuidang.org.
 *
 * Written by `npm run sync:santui` (see that script for why the fetch cannot
 * happen at request time) and read here. Everything in this module degrades to
 * `null` rather than throwing: the homepage must render even if the table is
 * missing, the snapshot has never been written, or Supabase is unreachable. The
 * caller falls back to the figures stored in the CMS.
 */

const FEED_PATH = "feeds/santui.json";

export interface SantuiDeclaration {
  id: string;
  /**
   * 标题 as the declarant wrote it -- 退党团队 / 退团队 / 三退声明. Optional
   * because snapshots written before the scraper captured it have no title.
   */
  title?: string;
  name: string;
  from: string;
  people: string;
  at: string;
  text: string;
  href: string;
}

export interface SantuiSnapshot {
  total: number;
  totalDisplay: string;
  sourceUpdatedAt: string;
  fetchedAt: string;
  declarations: SantuiDeclaration[];
}

/**
 * 466,911,794 -> "4.66 亿".
 *
 * Truncated, never rounded: 4.669… is reported as 4.66, because a registry
 * count is a floor -- every declaration behind it is a real one, and rounding
 * up would claim declarations that have not been made. This also matches how
 * santui itself presents the figure.
 */
export function formatYi(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "";
  return `${(Math.floor(total / 1e6) / 100).toFixed(2)} 亿`;
}

function isUsable(value: unknown): value is SantuiSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.total === "number" && row.total > 0 && Array.isArray(row.declarations);
}

export async function getSantuiSnapshot(): Promise<SantuiSnapshot | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data")
      .eq("path", FEED_PATH)
      .eq("locale", "zh")
      .maybeSingle();
    if (error || !data) return null;
    return isUsable(data.data) ? (data.data as SantuiSnapshot) : null;
  } catch {
    // A missing table or an unreachable database is not a reason to fail the
    // homepage; the CMS figures stand in.
    return null;
  }
}

/** Shapes a declaration for the 曙光 trail. */
export function toFeedRow(row: SantuiDeclaration) {
  const people = Number(row.people);
  return {
    // santui's own statement id, grouped like the count beside it.
    region: `No. ${Number(row.id).toLocaleString("en-US")}`,
    // The declarant's own 标题. "三退声明" stands in for the handful of rows
    // that have none, rather than the bare "退" every card used to show.
    kind: (row.title || "").trim() || "三退声明",
    // 声明人 · 人数 · 来自, in santui's own order. The count is only worth
    // showing when a statement speaks for more than one person; "1人" is noise.
    name: [row.name, Number.isFinite(people) && people > 1 ? `${people}人` : "", row.from]
      .filter(Boolean)
      .join(" · "),
    text: row.text,
    at: row.at
  };
}
