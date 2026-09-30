import { AdminShell } from "@/components/admin/AdminShell";
import { VideoTable } from "@/components/admin/VideoTable";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories, searchVideos, type VideoSearchFilters } from "@/lib/admin/video-repository";

interface PageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const GAPS = [
  { key: "no-source", label: "缺播放地址" },
  { key: "no-cover", label: "缺封面" },
  { key: "no-description", label: "缺简介" }
] as const;

const HOSTS = [
  { key: "youtube", label: "YouTube" },
  { key: "ganjing", label: "干净世界" },
  { key: "tuidang", label: "自有（旧站）" },
  { key: "none", label: "无地址" }
] as const;

/** 查找与修改 — the video half of the article screen of the same name. */
export default async function AdminVideosPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;

  const [result, categories] = await Promise.all([
    searchVideos({
      q: params.q,
      category: params.category,
      status: params.status,
      host: params.host,
      gap: params.gap as VideoSearchFilters["gap"],
      from: params.from,
      to: params.to,
      sort: (params.sort as VideoSearchFilters["sort"]) ?? "published",
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
      <VideoTabs active="search" />

      {!result.ready ? (
        <section className="admin-card" style={{ background: "#fffbe9", borderColor: "#f2e3b3" }}>
          <strong>视频分类与来源字段尚未建立。</strong> 请先执行{" "}
          <code>supabase/content/migrations/012_video_categories.sql</code>。
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
          <select className="admin-select" name="host" defaultValue={params.host ?? ""}>
            <option value="">全部来源</option>
            {HOSTS.map((h) => (
              <option key={h.key} value={h.key}>
                {h.label}
              </option>
            ))}
          </select>
          <select className="admin-select" name="status" defaultValue={params.status ?? ""}>
            <option value="">全部状态</option>
            <option value="published">已发布</option>
            <option value="draft">草稿</option>
            <option value="archived">已归档</option>
          </select>
          <label className="muted" style={{ display: "flex", alignItems: "center", gap: 6 }}>
            发布于
            <input className="admin-input" type="date" name="from" defaultValue={params.from ?? ""} />
            至
            <input className="admin-input" type="date" name="to" defaultValue={params.to ?? ""} />
          </label>
          <select className="admin-select" name="sort" defaultValue={params.sort ?? "published"}>
            <option value="published">发布时间（新→旧）</option>
            <option value="updated">更新时间（新→旧）</option>
            <option value="duration">时长（长→短）</option>
            <option value="title">标题 A→Z</option>
          </select>
          {params.gap ? <input type="hidden" name="gap" value={params.gap} /> : null}
          <button className="admin-btn admin-btn-primary" type="submit">
            搜索
          </button>
        </form>

        <div className="admin-toolbar" style={{ marginBottom: 8 }}>
          <span className="chips">
            {GAPS.map((gap) => (
              <a
                key={gap.key}
                className={`chip${params.gap === gap.key ? " on" : ""}`}
                href={hrefWith({ gap: params.gap === gap.key ? undefined : gap.key, page: undefined })}
              >
                {gap.label}
              </a>
            ))}
          </span>
        </div>

        <p className="muted" style={{ margin: 0 }}>
          符合条件 <b>{result.total.toLocaleString()}</b> 个 · 第 {result.page}／{result.pageCount} 页
        </p>
      </section>

      <section className="admin-card">
        <form method="post" action="/api/admin/content/videos/bulk">
          <div className="admin-toolbar" style={{ marginBottom: 8 }}>
            <select className="admin-select" name="action" defaultValue="category">
              <option value="category">改主分类为…</option>
              <option value="published">发布</option>
              <option value="draft">退回草稿</option>
              <option value="archived">归档</option>
            </select>
            <select className="admin-select" name="category" defaultValue="">
              <option value="">（选择目标分类）</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="admin-btn" type="submit">
              对选中的视频执行
            </button>
            <span className="muted">勾选左侧复选框后执行；改分类只替换主分类。</span>
          </div>
          <VideoTable rows={result.rows} selectable />
        </form>

        <div className="admin-toolbar" style={{ marginTop: 12 }}>
          {result.page > 1 ? (
            <a className="admin-btn" href={hrefWith({ page: String(result.page - 1) })}>
              ← 上一页
            </a>
          ) : null}
          {result.page < result.pageCount ? (
            <a className="admin-btn" href={hrefWith({ page: String(result.page + 1) })}>
              下一页 →
            </a>
          ) : null}
        </div>
      </section>
    </AdminShell>
  );
}
