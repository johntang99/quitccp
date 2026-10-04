import { Fragment } from "react";
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

function Table({ caption, rows }: { caption: string; rows: readonly MatrixRow[] }) {
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
            <th>{caption.includes("页面") ? "页面" : "操作"}</th>
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
                    title={allowed ? "允许" : "拒绝"}
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
        下面两张表由系统的权限代码直接生成，不是手写的说明。改了权限规则，这里会跟着变。
      </p>
      <ul style={{ color: "#5a6072", margin: "0 0 16px", paddingLeft: 20, fontSize: 13 }}>
        {MATRIX_COLUMNS.filter((column) => column.note).map((column) => (
          <li key={column.key}>
            <strong>{column.label}</strong>：{column.note}
          </li>
        ))}
      </ul>

      <Table caption="可以打开哪些页面" rows={PAGE_ROWS} />
      <div style={{ height: 22 }} />
      <Table caption="可以做哪些操作" rows={ACTION_ROWS} />

      <h4 style={{ marginBottom: 8 }}>对所有人都成立的规则</h4>
      <ul style={{ color: "#5a6072", margin: 0, paddingLeft: 20, lineHeight: 1.8, fontSize: 13 }}>
        {INVARIANTS.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </>
  );
}
