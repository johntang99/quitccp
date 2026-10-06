"use client";

import { MarkdownEditor } from "./MarkdownEditor";
import {
  asRow,
  asRows,
  createFieldRenderers,
  fieldCaption,
  fieldsetStyle,
  legendStyle,
  type ObjectEditorSpec,
  type RowEditorSpec,
  type RowField,
  type SectionBlockDef
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

/**
 * The block declaration now lives in section-fields, beside the renderers that
 * read it, because the Involve pages use the same shape. The old name is kept
 * as an alias so the declarations below need no rewriting.
 */
type AboutBlockDef = SectionBlockDef;

const LINK_ROW: RowField[] = [
  { key: "label", label: "文字（Label）" },
  { key: "href", label: "链接（Link）" }
];

const STAT_ROW: RowField[] = [
  { key: "value", label: "数字（Value）" },
  { key: "label", label: "说明（Label）" }
];

/**
 * The /about overview page is the 机构简介 and nothing else.
 *
 * It used to carry five more blocks that summarised the sub-pages, each holding
 * its own copy of that page's list. The copies drifted -- the timeline showed 7
 * entries here and 11 on /about/history -- and an editor who updated one saw no
 * change on the other. The summaries are gone: /about is the introduction, and
 * each topic lives on its own tab, edited in one place.
 */
export const ABOUT_BLOCKS: AboutBlockDef[] = [
  {
    key: "intro",
    label: "机构简介 Intro",
    markdown: [
      {
        key: "body",
        label: "正文（Markdown）",
        hint: "空行分段。`## 小标题` 是二级标题，`**加粗**`，`[文字](链接)` 是链接。"
      }
    ],
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "sidebarTitle", label: "侧栏标题（Sidebar title）" },
      { key: "downloadPanelTitle", label: "下载区标题（Download title）" },
      { key: "downloadPanelBody", label: "下载区说明（Download body）", area: true },
      { key: "downloadPanelButtonLabel", label: "下载按钮文字（Button label）" },
      { key: "downloadPanelButtonHref", label: "下载按钮链接（Button link）" }
    ],
    rows: {
      sidebarLinks: { label: "侧栏链接（Sidebar links）", blank: { label: "", href: "#" }, fields: LINK_ROW }
    }
  }
];

/** Keys the declaration covers, so anything else can be surfaced rather than lost. */
function declaredKeys(block: AboutBlockDef): Set<string> {
  return new Set([
    ...(block.text ?? []).map((f) => f.key),
    ...(block.lists ?? []).map((f) => f.key),
    ...Object.keys(block.rows ?? {}),
    ...Object.keys(block.objects ?? {}),
    ...(block.markdown ?? []).map((f) => f.key),
    // Superseded by the markdown body; still stored, deliberately not shown.
    ...(block.markdown ? ["paragraphs", "principlesHeading", "principles"] : [])
  ]);
}

/**
 * The five About sub-pages, in the same declarative shape as ABOUT_BLOCKS.
 *
 * They were edited as raw JSON textareas until now: an editor wanting to change
 * one board member had to find the right object inside a wall of braces and not
 * break it. Nothing here is new machinery -- the same renderers that serve the
 * overview page serve these, so every About screen now reads the same way.
 *
 * Keyed by content path because that is what ContentExplorer knows.
 */
const PARA_ROW: RowField[] = [
  { key: "heading", label: "小节标题（Heading）" },
  { key: "paragraphs", label: "段落（Paragraphs，每段一行）", kind: "list" }
];

const PERSON_ROW: RowField[] = [
  { key: "image", label: "头像（Portrait）", kind: "image" },
  { key: "name", label: "姓名（Name）" },
  { key: "roleLine1", label: "身份第一行（Role, line 1）" },
  { key: "roleLine2", label: "身份第二行（Role, line 2）" }
];

