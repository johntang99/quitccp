"use client";

import {
  asRow,
  asRows,
  createFieldRenderers,
  fieldCaption,
  fieldsetStyle,
  legendStyle,
  type ObjectEditorSpec,
  type RowEditorSpec,
  type RowField
} from "./section-fields";

/**
 * Section-by-section editor for `pages/about-index.json`.
 *
 * The About page used to be six raw JSON textareas, one per block. It uses the
 * same field renderers as the homepage editor, so the two read alike: bold
 * captions with their English beside them, repeating rows with add / delete /
 * reorder, and an image picker wherever there is an image.
 *
 * Unlike the homepage, these blocks have no `enabled` or `variant` — the About
 * page shows all of them, in a fixed order.
 */

interface AboutBlockDef {
  key: string;
  label: string;
  note?: string;
  /** Plain string fields, in render order, with their captions. */
  text?: { key: string; label: string; area?: boolean }[];
  /** Fields that are a plain list of strings, one per line. */
  lists?: { key: string; label: string; hint?: string }[];
  /** Repeating records. */
  rows?: Record<string, RowEditorSpec>;
  /** Single nested records. */
  objects?: Record<string, ObjectEditorSpec>;
}

const LINK_ROW: RowField[] = [
  { key: "label", label: "文字（Label）" },
  { key: "href", label: "链接（Link）" }
];

const STAT_ROW: RowField[] = [
  { key: "value", label: "数字（Value）" },
  { key: "label", label: "说明（Label）" }
];

export const ABOUT_BLOCKS: AboutBlockDef[] = [
  {
    key: "intro",
    label: "机构简介 Intro",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "principlesHeading", label: "原则区标题（Principles heading）" },
      { key: "sidebarTitle", label: "侧栏标题（Sidebar title）" },
      { key: "downloadPanelTitle", label: "下载区标题（Download title）" },
      { key: "downloadPanelBody", label: "下载区说明（Download body）", area: true },
      { key: "downloadPanelButtonLabel", label: "下载按钮文字（Button label）" },
      { key: "downloadPanelButtonHref", label: "下载按钮链接（Button link）" }
    ],
    lists: [
      {
        key: "paragraphs",
        label: "正文段落（Paragraphs，每段一行）",
        hint: "一行是一段。段落之间不要留空行。"
      }
    ],
    rows: {
      principles: {
        label: "原则（Principles）",
        blank: { label: "", text: "" },
        fields: [
          { key: "label", label: "标签（Label）" },
          { key: "text", label: "说明（Text）", kind: "area" }
        ]
      },
      sidebarLinks: { label: "侧栏链接（Sidebar links）", blank: { label: "", href: "#" }, fields: LINK_ROW }
    }
  },
  {
    key: "numbersBand",
    label: "数字带 Numbers",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "heading", label: "区块标题（Heading）" },
      { key: "lede", label: "导语（Lede）", area: true }
    ],
    rows: {
      stats: { label: "数字（Stats）", blank: { value: "", label: "" }, fields: STAT_ROW },
      actions: {
        label: "按钮（Actions）",
        blank: { label: "", href: "#", variant: "seal" },
        fields: [
          { key: "label", label: "文字（Label）" },
          { key: "href", label: "链接（Link）" },
          { key: "variant", label: "样式（Style，seal 为主按钮）" }
        ]
      }
    }
  },
  {
    key: "network",
    label: "全球网络 Network",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "heading", label: "区块标题（Heading）" },
      { key: "lede", label: "导语（Lede）", area: true },
      { key: "moreLabel", label: "更多链接文字（More label）" },
      { key: "moreHref", label: "更多链接地址（More link）" }
    ],
    rows: {
      stats: { label: "数字（Stats）", blank: { value: "", label: "" }, fields: STAT_ROW }
    }
  },
  {
    key: "accountability",
    label: "问责与公开 Accountability",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "heading", label: "区块标题（Heading）" },
      { key: "lede", label: "导语（Lede）", area: true },
      { key: "moreLabel", label: "更多链接文字（More label）" },
      { key: "moreHref", label: "更多链接地址（More link）" }
    ],
    rows: {
      cells: {
        label: "指标（Cells）",
        blank: { title: "", value: "", body: "" },
        fields: [
          { key: "title", label: "小标题（Title）" },
          { key: "value", label: "主数字／标题（Figure）" },
          { key: "body", label: "说明（Body）", kind: "area" }
        ]
      },
      links: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW }
    }
  },
  {
    key: "team",
    label: "团队 Team",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "heading", label: "区块标题（Heading）" },
      { key: "lede", label: "导语（Lede）", area: true }
    ],
    rows: {
      people: {
        label: "成员（People）",
        blank: { name: "", image: "", roleLine1: "", roleLine2: "" },
        fields: [
          { key: "image", label: "头像（Portrait）", kind: "image" },
          { key: "name", label: "姓名（Name）" },
          { key: "roleLine1", label: "身份第一行（Role, line 1）" },
          { key: "roleLine2", label: "身份第二行（Role, line 2）" }
        ]
      }
    }
  },
  {
    key: "history",
    label: "大事记与联系 History",
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "heading", label: "区块标题（Heading）" },
      { key: "contactTitle", label: "联系区标题（Contact title）" }
    ],
    lists: [
      { key: "contactAddressLines", label: "地址（Address，每行一条）" }
    ],
    rows: {
      timeline: {
        label: "大事记（Timeline）",
        blank: { date: "", body: "" },
        fields: [
          { key: "date", label: "时间（Date）" },
          { key: "body", label: "内容（Body）", kind: "area" }
        ]
      },
      contactLinks: { label: "联系链接（Contact links）", blank: { label: "", href: "#" }, fields: LINK_ROW }
    }
  }
];

