import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories, searchVideos } from "@/lib/admin/video-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function duration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "已发布", cls: "b-pub" },
  draft: { label: "草稿", cls: "b-draft" },
  archived: { label: "已归档", cls: "b-arch" }
};

/**
 * 视频管理 — the same shape as 文章管理 so the two read alike: search and
 * filters at the top, one row per item with its cover, inline edit and preview.
 */
export default async function AdminVideosPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories] = await Promise.all([
    searchVideos({
      q: params.q,
      category: params.category,
      status: params.status,
      page: Number(params.page ?? "1") || 1,
      pageSize: Number(params.pageSize ?? "20") || 20
    }),
    listVideoCategories()
  ]);

  const hrefWith = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, ...overrides })) {
      if (value && key !== "msg") next.set(key, value);
    }
    const query = next.toString();
    return `/admin/videos${query ? `?${query}` : ""}`;
  };

  return (
    <AdminShell user={user}>
      <section className="admin-card" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>视频管理 Videos</h2>
        <Link className="admin-btn" href="/admin/video-categories">
          视频分类
        </Link>
        <Link className="admin-btn admin-btn-primary" href="/admin/videos/new" style={{ marginLeft: "auto" }}>
          ＋ 新建视频
        </Link>
      </section>

      {!result.ready ? (
        <section className="admin-card" style={{ background: "#fffbe9", borderColor: "#f2e3b3" }}>
          <strong>视频分类与来源字段尚未建立。</strong> 请先执行{" "}
          <code>supabase/content/migrations/012_video_categories.sql</code>
          。在那之前这一页只显示标题、状态与时长。
        </section>
      ) : null}

      {params.msg ? (
        <section className="admin-card" style={{ background: "#f0fbf4", borderColor: "#bfe6cd" }}>
          <strong>{params.msg}</strong>
        </section>
      ) : null}

      <section className="admin-card">
        <form method="get" className="admin-toolbar" style={{ marginBottom: 8 }}>
          <input
            className="admin-input"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="搜索标题或 slug"
            style={{ flex: 1, minWidth: 220 }}
          />
          <select className="admin-select" name="category" defaultValue={params.category ?? ""}>
            <option value="">全部分类</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.name}（{c.videoCount}）
              </option>
            ))}
          </select>
          <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
          <button className="admin-btn admin-btn-primary" type="submit">
            搜索
          </button>
        </form>
        <p className="muted" style={{ margin: 0 }}>
          符合条件 <b>{result.total.toLocaleString()}</b> 个 · 第 {result.page}／{result.pageCount} 页
        </p>
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 76 }}>封面</th>
              <th>标题</th>
              <th>分类</th>
              <th>时长</th>
              <th>状态</th>
              <th>来源</th>
              <th>发布时间</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ color: "#8a90a0", padding: 24, textAlign: "center" }}>
                  还没有视频。旧站的视频稍后会从文章里迁移过来。
                </td>
              </tr>
            ) : null}
            {result.rows.map((row) => {
              const status = STATUS[row.status] ?? STATUS.draft;
              return (
                <tr key={row.id}>
                  <td>
                    {row.coverImage ? (
                      <img
                        src={row.coverImage}
                        alt=""
                        style={{ width: 64, height: 44, objectFit: "cover", borderRadius: 4, display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 64,
                          height: 44,
                          borderRadius: 4,
                          background: "#f1f1f4",
                          display: "grid",
                          placeItems: "center",
                          color: "#8a90a0",
                          fontSize: 11
                        }}
                      >
                        无图
                      </div>
                    )}
                  </td>
                  <td>
                    <Link href={`/admin/videos/${row.id}`} style={{ fontWeight: 600 }}>
                      {row.title}
                    </Link>
                    <div className="muted" style={{ fontSize: 12, fontFamily: "ui-monospace, Menlo, monospace" }}>
                      {row.slug}
                    </div>
                  </td>
                  <td>{row.category || <span style={{ color: "#b42318" }}>未分类</span>}</td>
                  <td>{duration(row.durationSeconds)}</td>
                  <td>
                    <span className={`badge ${status.cls}`}>{status.label}</span>
                  </td>
                  <td>
                    {row.sourceUrl ? (
                      <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer">
                        播放 ↗
                      </a>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="muted" style={{ whiteSpace: "nowrap" }}>
                    {row.publishedAt ? row.publishedAt.slice(0, 10) : "—"}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="admin-btn admin-btn-sm" href={`/admin/videos/${row.id}`}>
                      编辑
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {result.page > 1 ? (
            <Link className="admin-btn" href={hrefWith({ page: String(result.page - 1) })}>
              ← 上一页
            </Link>
          ) : null}
          {result.page < result.pageCount ? (
            <Link className="admin-btn" href={hrefWith({ page: String(result.page + 1) })}>
              下一页 →
            </Link>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
