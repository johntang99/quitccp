import { AdminShell } from "@/components/admin/AdminShell";
import { VideoTabs } from "@/components/admin/VideoTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listVideoCategories } from "@/lib/admin/video-repository";

interface PageProps {
  searchParams: Promise<{ error?: string; msg?: string }>;
}

export default async function VideoCategoriesPage({ searchParams }: PageProps) {
  const user = await requireAdminSessionUser();
  const params = await searchParams;
  const rows = await listVideoCategories();

  return (
    <AdminShell user={user}>
      <VideoTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>视频分类 Video categories</h2>
        <p>
          可新增、重命名、排序；删除前需先移走该分类下的视频。
          分类名称可用中文，slug 请用英文（它出现在网址里）。
          <br />
          「页面说明」是分类页标题下面那句话。留空也没关系 —— 页面会只显示
          「全部节目可自由下载、转载与再制作。」那一句，所有分类通用，不需要你重复输入。
        </p>
        {params.error ? (
          <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>
            {decodeURIComponent(params.error)}
          </p>
        ) : null}
        {params.msg ? (
          <p style={{ margin: "8px 0 0", color: "#1f7a4d", background: "#f0fbf4", padding: "8px 10px" }}>
            {decodeURIComponent(params.msg)}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p style={{ margin: "8px 0 0", color: "#8a6d1f", background: "#fffbe9", padding: "8px 10px" }}>
            还没有视频分类表。请先执行
            <code> supabase/content/migrations/012_video_categories.sql</code>。
          </p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>排序</th>
              <th style={{ width: 140 }}>名称</th>
              <th style={{ width: 150 }}>slug</th>
              <th style={{ width: 70 }}>视频数</th>
              <th>页面说明</th>
              <th style={{ width: 110 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6}>暂无分类</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.sortOrder}</td>
                  <td>{row.name}</td>
                  <td style={{ fontFamily: "ui-monospace, Menlo, monospace", wordBreak: "break-all" }}>{row.slug}</td>
                  <td>{row.videoCount}</td>
                  <td>
                    {/* The inputs sit in their own cells but belong to one form,
                        tied together by `form={formId}` -- a <form> cannot span
                        table cells, and putting every field in the last column
                        would hide the description behind a scrollbar. */}
                    <textarea
                      className="admin-input"
                      form={`vc-${row.id}`}
                      name="description"
                      defaultValue={row.description}
                      rows={2}
                      placeholder="留空则只显示那句通用的转载说明"
                      style={{ width: "100%", minWidth: 260, resize: "vertical" }}
                      aria-label={`${row.name} 的页面说明`}
                    />
                  </td>
                  <td>
                    <form
                      id={`vc-${row.id}`}
                      method="post"
                      action="/api/admin/content/video-categories"
                      className="admin-toolbar"
                      style={{ flexDirection: "column", alignItems: "stretch", gap: 6 }}
                    >
                      <input type="hidden" name="id" value={row.id} />
                      <input
                        className="admin-input"
                        name="sortOrder"
                        type="number"
                        step={1}
                        defaultValue={row.sortOrder}
                        aria-label={`${row.name} 的排序`}
                      />
                      <input className="admin-input" name="name" defaultValue={row.name} aria-label={`${row.name} 的名称`} required />
                      <input className="admin-input" name="slug" defaultValue={row.slug} aria-label={`${row.name} 的 slug`} required />
                      <button className="admin-btn" type="submit">
                        更新
                      </button>
                    </form>
                    <form method="post" action="/api/admin/content/video-categories/delete" style={{ marginTop: 8 }}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="admin-btn" type="submit">
                        删除
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增分类</h3>
        <form method="post" action="/api/admin/content/video-categories" className="admin-toolbar">
          <input className="admin-input" name="name" placeholder="分类名称（可用中文）" required />
          <input className="admin-input" name="slug" placeholder="slug（英文；中文名称必须填写）" />
          <input
            className="admin-input"
            name="description"
            placeholder="页面说明（可留空，之后再补）"
            style={{ minWidth: 260 }}
          />
          <input
            className="admin-input"
            name="sortOrder"
            type="number"
            step={1}
            defaultValue={0}
            placeholder="排序"
            style={{ width: 90 }}
            aria-label="排序"
          />
          <button className="admin-btn admin-btn-primary" type="submit">
            新增
          </button>
        </form>
      </section>
    </AdminShell>
  );
}
