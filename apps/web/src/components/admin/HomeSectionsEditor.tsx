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
  { key: "channels", label: "栏目卡片" },
  { key: "video", label: "视频资源" },
  { key: "voices", label: "见证者" },
  { key: "network", label: "全球网络" },
  { key: "resources", label: "资源馆" },
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
  moreLabel: "更多链接文字",
  moreHref: "更多链接地址",
  buttonLabel: "按钮文字",
  buttonHref: "按钮链接",
  citiesLabel: "城市列表标题"
};

/** Render order per section. Anything unlisted follows, alphabetically. */
const FIELD_ORDER: Record<string, string[]> = {
  hero: ["eyebrow", "title", "body", "image", "imageAlt", "gallery", "video", "actions"],
  registry: ["eyebrow", "count", "countLabel", "noteLabel", "noteHref", "streamHeading", "substats"],
  services: ["eyebrow", "heading", "moreLabel", "moreHref", "cards"],
  news: ["eyebrow", "heading", "moreLabel", "moreHref", "lead", "items"],
  channels: ["cards"],
  video: ["eyebrow", "heading", "moreLabel", "moreHref", "items"],
  voices: ["eyebrow", "heading", "lede", "moreLabel", "moreHref", "items"],
  network: ["eyebrow", "heading", "body", "buttonLabel", "buttonHref", "citiesLabel", "cities"],
  resources: ["eyebrow", "heading", "moreLabel", "moreHref", "items"],
  about: ["eyebrow", "heading", "lede", "moreLabel", "moreHref", "cells"],
  involve: ["eyebrow", "heading", "items"]
};

/** Plain-text fields that hold an image URL. */
const IMAGE_FIELDS = new Set(["image", "poster", "backgroundImage"]);

/** Fields that get a purpose-built editor rather than a JSON textarea. */
const STRUCTURED = new Set(["gallery", "video", "actions"]);

const MEDIA_FIELDS = new Set(["image", "imageAlt", "gallery", "video"]);
const LINK_FIELDS = new Set(["actions", "moreLabel", "moreHref", "buttonLabel", "buttonHref"]);

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
                选择图片
              </span>
            )}
          </button>
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
        首页按区块编辑。每个区块可单独显示／隐藏并选择版式；文字与图片可直接编辑，
        其余列表字段为 JSON。
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
        const jsonKeys = otherKeys.filter((k) => !STRUCTURED.has(k));

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

              {textBlock.length > 0 ? (
                <fieldset style={fieldset}>
                  <legend style={legend}>文字</legend>
                  {textBlock.map(renderText)}
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
