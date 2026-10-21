import Link from "next/link";
import { t } from "@/lib/i18n";
import { actorLabel, listAdminDisplayNames } from "@/lib/admin/user-admin-repository";
import type { ArticleRecord } from "@/lib/admin/types";
import { ArticleDeleteButton } from "./ArticleDeleteButton";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: t("admin.status.published"), cls: "b-pub" },
  draft: { label: t("admin.status.draft"), cls: "b-draft" },
  review: { label: t("admin.status.review"), cls: "b-review" },
  archived: { label: t("admin.status.archived"), cls: "b-arch" }
};

function day(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toISOString().slice(0, 10);
}

/**
 * The article rows, shared by 查找与修改 and 最新 100 篇 so the two cannot drift.
 * `selectable` adds the checkboxes the bulk bar reads.
 */
export async function ArticleTable({
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
  const actorNames = await listAdminDisplayNames();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {selectable ? <th style={{ width: 28 }} /> : null}
            {numbered ? <th style={{ width: 36 }}>#</th> : null}
            <th style={{ width: 76 }}>{t("admin.list.col.cover")}</th>
            <th>{t("admin.list.col.title")}</th>
            <th>{t("admin.list.col.category")}</th>
            <th>{t("admin.art.col.author")}</th>
            <th>{t("admin.list.col.status")}</th>
            <th style={{ width: 44, textAlign: "center" }} title={t("admin.list.col.featured")}>
              {t("admin.list.col.featuredShort")}
            </th>
            <th style={{ width: 62, textAlign: "center" }} title={t("admin.list.col.editorArchive")}>
              {t("admin.list.col.editorArchiveShort")}
            </th>
            <th>{t("admin.art.col.editor")}</th>
            <th>{t(dateColumn === "updated" ? "admin.art.col.updated" : "admin.art.col.published")}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ color: "#8a90a0", padding: 24, textAlign: "center" }}>
                {t("admin.art.empty")}
              </td>
            </tr>
          ) : null}
          {rows.map((row, index) => {
            const status = STATUS[row.status] ?? STATUS.draft;
            return (
              /*
               * data-snapshot="data"：这一行装的是库里的东西（标题、分类、作者）,
               * 不是界面文案。admin:snapshot 用它把这段排除掉 —— 编辑一存新稿，
               * 整张表的行就全部错位，不排除的话那个检查天天报假差异。
               * 行内也有几句文案（「未分类」、状态标签），它们由
               * npm run zh:unchanged 在源码层面把关。
               */
              <tr key={row.id} data-snapshot="data">
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
                      {t("admin.list.noImage")}
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
                <td>{row.category || <span style={{ color: "#b42318" }}>{t("admin.list.uncategorised")}</span>}</td>
                <td>{row.author || <span style={{ color: "#8a90a0" }}>—</span>}</td>
                <td>
                  <span className={`badge ${status.cls}`}>{status.label}</span>
                </td>
                {/* A mark when set, nothing when not: a column of ✗ is noise,
                    and what an editor scans for is the few that are flagged. */}
                <td style={{ textAlign: "center" }} title={row.featured ? t("admin.list.col.featured") : ""}>
                  {row.featured ? <span style={{ color: "#c8102e", fontSize: 15 }}>★</span> : null}
                </td>
                <td style={{ textAlign: "center" }} title={row.editorArchive ? t("admin.list.col.editorArchive") : ""}>
                  {row.editorArchive ? <span style={{ color: "#1f7a4d", fontSize: 15 }}>✦</span> : null}
                </td>
                {/* 编辑 in the masthead sense: the person who handled the piece
                    for us. The 作者 column above is the public byline -- the
                    writer, often someone outside the organisation. */}
                <td style={{ color: "#8a90a0", whiteSpace: "nowrap" }} title={row.createdBy || undefined}>
                  {actorLabel(row.createdBy, actorNames)}
                  {row.updatedBy && row.updatedBy !== row.createdBy ? (
                    <div style={{ fontSize: 11 }} title={t("admin.list.lastEditedBy", { email: row.updatedBy })}>
                      {t("admin.list.changedBy", { name: actorLabel(row.updatedBy, actorNames) })}
                    </div>
                  ) : null}
                </td>
                <td style={{ color: "#8a90a0", whiteSpace: "nowrap" }}>
                  {day(dateColumn === "updated" ? row.updatedAt : row.publishedAt)}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="admin-btn admin-btn-sm" href={`/admin/articles/${row.id}`}>
                    {t("admin.list.edit")}
                  </Link>
                  <a
                    className="admin-btn admin-btn-sm"
                    href={`/admin/preview/news/${row.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ marginLeft: 4 }}
                  >
                    {t("admin.art.preview")}
                  </a>
                  <ArticleDeleteButton id={row.id} title={row.title} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
