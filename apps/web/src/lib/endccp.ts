import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/** Where the fetched count is parked, same shelf as the santui feed. */
export const ENDCCP_FEED_PATH = "feeds/endccp.json";

export interface EndccpSnapshot {
  /** Signatures, as endccp.com published them. */
  count: number;
  /** When we read it, ISO. */
  fetchedAt: string;
  /** The page it came from, so the number is traceable. */
  source: string;
}

/**
 * The End CCP signature count, read off endccp.com.
 *
 * ## Why a scrape and not an API
 *
 * There isn't one. The count is rendered by an Elementor counter widget, which
 * puts the real figure in `data-to-value` on the element and animates up to it.
 * Exactly one such attribute exists on the page, so the match is unambiguous --
 * there is no second counter to confuse it with.
 *
 * ## Why it was worth doing
 *
 * The figure in the CMS said 2,481,036. The site said 5,484,913 on the day this
 * was written -- the stored number was less than half the real one, and had
 * been hand-typed at some point and then left. endccp.com notes beside its own
 * counter that it refreshes every four hours, so a few hours of lag here is the
 * same lag the source has.
 */
export function parseEndccpCount(html: string): number | null {
  const match = /data-to-value="(\d{1,12})"/.exec(html);
  if (!match) return null;
  const value = Number(match[1]);
  /*
   * A sanity floor, not a guess at the real number.
   *
   * If the page changes shape and `data-to-value` ends up on some other
   * widget -- a year, a percentage, a countdown -- the regex still matches and
   * we would publish that as the signature count. Anything below a million is
   * not this counter: it passed two million years ago and only goes up.
   */
  if (!Number.isFinite(value) || value < 1_000_000) return null;
  return value;
}

/** The stored snapshot, or null when nothing has been fetched yet. */
export async function getEndccpSnapshot(): Promise<EndccpSnapshot | null> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_content_entries")
      .select("data")
      .eq("path", ENDCCP_FEED_PATH)
      .eq("locale", "zh")
      .maybeSingle();
    if (error || !data) return null;
    const row = data.data as Partial<EndccpSnapshot> | null;
    if (!row || typeof row.count !== "number" || row.count < 1_000_000) return null;
    return {
      count: row.count,
      fetchedAt: String(row.fetchedAt ?? ""),
      source: String(row.source ?? "")
    };
  } catch {
    /* An unreachable database is not a reason to fail the page; the figure an
       editor typed into the CMS stands in. */
    return null;
  }
}

/** `5484913` -> `5,484,913`, the way both pages already print it. */
export function formatEndccpCount(count: number): string {
  return count.toLocaleString("en-US");
}
