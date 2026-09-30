import { createSupabaseAdminClient } from "@/lib/supabase/admin-client";
import { listVideoCategories } from "@/lib/admin/video-repository";

/**
 * Counts for the 视频统计 screen.
 *
 * HEAD counts throughout, like the article stats: the map table is larger than
 * PostgREST's 1,000-row response cap, and fetching rows to tally them is how the
 * category page once reported 0 for a category holding thousands.
 */
export interface VideoStats {
  total: number;
  byStatus: { key: string; label: string; count: number }[];
  byCategory: { name: string; slug: string; count: number }[];
  byHost: { key: string; label: string; count: number; reachable: boolean }[];
  gaps: { key: string; label: string; count: number; href: string }[];
  byYear: { year: string; count: number }[];
  totalSeconds: number;
}

function base() {
  return createSupabaseAdminClient().from("cms_videos").select("id", { count: "exact", head: true });
}

async function count(build: (q: ReturnType<typeof base>) => ReturnType<typeof base>): Promise<number> {
  const { count: n, error } = await build(base());
  if (error) throw error;
  return n ?? 0;
}

export async function getVideoStats(): Promise<VideoStats> {
  const [total, published, draft, archived, categories] = await Promise.all([
    count((q) => q),
    count((q) => q.eq("status", "published")),
    count((q) => q.eq("status", "draft")),
    count((q) => q.eq("status", "archived")),
    listVideoCategories()
  ]);

  const [youtube, ganjing, selfHosted, noSource, noCover, noDescription] = await Promise.all([
    count((q) => q.like("source_url", "%youtu%")),
    count((q) => q.like("source_url", "%ganjing%")),
    count((q) => q.like("source_url", "%tuidang.org%")),
    count((q) => q.eq("source_url", "")),
    count((q) => q.eq("cover_image", "")),
    count((q) => q.eq("description", ""))
  ]);

  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 12 }, (_, i) => thisYear - 11 + i);
  const byYear = await Promise.all(
    years.map(async (year) => ({
      year: String(year),
      count: await count((q) =>
        q.gte("published_at", `${year}-01-01T00:00:00Z`).lt("published_at", `${year + 1}-01-01T00:00:00Z`)
      )
    }))
  );

  // Durations were recovered for the self-hosted files only, so this is a floor
  // rather than the library's true length. Said plainly on the screen.
  const supabase = createSupabaseAdminClient();
  const { data: durations } = await supabase
    .from("cms_videos")
    .select("duration_seconds")
    .not("duration_seconds", "is", null)
    .limit(1000);
  const totalSeconds = (durations ?? []).reduce(
    (sum, row) => sum + Number((row as { duration_seconds: number }).duration_seconds ?? 0),
    0
  );

  return {
    total,
    byStatus: [
      { key: "published", label: "已发布", count: published },
      { key: "draft", label: "草稿", count: draft },
      { key: "archived", label: "已归档", count: archived }
    ],
    byCategory: categories
      .map((row) => ({ name: row.name, slug: row.slug, count: row.videoCount }))
      .sort((a, b) => b.count - a.count),
    byHost: [
      { key: "youtube", label: "YouTube", count: youtube, reachable: false },
      { key: "tuidang", label: "自有（旧站）", count: selfHosted, reachable: false },
      { key: "ganjing", label: "干净世界", count: ganjing, reachable: true },
      { key: "none", label: "无播放地址", count: noSource, reachable: false }
    ],
    gaps: [
      { key: "no-source", label: "缺播放地址", count: noSource, href: "/admin/videos?gap=no-source" },
      { key: "no-cover", label: "缺封面", count: noCover, href: "/admin/videos?gap=no-cover" },
      { key: "no-description", label: "缺简介", count: noDescription, href: "/admin/videos?gap=no-description" }
    ],
    byYear,
    totalSeconds
  };
}
