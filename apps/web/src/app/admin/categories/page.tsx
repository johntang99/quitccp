import { AdminShell } from "@/components/admin/AdminShell";
import { CategoryRowActions } from "@/components/admin/CategoryRowActions";
import { ArticleTabs } from "@/components/admin/ArticleTabs";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { listCategories } from "@/lib/admin/repository";

interface AdminCategoriesPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function AdminCategoriesPage({ searchParams }: AdminCategoriesPageProps) {
  const user = await requireAdminSessionUser();
  const rows = await listCategories(user.email);
  const params = await searchParams;

  return (
    <AdminShell user={user}>
      <ArticleTabs active="categories" />
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>分类管理</h2>
        <p>
          可新增、重命名、排序分类；删除前需先移除该分类下文章映射。
          名称和排序改完保存，网站上立刻就是新的。
          <br />
          slug 建好之后不能再改，只能看：它是分类页的网址，改了旧链接就全断了。
          新建分类时 slug 可用英文填写（中文名称必须填）。
          <br />
          「页面说明」是分类页标题下面那句话。留空的话，那里会沿用原来的
          「SLUG · N 篇」—— 那是网址和篇数，不是一句介绍。
          <br />
          勾上「公开页面」，这个分类才会有 /news/&lt;slug&gt; 列表页，并出现在
          新闻页顶部的分类 tab 里；取消勾选，那个地址就不再对外。tab 的顺序就是
          上面的「排序」。

        </p>
        {params.error ? (
          <p style={{ margin: "8px 0 0", color: "#b42318", background: "#fef3f2", padding: "8px 10px" }}>
            {decodeURIComponent(params.error)}
          </p>
        ) : null}
      </section>

      <section className="admin-card">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: 60 }}>排序</th>
              <th style={{ width: 150 }}>名称</th>
              <th style={{ width: 170 }}>slug</th>
              <th style={{ width: 70 }}>文章数</th>
              <th style={{ width: 86 }}>公开页面</th>
              <th>页面说明</th>
              <th style={{ width: 110 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7}>暂无分类</td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.sortOrder}</td>
                  <td>{row.name}</td>
                  <td>{row.slug}</td>
                  <td>{row.articleCount}</td>
                  <td>
                    {/* 勾上才有 /news/<slug> 页面和新闻页顶部那个 tab。
                        隐藏字段表明「这张表单管这个开关」：复选框不勾时浏览器
                        什么都不发，没有它就分不清「取消勾选」和「这张表单不碰
                        它」—— 新建分类那张表单正是后者。 */}
                    <input type="hidden" name="hasListingFlag" value="1" form={`ac-${row.id}`} />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                      <input
                        type="checkbox"
                        name="isNewsListing"
                        value="1"
                        form={`ac-${row.id}`}
                        defaultChecked={row.isNewsListing}
                        aria-label={`${row.name} 是否有公开列表页`}
                      />
                      <span>{row.isNewsListing ? "公开" : "不公开"}</span>
                    </label>
                  </td>
                  <td>
                    {/* In its own cell but part of the row's form, tied by
                        `form={…}`: a <form> cannot span table cells, and
                        burying the description in the last column would hide
                        it behind a scrollbar. */}
                    <textarea
                      className="admin-input"
                      form={`ac-${row.id}`}
                      name="description"
                      defaultValue={row.description}
                      rows={2}
                      placeholder="留空则沿用原来的「SLUG · N 篇」"
                      style={{ width: "100%", minWidth: 260, resize: "vertical" }}
                      aria-label={`${row.name} 的页面说明`}
                    />
                  </td>
                  <td>
                    <form
                      id={`ac-${row.id}`}
                      method="post"
                      action="/api/admin/content/categories"
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
                      <input
                        className="admin-input"
                        name="name"
                        defaultValue={row.name}
                        aria-label={`${row.name} 的名称`}
                        required
                      />
                    </form>
                    <div style={{ marginTop: 6 }}>
                      <CategoryRowActions
                        formId={`ac-${row.id}`}
                        id={row.id}
                        name={row.name}
                        count={row.articleCount}
                        unit="篇文章"
                        deleteAction="/api/admin/content/categories/delete"
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>新增分类</h3>
        <form method="post" action="/api/admin/content/categories" className="admin-toolbar">
          <input className="admin-input" name="name" placeholder="分类名称（可用中文）" required />
          <input
            className="admin-input"
            name="slug"
            placeholder="slug（英文；中文名称必须填写）"
          />
          <input
            className="admin-input"
            name="description"
            placeholder="页面说明（标题下面那句话）"
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
