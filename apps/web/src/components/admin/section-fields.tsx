"use client";

/**
 * Field renderers shared by the section editors (homepage, About).
 *
 * The homepage editor grew a set of purpose-built controls -- image picker,
 * repeating rows with reorder, nested link lists, split bars -- and the About
 * page needs exactly the same ones. They live here so the two editors stay in
 * step rather than drifting apart as copies.
 */

export interface RowField {
  key: string;
  label: string;
  kind?: "text" | "area" | "image" | "video-flag" | "flag" | "list" | "links" | "meta-list" | "bars";
}

/** A repeating list of records: `blank` is the template a new row starts from. */
export interface RowEditorSpec {
  label: string;
  blank: Record<string, unknown>;
  fields: RowField[];
}

/** A single record edited in place, e.g. the news lead story. */
export interface ObjectEditorSpec {
  label: string;
  fields: RowField[];
}

/** One markdown body inside a block, edited with the article body editor. */
export interface MarkdownFieldSpec {
  key: string;
  label: string;
  hint?: string;
}

/**
 * One editable block of a page, declared rather than hand-built.
 *
 * Originally written for the About page; the Involve pages now use the same
 * shape, so the declaration and its renderer live here rather than in a file
 * named after one section.
 */
export interface SectionBlockDef {
  key: string;
  label: string;
  note?: string;
  /**
   * Lists that are no longer stored here -- the page reads them from the page
   * named in `managedOn`. Rendering them would be a control that silently does
   * nothing, which is the exact confusion this consolidation set out to remove.
   */
  managedElsewhere?: { fields: string[]; label: string; managedOn: string };
  /** Plain string fields, in render order, with their captions. */
  text?: { key: string; label: string; area?: boolean }[];
  /** Fields that are a plain list of strings, one per line. */
  lists?: { key: string; label: string; hint?: string }[];
  /** Markdown bodies. A block may hold more than one (body plus a footnote). */
  markdown?: MarkdownFieldSpec[];
  /** Repeating records. */
  rows?: Record<string, RowEditorSpec>;
  /** Single nested records. */
  objects?: Record<string, ObjectEditorSpec>;
}

export function asRow(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRow) : [];
}

export const fieldsetStyle: React.CSSProperties = {
  border: "1px solid #ececec",
  borderRadius: 4,
  padding: "12px 14px",
  display: "grid",
  gap: 12
};

/** Field captions read as the control's heading, so they are set apart from
 *  the value the operator types into it. */
export const fieldCaption: React.CSSProperties = {
  display: "block",
  marginBottom: 4,
  fontWeight: 600
};

/** Column captions above a row editor whose fields are otherwise unlabelled. */
export const columnHead: React.CSSProperties = {
  display: "grid",
  gap: 8,
  fontSize: 12,
  color: "#777"
};

export const legendStyle: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#777",
  padding: "0 6px"
};

export interface FieldRendererDeps {
  updateField: (keyPath: string[], value: unknown) => void;
  onPickImage: (keyPath: string[], label: string) => void;
}

/**
 * Builds the renderers bound to one editor's write and image-picker callbacks.
 */
