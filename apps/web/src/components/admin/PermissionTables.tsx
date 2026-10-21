import { Fragment } from "react";
import { t } from "@/lib/i18n";
import {
  ACTION_ROWS,
  INVARIANTS,
  MATRIX_COLUMNS,
  PAGE_ROWS,
  type MatrixRow
} from "@/lib/admin/permission-matrix";

/**
 * The permission tables, rendered from the live permission functions.
 *
 * Nothing here is typed out by hand: every ✓ and ✗ is the result of asking the
 * same `can()` the routes ask. Change a rule in permissions.ts and this page
 * changes with it, which is the only way a printed matrix stays true.
 */

/*
 * `isPages` 是个显式的 prop，不是从 caption 里猜的。
 *
 * 原来这里写的是 `caption.includes("页面") ? "页面" : "操作"` —— 靠标题里有没有
 * 那两个字来决定第一列叫什么。标题一翻成英文，这个判断就永远走 else 分支，
 * 两张表的第一列都会变成「操作」。翻译把这个隐含依赖逼了出来。
 */
function Table({
  caption,
  rows,
  isPages = false
}: {
  caption: string;
  rows: readonly MatrixRow[];
  isPages?: boolean;
}) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="admin-table perm-table">
        <caption
          style={{
            captionSide: "top",
            textAlign: "left",
            padding: "0 0 8px",
            fontWeight: 600
          }}
        >
          {caption}
        </caption>
        <thead>
          <tr>
            <th>{t(isPages ? "admin.perm.colPage" : "admin.perm.colAction")}</th>
            {MATRIX_COLUMNS.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <Fragment key={row.label}>
              {/* A heading only where the group changes, so three unrelated
                  areas of the admin stop reading as one undifferentiated list. */}
              {row.group && row.group !== rows[index - 1]?.group ? (
                <tr className="perm-group">
                  <td colSpan={MATRIX_COLUMNS.length + 1}>{row.group}</td>
                </tr>
              ) : null}
            <tr>
              <td>
                {row.label}
                {row.note ? <div className="perm-note">{row.note}</div> : null}
              </td>
              {MATRIX_COLUMNS.map((column) => {
                const allowed = row.allow(column.actor);
                return (
                  <td
                    key={column.key}
                    style={{ color: allowed ? "#1f7a4d" : "#b4232c", fontWeight: 600 }}
                    title={t(allowed ? "admin.perm.allowed" : "admin.perm.denied")}
                  >
                    {allowed ? "✓" : "✗"}
                  </td>
                );
              })}
            </tr>
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PermissionTables() {
  return (
    <>
      <p style={{ color: "#5a6072", marginTop: 0, fontSize: 13 }}>
        {t("admin.perm.generatedNote")}
      </p>
      <ul style={{ color: "#5a6072", margin: "0 0 16px", paddingLeft: 20, fontSize: 13 }}>
        {MATRIX_COLUMNS.filter((column) => column.note).map((column) => (
          <li key={column.key}>
            <strong>{column.label}</strong>：{column.note}
          </li>
        ))}
      </ul>

      <Table caption={t("admin.perm.tablePages")} rows={PAGE_ROWS} isPages />
      <div style={{ height: 22 }} />
      <Table caption={t("admin.perm.tableActions")} rows={ACTION_ROWS} />

      <h4 style={{ marginBottom: 8 }}>{t("admin.perm.invariantsTitle")}</h4>
      <ul style={{ color: "#5a6072", margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
        {INVARIANTS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