export const ABOUT_SUBPAGE_BLOCKS: Record<string, AboutBlockDef[]> = {
  "pages/about-accountability.json": [
    {
      key: "summaryCells",
      label: "概览指标 Summary",
      note: "页面顶部的几格数字。",
      rows: {
        __self: {
          label: "指标（Cells）",
          blank: { title: "", value: "", body: "", bars: [] },
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "value", label: "数值（Value）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "bars", label: "比例条（Bars）", kind: "bars" }
          ]
        }
      }
    },
    {
      key: "proseSections",
      label: "正文章节 Sections",
      rows: { __self: { label: "章节（Sections）", blank: { heading: "", paragraphs: [] }, fields: PARA_ROW } }
    },
    {
      key: "summaryLinks",
      label: "概览链接 Summary links",
      rows: { __self: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    },
    {
      key: "downloadsPanel",
      label: "下载面板 Downloads",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: { links: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    },
    {
      key: "thirdPartyPanel",
      label: "第三方认证 Third party",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: { links: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    }
  ],

  "pages/about-history.json": [
    {
      key: "timeline",
      label: "大事记 Timeline",
      note: "/about 总览页的大事记直接取自这里，不必再维护第二份。",
      rows: {
        __self: {
          label: "条目（Timeline）",
          blank: { date: "", body: "" },
          fields: [
            { key: "date", label: "时间（Date，如 2005.01）" },
            { key: "body", label: "内容（Body）", kind: "area" }
          ]
        }
      }
    },
    {
      key: "relatedLinks",
      label: "相关链接 Related",
      rows: { __self: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    }
  ],

  "pages/about-network.json": [
    {
      key: "stats",
      label: "统计卡片 Stats",
      rows: { __self: { label: "数字（Stats）", blank: { value: "", label: "" }, fields: STAT_ROW } }
    },
    {
      key: "locations",
      label: "服务点 Locations",
      rows: {
        __self: {
          label: "服务点（Locations）",
          blank: { title: "", meta: "", body: "", tag: "" },
          fields: [
            { key: "title", label: "名称（Title）" },
            { key: "meta", label: "地区／说明（Meta）" },
            { key: "body", label: "介绍（Body）", kind: "area" },
            { key: "tag", label: "标签（Tag）" }
          ]
        }
      }
    },
    { key: "filters", label: "筛选标签 Filters", lists: [{ key: "__self", label: "标签（每行一个）" }] },
    { key: "pager", label: "分页 Pager", lists: [{ key: "__self", label: "页码（每行一个）" }] },
    {
      key: "mapBlock",
      label: "地图说明 Map",
      text: [
        { key: "label", label: "标签（Label）" },
        { key: "text", label: "说明（Text）", area: true }
      ]
    },
    {
      key: "ctaPanel",
      label: "右侧 CTA",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true },
        { key: "buttonLabel", label: "按钮文字（Button label）" },
        { key: "buttonHref", label: "按钮链接（Button link）" }
      ]
    },
    {
      key: "setupPanel",
      label: "设点面板 Setup",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: { links: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    },
    {
      key: "offeringsPanel",
      label: "服务内容 Offerings",
      text: [{ key: "title", label: "标题（Title）" }],
      lists: [{ key: "items", label: "条目（每行一条）" }]
    }
  ],

  "pages/about-numbers.json": [
    {
      key: "stats",
      label: "顶部统计 Stats",
      note: "/about 总览页的数字带直接取自这里。",
      rows: { __self: { label: "数字（Stats）", blank: { value: "", label: "" }, fields: STAT_ROW } }
    },
    {
      key: "sections",
      label: "正文章节 Sections",
      rows: { __self: { label: "章节（Sections）", blank: { heading: "", paragraphs: [] }, fields: PARA_ROW } }
    },
    {
      key: "actions",
      label: "按钮 Actions",
      rows: {
        __self: {
          label: "按钮（Actions）",
          blank: { label: "", href: "#", variant: "seal" },
          fields: [
            { key: "label", label: "文字（Label）" },
            { key: "href", label: "链接（Link）" },
            { key: "variant", label: "样式（seal 为主按钮）" }
          ]
        }
      }
    },
    {
      key: "relatedLinks",
      label: "相关链接 Related",
      rows: { __self: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    },
    {
      key: "citationPanel",
      label: "引用面板 Citation",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true },
        { key: "label", label: "链接文字（Label）" },
        { key: "href", label: "链接（Link）" }
      ]
    }
  ],

  "pages/about-team.json": [
    {
      key: "boardPanel",
      label: "理事会 Board",
      note: "/about 总览页的团队区块直接取自这里，只需维护这一处。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "heading", label: "区块标题（Heading）" }
      ],
      rows: { people: { label: "成员（People）", blank: { name: "", roleLine1: "", roleLine2: "", image: "" }, fields: PERSON_ROW } }
    },
    {
      key: "staffPanel",
      label: "执行团队 Staff",
      note: "留空则该段在页面上整段隐藏。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "heading", label: "区块标题（Heading）" }
      ],
      rows: { people: { label: "成员（People）", blank: { name: "", roleLine1: "", roleLine2: "", image: "" }, fields: PERSON_ROW } }
    },
    {
      key: "notePanel",
      label: "姓名与照片说明 Note",
      text: [
        { key: "heading", label: "标题（Heading）" },
        { key: "body", label: "正文（Body）", area: true }
      ]
    },
    {
      key: "joinPanel",
      label: "加入我们 Join",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true },
        { key: "buttonLabel", label: "按钮文字（Button label）" },
        { key: "buttonHref", label: "按钮链接（Button link）" }
      ]
    },
    {
      key: "relatedPanel",
      label: "相关链接 Related",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: { links: { label: "链接（Links）", blank: { label: "", href: "#" }, fields: LINK_ROW } }
    }
  ]
};