/** Every key a block's declaration covers, so an undeclared one can be spotted. */
function declaredKeys(block: AboutBlockDef): Set<string> {
  return new Set([
    ...(block.text ?? []).map((f) => f.key),
    ...(block.lists ?? []).map((f) => f.key),
    ...Object.keys(block.rows ?? {}),
    ...Object.keys(block.objects ?? {})
  ]);
}

export interface AboutSectionsEditorProps {
  data: Record<string, unknown>;
  updateField: (keyPath: string[], value: unknown) => void;
  onPickImage: (keyPath: string[], label: string) => void;
  jsonDrafts: Record<string, string>;
  jsonErrors: Record<string, string>;
  onJsonDraft: (blockKey: string, fieldKey: string, raw: string) => void;
}

export function AboutSectionsEditor({
  data,
  updateField,
  onPickImage,
  jsonDrafts,
  jsonErrors,
  onJsonDraft
}: AboutSectionsEditorProps) {
  const { recordFields, rowsEditor } = createFieldRenderers({ updateField, onPickImage });

  const stringList = (
    blockKey: string,
    spec: { key: string; label: string; hint?: string },
    value: unknown
  ) => {
    const entries = Array.isArray(value) ? (value as unknown[]).map((entry) => String(entry)) : [];
    return (
      <label key={spec.key}>
        {spec.label}
        <textarea
          className="admin-textarea"
          style={{ minHeight: 120 }}
          value={entries.join("\n")}
          onChange={(event) =>
            updateField(
              [blockKey, spec.key],
              event.target.value
                .split("\n")
                .map((entry) => entry.trim())
                .filter((entry) => entry.length > 0)
            )
          }
        />
        {spec.hint ? <span style={{ color: "#777", fontSize: 12 }}>{spec.hint}</span> : null}
      </label>
    );
  };

  return (
    <div className="home-sections" style={{ display: "contents" }}>
      <p style={{ margin: 0, color: "#666" }}>
        About 页面按区块编辑。文字、列表与图片都可直接编辑；区块的显示顺序固定，与页面一致。
      </p>

      {ABOUT_BLOCKS.map((block) => {
        const value = asRow(data[block.key]);
        const textFields = block.text ?? [];
        const listFields = block.lists ?? [];
        const rowSpecs = Object.entries(block.rows ?? {});
        const objectSpecs = Object.entries(block.objects ?? {});
        // A key the declaration above does not cover would otherwise be
        // invisible here and uneditable -- worse than a JSON box. This keeps
        // the form honest when the page content grows a field.
        const declared = declaredKeys(block);
        const extraKeys = Object.keys(value).filter((key) => !declared.has(key));

        return (
          <details
            key={block.key}
            style={{ border: "1px solid #ececec", borderRadius: 4, padding: "10px 12px" }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>{block.label}</summary>

            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              {block.note ? (
                <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>{block.note}</p>
              ) : null}

              {textFields.length > 0 || listFields.length > 0 ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>文字 Text</legend>
                  {textFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <textarea
                        className="admin-textarea"
                        style={{ minHeight: field.area ? 84 : 46 }}
                        value={String(value[field.key] ?? "")}
                        onChange={(event) => updateField([block.key, field.key], event.target.value)}
                      />
                    </label>
                  ))}
                  {listFields.map((field) => stringList(block.key, field, value[field.key]))}
                </fieldset>
              ) : null}

              {rowSpecs.length > 0 || objectSpecs.length > 0 ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>内容条目 Items</legend>
                  {objectSpecs.map(([key, spec]) => (
                    <div key={key} style={{ display: "grid", gap: 8 }}>
                      <span style={fieldCaption}>{spec.label}</span>
                      {recordFields(
                        [block.key, key],
                        `${block.label} · ${spec.label}`,
                        asRow(value[key]),
                        spec.fields
                      )}
                    </div>
                  ))}
                  {rowSpecs.map(([key, spec]) => (
                    <div key={key} style={{ display: "grid", gap: 8 }}>
                      <span style={fieldCaption}>{spec.label}</span>
                      {rowsEditor(block.key, key, spec, asRows(value[key]))}
                    </div>
                  ))}
                </fieldset>
              ) : null}

              {extraKeys.length > 0 ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>其它字段 Other（JSON）</legend>
                  <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>
                    这些字段还没有专用表单，暂时以 JSON 编辑。
                  </p>
                  {extraKeys.map((key) => (
                    <label key={key}>
                      {key}
                      <textarea
                        className="admin-textarea"
                        style={{
                          minHeight: 140,
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 12
                        }}
                        value={jsonDrafts[`${block.key}.${key}`] ?? JSON.stringify(value[key], null, 2)}
                        onChange={(event) => onJsonDraft(block.key, key, event.target.value)}
                      />
                      {jsonErrors[`${block.key}.${key}`] ? (
                        <span style={{ color: "#b42318", fontSize: 12 }}>
                          {jsonErrors[`${block.key}.${key}`]}
                        </span>
                      ) : null}
                    </label>
                  ))}
                </fieldset>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
