"use client";

import { HOME_SECTION_VARIANTS } from "@quitccp/content-schema";

/**
 * Section-by-section editor for `pages/home.json`.
 *
 * Fields render in a deliberate order (eyebrow → title → body → media → links)
 * rather than whatever order the stored JSON happens to use, and are grouped so
 * text, media and links are visually separate. Gallery, video and action lists
 * get purpose-built editors instead of raw JSON, because those are the fields
 * editors actually touch.
 */

export interface HomeSectionDef {
  key: string;
  label: string;
  note?: string;
  /** Shown only while the section is hidden: why it was turned off. */
  hiddenNote?: string;
}

export const HOME_SECTIONS: HomeSectionDef[] = [
  { key: "hero", label: "首屏 Hero" },
  {
    key: "registry",
    label: "实时登记册",
    note: "声明内容来自三退网站的数据，不在此编辑；这里只调整版式与说明文字。"
  },
  { key: "services", label: "我们的服务" },
  { key: "news", label: "新闻与报告（公开更新与重点议题）" },
  { key: "channels", label: "栏目卡片（专题栏目）" },
  {
    key: "video",
    label: "视频资源",
    note: "「导语」「底部说明」「底部标记」留空即不显示；填上文字就会出现。"
  },
  { key: "voices", label: "见证者" },
  {
    key: "network",
    label: "全球网络",
    hiddenNote: "已从首页移除。服务点查找仍在 /about/network，并从「关于我们」与「服务」页面链接过去。"
  },
  {
    key: "resources",
    label: "资源馆",
    hiddenNote: "已从首页移除：同样的链接在 /resources 页面上，首页这一排是重复的。"
  },
  { key: "about", label: "关于我们" },
  { key: "involve", label: "参与我们" }
];

const FIELD_LABELS: Record<string, string> = {
  eyebrow: "小标题（eyebrow）",
  title: "标题",
  heading: "区块标题",
  body: "正文",
  lede: "导语",
  image: "图片",
  imageAlt: "图片说明",
  count: "登记数字",
  countLabel: "数字说明",
  noteLabel: "数字注释链接文字",
  noteHref: "数字注释链接地址",
  streamHeading: "滚动区标题",
  liveLabel: "实时标签（如「实时登记册 · LIVE」）",
  moreLabel: "更多链接文字",
  moreHref: "更多链接地址",
  buttonLabel: "按钮文字",
  buttonHref: "按钮链接",
  citiesLabel: "城市列表标题",
  listTitle: "侧栏标题",
  listTitleEn: "侧栏英文标签",
  listMoreLabel: "侧栏底部链接文字",
  listMoreHref: "侧栏底部链接地址",
  latestLabel: "卡片区标题",
  footNote: "底部说明",
  footMark: "底部标记"
};

/** Render order per section. Anything unlisted follows, alphabetically. */
const FIELD_ORDER: Record<string, string[]> = {
  hero: ["eyebrow", "title", "body", "image", "imageAlt", "gallery", "video", "actions"],
  registry: [
    "eyebrow",
    "count",
    "countLabel",
    "liveLabel",
    "streamHeading",
    "feedCount",
    "noteLabel",
    "noteHref",
    "substats"
  ],
  services: ["eyebrow", "heading", "moreLabel", "moreHref", "cards"],
  news: [
    "eyebrow",
    "heading",
    "moreLabel",
    "moreHref",
    "listTitle",
    "listTitleEn",
    "listMoreLabel",
    "listMoreHref",
    "lead",
    "items"
  ],
  channels: ["heading", "cards"],
  video: [
    "eyebrow",
    "heading",
    "lede",
    "moreLabel",
    "moreHref",
    "series",
    "featured",
    "latestLabel",
    "items",
    "footNote",
    "footMark"
  ],
  voices: ["eyebrow", "heading", "lede", "moreLabel", "moreHref", "items"],
  network: ["eyebrow", "heading", "body", "buttonLabel", "buttonHref", "citiesLabel", "cities"],
  resources: ["eyebrow", "heading", "moreLabel", "moreHref", "items"],
  about: ["eyebrow", "heading", "lede", "moreLabel", "moreHref", "cells"],
  involve: ["eyebrow", "heading", "lede", "items"]
};

