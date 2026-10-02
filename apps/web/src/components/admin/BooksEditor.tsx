"use client";

/**
 * Form editor for `pages/resources-index.json` — 书籍与文集.
 *
 * The page was editable only as raw JSON textareas, one per top-level key, so
 * changing a book's link meant finding the right `href` inside a nested blob and
 * not breaking the syntax around it. Everything here maps to the same fields;
 * the JSON fallback is still there for anything this form does not cover.
 *
 * The shape it edits:
 *
 *   featuredBook   { title, yearLine, body, href, image, imageAlt,
 *                    formats[{label, href}], toc[{index, title, href}] }
 *   otherWorks[]   { title, body, href, image, imageAlt, formats[{label, href}] }
 *
 * A format pill with a blank link is **not rendered on the public page** — see
 * `withRealHref` in SectionHomeTemplate. That is the intended way to retire a
 * button: clear its link, rather than leave it pointing somewhere plausible.
 * The hint under each list says so, because it is not guessable.
 */

import type { ReactNode } from "react";

export interface BooksEditorProps {
  data: Record<string, unknown>;
  updateField: (keyPath: string[], value: unknown) => void;
  onPickImage: (keyPath: string[], label: string) => void;
}

type Row = Record<string, unknown>;

function asRows(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((row) => typeof row === "object" && row !== null) as Row[]) : [];
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
      <span style={{ color: "#555" }}>{label}</span>
      {children}
    </label>
  );
}

const cardStyle = {
  border: "1px solid #e8e8e8",
  borderRadius: 6,
  padding: 14,
  display: "grid",
  gap: 12
} as const;

const hint = { margin: 0, fontSize: 12, color: "#777" } as const;