export function createFieldRenderers({ updateField, onPickImage }: FieldRendererDeps) {
  const imageField = (keyPath: string[], label: string, value: string, compact = false) => (
    <div style={{ display: "grid", gap: 6 }}>
      <input
        className="admin-input"
        value={value}
        placeholder="https://… 或点击「选择图片」"
        onChange={(event) => updateField(keyPath, event.target.value)}
      />
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button className="admin-btn" type="button" onClick={() => onPickImage(keyPath, label)}>
          选择图片…
        </button>
        {value ? (
          <>
            <img
              src={value}
              alt=""
              style={{
                width: compact ? 56 : 72,
                height: compact ? 42 : 54,
                objectFit: "cover",
                border: "1px solid #ececec"
              }}
            />
            <button className="admin-btn" type="button" onClick={() => updateField(keyPath, "")}>
              清除
            </button>
          </>
        ) : (
          <span style={{ color: "#999", fontSize: 12 }}>未设置</span>
        )}
      </div>
    </div>
  );

  const recordFields = (
    keyPath: string[],
    label: string,
    row: Record<string, unknown>,
    fields: RowField[]
  ) => (
    <div style={{ display: "grid", gap: 10 }}>
      {fields.map((field) => {
        const path = [...keyPath, field.key];
        const current = String(row[field.key] ?? "");
        if (field.kind === "image") {
          return (
            <div key={field.key}>
              <span style={fieldCaption}>{field.label}</span>
              {imageField(path, `${label} · ${field.label}`, current, true)}
            </div>
          );
        }
        if (field.kind === "flag") {
          return (
            <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={row[field.key] === true}
                onChange={(event) => updateField(path, event.target.checked)}
              />
              {field.label}
            </label>
          );
        }
        if (field.kind === "bars") {
          const rows = asRows(row[field.key]);
          const write = (next: Record<string, unknown>[]) => updateField(path, next);
          const total = rows.reduce((sum, bar) => sum + (Number(bar.percent) || 0), 0);
          return (
            <div key={field.key} style={{ display: "grid", gap: 8 }}>
              <span style={fieldCaption}>{field.label}</span>
              {rows.length > 0 ? (
                <div style={{ ...columnHead, gridTemplateColumns: "minmax(0, 1fr) 90px auto" }}>
                  <span>名称（Label）</span>
                  <span>百分比（%）</span>
                  <span />
                </div>
              ) : null}
              {rows.map((bar, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 90px auto",
                    gap: 8,
                    alignItems: "center"
                  }}
                >
                  <input
                    className="admin-input"
                    placeholder="名称"
                    value={String(bar.label ?? "")}
                    onChange={(event) =>
                      write(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                    }
                  />
                  <input
                    className="admin-input"
                    type="number"
                    min={0}
                    max={100}
                    value={Number(bar.percent) || 0}
                    onChange={(event) =>
                      write(
                        rows.map((r, i) =>
                          i === index
                            ? { ...r, percent: Math.max(0, Math.min(100, Number(event.target.value) || 0)) }
                            : r
                        )
                      )
                    }
                  />
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => write(rows.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </div>
              ))}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  className="admin-btn"
                  type="button"
                  onClick={() => write([...rows, { label: "", percent: 0 }])}
                >
                  + 添加分段
                </button>
                {rows.length > 0 ? (
                  <span style={{ fontSize: 12, color: total === 100 ? "#777" : "#b42318" }}>
                    合计 {total}%{total === 100 ? "" : "（应为 100%）"}
                  </span>
                ) : null}
              </div>
            </div>
          );
        }
        /**
         * A list of label + count pairs, e.g. the download page's
         * "三退主题展板 / 86 项". Same shape as `links` without an address.
         */
        if (field.kind === "meta-list") {
          const rows = asRows(row[field.key]);
          const write = (next: Record<string, unknown>[]) => updateField(path, next);
          return (
            <div key={field.key} style={{ display: "grid", gap: 8 }}>
              <span style={fieldCaption}>{field.label}</span>
              {rows.length === 0 ? (
                <span style={{ color: "#777", fontSize: 13 }}>还没有条目。</span>
              ) : (
                <div style={{ ...columnHead, gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr) auto" }}>
                  <span>名称（Label）</span>
                  <span>数量／说明（Meta）</span>
                  <span />
                </div>
              )}
              {rows.map((item, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1.6fr) minmax(0, 1fr) auto",
                    gap: 8,
                    alignItems: "center"
                  }}
                >
                  <input
                    className="admin-input"
                    placeholder="名称"
                    value={String(item.label ?? "")}
                    onChange={(event) =>
                      write(rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r)))
                    }
                  />
                  <input
                    className="admin-input"
                    placeholder="数量／说明"
                    value={String(item.meta ?? "")}
                    onChange={(event) =>
                      write(rows.map((r, i) => (i === index ? { ...r, meta: event.target.value } : r)))
                    }
                  />
                  <button className="admin-btn" type="button" onClick={() => write(rows.filter((_, i) => i !== index))}>
                    删除
                  </button>
                </div>
              ))}
              <div>
                <button className="admin-btn" type="button" onClick={() => write([...rows, { label: "", meta: "" }])}>
                  添加条目
                </button>
              </div>
            </div>
          );
        }

        if (field.kind === "links") {
          const rows = asRows(row[field.key]);
          const write = (next: Record<string, unknown>[]) => updateField(path, next);
          return (
            <div key={field.key} style={{ display: "grid", gap: 8 }}>
              <span style={fieldCaption}>{field.label}</span>
              {rows.length === 0 ? (
                <span style={{ color: "#777", fontSize: 13 }}>还没有链接。</span>
              ) : (
                <div style={{ ...columnHead, gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) auto" }}>
                  <span>文字（Label）</span>
                  <span>链接（Link）</span>
                  <span />
                </div>
              )}
              {rows.map((link, index) => (
                <div
                  key={index}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.4fr) auto",
                    gap: 8,
                    alignItems: "center"
                  }}
                >
                  <input
                    className="admin-input"
                    placeholder="文字"
                    value={String(link.label ?? "")}
                    onChange={(event) =>
                      write(
                        rows.map((r, i) => (i === index ? { ...r, label: event.target.value } : r))
                      )
                    }
                  />
                  <input
                    className="admin-input"
                    placeholder="链接"
                    value={String(link.href ?? "")}
                    onChange={(event) =>
                      write(
                        rows.map((r, i) => (i === index ? { ...r, href: event.target.value } : r))
                      )
                    }
                  />
                  <button
                    className="admin-btn"
                    type="button"
                    onClick={() => write(rows.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </div>
              ))}
              <div>
                <button
                  className="admin-btn"
                  type="button"
                  onClick={() => write([...rows, { label: "", href: "" }])}
                >
                  + 添加链接
                </button>
              </div>
            </div>
          );
        }
        if (field.kind === "list") {
          const entries = Array.isArray(row[field.key])
            ? (row[field.key] as unknown[]).map((entry) => String(entry))
            : [];
          return (
            <label key={field.key}>
              {field.label}
              <textarea
                className="admin-textarea"
                style={{ minHeight: 64 }}
                value={entries.join("\n")}
                onChange={(event) =>
                  updateField(
                    path,
                    event.target.value
                      .split("\n")
                      .map((entry) => entry.trim())
                      // Blank lines would render as empty pills; a trailing
                      // newline while typing is the common case.
                      .filter((entry) => entry.length > 0)
                  )
                }
              />
            </label>
          );
        }
        if (field.kind === "video-flag") {
          return (
            <label key={field.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input
                type="checkbox"
                checked={current.trim().length > 0}
                // The badge doubles as the "this is a video" flag in every
                // channels variant; the play glyph is what the other layouts
                // print, so keep writing it rather than a boolean.
                onChange={(event) => updateField(path, event.target.checked ? "▶" : "")}
              />
              {field.label}
            </label>
          );
        }
        return (
          <label key={field.key}>
            {field.label}
            <textarea
              className="admin-textarea"
              style={{ minHeight: field.kind === "area" ? 64 : 42 }}
              value={current}
              onChange={(event) => updateField(path, event.target.value)}
            />
          </label>
        );
      })}
    </div>
  );

  const rowsEditor = (
    sectionKey: string,
    /**
     * null when the section's own value is the array -- `timeline` and friends
     * are stored bare rather than under a named key.
     */
    fieldKey: string | null,
    spec: { label: string; blank: Record<string, unknown>; fields: RowField[] },
    rows: Record<string, unknown>[]
  ) => {
    const basePath = fieldKey === null ? [sectionKey] : [sectionKey, fieldKey];
    const write = (next: Record<string, unknown>[]) => updateField(basePath, next);
    const move = (index: number, delta: number) => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      write(next);
    };
    return (
      <div style={{ display: "grid", gap: 12 }}>
        {rows.length === 0 ? (
          <p style={{ margin: 0, color: "#777", fontSize: 13 }}>还没有条目。</p>
        ) : null}
        {rows.map((row, index) => (
          <div
            key={index}
            style={{ border: "1px solid #f0f0f0", borderRadius: 4, padding: 10, display: "grid", gap: 10 }}
          >
            <div className="admin-toolbar" style={{ margin: 0, padding: 0 }}>
              <strong style={{ fontSize: 13 }}>
                {spec.label} {index + 1}
              </strong>
              <button
                className="admin-btn"
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                上移
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                下移
              </button>
              <button
                className="admin-btn"
                type="button"
                style={{ marginLeft: "auto" }}
                onClick={() => write(rows.filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
            {recordFields(
              [...basePath, String(index)],
              `${spec.label} ${index + 1}`,
              row,
              spec.fields
            )}
          </div>
        ))}
        <div>
          <button
            className="admin-btn"
            type="button"
            // structuredClone, not spread: a nested `links: []` in the blank
            // would otherwise be the same array on every card added.
            onClick={() => write([...rows, structuredClone(spec.blank)])}
          >
            + 添加{spec.label}
          </button>
        </div>
      </div>
    );
  };
  return { imageField, recordFields, rowsEditor };
}