export interface AboutSectionsEditorProps {
  /**
   * Which block set to render. Defaults to the overview page's blocks; the five
   * sub-pages pass their own from ABOUT_SUBPAGE_BLOCKS.
   */
  blocks?: AboutBlockDef[];
  data: Record<string, unknown>;
  updateField: (keyPath: string[], value: unknown) => void;
  onPickImage: (keyPath: string[], label: string) => void;
  jsonDrafts: Record<string, string>;
  jsonErrors: Record<string, string>;
  onJsonDraft: (blockKey: string, fieldKey: string, raw: string) => void;
}

export function AboutSectionsEditor({
  blocks = ABOUT_BLOCKS,
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

  /** Same as stringList, but the block's own value is the array. */
  const stringListSelf = (
    blockKey: string,
    spec: { key: string; label: string; hint?: string },
    entries: unknown[]
  ) => (
    <label key={spec.key}>
      {spec.label}
      <textarea
        className="admin-textarea"
        style={{ minHeight: 120 }}
        value={entries.map((entry) => String(entry)).join("\n")}
        onChange={(event) =>
          updateField(
            [blockKey],
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

  return (
    <div className="home-sections" style={{ display: "contents" }}>
      <p style={{ margin: 0, color: "#666" }}>
        按区块编辑。文字、列表与图片都可直接编辑；区块的显示顺序固定，与页面一致。
      </p>

      {blocks.map((block) => {
        /*
         * Some blocks ARE the value -- `timeline`, `stats`, `filters` and the
         * like are stored as a bare array, not an object with named keys. The
         * `__self` field name marks that case so one declaration shape can
         * describe both without a second kind of block.
         */
        const raw = data[block.key];
        const selfArray = Array.isArray(raw) ? (raw as unknown[]) : null;
        const value = selfArray ? {} : asRow(raw);
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

              {block.managedElsewhere ? (
                <p
                  style={{
                    margin: 0,
                    padding: "9px 11px",
                    borderRadius: 6,
                    background: "#eef3fb",
                    border: "1px solid #c7d7ee",
                    color: "#2a4a77",
                    fontSize: 13,
                    lineHeight: 1.7
                  }}
                >
                  本区块的「{block.managedElsewhere.label}」在
                  <strong>「{block.managedElsewhere.managedOn}」</strong>
                  页面编辑，改一次这里和那一页同时更新。这里只保留本页自己的标题与导语。
                </p>
              ) : null}

              {(block.markdown ?? []).map((spec) => (
                <fieldset key={spec.key} style={fieldsetStyle}>
                  <legend style={legendStyle}>正文 Body</legend>
                  <span style={fieldCaption}>{spec.label}</span>
                  <MarkdownEditor
                    value={String(value[spec.key] ?? "")}
                    onChange={(next) => updateField([block.key, spec.key], next)}
                    onPickImage={() =>
                      onPickImage([block.key, spec.key], `${block.label} · ${spec.label}`)
                    }
                  />
                  {spec.hint ? (
                    <span style={{ color: "#777", fontSize: 12 }}>{spec.hint}</span>
                  ) : null}
                </fieldset>
              ))}

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
                  {listFields.map((field) =>
                    field.key === "__self"
                      ? stringListSelf(block.key, field, selfArray ?? [])
                      : stringList(block.key, field, value[field.key])
                  )}
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
                  {rowSpecs
                    .filter(([key]) => !(block.managedElsewhere?.fields ?? []).includes(key))
                    .map(([key, spec]) => (
                    <div key={key} style={{ display: "grid", gap: 8 }}>
                      <span style={fieldCaption}>{spec.label}</span>
                      {key === "__self"
                        ? rowsEditor(block.key, null, spec, asRows(selfArray ?? []))
                        : rowsEditor(block.key, key, spec, asRows(value[key]))}
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