export function BooksEditor({ data, updateField, onPickImage }: BooksEditorProps) {
  const featured = (data.featuredBook ?? {}) as Row;
  const others = asRows(data.otherWorks);

  const imageButton = (path: string[], label: string, current: string) => (
    <div style={{ display: "grid", gridTemplateColumns: "96px 1fr", gap: 10, alignItems: "start" }}>
      <button
        type="button"
        onClick={() => onPickImage(path, label)}
        style={{ padding: 0, border: "1px solid #ececec", background: "none", cursor: "pointer", lineHeight: 0 }}
        title="更换图片"
      >
        {current ? (
          <img src={current} alt="" style={{ width: 94, height: 94, objectFit: "cover", display: "block" }} />
        ) : (
          <span style={{ display: "grid", placeItems: "center", width: 94, height: 94, fontSize: 12, color: "#999" }}>
            未设置
          </span>
        )}
      </button>
      <div style={{ display: "grid", gap: 6 }}>
        <button className="admin-btn" type="button" style={{ padding: "3px 8px", fontSize: 12 }} onClick={() => onPickImage(path, label)}>
          选择图片…
        </button>
        <input
          className="admin-input"
          value={current}
          placeholder="图片地址"
          onChange={(event) => updateField(path, event.target.value)}
        />
      </div>
    </div>
  );

  /** label + href pairs: the format pills, and the 九评 table of contents. */
  const linkRows = (
    basePath: string[],
    rows: Row[],
    firstKey: "label" | "index",
    firstLabel: string,
    opts: { secondKey?: "title"; secondLabel?: string; addLabel: string }
  ) => {
    const write = (next: Row[]) => updateField(basePath, next);
    return (
      <div style={{ display: "grid", gap: 8 }}>
        {rows.length === 0 ? <p style={hint}>还没有条目。</p> : null}
        {rows.map((row, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: opts.secondKey ? "80px 1fr 2fr auto" : "120px 1fr auto",
              gap: 8,
              alignItems: "center"
            }}
          >
            <input
              className="admin-input"
              value={str(row[firstKey])}
              placeholder={firstLabel}
              onChange={(event) => write(rows.map((r, i) => (i === index ? { ...r, [firstKey]: event.target.value } : r)))}
            />
            {opts.secondKey ? (
              <input
                className="admin-input"
                value={str(row[opts.secondKey])}
                placeholder={opts.secondLabel}
                onChange={(event) =>
                  write(rows.map((r, i) => (i === index ? { ...r, [opts.secondKey as string]: event.target.value } : r)))
                }
              />
            ) : null}
            <input
              className="admin-input"
              value={str(row.href)}
              placeholder="链接（留空则不显示）"
              onChange={(event) => write(rows.map((r, i) => (i === index ? { ...r, href: event.target.value } : r)))}
            />
            <button
              className="admin-btn"
              type="button"
              style={{ padding: "3px 8px", fontSize: 12 }}
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
            style={{ padding: "3px 10px", fontSize: 12 }}
            onClick={() =>
              write([...rows, opts.secondKey ? { [firstKey]: "", [opts.secondKey]: "", href: "" } : { [firstKey]: "", href: "" }])
            }
          >
            {opts.addLabel}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <section style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 15 }}>主推著作（Featured book）</h3>
        <Field label="书名（Title）">
          <input className="admin-input" value={str(featured.title)} onChange={(e) => updateField(["featuredBook", "title"], e.target.value)} />
        </Field>
        <Field label="年份说明（Year line）">
          <input className="admin-input" value={str(featured.yearLine)} onChange={(e) => updateField(["featuredBook", "yearLine"], e.target.value)} />
        </Field>
        <Field label="简介（Body）">
          <textarea
            className="admin-textarea"
            style={{ minHeight: 100 }}
            value={str(featured.body)}
            onChange={(e) => updateField(["featuredBook", "body"], e.target.value)}
          />
        </Field>
        <Field label="书籍链接（Link，新窗口打开）">
          <input className="admin-input" value={str(featured.href)} onChange={(e) => updateField(["featuredBook", "href"], e.target.value)} />
        </Field>
        <Field label="配图（Photo）">{imageButton(["featuredBook", "image"], "主推著作配图", str(featured.image))}</Field>
        <Field label="配图说明（Alt，给读屏软件用）">
          <input className="admin-input" value={str(featured.imageAlt)} onChange={(e) => updateField(["featuredBook", "imageAlt"], e.target.value)} />
        </Field>
        <Field label="文字封面（留空则只显示配图）">
          <input
            className="admin-input"
            value={str(featured.coverText)}
            onChange={(e) => updateField(["featuredBook", "coverText"], e.target.value)}
          />
        </Field>

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#555" }}>版本按钮（Formats）</p>
          <p style={{ ...hint, marginBottom: 8 }}>留空链接的按钮不会显示在页面上——这是去掉一个按钮的方法。</p>
          {linkRows(["featuredBook", "formats"], asRows(featured.formats), "label", "按钮文字", { addLabel: "添加版本按钮" })}
        </div>

        <div>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#555" }}>目录（Table of contents）</p>
          <p style={{ ...hint, marginBottom: 8 }}>每一章的链接单独填写，点击后在新窗口打开。</p>
          {linkRows(["featuredBook", "toc"], asRows(featured.toc), "index", "序号", {
            secondKey: "title",
            secondLabel: "章节标题",
            addLabel: "添加章节"
          })}
        </div>
      </section>

      <section style={cardStyle}>
        <h3 style={{ margin: 0, fontSize: 15 }}>其他著作（Other works）</h3>
        {others.length === 0 ? <p style={hint}>还没有其他著作。</p> : null}
        {others.map((work, index) => (
          <div key={index} style={{ ...cardStyle, background: "#fcfcfc" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
              <strong style={{ fontSize: 14 }}>{str(work.title) || `第 ${index + 1} 本`}</strong>
              <button
                className="admin-btn"
                type="button"
                style={{ padding: "3px 8px", fontSize: 12 }}
                onClick={() => updateField(["otherWorks"], others.filter((_, i) => i !== index))}
              >
                删除这本书
              </button>
            </div>
            <Field label="书名（Title）">
              <input className="admin-input" value={str(work.title)} onChange={(e) => updateField(["otherWorks", String(index), "title"], e.target.value)} />
            </Field>
            <Field label="简介（Body）">
              <textarea
                className="admin-textarea"
                style={{ minHeight: 80 }}
                value={str(work.body)}
                onChange={(e) => updateField(["otherWorks", String(index), "body"], e.target.value)}
              />
            </Field>
            <Field label="书籍链接（Link，新窗口打开）">
              <input className="admin-input" value={str(work.href)} onChange={(e) => updateField(["otherWorks", String(index), "href"], e.target.value)} />
            </Field>
            <Field label="配图（Photo）">
              {imageButton(["otherWorks", String(index), "image"], `${str(work.title) || "著作"} 配图`, str(work.image))}
            </Field>
            <Field label="配图说明（Alt）">
              <input
                className="admin-input"
                value={str(work.imageAlt)}
                onChange={(e) => updateField(["otherWorks", String(index), "imageAlt"], e.target.value)}
              />
            </Field>
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 13, color: "#555" }}>版本按钮（Formats）</p>
              <p style={{ ...hint, marginBottom: 8 }}>留空链接的按钮不会显示。</p>
              {linkRows(["otherWorks", String(index), "formats"], asRows(work.formats), "label", "按钮文字", {
                addLabel: "添加版本按钮"
              })}
            </div>
          </div>
        ))}
        <div>
          <button
            className="admin-btn"
            type="button"
            onClick={() => updateField(["otherWorks"], [...others, { title: "", body: "", href: "", image: "", imageAlt: "", formats: [] }])}
          >
            添加一本著作
          </button>
        </div>
      </section>
    </div>
  );
}
