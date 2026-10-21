"use client";

import { HOME_SECTION_VARIANTS } from "@quitccp/content-schema";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { VideoUploadField } from "@/components/admin/VideoUploadField";
import { HERO_MOBILE_RATIO, HERO_RATIO, VideoRatioHint } from "@/components/admin/VideoRatioHint";
import {
  asRow,
  asRows,
  columnHead,
  createFieldRenderers,
  fieldCaption,
  fieldsetStyle,
  legendStyle,
  type ObjectEditorSpec,
  type RowEditorSpec,
  type RowField
} from "./section-fields";

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
  { key: "hero", label: t("home.sec.hero") },
  {
    key: "registry",
    label: t("home.sec.registry"),
    note: t("home.sec.registryNote")
  },
  { key: "services", label: t("home.sec.services") },
  { key: "news", label: t("home.sec.news") },
  { key: "channels", label: t("home.sec.channels") },
  {
    key: "video",
    label: t("home.sec.video"),
    note: t("home.sec.videoNote")
  },
  { key: "voices", label: t("home.sec.voices") },
  {
    key: "network",
    label: t("home.sec.network"),
    hiddenNote: t("home.sec.networkHidden")
  },
  {
    key: "resources",
    label: t("home.sec.resources"),
    hiddenNote: t("home.sec.resourcesHidden")
  },
  { key: "about", label: t("home.sec.about") },
  { key: "involve", label: t("home.sec.involve") }
];

const FIELD_LABELS: Record<string, string> = {
  eyebrow: t("home.f.eyebrow"),
  title: t("home.f.title"),
  heading: t("home.f.heading"),
  body: t("home.f.body"),
  lede: t("home.f.lede"),
  image: t("home.f.image"),
  imageAlt: t("home.f.imageAlt"),
  count: t("home.f.count"),
  countLabel: t("home.f.countLabel"),
  noteLabel: t("home.f.noteLabel"),
  noteHref: t("home.f.noteHref"),
  streamHeading: t("home.f.streamHeading"),
  liveLabel: t("home.f.liveLabel"),
  moreLabel: t("home.f.moreLabel"),
  moreHref: t("home.f.moreHref"),
  buttonLabel: t("home.f.buttonLabel"),
  buttonHref: t("home.f.buttonHref"),
  citiesLabel: t("home.f.citiesLabel"),
  listTitle: t("home.f.listTitle"),
  listTitleEn: t("home.f.listTitleEn"),
  listMoreLabel: t("home.f.listMoreLabel"),
  listMoreHref: t("home.f.listMoreHref"),
  latestLabel: t("home.f.latestLabel"),
  footNote: t("home.f.footNote"),
  footMark: t("home.f.footMark"),
  asideImage: t("home.f.asideImage"),
  asideImageAlt: t("home.f.asideImageAlt"),
  asideHref: t("home.f.asideHref")
};

