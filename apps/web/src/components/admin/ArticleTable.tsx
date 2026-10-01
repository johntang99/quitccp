import Link from "next/link";
import type { ArticleRecord } from "@/lib/admin/types";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "已发布", cls: "b-pub" },
  draft: { label: "草稿", cls: "b-draft" },
  review: { label: "待审校", cls: "b-review" },
  archived: { label: "已归档", cls: "b-arch" }
};

function day(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * The article rows, shared by 查找与修改 and 最新 100 篇 so the two cannot drift.
 * `selectable` adds the checkboxes the bulk bar reads.
 */
export function ArticleTable({
  rows,
  selectable = true,
  numbered = false,
  dateColumn = "published"
}: {
  rows: ArticleRecord[];
  selectable?: boolean;
  numbered?: boolean;
  /**
   * Which date to show. It must be the one the list is sorted on: showing the
   * publish date beside an update-ordered list made the dates look shuffled --
   * 2026 then 2011 then 2012 -- with nothing on screen to explain the order.
   */
  dateColumn?: "published" | "updated";
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {selectable ? <th style={{ width: 28 }} /> : null}
            {numbered ? <th style={{ width: 36 }}>#</th> : null}
            <th style={{ width: 76 }}>封面</th>
            <th>标题</th>
            <th>分类</th>
            <th>作者</th>
            <th>状态</th>
            <th style={{ width: 44, textAlign: "center" }} title="重要">重要</th>
            <th style={{ width: 62, textAlign: "center" }} title="精彩保留">精彩</th>
            <th>{dateColumn === "updated" ? "更新" : "发布"}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={10} style={{ color: "#8a90a0", padding: 24, textAlign: "center" }}>
                没有符合条件的文章。
              </td>
            </tr>
          ) : null}
          {rows.map((row, index) => {
            const status = STATUS[row.status] ?? STATUS.draft;
            return (
              <tr key={row.id}>
                {selectable ? (
                  <td>
                    <input type="checkbox" name="ids" value={row.id} form="bulk-form" />
                  </td>
                ) : null}
                {numbered ? <td style={{ color: "#8a90a0" }}>{index + 1}</td> : null}
                <td>
                  {row.heroImage ? (
                    <img
                      src={row.heroImage}
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
                  <Link href={`/admin/articles/${row.id}`} style={{ fontWeight: 600 }}>
                    {row.title}
                  </Link>
                  {row.subtitle ? (
                    <div style={{ color: "#8a90a0", fontSize: 12 }}>{row.subtitle}</div>
                  ) : null}
                </td>
                <td>{row.category || <span style={{ color: "#b42318" }}>未分类</span>}</td>
                <td>{row.author || <span style={{ color: "#8a90a0" }}>—</span>}</td>
                <td>
                  <span className={`badge ${status.cls}`}>{status.label}</span>
                </td>
                {/* A mark when set, nothing when not: a column of ✗ is noise,
                    and what an editor scans for is the few that are flagged. */}
                <td style={{ textAlign: "center" }} title={row.featured ? "重要" : ""}>
                  {row.featured ? <span style={{ color: "#c8102e", fontSize: 15 }}>★</span> : null}
                </td>
                <td style={{ textAlign: "center" }} title={row.editorArchive ? "精彩保留" : ""}>
                  {row.editorArchive ? <span style={{ color: "#1f7a4d", fontSize: 15 }}>✦</span> : null}
                </td>
                <td style={{ color: "#8a90a0", whiteSpace: "nowrap" }}>
                  {day(dateColumn === "updated" ? row.updatedAt : row.publishedAt)}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="admin-btn admin-btn-sm" href={`/admin/articles/${row.id}`}>
                    编辑
                  </Link>
                  <a
                    className="admin-btn admin-btn-sm"
                    href={`/news/${row.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 4 }}
                  >
                    预览
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
