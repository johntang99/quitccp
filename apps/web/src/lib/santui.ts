import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { SITE_LOCALE } from "@/lib/site-config";

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

/**
 * 同一个数字，按这个站的语言写。
 *
 * 大数字在不同语言里的断法不一样：中文按「亿」，英文按 million。把
 * 466,911,794 直接写成「4.66 亿」放在英文站上，英文读者读不出大小。
 *
 * 认不出这个语言该怎么断的，返回空字符串 —— 由 CMS 里编辑自己填的那个数顶上。
 * 编一个说法比显示一个旧数字更糟：旧数字至少还是个数字，编的说法是错的。
 */
export function formatRegistryCount(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return "";
  if (SITE_LOCALE === "zh") return formatYi(total);
  /* 和「亿」一样截断不进位：这个数是个下限，每一条背后都是一份真实声明，
     进位等于替没声明的人声明了。 */
  if (SITE_LOCALE === "en") return `${Math.floor(total / 1e6)} million`;
  return "";
}

function isUsable(value: unknown): value is SantuiSnapshot {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return typeof row.total === "number" && row.total > 0 && Array.isArray(row.declarations);
}

/**
 * 登记册的总数，不分站读。
 *
 * 这个数字是全球总数，四个语言的站显示的是同一个数。但只有中文站去抓
 * （cron-locale 里的 SANTUI_LOCALES），快照写进 cms_content_entries 时带的是
 * locale='zh'。而 getSantuiSnapshot() 按本站的 locale 读 —— 于是英文站永远
 * 拿不到，首页上一直显示内容条目里那个手填的约数。
 *
 * 那个手填的数是建站时敲进去的，不会自己变。中文站显示实时的 466,911,794，
 * 英文站显示一个停在某天的「466 million」，而两边说的是同一件事。
 *
 * 所以总数全局读：优先本站自己的那条（哪天英文站也有了自己的数据源，它说了
 * 算），没有就拿最新写入的那条。
 *
 * 只取数字，不取 declarations —— 那些声明是中文写的，属于写它们的那个站。
 */
export async function getRegistryTotal(): Promise<{ total: number; fetchedAt: string } | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data, locale, updated_at")
      .eq("path", FEED_PATH)
      .order("updated_at", { ascending: false });
    if (error || !data || data.length === 0) return null;
    const rows = data.filter((row) => isUsable(row.data));
    if (rows.length === 0) return null;
    const own = rows.find((row) => row.locale === SITE_LOCALE);
    const snap = ((own ?? rows[0]).data as SantuiSnapshot);
    return { total: snap.total, fetchedAt: snap.fetchedAt };
  } catch {
    return null;
  }
}

export async function getSantuiSnapshot(): Promise<SantuiSnapshot | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data")
      .eq("path", FEED_PATH)
      .eq("locale", SITE_LOCALE)
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