/** Plain-text fields that hold an image URL. */
const IMAGE_FIELDS = new Set(["image", "poster", "backgroundImage"]);

/** Fields that get a purpose-built editor rather than a JSON textarea. */
const STRUCTURED = new Set(["gallery", "video", "actions"]);

const MEDIA_FIELDS = new Set(["image", "imageAlt", "gallery", "video"]);
const LINK_FIELDS = new Set([
  "actions",
  "moreLabel",
  "moreHref",
  "buttonLabel",
  "buttonHref",
  "listMoreLabel",
  "listMoreHref"
]);

/**
 * Per-field editors for the news and media sections.
 *
 * These lists used to be raw JSON textareas, which made the images
 * uneditable in practice -- an operator had to paste a URL into a string
 * inside a blob. Keyed `<section>.<field>` because the field names repeat
 * across sections (`items`, `cards`) with different shapes.
 */
interface RowField {
  key: string;
  label: string;
  kind?: "text" | "area" | "image" | "video-flag" | "flag" | "list" | "links" | "bars";
}

/**
 * Numeric section settings, keyed `<section>.<field>`. Without this they fall
 * to the JSON textarea, where a count reads as a data structure rather than the
 * dial it is. Ranges mirror what `resolveHomeContent` clamps to.
 */
const NUMBER_FIELDS: Record<string, { label: string; min: number; max: number; hint?: string }> = {
  "registry.feedCount": {
    label: "滚动条数",
    min: 1,
    max: 20,
    hint: "滚动带里显示多少条声明；声明不足时会循环填满。"
  }
};

/**
 * Section fields that hold a plain list of strings, keyed `<section>.<field>`.
 * One per line beats a JSON array of quoted strings for something like a list
 * of city names.
 */
const STRING_LIST_FIELDS: Record<string, { label: string; hint?: string }> = {
  "network.cities": { label: "城市（每行一个）", hint: "按填写顺序显示。" }
};

const OBJECT_EDITORS: Record<string, { label: string; fields: RowField[] }> = {
  "video.featured": {
    label: "本期推荐",
    fields: [
      { key: "image", label: "封面图", kind: "image" },
      { key: "tag", label: "角标（如「本期推荐」）" },
      { key: "title", label: "标题", kind: "area" },
      { key: "body", label: "简介", kind: "area" },
      { key: "href", label: "播放链接" },
      { key: "duration", label: "时长角标（如 58:00，留空则不显示）" },
      { key: "meta", label: "标签（每行一个）", kind: "list" },
      { key: "primaryLabel", label: "主按钮文字" },
      { key: "primaryHref", label: "主按钮链接" },
      { key: "secondaryLabel", label: "次按钮文字" },
      { key: "secondaryHref", label: "次按钮链接" }
    ]
  },
  "news.lead": {
    label: "头条文章",
    fields: [
      { key: "image", label: "图片", kind: "image" },
      { key: "tag", label: "角标（如「头条」）" },
      { key: "kicker", label: "英文前缀（如 FEATURE）" },
      { key: "title", label: "标题", kind: "area" },
      { key: "body", label: "摘要", kind: "area" },
      { key: "meta", label: "日期" },
      { key: "href", label: "链接" }
    ]
  }
};

const ROW_EDITORS: Record<
  string,
  { label: string; blank: Record<string, unknown>; fields: RowField[] }
