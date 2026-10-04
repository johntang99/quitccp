import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Searches that found nothing.
 *
 * Only the failures, aggregated, and only to answer one question: what are
 * readers looking for that this archive cannot give them? See migration 022 for
 * why it is shaped this narrowly -- no address, no session, no per-search
 * timestamp, and rows that expire.
 *
 * Nothing here may ever affect a search. Every function swallows its own errors
 * and returns something harmless: if the table is missing because the migration
 * has not been run, or the database is busy, a reader must still get results.
 */

export interface SearchMiss {
  query: string;
  hits: number;
  firstSeen: string;
  lastSeen: string;
}

/** Keep the table about phrases, not essays. */
const MAX_QUERY_LENGTH = 120;

/**
 * What gets stored, or null when the search is not worth recording.
 *
 * Case is folded and whitespace collapsed so the same phrase typed twice is one
 * row. Single characters are dropped: they say nothing about missing content,
 * and someone typing one character has not really asked for anything yet.
 */
export function normalizeMiss(query: string): string | null {
  const trimmed = query.trim().replace(/[\s　]+/g, " ").toLowerCase();
  if (!trimmed) return null;
  if (trimmed.length > MAX_QUERY_LENGTH) return null;
  if ([...trimmed].length < 2) return null;
  return trimmed;
}

/**
 * Records one failed search.
 *
 * Deliberately returns void and never throws. Call it from `after()` so it runs
 * once the reader already has their page -- logging a miss must not add a
 * millisecond to the search that missed.
 */
export async function recordSearchMiss(query: string): Promise<void> {
  const normalized = normalizeMiss(query);
  if (!normalized) return;
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc("record_search_miss", { p_query: normalized });
    // A missing function means migration 022 has not been run. That is a
    // perfectly fine state to be in and not worth an error in the logs.
    if (error && !isMissingObject(error)) throw error;
  } catch (error) {
    if (!isMissingObject(error)) {
      // eslint-disable-next-line no-console
      console.warn("[search-misses] could not record", error);
    }
  }
}

export async function listSearchMisses(limit = 20): Promise<SearchMiss[]> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("cms_search_misses")
      .select("query, hits, first_seen, last_seen")
      .order("hits", { ascending: false })
      .order("last_seen", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      query: String(row.query),
      hits: Number(row.hits ?? 0),
      firstSeen: String(row.first_seen),
      lastSeen: String(row.last_seen)
    }));
  } catch {
    return [];
  }
}

/** Rows not seen in this long are dropped by the cron. */
export const MISS_RETENTION_DAYS = 60;

export async function pruneSearchMisses(): Promise<number> {
  try {
    const supabase = createSupabaseAdminClient();
    const cutoff = new Date(Date.now() - MISS_RETENTION_DAYS * 86_400_000).toISOString();
    const { data, error } = await supabase
      .from("cms_search_misses")
      .delete()
      .lt("last_seen", cutoff)
      .select("query");
    if (error) throw error;
    return (data ?? []).length;
  } catch {
    return 0;
  }
}

function isMissingObject(error: unknown): boolean {
  const text = JSON.stringify(error ?? "");
  // PGRST202: no such function. PGRST205/42P01: no such table.
  return /PGRST202|PGRST205|42P01|record_search_miss|cms_search_misses/.test(text);
}
