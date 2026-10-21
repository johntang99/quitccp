import Link from "next/link";
import { t } from "@/lib/i18n";
import { DeleteVideoButton } from "./DeleteVideoButton";
import { actorLabel, listAdminDisplayNames } from "@/lib/admin/user-admin-repository";
import { hostOf } from "@/lib/video-host";
import type { VideoListRow } from "@/lib/admin/video-repository";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: t("admin.status.published"), cls: "b-pub" },
  draft: { label: t("admin.status.draft"), cls: "b-draft" },
  archived: { label: t("admin.status.archived"), cls: "b-arch" }
};

function duration(seconds: number | null): string {
  if (!seconds) return "—";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * One row per video, shared by 查找与修改 and 最新 100 个 — the same arrangement
 * ArticleTable gives articles, so the two admins read alike.
 */
export async function VideoTable({
  rows,
  selectable = false,
  bulkFormId
}: {
  rows: VideoListRow[];
  selectable?: boolean;
  /** Associates the row checkboxes with a bulk form that lives outside the table. */
  bulkFormId?: string;
}) {
  const actorNames = await listAdminDisplayNames();
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {selectable ? <th style={{ width: 28 }} /> : null}
            <th style={{ width: 76 }}>{t("admin.list.col.cover")}</th>
            <th>{t("admin.list.col.title")}</th>
            <th>{t("admin.list.col.category")}</th>
            <th>{t("admin.vid.col.duration")}</th>
            <th>{t("admin.list.col.status")}</th>
            {/* Same two marks as the article list, same glyphs and colours. */}
            <th style={{ width: 44, textAlign: "center" }} title={t("admin.list.col.featured")}>{t("admin.list.col.featuredShort")}</th>
            <th style={{ width: 62, textAlign: "center" }} title={t("admin.list.col.editorArchive")}>{t("admin.list.col.editorArchiveShort")}</th>
            <th>{t("admin.vid.col.source")}</th>
            <th>{t("admin.vid.col.createdBy")}</th>
            <th>{t("admin.vid.col.publishedAt")}</th>
            <th style={{ width: 150 }}>{t("admin.vid.col.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={selectable ? 12 : 11} style={{ color: "#8a90a0", padding: 24, textAlign: "center" }}>
                {t("admin.vid.empty")}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => {
            const status = STATUS[row.status] ?? STATUS.draft;
            const host = hostOf(row.sourceUrl);
            return (
              <tr key={row.id}>
                {selectable ? (
                  <td>
                    <input type="checkbox" name="ids" value={row.id} form={bulkFormId} />
                  </td>
                ) : null}
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
                      {t("admin.list.noImage")}
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
                <td>{row.category || <span style={{ color: "#b42318" }}>{t("admin.list.uncategorised")}</span>}</td>
                <td>{duration(row.durationSeconds)}</td>
                <td>
                  <span className={`badge ${status.cls}`}>{status.label}</span>
                </td>
                <td style={{ textAlign: "center" }} title={row.featured ? t("admin.list.col.featured") : ""}>
                  {row.featured ? <span style={{ color: "#c8102e", fontSize: 15 }}>★</span> : null}
                </td>
                <td style={{ textAlign: "center" }} title={row.editorArchive ? t("admin.list.col.editorArchive") : ""}>
                  {row.editorArchive ? <span style={{ color: "#1f7a4d", fontSize: 15 }}>✦</span> : null}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {host.key === "none" ? (
                    <span style={{ color: "#b42318" }}>{t("admin.vid.noSource")}</span>
                  ) : (
                    <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" title={row.sourceUrl}>
                      {host.label} ↗
                    </a>
                  )}
                </td>
                {/* Who added it to the CMS; 来源 above is where the video is hosted. */}
                <td style={{ color: "#8a90a0", whiteSpace: "nowrap" }} title={row.createdBy || undefined}>
                  {actorLabel(row.createdBy, actorNames)}
                  {row.updatedBy && row.updatedBy !== row.createdBy ? (
                    <div style={{ fontSize: 11 }} title={t("admin.list.lastEditedBy", { email: row.updatedBy })}>
                      {t("admin.list.changedBy", { name: actorLabel(row.updatedBy, actorNames) })}
                    </div>
                  ) : null}
                </td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {row.publishedAt ? row.publishedAt.slice(0, 10) : "—"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="admin-btn admin-btn-sm" href={`/admin/videos/${row.id}`}>
                    {t("admin.list.edit")}
                  </Link>{" "}
                  <a
                    className="admin-btn admin-btn-sm"
                    href={`/videos/${encodeURIComponent(row.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {t("admin.vid.preview")}
                  </a>{" "}
                  <DeleteVideoButton id={row.id} title={row.title} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