> = {
  "news.items": {
    label: "最新发布",
    blank: { title: "", date: "", href: "/news", image: "" },
    fields: [
      { key: "image", label: "图片", kind: "image" },
      { key: "title", label: "标题", kind: "area" },
      { key: "date", label: "日期" },
      { key: "href", label: "链接" }
    ]
  },
  "channels.cards": {
    label: "专题栏目",
    blank: {
      title: "",
      en: "",
      leadTitle: "",
      leadHref: "/news",
      image: "",
      badge: "",
      footLabel: "",
      footHref: "/news"
    },
    fields: [
      { key: "image", label: "图片", kind: "image" },
      { key: "title", label: "栏目名称" },
      { key: "en", label: "英文标签（如 INVESTIGATIONS）" },
      { key: "badge", label: "视频", kind: "video-flag" },
      { key: "leadTitle", label: "导读标题", kind: "area" },
      { key: "leadHref", label: "导读链接" },
      { key: "footLabel", label: "底部链接文字" },
      { key: "footHref", label: "底部链接地址" }
    ]
  },
  "video.items": {
    label: "视频",
    blank: { title: "", meta: "", href: "/videos", image: "", duration: "", badge: "" },
    fields: [
      { key: "image", label: "封面", kind: "image" },
      { key: "title", label: "标题", kind: "area" },
      { key: "meta", label: "系列与类型（如「三退前线 · 现场纪录」）" },
      { key: "href", label: "链接" },
      { key: "duration", label: "时长角标（如 11:05，留空则不显示）" },
      { key: "badge", label: "角标（如 NEW，留空则不显示）" }
    ]
  },
  "registry.substats": {
    label: "小数据",
    blank: { value: "", label: "" },
    fields: [
      { key: "value", label: "数字" },
      { key: "label", label: "说明" }
    ]
  },
  "services.cards": {
    label: "服务卡片",
    blank: { tag: "", title: "", body: "", links: [], ctaLabel: "", ctaHref: "" },
    fields: [
      { key: "tag", label: "分类标签" },
      { key: "title", label: "标题", kind: "area" },
      { key: "body", label: "说明", kind: "area" },
      { key: "links", label: "卡片内链接", kind: "links" },
      { key: "ctaLabel", label: "底部按钮文字（留空则不显示）" },
      { key: "ctaHref", label: "底部按钮链接" }
    ]
  },
  "about.cells": {
    label: "指标",
    blank: { heading: "", value: "", body: "" },
    fields: [
      { key: "value", label: "主数字／标题（左栏）" },
      { key: "heading", label: "小标题（只在有分段条时显示）" },
      { key: "body", label: "说明", kind: "area" },
      { key: "bars", label: "分段条", kind: "bars" }
    ]
  },
  "involve.items": {
    label: "参与方式",
    blank: { title: "", body: "", href: "#", ctaLabel: "", glyph: "" },
    fields: [
      { key: "title", label: "标题" },
      { key: "body", label: "说明", kind: "area" },
      { key: "href", label: "链接" },
      { key: "ctaLabel", label: "按钮文字（留空则用标题）" },
      { key: "glyph", label: "圆形徽标文字（一个字，留空则不显示）" },
      { key: "primary", label: "作为主推卡片（金色顶线与实心按钮）", kind: "flag" }
    ]
  },
  "resources.items": {
    label: "资源",
    blank: { label: "", tag: "", href: "#" },
    fields: [
      { key: "label", label: "名称" },
      { key: "tag", label: "分类标签" },
      { key: "href", label: "链接" }
    ]
  },
  "voices.items": {
    label: "见证",
    blank: { quote: "", name: "", role: "", image: "" },
    fields: [
      { key: "image", label: "头像", kind: "image" },
      { key: "quote", label: "引述", kind: "area" },
      { key: "name", label: "姓名" },
      { key: "role", label: "身份（可换行）", kind: "area" }
    ]
  },
  "video.series": {
    label: "系列标签",
    blank: { label: "", href: "/videos" },
    fields: [
      { key: "label", label: "名称" },
      { key: "href", label: "链接" },
      { key: "active", label: "高亮显示（白底）", kind: "flag" }
    ]
  }
};

function orderFields(sectionKey: string, keys: string[]): string[] {
  const order = FIELD_ORDER[sectionKey] ?? [];
  return [...keys].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}

