export interface SearchResultItem {
  id: string;
  title: string;
  excerpt: string;
  section: string;
  slug: string;
  score: number;
}

export interface SearchBenchmarkTarget {
  minRecall: number;
  maxP95LatencyMs: number;
}

export const searchBenchmarkTarget: SearchBenchmarkTarget = {
  minRecall: 0.72,
  maxP95LatencyMs: 250
};

export const pgTrgmSearchSql = `
SELECT
  a.id,
  a.title,
  LEFT(a.body_plain, 160) AS excerpt,
  a.section,
  a.slug,
  (
    similarity(a.title, $1) * 0.55 +
    similarity(a.body_plain, $1) * 0.30 +
    similarity(COALESCE(a.tag_blob, ''), $1) * 0.15
  ) AS score
FROM articles a
WHERE
  a.locale = $2
  AND a.status = 'published'
  AND (
    a.title % $1
    OR a.body_plain % $1
    OR COALESCE(a.tag_blob, '') % $1
  )
ORDER BY score DESC, a.published_at DESC
LIMIT $3 OFFSET $4;
`;

// Temporary in-memory fallback used during scaffolding before DB wiring.
export function simpleSearch(
  query: string,
  rows: Array<{ id: string; title: string; excerpt: string; section: string; slug: string }>
): SearchResultItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return rows
    .map((row) => {
      const haystack = `${row.title} ${row.excerpt}`.toLowerCase();
      const titleBoost = row.title.toLowerCase().includes(q) ? 2 : 0;
      const bodyBoost = haystack.includes(q) ? 1 : 0;
      return { ...row, score: titleBoost + bodyBoost };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score);
}
