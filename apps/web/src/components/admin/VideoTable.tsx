import Link from "next/link";
import { DeleteVideoButton } from "./DeleteVideoButton";
import { hostOf } from "@/lib/video-host";
import type { VideoListRow } from "@/lib/admin/video-repository";

const STATUS: Record<string, { label: string; cls: string }> = {
  published: { label: "已发布", cls: "b-pub" },
  draft: { label: "草稿", cls: "b-draft" },
  archived: { label: "已归档", cls: "b-arch" }
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
export function VideoTable({
  rows,
  selectable = false,
  bulkFormId
}: {
  rows: VideoListRow[];
  selectable?: boolean;
  /** Associates the row checkboxes with a bulk form that lives outside the table. */
  bulkFormId?: string;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {selectable ? <th style={{ width: 28 }} /> : null}
            <th style={{ width: 76 }}>封面</th>
            <th>标题</th>
            <th>分类</th>
            <th>时长</th>
            <th>状态</th>
            <th>来源</th>
            <th>发布时间</th>
            <th style={{ width: 150 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={selectable ? 9 : 8} style={{ color: "#8a90a0", padding: 24, textAlign: "center" }}>
                没有符合条件的视频。
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
                <td style={{ whiteSpace: "nowrap" }}>
                  {host.key === "none" ? (
                    <span style={{ color: "#b42318" }}>无地址</span>
                  ) : (
                    <a href={row.sourceUrl} target="_blank" rel="noopener noreferrer" title={row.sourceUrl}>
                      {host.label} ↗
                    </a>
                  )}
                </td>
                <td className="muted" style={{ whiteSpace: "nowrap" }}>
                  {row.publishedAt ? row.publishedAt.slice(0, 10) : "—"}
                </td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="admin-btn admin-btn-sm" href={`/admin/videos/${row.id}`}>
                    编辑
                  </Link>{" "}
                  <a
                    className="admin-btn admin-btn-sm"
                    href={`/videos/${encodeURIComponent(row.slug)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    预览 ↗
                  </a>{" "}
                  <form method="post" action="/api/admin/content/videos/delete" style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={row.id} />
                    <DeleteVideoButton title={row.title} />
                  </form>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