function asRow(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Two sections are absorbed by another section's variant: 「曙光」 pulls
 * 我们的服务 into 实时登记册, and 「报刊头版」 pulls 栏目卡片 into 新闻与报告.
 * Their content still renders, but their own 版式 choice stops mattering --
 * which is invisible from inside the absorbed section without saying so.
 */
function couplingNote(sectionKey: string, data: Record<string, unknown>): string | null {
  const variantOf = (key: string) => String(asRow(data[key]).variant ?? "");
  if (sectionKey === "channels" && variantOf("news") === "broadsheet") {
    return "「新闻与报告」正在使用「报刊头版」版式，本区块已并入其中显示：内容仍然生效，但这里的「版式」选择不起作用。";
  }
  if (
    (sectionKey === "services" || sectionKey === "voices") &&
    variantOf("registry") === "dawn"
  ) {
    return "「实时登记册」正在使用「曙光」版式，本区块已并入其中显示：内容仍然生效，但这里的「版式」选择不起作用。";
  }
  if (sectionKey === "registry" && variantOf("registry") === "dawn") {
    return "「曙光」版式把「我们的服务」与「见证者」并入本区块一起显示，共四张卡片；两者的内容仍在各自区块里编辑。本版式使用「实时标签」而不是「滚动区标题」。";
  }
  if (sectionKey === "involve" && variantOf("about") === "verified") {
    return "「关于我们」正在使用「可检验」版式，本区块已并入其中显示：内容仍然生效，但这里的「版式」与「小标题」不起作用（合并后的小标题在「关于我们」里设置）。";
  }
  if (sectionKey === "about" && variantOf("about") === "verified") {
    return "「可检验」版式把「参与我们」并入本区块一起显示；参与方式仍在「参与我们」里编辑。左栏为拉丁文字时用等宽字体，中文用衬线字体，无需另设。";
  }
  if (sectionKey === "news" && variantOf("news") === "broadsheet") {
    return "「报刊头版」版式把「栏目卡片（专题栏目）」并入本区块一起显示；栏目卡片仍在该区块里编辑。";
  }
  return null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRow) : [];
}

const fieldset: React.CSSProperties = {
  border: "1px solid #ececec",
  borderRadius: 4,
  padding: "12px 14px",
  display: "grid",
  gap: 12
};

const legend: React.CSSProperties = {
  fontSize: 12,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  color: "#777",
  padding: "0 6px"
};

export interface HomeSectionsEditorProps {
  data: Record<string, unknown>;
  updateField: (keyPath: string[], value: unknown) => void;
  jsonDrafts: Record<string, string>;
  jsonErrors: Record<string, string>;
  onJsonDraft: (sectionKey: string, fieldKey: string, raw: string) => void;
  onPickImage: (keyPath: string[], label: string) => void;
}

