"use client";

import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { formatTime } from "@/lib/format";
import { isGanjingWatchUrl, isVimeoWatchUrl, toEmbedUrl } from "@/lib/video-host";
import { GanjingEmbedNotice } from "./GanjingEmbedNotice";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { warmPages } from "@/lib/admin/warm-pages";
import { requestSlug, retargetSlugDate, useAutoSlug } from "./use-auto-slug";

/**
 * The single video form, used for both creating and editing.
 *
 * Posts to a plain form endpoint so it still works without JavaScript; the only
 * pieces that need JS are the image picker and the player preview.
 *
 * Unlike the article form this one leads with the player address, because most
 * of what a video needs can be read off the platform once that is known.
 */

export interface VideoFormValues {
  id?: string;
  slug: string;
  title: string;
  episode: string;
  description: string;
  bodyMarkdown: string;
  sourceUrl: string;
  backupUrl: string;
  coverImage: string;
  coverImageAlt: string;
  speaker: string;
  sourceCredit: string;
  legacyUrl: string;
  status: string;
  publishedAt: string | null;
  category: string;
  featured: boolean;
  editorArchive: boolean;
}

interface VideoFormProps {
  initial: VideoFormValues;
  categories: { name: string; slug: string }[];
  mode: "new" | "edit";
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`, not an ISO string with a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/*
 * The preview uses the same converter as the public page.
 *
 * It used to have its own copy that handled YouTube only, so a 干净世界 /video/
 * address -- the one you get by copying the browser bar -- previewed as a blank
 * black box here while playing correctly on the site. A preview that disagrees
 * with the page is worse than no preview.
 */
export { toEmbedUrl as toEmbed };

const STATUS_LABEL: Record<string, string> = {
  published: t("admin.status.published"),
  draft: t("admin.status.draft"),
  archived: t("admin.status.archived")
};

function platformOf(url: string): string {
  if (!url.trim()) return "";
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/ganjing/i.test(url)) return t("admin.vid.host.ganjing");
  if (/vimeo/i.test(url)) return "Vimeo";
  if (/\.mp4(\?|$)/i.test(url)) return t("admin.vid.host.file");
  return t("admin.vid.host.other");
}

export function VideoForm({ initial, categories, mode }: VideoFormProps) {
  const [value, setValue] = useState<VideoFormValues>(initial);
  const [picker, setPicker] = useState<null | "cover" | "body">(null);
  // Lets the picker drop its image where the caret is, not at the end.
  const editor = useRef<MarkdownEditorHandle>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ at: string; status: string } | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  /**
   * Saves without leaving the page.
   *
   * It used to post the form and land on the video list, which threw away
   * whatever the editor was in the middle of. Same change the article form got.
   */
  const save = async (status: string) => {
    const form = formRef.current;
    if (!form) return;
    if (!check(status)) return;
    setSaving(true);
    setSaved(null);
    setError("");
    try {
      const body = new FormData(form);
      body.set("status", status);
      const response = await fetch(form.action, {
        method: "POST",
        headers: { accept: "application/json" },
        body
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string; id?: string; warm?: string[] };
      if (!response.ok || !payload.ok) {
        setError(payload.error || t("admin.save.failed"));
        return;
      }
      setSaved({ at: formatTime(new Date()), status });
      /* Build the pages this video appears on now, so the editor's own click
         through to the public page is a hit rather than a full render. */
      warmPages(payload.warm ?? []);
      setValue((prev) => ({ ...prev, status }));
      // A new video becomes the video being edited, so the next save updates it
      // rather than refusing the slug as already taken.
      if (!value.id && payload.id) {
        setValue((prev) => ({ ...prev, id: payload.id }));
        setSlugTouched(true);
        window.history.replaceState(null, "", `/admin/videos/${payload.id}`);
      }
    } catch {
      setError(t("admin.form.saveFailedOffline"));
    } finally {
      setSaving(false);
    }
  };

  /** Drafts 简介 from the transcript; the editor keeps or edits it. */
  const generateSummary = async () => {
    setAiBusy(true);
    setAiError("");
    try {
      const response = await fetch("/api/admin/content/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: value.title, body: value.bodyMarkdown })
      });
      const data = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || t("admin.form.aiFailed"));
      set("description", data.summary);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("admin.form.aiFailed"));
    } finally {
      setAiBusy(false);
    }
  };
  // Same slug behaviour as articles: date prefix on by default, and a clash
  // shown while typing rather than refused after 保存.
  const [datePrefix, setDatePrefix] = useState(true);
  const [slugCheck, setSlugCheck] = useState<{ available: boolean; takenBy?: string; suggestion: string } | null>(null);
  // The slug follows the title until it has been edited by hand, exactly as the
  // article form does. Without this the field simply stayed empty unless the
  // editor thought to press 由标题生成.
  const [slugTouched, setSlugTouched] = useState(mode === "edit");

  useEffect(() => {
    try {
      setDatePrefix(window.localStorage.getItem("quitccp.slugDatePrefix") !== "0");
    } catch {
      // Private browsing refuses storage; the default stands.
    }
  }, []);

  /* 和文章页同一套：标题转拼音、日期前缀用这一支自己的发布时间、地址生成
     一次之后不再跟着标题走。理由写在 ArticleForm 里那一段。 */
  useAutoSlug(
    value.title,
    { enabled: !slugTouched && mode !== "edit", withDate: datePrefix, at: value.publishedAt || null },
    (slug) => set("slug", slug)
  );

  useEffect(() => {
    const slug = value.slug.trim();
    if (!slug) {
      setSlugCheck(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug });
        if (value.id) params.set("id", value.id);
        const response = await fetch(`/api/admin/content/videos/slug?${params}`);
        if (response.ok) setSlugCheck(await response.json());
      } catch {
        // A failed check must not block editing; save refuses a clash anyway.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [value.slug, value.id]);
  /*
   * Fetches the cover the platform already holds for this film. See
   * lib/admin/video-cover-source.ts for why this is worth doing at all, and why
   * the picture is copied into our own storage rather than hot-linked.
   */
  const [coverBusy, setCoverBusy] = useState(false);
  const [coverNote, setCoverNote] = useState("");
  const fetchCover = async () => {
    const sourceUrl = value.sourceUrl.trim() || value.backupUrl.trim();
    if (!sourceUrl) {
      setCoverNote(t("admin.vidform.coverNeedsSource"));
      return;
    }
    setCoverBusy(true);
    setCoverNote("");
    try {
      const response = await fetch("/api/admin/content/videos/cover-from-source", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceUrl })
      });
      const payload = (await response.json()) as { ok?: boolean; url?: string; reason?: string; error?: string };
      if (payload.ok && payload.url) {
        set("coverImage", payload.url);
        setCoverNote(t("admin.vidform.coverGot"));
        return;
      }
      setCoverNote(payload.reason || payload.error || t("admin.vidform.coverMissed"));
    } catch {
      setCoverNote(t("admin.vidform.coverFailed"));
    } finally {
      setCoverBusy(false);
    }
  };

  const [error, setError] = useState("");

  const set = <K extends keyof VideoFormValues>(key: K, next: VideoFormValues[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const embed = toEmbedUrl(value.sourceUrl);
  const isFile = /\.mp4(\?|$)/i.test(value.sourceUrl);
  /* Flagged rather than rewritten under the editor's hands; 改成 /embed/ does it. */
  const ganjingWatch = isGanjingWatchUrl(value.sourceUrl) || isVimeoWatchUrl(value.sourceUrl);
  const backupGanjingWatch = isGanjingWatchUrl(value.backupUrl) || isVimeoWatchUrl(value.backupUrl);

  /**
   * Same order as the article form: stop at the first thing that is missing
   * rather than listing every complaint at once.
   */
  const check = (status: string) => {
    const complaint = !value.title.trim()
      ? t("admin.vidform.needTitle")
      : !value.slug.trim()
        ? t("admin.vidform.needSlug")
        : !value.category.trim()
          ? t("admin.vidform.needCategory")
          : value.coverImageAlt.trim() && !value.coverImage.trim()
            ? t("admin.vidform.altWithoutCover")
            : /*
               * A film with no cover is skipped by the homepage band entirely --
               * that query only lists films that have one -- and shows as a flat
               * grey rectangle in every card grid. Nothing in the admin said so,
               * so editors published films that silently never reached the home
               * page.
               *
               * Only on publish, and only when there is a film to take a cover
               * from: the 174 text-only episodes carried over from the old site
               * have no player and no thumbnail to fetch, and refusing to
               * publish those would be refusing to publish something correct.
               */
              status === "published" && value.sourceUrl.trim() && !value.coverImage.trim()
              ? t("admin.vidform.needCover")
              : "";
    if (complaint) {
      setError(complaint);
      return false;
    }
    setError("");
    return true;
  };

  /** Only reached without JavaScript; the buttons save over fetch. */
  const validate = (event: React.FormEvent<HTMLFormElement>) => {
    if (!check(value.status)) {
      event.preventDefault();
      return false;
    }
    return true;
  };

  return (
    <form ref={formRef} method="post" action="/api/admin/content/videos/save" onSubmit={validate}>
      {value.id ? <input type="hidden" name="id" value={value.id} /> : null}
      {/* Checkboxes outside a form post nothing when unchecked; these carry the
          two flags explicitly so "unticked" is saved as false. */}
      {value.featured ? <input type="hidden" name="featured" value="1" /> : null}
      {value.editorArchive ? <input type="hidden" name="editorArchive" value="1" /> : null}

      {error ? (
        <section className="admin-card" style={{ background: "#fdf1f0", borderColor: "#f2c9c4" }}>
          <strong style={{ color: "#b42318" }}>{error}</strong>
        </section>
      ) : null}

      <div className="article-form">
        <div>
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.vidform.sourcePanel")}</h3>
            <div className="field">
              <label htmlFor="sourceUrl">{t("admin.vidform.sourceUrl")}</label>
              <input
                className="admin-input"
                id="sourceUrl"
                name="sourceUrl"
                value={value.sourceUrl}
                onChange={(event) => set("sourceUrl", event.target.value)}
                placeholder={t("admin.vidform.sourcePlaceholder")}
                style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
              />
              <span className="hint">
                {t("admin.vidform.sourceHint")}
                {value.sourceUrl
                  ? t("admin.vidform.recognisedAs", { host: platformOf(value.sourceUrl) })
                  : ""}
              </span>
              {ganjingWatch ? (
                <GanjingEmbedNotice
                  url={value.sourceUrl}
                  onFix={() => set("sourceUrl", toEmbedUrl(value.sourceUrl))}
                />
              ) : null}
            </div>

            {embed ? (
              <div style={{ maxWidth: 480, marginBottom: 12 }}>
                {isFile ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={embed} controls style={{ width: "100%", borderRadius: 4, background: "#111" }} />
                ) : (
                  <iframe
                    src={embed}
                    title={t("admin.preview")}
                    allowFullScreen
                    style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 4, background: "#111" }}
                  />
                )}
              </div>
            ) : (
              <p className="muted" style={{ margin: "0 0 12px" }}>
                {t("admin.vidform.noSourceOk")}
              </p>
            )}

            <div className="field">
              <label htmlFor="backupUrl">{t("admin.vidform.backupUrl")}</label>
              <input
                className="admin-input"
                id="backupUrl"
                name="backupUrl"
                value={value.backupUrl}
                onChange={(event) => set("backupUrl", event.target.value)}
                placeholder={t("admin.vidform.backupPlaceholder")}
                style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
              />
              <span className="hint">
                {tRich("admin.vidform.backupHint", { embed: <code>/embed/</code> })}
              </span>
              {backupGanjingWatch ? (
                <GanjingEmbedNotice
                  url={value.backupUrl}
                  onFix={() => set("backupUrl", toEmbedUrl(value.backupUrl))}
                />
              ) : null}
            </div>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.vidform.basicPanel")}</h3>
            <div className="field">
              <label htmlFor="title">
                {t("admin.vidform.title")}
                <span className="req">{t("admin.form.required")}</span>
              </label>
              <input
                className="admin-input"
                id="title"
                name="title"
                value={value.title}
                onChange={(event) => set("title", event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="episode">{t("admin.vidform.episode")}</label>
              <input
                className="admin-input"
                id="episode"
                name="episode"
                value={value.episode}
                onChange={(event) => set("episode", event.target.value)}
                placeholder={t("admin.vidform.episodePlaceholder")}
                style={{ maxWidth: 220 }}
              />
            </div>

            <div className="field">
              <label htmlFor="slug">
                {t("admin.form.slug")}
                <span className="req">{t("admin.form.required")}</span>
              </label>
              <div className="row">
                <input
                  className="admin-input"
                  id="slug"
                  name="slug"
                  value={value.slug}
                  onChange={(event) => {
                    setSlugTouched(true);
                    set("slug", event.target.value);
                  }}
                  style={{ flex: 1, fontFamily: "ui-monospace, Menlo, monospace" }}
                />
                <button
                  className="admin-btn admin-btn-sm"
                  type="button"
                  onClick={async () => {
                    setSlugTouched(true);
                    try {
                      set("slug", await requestSlug(value.title, { withDate: datePrefix, at: value.publishedAt || null }));
                    } catch {
                      /* 取不到就不动 —— 把地址清空比保留旧的更糟。 */
                    }
                  }}
                >
                  {t("admin.vidform.regenSlug")}
                </button>
              </div>
              <div className="row" style={{ marginTop: 6, alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={datePrefix}
                    onChange={(event) => {
                      setDatePrefix(event.target.checked);
                      try {
                        window.localStorage.setItem(
                          "quitccp.slugDatePrefix",
                          event.target.checked ? "1" : "0"
                        );
                      } catch {
                        // Not remembering the choice is not an error.
                      }
                    }}
                  />
                  {t("admin.form.datePrefix")}
                </label>
                {slugCheck && !slugCheck.available ? (
                  <button
                    className="admin-btn admin-btn-sm"
                    type="button"
                    onClick={() => set("slug", slugCheck.suggestion)}
                  >
                    {t("admin.form.useSuggestion", { slug: slugCheck.suggestion.slice(-18) })}
                  </button>
                ) : null}
              </div>
              {slugCheck && !slugCheck.available ? (
                <span className="hint" style={{ color: "#b42318" }}>
                  {t("admin.form.slugTaken", { title: slugCheck.takenBy ?? "" })}
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="speaker">{t("admin.vidform.speaker")}</label>
              <input
                className="admin-input"
                id="speaker"
                name="speaker"
                value={value.speaker}
                onChange={(event) => set("speaker", event.target.value)}
                placeholder={t("admin.vidform.speakerPlaceholder")}
              />
            </div>

            <div className="field">
              <span className="cap">{t("admin.vidform.body")}</span>
              <input type="hidden" name="bodyMarkdown" value={value.bodyMarkdown} />
              <MarkdownEditor
                ref={editor}
                value={value.bodyMarkdown}
                onChange={(next) => set("bodyMarkdown", next)}
                onPickImage={() => setPicker("body")}
              />
              <span className="hint">
                {t("admin.vidform.bodyHint")}
              </span>
            </div>
          </section>

          {/* Below the transcript, the way the article form puts 摘要 below the
              body: it is written from the body, so it reads in that order. */}
          <section className="admin-card">
            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label htmlFor="description" style={{ margin: 0 }}>{t("admin.vidform.description")}</label>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={generateSummary}
                  disabled={aiBusy || value.bodyMarkdown.trim().length < 60}
                  title={t("admin.vidform.aiTitle")}
                >
                  {t(aiBusy ? "admin.form.aiGenerating" : "admin.form.aiSummary")}
                </button>
                {aiError ? (
                  <span role="status" style={{ color: "#b42318", fontSize: 12.5 }}>{aiError}</span>
                ) : null}
              </div>
              <textarea
                className="admin-textarea"
                id="description"
                name="description"
                rows={4}
                value={value.description}
                onChange={(event) => set("description", event.target.value)}
              />
              <span className="hint">
                {tRich("admin.vidform.descriptionHint", { n: <b>{value.description.length}</b> })}
              </span>
            </div>
          </section>
        </div>

        <div className="side">
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.vidform.publishPanel")}</h3>
            {mode === "edit" ? (
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
                {tRich("admin.vidform.currentStatus", {
                  status: <b>{STATUS_LABEL[value.status] ?? value.status}</b>
                })}
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="publishedAt">{t("admin.form.publishedAt")}</label>
              <input
                className="admin-input"
                id="publishedAt"
                name="publishedAt"
                type="datetime-local"
                value={toLocalInput(value.publishedAt)}
                // Convert to an instant here, the way the article form does.
                // Posting the raw datetime-local value leaves the server to
                // guess a zone -- in production that is UTC, not the editor's,
                // so the time shifted by the offset on every save.
                onChange={(event) => {
                  const next = event.target.value ? new Date(event.target.value).toISOString() : null;
                  set("publishedAt", next);
                  /*
                   * 地址里的日期跟着发布时间走，但只换日期那一段。
                   *
                   * 新建表单的发布时间默认「现在」，编辑往往先输标题、地址按
                   * 「现在」生成，之后才回填真正的发布日 —— 而那时地址多半已经
                   * 被标记成「动过」，跟标题走的钩子就停了。2026-10-21 查出 20
                   * 条是这么来的：地址上写 10-21，内容其实是 10-20 的。
                   *
                   * 只在新建时做。编辑一篇已发布的内容时改发布时间，不该悄悄
                   * 挪动一个已经发出去的地址 —— 那是改名，有它自己的代价。
                   * 真要改，「由标题重新生成」那颗按钮是明确的入口。
                   */
                  if (mode !== "edit" && datePrefix) {
                    set("slug", retargetSlugDate(value.slug, next));
                  }
                }}
              />
            </div>
            {/* Same two flags as articles, in the publish panel for the same
                reason: they are decided when publishing, and this panel is the
                part of the form that is on screen without scrolling. */}
            <div className="field" style={{ marginBottom: 12 }}>
              <span className="cap">{t("admin.form.editorMarks")}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={value.featured}
                  onChange={(event) => set("featured", event.target.checked)}
                />
                <b>{t("admin.form.featured")}</b>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <input
                  type="checkbox"
                  checked={value.editorArchive}
                  onChange={(event) => set("editorArchive", event.target.checked)}
                />
                <b>{t("admin.form.editorArchive")}</b>
              </label>
              <span className="hint">
                {t("admin.vidform.marksHint")}
              </span>
            </div>

            {/* The button is the decision. A separate 状态 dropdown next to a
                generic 保存 meant picking the state and then confirming it, and
                nothing showed which of the two you had actually done. */}
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <button
                className="admin-btn admin-btn-primary"
                type="button"
                disabled={saving}
                onClick={() => save("published")}
              >
                {t(saving ? "admin.form.saving" : "admin.vidform.publish")}
              </button>
              <button
                className="admin-btn"
                type="button"
                disabled={saving}
                onClick={() => save("draft")}
              >
                {t(saving ? "admin.form.saving" : "admin.vidform.saveDraft")}
              </button>
              {mode === "edit" && value.status !== "archived" ? (
                <button
                  className="admin-btn"
                  type="button"
                  disabled={saving}
                  onClick={() => save("archived")}
                >
                  {t(saving ? "admin.form.saving" : "admin.vidform.archive")}
                </button>
              ) : null}
              <a className="admin-btn" href="/admin/videos">
                {t("admin.cancel")}
              </a>
            </div>
            {saved ? (
              <p
                role="status"
                style={{ margin: "8px 0 0", color: "#1f7a4d", fontSize: 13, fontWeight: 600 }}
              >
                {t("admin.form.savedAt", {
                  status: STATUS_LABEL[saved.status] ?? saved.status,
                  at: saved.at
                })}
                　
                <a
                  href={`/videos/${encodeURIComponent(value.slug)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontWeight: 400 }}
                >
                  {t("admin.form.viewLink")}
                </a>
              </p>
            ) : null}
            <span className="hint" style={{ display: "block", marginTop: 6 }}>
              {t("admin.vidform.publishHint")}
            </span>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>
              {t("admin.vidform.category")}
              <span className="req">{t("admin.form.required")}</span>
            </h3>
            <select
              className="admin-select"
              name="category"
              value={value.category}
              onChange={(event) => set("category", event.target.value)}
            >
              <option value="">{t("admin.form.pickOne")}</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>
              {t("admin.vidform.coverPanel")}
              <span className="req">{t("admin.form.required")}</span>
            </h3>
            <input type="hidden" name="coverImage" value={value.coverImage} />
            {value.coverImage ? (
              <img
                src={value.coverImage}
                alt=""
                style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", borderRadius: 4, display: "block" }}
              />
            ) : (
              <div
                style={{
                  width: "100%",
                  aspectRatio: "16 / 9",
                  borderRadius: 4,
                  background: "#f1f1f4",
                  display: "grid",
                  placeItems: "center",
                  color: "#8a90a0",
                  fontSize: 12
                }}
              >
                {t("admin.vidform.noCover")}
              </div>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn-sm" type="button" onClick={() => setPicker("cover")}>
                {t("admin.vidform.pickCover")}
              </button>
              <button className="admin-btn admin-btn-sm" type="button" onClick={fetchCover} disabled={coverBusy}>
                {t(coverBusy ? "admin.vidform.autoCoverBusy" : "admin.vidform.autoCover")}
              </button>
              {value.coverImage ? (
                <button className="admin-btn admin-btn-sm" type="button" onClick={() => set("coverImage", "")}>
                  {t("admin.vidform.removeCover")}
                </button>
              ) : null}
            </div>
            <p className="hint" style={{ marginTop: 6 }}>
              {coverNote ||
                t("admin.vidform.coverHint")}
            </p>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="coverImageAlt">{t("admin.vidform.coverAlt")}</label>
              <input
                className="admin-input"
                id="coverImageAlt"
                name="coverImageAlt"
                value={value.coverImageAlt}
                onChange={(event) => set("coverImageAlt", event.target.value)}
              />
            </div>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.vidform.sourcePanel2")}</h3>
            <div className="field">
              <label htmlFor="sourceCredit">{t("admin.vidform.sourceCredit")}</label>
              <input
                className="admin-input"
                id="sourceCredit"
                name="sourceCredit"
                value={value.sourceCredit}
                onChange={(event) => set("sourceCredit", event.target.value)}
              />
            </div>
            {value.legacyUrl ? (
              <p className="muted" style={{ margin: 0, fontSize: 12, wordBreak: "break-all" }}>
                {t("admin.vidform.legacyUrl", { url: value.legacyUrl })}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <ImagePickerModal
        open={picker !== null}
        fieldLabel={t(picker === "cover" ? "admin.vidform.coverPanel" : "admin.form.bodyImage")}
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "cover") set("coverImage", url);
          else editor.current?.insertAtCaret(`\n\n![${t("admin.form.insertedImageAlt")}](${url})\n\n`);
          setPicker(null);
        }}
      />
    </form>
  );
}