/** Render order per section. Anything unlisted follows, alphabetically. */
const FIELD_ORDER: Record<string, string[]> = {
  hero: ["eyebrow", "title", "body", "image", "imageAlt", "video", "gallery", "actions"],
  registry: [
    "eyebrow",
    "count",
    "countLabel",
    "liveLabel",
    "streamHeading",
    "feedCount",
    "asideImage",
    "asideImageAlt",
    "asideHref",
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
/** Hero 描述的上限：超过这个长度，首页的卡片放不下，手机上会被截断。 */
const HERO_BODY_MAX = 120;

const IMAGE_FIELDS = new Set(["image", "poster", "backgroundImage", "asideImage"]);

/** Fields that get a purpose-built editor rather than a JSON textarea. */
const STRUCTURED = new Set(["gallery", "video", "actions"]);

const MEDIA_FIELDS = new Set(["image", "imageAlt", "gallery", "video", "asideImage", "asideImageAlt"]);
const LINK_FIELDS = new Set([
  "actions",
  "moreLabel",
  "moreHref",
  "buttonLabel",
  "buttonHref",
  "listMoreLabel",
  "listMoreHref",
  "asideHref"
]);

/**
 * Per-field editors for the news and media sections.
 *
 * These lists used to be raw JSON textareas, which made the images
 * uneditable in practice -- an operator had to paste a URL into a string
 * inside a blob. Keyed `<section>.<field>` because the field names repeat
 * across sections (`items`, `cards`) with different shapes.
 */
/**
 * Numeric section settings, keyed `<section>.<field>`. Without this they fall
 * to the JSON textarea, where a count reads as a data structure rather than the
 * dial it is. Ranges mirror what `resolveHomeContent` clamps to.
 */
const NUMBER_FIELDS: Record<string, { label: string; min: number; max: number; hint?: string }> = {
  "registry.feedCount": {
    label: t("home.l.feedCount"),
    min: 1,
    max: 20,
    hint: t("home.l.feedCountHint")
  }
};

/**
 * Section fields that hold a plain list of strings, keyed `<section>.<field>`.
 * One per line beats a JSON array of quoted strings for something like a list
 * of city names.
 */
const STRING_LIST_FIELDS: Record<string, { label: string; hint?: string }> = {
  "network.cities": { label: t("home.l.cities"), hint: t("home.l.citiesHint") }
};

const OBJECT_EDITORS: Record<string, ObjectEditorSpec> = {
  // Poster, title, summary, play link, duration and tags come from the video
  // the band is featuring; the secondary button follows that film's own series.
  // What is left is the wording around it.
  "video.featured": {
    label: t("home.l.featured"),
    fields: [
      { key: "tag", label: t("home.l.featuredTag") },
      { key: "primaryLabel", label: t("home.l.primaryLabel") }
    ]
  },
  // Image, title, summary, date and link come from the article the band is
  // leading with. What is left is the wording around it.
  "news.lead": {
    label: t("home.l.lead"),
    fields: [
      { key: "tag", label: t("home.l.leadTag") },
      { key: "kicker", label: t("home.l.kicker") }
    ]
  }
};

const ROW_EDITORS: Record<string, RowEditorSpec> = {
  "news.items": {
    label: t("home.l.latest"),
    blank: { title: "", date: "", href: "/news", image: "" },
    fields: [
      { key: "image", label: t("home.f.image"), kind: "image" },
      { key: "title", label: t("home.f.title"), kind: "area" },
      { key: "date", label: t("home.l.date") },
      { key: "href", label: t("home.l.href") }
    ]
  },
  "channels.cards": {
    label: t("home.l.channels"),
    blank: {
      title: "",
      en: "",
      leadTitle: "",
      leadHref: "/news",
      image: "",
      badge: "",
      footLabel: "",
      // Empty, not "/news": a new card should take its own column's page.
      footHref: ""
    },
    // 栏目名称 decides which news category a card follows. When it matches
    // one, that column's newest article supplies the picture and the 导读, and
    // whatever is typed in those three fields below is replaced at render
    // time. When it does not -- 九评共产党 points at the films, not at a news
    // category -- nothing replaces them, and they are the only way to give the
    // card a picture and a headline at all. They were not editable here, which
    // left such a card permanently stuck with whatever it was created with.
    //
    // 底部链接地址 is the same story: it used to fill itself in and then had no
    // way to be corrected. Left empty it still fills itself in, so nobody has
    // to know the slug of their own column.
    fields: [
      { key: "title", label: t("home.l.channelName") },
      { key: "en", label: t("home.l.latinLabel") },
      {
        key: "image",
        label: t("home.f.image"),
        kind: "image",
        hint: t("home.l.channelImageHint")
      },
      { key: "leadTitle", label: t("home.l.leadTitle"), kind: "area", hint: t("home.l.sameAsAbove") },
      { key: "leadHref", label: t("home.l.leadHref"), hint: t("home.l.sameAsAbove") },
      { key: "footLabel", label: t("home.l.footLabel") },
      {
        key: "footHref",
        label: t("home.l.footHref"),
        hint: t("home.l.footHrefHint")
      }
    ]
  },
  "video.items": {
    label: t("home.l.videos"),
    blank: { title: "", meta: "", href: "/videos", image: "", duration: "", badge: "" },
    fields: [
      { key: "image", label: t("home.l.thumbnail"), kind: "image" },
      { key: "title", label: t("home.f.title"), kind: "area" },
      { key: "meta", label: t("home.l.meta") },
      { key: "href", label: t("home.l.href") },
      { key: "duration", label: t("home.l.duration") },
      { key: "badge", label: t("home.l.badge") }
    ]
  },
  "registry.substats": {
    label: t("home.l.subStats"),
    blank: { value: "", label: "" },
    fields: [
      { key: "value", label: t("home.l.value") },
      { key: "label", label: t("home.l.label") }
    ]
  },
  "services.cards": {
    label: t("home.l.serviceCards"),
    blank: { tag: "", title: "", body: "", links: [], ctaLabel: "", ctaHref: "" },
    fields: [
      { key: "tag", label: t("home.l.tag") },
      { key: "title", label: t("home.f.title"), kind: "area" },
      { key: "body", label: t("home.l.bodyText"), kind: "area" },
      { key: "links", label: t("home.l.links"), kind: "links" },
      { key: "ctaLabel", label: t("home.l.ctaLabelOptional") },
      { key: "ctaHref", label: t("home.l.ctaHref") }
    ]
  },
  "about.cells": {
    label: t("home.l.facts"),
    blank: { heading: "", value: "", body: "" },
    fields: [
      { key: "value", label: t("home.l.figure") },
      { key: "heading", label: t("home.l.leadLine") },
      { key: "body", label: t("home.l.bodyText"), kind: "area" },
      { key: "bars", label: t("home.l.bars"), kind: "bars" }
    ]
  },
  "involve.items": {
    label: t("home.l.waysToJoin"),
    blank: { title: "", body: "", href: "#", ctaLabel: "", glyph: "" },
    fields: [
      { key: "title", label: t("home.f.title") },
      { key: "body", label: t("home.l.bodyText"), kind: "area" },
      { key: "href", label: t("home.l.href") },
      { key: "ctaLabel", label: t("home.l.ctaLabelFallback") },
      { key: "glyph", label: t("home.l.glyph") },
      { key: "primary", label: t("home.l.primaryCard"), kind: "flag" }
    ]
  },
  "resources.items": {
    label: t("home.l.resources"),
    blank: { label: "", tag: "", href: "#" },
    fields: [
      { key: "label", label: t("home.l.name") },
      { key: "tag", label: t("home.l.tag") },
      { key: "href", label: t("home.l.href") }
    ]
  },
  "voices.items": {
    label: t("home.l.voices"),
    blank: { quote: "", name: "", role: "", image: "" },
    fields: [
      { key: "image", label: t("home.l.portrait"), kind: "image" },
      { key: "quote", label: t("home.l.quote"), kind: "area" },
      { key: "name", label: t("home.l.personName") },
      { key: "role", label: t("home.l.role"), kind: "area" }
    ]
  },
  "video.series": {
    label: t("home.l.series"),
    blank: { label: "", href: "/videos" },
    fields: [
      { key: "label", label: t("home.l.name") },
      { key: "href", label: t("home.l.href") },
      { key: "active", label: t("home.l.active"), kind: "flag" }
    ]
  }
};

/**
 * Fields the homepage now fills from the database, so the admin must not offer
 * them: editing one changes nothing, which is worse than not having it.
 *
 * The values stay in the stored JSON -- they are simply not rendered -- so
 * nothing is destroyed by hiding them, and the section's own headings and
 * labels remain editable as before.
 */
const AUTO_FILLED: Record<string, Set<string>> = {
  // The three 最新发布 rows: see getHomeNews(). `lead` stays, trimmed to the
  // two labels that are still the editor's -- see FIELD_SPECS above.
  news: new Set(["items"]),
  // The four 最新上线 cards: see getHomeVideo(). `featured` stays, trimmed.
  video: new Set(["items"])
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

/**
 * Two sections are absorbed by another section's variant: 「曙光」 pulls
 * 我们的服务 into 实时登记册, and 「报刊头版」 pulls 栏目卡片 into 新闻与报告.
 * Their content still renders, but their own 版式 choice stops mattering --
 * which is invisible from inside the absorbed section without saying so.
 */
function couplingNote(sectionKey: string, data: Record<string, unknown>): string | null {
  const variantOf = (key: string) => String(asRow(data[key]).variant ?? "");
  if (sectionKey === "channels" && variantOf("news") === "broadsheet") {
    return t("home.absorb.channelsIntoNews");
  }
  if (
    (sectionKey === "services" || sectionKey === "voices") &&
    variantOf("registry") === "dawn"
  ) {
    return t("home.absorb.servicesIntoRegistry");
  }
  if (sectionKey === "registry" && variantOf("registry") === "dawn") {
    return t("home.absorb.registryDawn");
  }
  if (sectionKey === "involve" && variantOf("about") === "verified") {
    return t("home.absorb.involveIntoAbout");
  }
  if (sectionKey === "about" && variantOf("about") === "verified") {
    return t("home.absorb.aboutVerifiable");
  }
  if (sectionKey === "news" && variantOf("news") === "broadsheet") {
    return t("home.absorb.newsFrontPage");
  }
  if (sectionKey === "channels") {
    return t("home.absorb.channelsAuto");
  }
  if (sectionKey === "video") {
    return t("home.absorb.videoAuto");
  }
  return null;
}

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
  const { imageField, recordFields, rowsEditor } = createFieldRenderers({
    updateField,
    onPickImage
  });

  const galleryEditor = (sectionKey: string, label: string, items: Record<string, unknown>[]) => (
    <div style={{ display: "grid", gap: 10 }}>
      {items.length === 0 ? <p style={{ margin: 0, color: "#777", fontSize: 13 }}>{t("home.gallery.empty")}</p> : null}
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
              onClick={() => onPickImage([sectionKey, "gallery", String(index), "src"], t("home.gallery.nth", { label, n: index + 1 }))}
              style={{ padding: 0, border: "1px solid #ececec", background: "none", cursor: "pointer", lineHeight: 0 }}
              title={t("home.gallery.replace")}
            >
              {String(item.src ?? "") ? (
                <img
                  src={String(item.src)}
                  alt=""
                  style={{ width: 90, height: 68, objectFit: "cover", display: "block" }}
                />
              ) : (
                <span style={{ display: "grid", placeItems: "center", width: 90, height: 68, fontSize: 12, color: "#999" }}>
                  {t("home.gallery.unset")}
                </span>
              )}
            </button>
            <button
              className="admin-btn"
              type="button"
              style={{ padding: "2px 6px", fontSize: 12 }}
              onClick={() => onPickImage([sectionKey, "gallery", String(index), "src"], t("home.gallery.nth", { label, n: index + 1 }))}
            >
              {t("home.gallery.pick")}
            </button>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <input
              className="admin-input"
              value={String(item.alt ?? "")}
              placeholder={t("home.gallery.altPlaceholder")}
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
              {t("home.gallery.remove")}
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
          {t("home.gallery.add")}
        </button>
      </div>
    </div>
  );

  const videoEditor = (sectionKey: string, label: string, video: Record<string, unknown>) => {
    // 卡片叠加 plays the video by itself as the backdrop; every other layout waits
    // for a click. The two behave so differently -- one spends the reader's data
    // the moment the page opens -- that the editor has to say which one is in
    // force rather than describe only the click-to-play case.
    const backdrop =
      sectionKey === "hero" && String(asRow(data[sectionKey]).variant ?? "") === "full-bleed-video";
    const src = String(video.src ?? "").trim();
    const hasSrc = src.length > 0;
    // The backdrop is a real <video> element, which can only play a file. A
    // YouTube or Vimeo page is not a file: it would fail silently and the hero
    // would quietly show the poster instead, leaving the editor to wonder why
    // the video they pasted never appears. 左文右视频 embeds such a link fine --
    // this restriction is the backdrop's alone.
    const needsFile = backdrop && hasSrc && !/\.(mp4|webm|ogg|ogv|mov)(\?.*)?$/i.test(src);
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <label style={{ display: "block" }}>
          {t("home.video.url")}
          {/* The address is long and the editor has to be able to read it to
              tell a working link from a broken one, so the box takes the full
              width of the panel rather than sitting inline after the label. */}
          <input
            className="admin-input"
            style={{
              fontFamily: "ui-monospace, Menlo, monospace",
              fontSize: 12,
              display: "block",
              width: "100%",
              marginTop: 4
            }}
            value={String(video.src ?? "")}
            placeholder={backdrop ? t("home.video.urlPlaceholderBackdrop") : t("home.video.urlPlaceholder")}
            onChange={(event) => updateField([sectionKey, "video", "src"], event.target.value)}
          />
        </label>
        <VideoUploadField
          folder="home"
          onUploaded={(url) => updateField([sectionKey, "video", "src"], url)}
        />
        {/* 只有满幅背景讲究比例 —— 别的版式把视频放进一个固定的框里，裁不裁
            由那个框说了算，和首屏不是一回事。 */}
        {backdrop && hasSrc && !needsFile ? (
          <VideoRatioHint src={src} target={HERO_RATIO} targetLabel={t("home.video.heroRatio")} />
        ) : null}
        {backdrop ? (
          <div style={{ display: "grid", gap: 8 }}>
            <label style={{ display: "block" }}>
              {t("home.video.mobileUrl")}
              <input
                className="admin-input"
                style={{
                  fontFamily: "ui-monospace, Menlo, monospace",
                  fontSize: 12,
                  display: "block",
                  width: "100%",
                  marginTop: 4
                }}
                value={String(video.srcMobile ?? "")}
                placeholder={t("home.video.mobilePlaceholder")}
                onChange={(event) => updateField([sectionKey, "video", "srcMobile"], event.target.value)}
              />
            </label>
            <VideoUploadField
              folder="home"
              onUploaded={(url) => updateField([sectionKey, "video", "srcMobile"], url)}
            />
            <p style={{ margin: 0, color: "#777", fontSize: 12, lineHeight: 1.7 }}>
              {tRich("home.video.mobileHint", {
                pct: <strong>{t("home.video.mobileHintPct")}</strong>,
                square: <strong>{t("home.video.mobileHintSquare")}</strong>
              })}
              <span style={{ display: "block", marginTop: 6 }}>
                {tRich("home.video.mobileWarn", {
                  dontFill: <strong>{t("home.video.mobileWarnDontFill")}</strong>
                })}
              </span>
            </p>
            {String(video.srcMobile ?? "").trim() ? (
              <VideoRatioHint
                src={String(video.srcMobile ?? "")}
                target={HERO_MOBILE_RATIO}
                targetLabel={t("home.video.squareTarget")}
              />
            ) : null}
          </div>
        ) : null}
        <div>
          <span style={fieldCaption}>{t("home.video.poster")}</span>
          {imageField([sectionKey, "video", "poster"], t("home.video.posterLabel", { label }), String(video.poster ?? ""))}
        </div>
        <label>
          {t("home.video.caption")}
          <input
            className="admin-input"
            value={String(video.caption ?? "")}
            onChange={(event) => updateField([sectionKey, "video", "caption"], event.target.value)}
          />
        </label>
        {needsFile ? (
          <p
            style={{
              margin: 0,
              padding: "9px 11px",
              borderRadius: 6,
              background: "#fdf2f2",
              border: "1px solid #e9b8b8",
              color: "#8a2b2b",
              fontSize: 12,
              lineHeight: 1.7
            }}
          >
            {tRich("home.video.notBackdrop", {
              direct: <strong>{t("home.video.notBackdropDirect")}</strong>
            })}
          </p>
        ) : null}
        {backdrop && hasSrc && !needsFile ? (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.7 }}>
            <input
              type="checkbox"
              checked={Boolean(video.hasAudio)}
              onChange={(event) => updateField([sectionKey, "video", "hasAudio"], event.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              {t("home.video.hasSound")}
              <span style={{ display: "block", color: "#777", fontSize: 12 }}>
                {t("home.video.hasSoundHint")}
              </span>
            </span>
          </label>
        ) : null}
        {/* Only meaningful once the file is known to have sound. */}
        {backdrop && hasSrc && !needsFile && video.hasAudio ? (
          <label style={{ display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.7 }}>
            <input
              type="checkbox"
              checked={Boolean(video.soundOn)}
              onChange={(event) => updateField([sectionKey, "video", "soundOn"], event.target.checked)}
              style={{ marginTop: 4 }}
            />
            <span>
              {t("home.video.soundOnLoad")}
              <span style={{ display: "block", color: "#777", fontSize: 12, marginTop: 2 }}>
                {tRich("home.video.soundOnLoadHint", {
                  wins: <strong>{t("home.video.soundOnLoadWins")}</strong>
                })}
              </span>
            </span>
          </label>
        ) : null}
        <p style={{ margin: 0, color: "#777", fontSize: 12, lineHeight: 1.7 }}>
          {backdrop
            ? t("home.video.autoplayNote")
            : t("home.video.clickNote")}
        </p>
      </div>
    );
  };

  const actionsEditor = (sectionKey: string, items: Record<string, unknown>[]) => (
    <div style={{ display: "grid", gap: 8 }}>
      {/* The rows are three unlabelled boxes once they hold text; the header
          says which is which without repeating a caption per row. */}
      {items.length > 0 ? (
        <div style={{ ...columnHead, gridTemplateColumns: "1fr 1.4fr 120px auto" }}>
          <span>{t("home.cta.label")}</span>
          <span>{t("home.cta.href")}</span>
          <span>{t("home.cta.style")}</span>
          <span />
        </div>
      ) : null}
      {items.map((item, index) => (
        <div
          key={index}
          style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr 120px auto", gap: 8, alignItems: "center" }}
        >
          <input
            className="admin-input"
            value={String(item.label ?? "")}
            placeholder={t("home.cta.labelPlaceholder")}
            onChange={(event) => updateField([sectionKey, "actions", String(index), "label"], event.target.value)}
          />
          <input
            className="admin-input"
            style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12 }}
            value={String(item.href ?? "")}
            placeholder={t("home.cta.hrefPlaceholder")}
            onChange={(event) => updateField([sectionKey, "actions", String(index), "href"], event.target.value)}
          />
          <select
            className="admin-select"
            value={String(item.variant ?? "seal")}
            onChange={(event) => updateField([sectionKey, "actions", String(index), "variant"], event.target.value)}
          >
            <option value="seal">{t("home.cta.primary")}</option>
            <option value="line-light">{t("home.cta.secondary")}</option>
          </select>
          <button
            className="admin-btn"
            type="button"
            onClick={() => updateField([sectionKey, "actions"], items.filter((_, i) => i !== index))}
          >
            {t("home.cta.remove")}
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
          {t("home.cta.add")}
        </button>
      </div>
    </div>
  );

  /** One record's fields, used for both `news.lead` and each list row. */


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
    <div className="home-sections" style={{ display: "contents" }}>
      <p style={{ margin: 0, color: "#666" }}>
        {t("home.intro")}
      </p>

      {HOME_SECTIONS.map((section) => {
        const value = asRow(data[section.key]);
        const variants = HOME_SECTION_VARIANTS[section.key as keyof typeof HOME_SECTION_VARIANTS] ?? [];
        const enabled = value.enabled !== false;

        const autoFilled = AUTO_FILLED[section.key];
        const keys = orderFields(
          section.key,
          Object.keys(value).filter(
            (k) => k !== "enabled" && k !== "variant" && !autoFilled?.has(k)
          )
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

        const renderText = (key: string) => {
          if (IMAGE_FIELDS.has(key)) {
            return (
              <div key={key}>
                <span style={fieldCaption}>{FIELD_LABELS[key] ?? key}</span>
                {imageField([section.key, key], `${section.label} · ${FIELD_LABELS[key] ?? key}`, String(value[key] ?? ""))}
              </div>
            );
          }
          const text = String(value[key] ?? "");
          /* Only the hero's own body is capped. It sits in a card over the
             photograph, and past ~120 characters the card either swallows the
             picture or the sentence is clamped mid-word on a phone -- the
             reader never reaches the end either way. Other sections set their
             text in open page width and have no such ceiling. */
          const capped = section.key === "hero" && key === "body";
          const over = capped ? text.length - HERO_BODY_MAX : 0;
          return (
            <label key={key}>
              {FIELD_LABELS[key] ?? key}
              <textarea
                className="admin-textarea"
                style={{ minHeight: key === "body" || key === "lede" ? 84 : 46 }}
                /* Never shorter than what is already saved: silently cutting an
                   editor's existing sentence is worse than showing them it is
                   long and letting them trim it. */
                maxLength={capped ? Math.max(HERO_BODY_MAX, text.length) : undefined}
                value={text}
                onChange={(event) => updateField([section.key, key], event.target.value)}
              />
              {capped ? (
                <span style={{ color: over > 0 ? "#b42318" : "#777", fontSize: 12 }}>
                  {t("home.charCount", { n: text.length, max: HERO_BODY_MAX })}
                  {over > 0 ? t("home.charOver", { n: over }) : ""}
                </span>
              ) : null}
            </label>
          );
        };

        return (
          <details
            key={section.key}
            style={{ border: "1px solid #ececec", borderRadius: 4, padding: "10px 12px" }}
          >
            <summary style={{ cursor: "pointer", fontWeight: 600 }}>
              {section.label}
              {!enabled ? <span style={{ color: "#b42318" }}>{t("home.hidden")}</span> : null}
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
                  {t("home.show")}
                </label>
                {variants.length > 0 ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {t("home.layout")}
                    <select
                      className="admin-select"
                      value={String(value.variant ?? variants[0])}
                      onChange={(event) => updateField([section.key, "variant"], event.target.value)}
                    >
                      {/* 名字按「区块 + 取值」查文案表 —— schema 包只给取值。 */}
                      {variants.map((variant) => (
                        <option key={variant} value={variant}>
                          {t(`home.variant.${section.key}.${variant}`)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>

              {textBlock.length > 0 || numberKeys.length > 0 || listKeys.length > 0 ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>{t("home.group.text")}</legend>
                  {textBlock.map(renderText)}
                  {numberKeys.map(renderNumber)}
                  {listKeys.map(renderStringList)}
                </fieldset>
              ) : null}

              {linkText.length > 0 || structuredKeys.includes("actions") ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>{t("home.group.ctas")}</legend>
                  {linkText.map(renderText)}
                  {structuredKeys.includes("actions")
                    ? actionsEditor(section.key, asRows(value.actions))
                    : null}
                </fieldset>
              ) : null}

              {mediaText.length > 0 || structuredKeys.some((k) => k === "gallery" || k === "video") ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>{t("home.group.media")}</legend>
                  {mediaText.map(renderText)}
                  {/* Video sits above the gallery: card overlay -- photo or
                      video -- is the hero this site actually runs, and the
                      gallery is the rare one. The common field should not be
                      below four rows of thumbnails. */}
                  {structuredKeys.includes("video") ? (
                    <div>
                      <span style={fieldCaption}>{t("home.group.video")}</span>
                      {videoEditor(section.key, section.label, asRow(value.video))}
                    </div>
                  ) : null}
                  {structuredKeys.includes("gallery") ? (
                    <div>
                      <span style={fieldCaption}>{t("home.group.gallery")}</span>
                      {galleryEditor(section.key, section.label, asRows(value.gallery))}
                    </div>
                  ) : null}
                </fieldset>
              ) : null}

              {richKeys.length > 0 ? (
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>{t("home.group.items")}</legend>
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
                <fieldset style={fieldsetStyle}>
                  <legend style={legendStyle}>{t("home.group.json")}</legend>
                  {jsonKeys.map((key) => jsonField(section.key, key, value[key]))}
                </fieldset>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