export function HomeSectionsEditor({
  data,
  updateField,
  jsonDrafts,
  jsonErrors,
  onJsonDraft,
  onPickImage
}: HomeSectionsEditorProps) {
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

  const galleryEditor = (sectionKey: string, label: string, items: Record<string, unknown>[]) => (
    <div style={{ display: "grid", gap: 10 }}>
      {items.length === 0 ? <p style={{ margin: 0, color: "#777", fontSize: 13 }}>还没有图片。</p> : null}
      {items.map((item, index) => (
        <div
          key={index}
          style={{
            display: "grid",
            gridTemplateColumns: "92px 1fr auto",
            gap: 10,
            alignItems: "start",
            border: "1px solid #f0f0f0",
            borderRadius: 4,
            padding: 8
          }}
        >
          {/* Thumbnail and an explicit button do the same thing: a filled
              thumbnail alone gave no sign it was clickable, and every other
              image field in this editor is picked from a labelled button. */}
          <div style={{ display: "grid", gap: 4 }}>
            <button
              type="button"
              onClick={() => onPickImage([sectionKey, "gallery", String(index), "src"], `${label} · 第 ${index + 1} 张`)}
              style={{ padding: 0, border: "1px solid #ececec", background: "none", cursor: "pointer", lineHeight: 0 }}
              title="更换图片"
            >
              {String(item.src ?? "") ? (
                <img
                  src={String(item.src)}
                  alt=""
                  style={{ width: 90, height: 68, objectFit: "cover", display: "block" }}
                />
              ) : (
                <span style={{ display: "grid", placeItems: "center", width: 90, height: 68, fontSize: 12, color: "#999" }}>
                  未设置
                </span>
              )}
            </button>
            <button
              className="admin-btn"
              type="button"
              style={{ padding: "2px 6px", fontSize: 12 }}
              onClick={() => onPickImage([sectionKey, "gallery", String(index), "src"], `${label} · 第 ${index + 1} 张`)}
            >
              选择图片…
            </button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              className="admin-input"
              value={String(item.alt ?? "")}
              placeholder="图片说明（也用作无障碍替代文字）"
              onChange={(event) =>
                updateField([sectionKey, "gallery", String(index), "alt"], event.target.value)
              }
            />
            <input
              className="admin-input"
              style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
              value={String(item.src ?? "")}
              placeholder="https://…"
              onChange={(event) =>
                updateField([sectionKey, "gallery", String(index), "src"], event.target.value)
              }
            />
          </div>
          <div style={{ display: "grid", gap: 4 }}>
            <button
              className="admin-btn"
              type="button"
              disabled={index === 0}
              onClick={() => {
                const next = [...items];
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                updateField([sectionKey, "gallery"], next);
              }}
            >
              ↑
            </button>
            <button
              className="admin-btn"
              type="button"
              disabled={index === items.length - 1}
              onClick={() => {
                const next = [...items];
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                updateField([sectionKey, "gallery"], next);
              }}
            >
              ↓
            </button>
            <button
              className="admin-btn"
              type="button"
              onClick={() => updateField([sectionKey, "gallery"], items.filter((_, i) => i !== index))}
            >
              删除
            </button>
          </div>
        </div>
      ))}
      <div>
        <button
          className="admin-btn"
          type="button"
          onClick={() => updateField([sectionKey, "gallery"], [...items, { src: "", alt: "" }])}
        >
          + 添加图片
        </button>
      </div>
    </div>
  );

  const videoEditor = (sectionKey: string, label: string, video: Record<string, unknown>) => (
    <div style={{ display: "grid", gap: 10 }}>
      <label>
        视频地址（.mp4/.webm 直链，或嵌入地址）
        <input
          className="admin-input"
          style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
          value={String(video.src ?? "")}
          placeholder="留空则只显示封面图，不显示播放按钮"
          onChange={(event) => updateField([sectionKey, "video", "src"], event.target.value)}
        />
      </label>
      <div>
        <span style={{ display: "block", marginBottom: 4 }}>封面图（poster）</span>
        {imageField([sectionKey, "video", "poster"], `${label} · 视频封面`, String(video.poster ?? ""))}
      </div>
      <label>
        视频说明
        <input
          className="admin-input"
          value={String(video.caption ?? "")}
          onChange={(event) => updateField([sectionKey, "video", "caption"], event.target.value)}
        />
      </label>
      <p style={{ margin: 0, color: "#777", fontSize: 12, lineHeight: 1.7 }}>
        点击才加载：访客未点击播放前不会向视频地址发出任何请求。
      </p>
    </div>
  );

  const actionsEditor = (sectionKey: string, items: Record<string, unknown>[]) => (
    <div style={{ display: "grid", gap: 8 }}>
      {items.map((item, index) => (
        <div
          key={index}
          style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 120px auto", gap: 8, alignItems: "center" }}
        >
          <input
            className="admin-input"
            value={String(item.label ?? "")}
            placeholder="按钮文字"
            onChange={(event) => updateField([sectionKey, "actions", String(index), "label"], event.target.value)}
          />
          <input
            className="admin-input"
            style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
            value={String(item.href ?? "")}
            placeholder="链接地址"
            onChange={(event) => updateField([sectionKey, "actions", String(index), "href"], event.target.value)}
          />
          <select
            className="admin-select"
            value={String(item.variant ?? "seal")}
            onChange={(event) => updateField([sectionKey, "actions", String(index), "variant"], event.target.value)}
          >
            <option value="seal">主按钮</option>
            <option value="line-light">次按钮</option>
          </select>
          <button
            className="admin-btn"
            type="button"
            onClick={() => updateField([sectionKey, "actions"], items.filter((_, i) => i !== index))}
          >
            删除
          </button>
        </div>
      ))}
      <div>
        <button
          className="admin-btn"
          type="button"
          onClick={() =>
            updateField([sectionKey, "actions"], [...items, { label: "", href: "", variant: "seal", stamp: "" }])
          }
        >
          + 添加按钮
        </button>
      </div>
    </div>
  );

  /** One record's fields, used for both `news.lead` and each list row. */
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
              <span style={{ display: "block", marginBottom: 4 }}>{field.label}</span>
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
              <span>{field.label}</span>
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
        if (field.kind === "links") {
          const rows = asRows(row[field.key]);
          const write = (next: Record<string, unknown>[]) => updateField(path, next);
          return (
            <div key={field.key} style={{ display: "grid", gap: 8 }}>
              <span>{field.label}</span>
              {rows.length === 0 ? (
                <span style={{ color: "#777", fontSize: 13 }}>还没有链接。</span>
              ) : null}
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
    fieldKey: string,
    spec: { label: string; blank: Record<string, unknown>; fields: RowField[] },
    rows: Record<string, unknown>[]
  ) => {
    const write = (next: Record<string, unknown>[]) => updateField([sectionKey, fieldKey], next);
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
              [sectionKey, fieldKey, String(index)],
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

  const jsonField = (sectionKey: string, key: string, value: unknown) => {
    const draftKey = `${sectionKey}.${key}`;
    return (
      <label key={key}>
        {key}（JSON）
        <textarea
          className="admin-textarea"
          style={{ minHeight: 140, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12 }}
          value={jsonDrafts[draftKey] ?? JSON.stringify(value, null, 2)}
          onChange={(event) => onJsonDraft(sectionKey, key, event.target.value)}
        />
        {jsonErrors[draftKey] ? (
          <span style={{ color: "#b42318", fontSize: 12 }}>{jsonErrors[draftKey]}</span>
        ) : null}
      </label>
    );
  };

  return (
    <>
      <p style={{ margin: 0, color: "#666" }}>
        首页按区块编辑。每个区块可单独显示／隐藏并选择版式；文字、图片与列表都可
        直接编辑。个别区块的版式会把相邻区块并入显示，遇到时区块内会有黄色提示。
      </p>

      {HOME_SECTIONS.map((section) => {
        const value = asRow(data[section.key]);
        const variants = HOME_SECTION_VARIANTS[section.key as keyof typeof HOME_SECTION_VARIANTS] ?? [];
        const enabled = value.enabled !== false;

        const keys = orderFields(
          section.key,
          Object.keys(value).filter((k) => k !== "enabled" && k !== "variant")
        );
        const textKeys = keys.filter((k) => typeof value[k] === "string");
        const otherKeys = keys.filter((k) => typeof value[k] !== "string");

        const textBlock = textKeys.filter((k) => !MEDIA_FIELDS.has(k) && !LINK_FIELDS.has(k));
        const mediaText = textKeys.filter((k) => MEDIA_FIELDS.has(k));
        const linkText = textKeys.filter((k) => LINK_FIELDS.has(k));

        const structuredKeys = otherKeys.filter((k) => STRUCTURED.has(k));
        const richKeys = otherKeys.filter(
          (k) => ROW_EDITORS[`${section.key}.${k}`] || OBJECT_EDITORS[`${section.key}.${k}`]
        );
        const numberKeys = otherKeys.filter((k) => NUMBER_FIELDS[`${section.key}.${k}`]);
        const listKeys = otherKeys.filter((k) => STRING_LIST_FIELDS[`${section.key}.${k}`]);
        const jsonKeys = otherKeys.filter(
          (k) =>
            !STRUCTURED.has(k) &&
            !richKeys.includes(k) &&
            !numberKeys.includes(k) &&
            !listKeys.includes(k)
        );

        const renderStringList = (key: string) => {
          const spec = STRING_LIST_FIELDS[`${section.key}.${key}`];
          const entries = Array.isArray(value[key])
            ? (value[key] as unknown[]).map((entry) => String(entry))
            : [];
          return (
            <label key={key}>
              {spec.label}
              <textarea
                className="admin-textarea"
                style={{ minHeight: 120 }}
                value={entries.join("\n")}
                onChange={(event) =>
                  updateField(
                    [section.key, key],
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

        const renderNumber = (key: string) => {
          const spec = NUMBER_FIELDS[`${section.key}.${key}`];
          const current = Number(value[key]);
          return (
            <label key={key}>
              {spec.label}
              <input
                className="admin-input"
                type="number"
                min={spec.min}
                max={spec.max}
                style={{ width: 120, display: "block" }}
                value={Number.isFinite(current) ? current : spec.min}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (!Number.isFinite(next)) return;
                  updateField(
                    [section.key, key],
                    Math.max(spec.min, Math.min(spec.max, Math.round(next)))
                  );
                }}
              />
              {spec.hint ? (
                <span style={{ color: "#777", fontSize: 12 }}>{spec.hint}</span>
              ) : null}
            </label>
          );
        };

        const renderText = (key: string) =>
          IMAGE_FIELDS.has(key) ? (
            <div key={key}>
              <span style={{ display: "block", marginBottom: 4 }}>{FIELD_LABELS[key] ?? key}</span>
              {imageField([section.key, key], `${section.label} · ${FIELD_LABELS[key] ?? key}`, String(value[key] ?? ""))}
            </div>
          ) : (
            <label key={key}>
              {FIELD_LABELS[key] ?? key}
              <textarea
                className="admin-textarea"
                style={{ minHeight: key === "body" || key === "lede" ? 84 : 46 }}
                value={String(value[key] ?? "")}
                onChange={(event) => updateField([section.key, key], event.target.value)}
              />
            </label>
          );

        return (
          <details
            key={section.key}
            style={{ border: "1px solid #ececec", borderRadius: 4, padding: "10px 12px" }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              {section.label}
              {!enabled ? <span style={{ color: "#b42318" }}>（已隐藏）</span> : null}
            </summary>

            <div style={{ display: "grid", gap: 14, marginTop: 12 }}>
              {section.note ? (
                <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>{section.note}</p>
              ) : null}
              {!enabled && section.hiddenNote ? (
                <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>{section.hiddenNote}</p>
              ) : null}
              {couplingNote(section.key, data) ? (
                <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>
                  {couplingNote(section.key, data)}
                </p>
              ) : null}

              <div
                className="admin-toolbar"
                style={{ margin: 0, background: "#fafafa", padding: "8px 10px", borderRadius: 4 }}
              >
                <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(event) => updateField([section.key, "enabled"], event.target.checked)}
                  />
                  在首页显示
                </label>
                {variants.length > 0 ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    版式
                    <select
                      className="admin-select"
                      value={String(value.variant ?? variants[0].value)}
                      onChange={(event) => updateField([section.key, "variant"], event.target.value)}
                    >
                      {variants.map((variant) => (
                        <option key={variant.value} value={variant.value}>
                          {variant.label}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {textBlock.length > 0 || numberKeys.length > 0 || listKeys.length > 0 ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>文字</legend>
                  {textBlock.map(renderText)}
                  {numberKeys.map(renderNumber)}
                  {listKeys.map(renderStringList)}
                </fieldset>
              ) : null}

              {mediaText.length > 0 || structuredKeys.some((k) => k === "gallery" || k === "video") ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>图片与视频</legend>
                  {mediaText.map(renderText)}
                  {structuredKeys.includes("gallery") ? (
                    <div>
                      <span style={{ display: "block", marginBottom: 6 }}>图集</span>
                      {galleryEditor(section.key, section.label, asRows(value.gallery))}
                    </div>
                  ) : null}
                  {structuredKeys.includes("video") ? (
                    <div>
                      <span style={{ display: "block", marginBottom: 6 }}>视频</span>
                      {videoEditor(section.key, section.label, asRow(value.video))}
                    </div>
                  ) : null}
                </fieldset>
              ) : null}

              {linkText.length > 0 || structuredKeys.includes("actions") ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>按钮与链接</legend>
                  {linkText.map(renderText)}
                  {structuredKeys.includes("actions")
                    ? actionsEditor(section.key, asRows(value.actions))
                    : null}
                </fieldset>
              ) : null}

              {richKeys.length > 0 ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>内容条目</legend>
                  {richKeys.map((key) => {
                    const objectSpec = OBJECT_EDITORS[`${section.key}.${key}`];
                    const rowSpec = ROW_EDITORS[`${section.key}.${key}`];
                    return (
                      <div key={key} style={{ display: "grid", gap: 8 }}>
                        <span style={{ fontWeight: 600 }}>
                          {(objectSpec ?? rowSpec).label}
                        </span>
                        {objectSpec
                          ? recordFields(
                              [section.key, key],
                              `${section.label} · ${objectSpec.label}`,
                              asRow(value[key]),
                              objectSpec.fields
                            )
                          : rowsEditor(section.key, key, rowSpec, asRows(value[key]))}
                      </div>
                    );
                  })}
                </fieldset>
              ) : null}

              {jsonKeys.length > 0 ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>列表内容（JSON）</legend>
                  {jsonKeys.map((key) => jsonField(section.key, key, value[key]))}
                </fieldset>
              ) : null}
            </div>
          </details>
        );
      })}
    </>
  );
}
