import { AdminShell } from "@/components/admin/AdminShell";
import { VideoTable } from "@/components/admin/VideoTable";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories, searchVideos } from "@/lib/admin/video-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

/**
 * 最新 100 个 — the same rows as 查找与修改 without the search step.
 *
 * Sorted by 更新时间, matching the article screen of the same name. Worth knowing
 * that the whole library was imported in one pass, so until editors start
 * editing this orders a set that is genuinely all the same age.
 */
export default async function LatestVideosPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories] = await Promise.all([
    searchVideos({
      category: params.category,
      status: params.unpublished ? "draft" : undefined,
      sort: "updated",
      page: 1,
      pageSize: 100
    }),
    listVideoCategories()
  ]);

  const chipHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value && key !== "msg") next.set(key, value);
    }
    const query = next.toString();
    return `/admin/videos/latest${query ? `?${query}` : ""}`;
  };

  return (
    <AdminShell user={user}>
      <VideoTabs active="latest" />

      <section className="admin-card">
        <div className="admin-toolbar" style={{ marginBottom: 6 }}>
          <span className="chips">
            <a className={`chip${params.category ? "" : " on"}`} href={chipHref({ category: undefined })}>
              全部分类
            </a>
            {categories.map((c) => (
              <a
                key={c.slug}
                className={`chip${params.category === c.slug ? " on" : ""}`}
                href={chipHref({ category: c.slug })}
              >
                {c.name}
              </a>
            ))}
          </span>
          <a
            className={`chip${params.unpublished ? " on" : ""}`}
            style={{ marginLeft: "auto" }}
            href={chipHref({ unpublished: params.unpublished ? undefined : "1" })}
          >
            只看草稿
          </a>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          按更新时间排序，最近改动的在最前面。共 {result.rows.length} 个。
        </p>
      </section>

      <section className="admin-card">
        <VideoTable rows={result.rows} />
      </section>
    </AdminShell>
  );
}
