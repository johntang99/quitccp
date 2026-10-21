"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { warmPages } from "@/lib/admin/warm-pages";
import { requestSlug, retargetSlugDate, useAutoSlug } from "./use-auto-slug";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { formatTime } from "@/lib/format";

/**
 * The single article form, used for both creating and editing.
 *
 * Posts to the existing form endpoint so it degrades to a plain HTML form if
 * JavaScript is unavailable -- the only pieces that need JS are the Markdown
 * toolbar and the image picker.
 */

export interface ArticleFormValues {
  id?: string;
  slug: string;
  title: string;
  subtitle: string;
  summary: string;
  bodyMarkdown: string;
  category: string;
  secondaryCategories: string[];
  tags: string[];
  heroImage: string;
  heroImageAlt: string;
  heroCredit: string;
  author: string;
  translator: string;
  sourceTitle: string;
  sourceUrl: string;
  publishedAt: string | null;
  featured: boolean;
  editorArchive: boolean;
  status: string;
  section: string;
  legacyId?: number;
}

interface ArticleFormProps {
  initial: ArticleFormValues;
  categories: { name: string; slug: string }[];
  authors: string[];
  /** Name of the signed-in editor, used as the default byline on a new article. */
  mode: "new" | "edit";
}

/** `datetime-local` needs `YYYY-MM-DDTHH:mm`, not an ISO string with a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ArticleForm({ initial, categories, authors, mode }: ArticleFormProps) {
  /*
   * 作者 starts empty on a new article.
   *
   * It used to default to the signed-in account's email prefix, so a piece typed
   * in by an editor went out bylined "editor" -- an internal account identifier
   * presented to readers as the person who wrote it. On a site whose standing is
   * its documentary accuracy, a wrong byline is not a cosmetic defect.
   *
   * 作者 is an editorial claim about who wrote the piece, often someone outside
   * the organisation entirely. Who typed it into the CMS is a separate question,
   * and 创建人 (created_by, migration 019) now answers it properly.
   */
  const [v, setV] = useState<ArticleFormValues>({ ...initial });
  const [picker, setPicker] = useState<null | "hero" | "body">(null);
  // Lets the picker drop its image where the caret is, not at the end.
  const editor = useRef<MarkdownEditorHandle>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState("");

  /** Drafts the summary from the whole body; the editor keeps or edits it. */
  const generateSummary = async () => {
    setAiBusy(true);
    setAiError("");
    try {
      const response = await fetch("/api/admin/content/summary", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: v.title, body: v.bodyMarkdown })
      });
      const data = (await response.json()) as { summary?: string; error?: string };
      if (!response.ok || !data.summary) throw new Error(data.error || t("admin.form.aiFailed"));
      set("summary", data.summary);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : t("admin.form.aiFailed"));
    } finally {
      setAiBusy(false);
    }
  };
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // Date prefix is on unless the editor turned it off. New articles get
  // 2026-09-29-标题; the 15,515 migrated ones keep the slugs they were imported
  // with, because changing a live URL breaks every link to it.
  const [datePrefix, setDatePrefix] = useState(true);
  const [slugCheck, setSlugCheck] = useState<{ available: boolean; takenBy?: string; suggestion: string } | null>(null);
  const [error, setError] = useState("");
  // What the editor sees after pressing save: the form stays put, so the
  // feedback has to be here rather than on the page it used to redirect to.
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ at: string; status: string } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const set = <K extends keyof ArticleFormValues>(key: K, value: ArticleFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    try {
      // Only an explicit "0" turns it off; never having chosen means on.
      setDatePrefix(window.localStorage.getItem("quitccp.slugDatePrefix") !== "0");
    } catch {
      // Private browsing refuses storage; the default stands.
    }
  }, []);

  /*
   * 地址从标题生成，中文转拼音：2026-09-29-biao-ti。
   *
   * 原来这里是本地一行 `title.replace(/\s+/g, "-")`，中文原样留在地址里。
   * 2026-10 读者反映那种地址显示出来是一堵百分号，于是全站 16,218 条改成了
   * 拼音 —— 新建的这一边必须同时改，否则编辑第二天发的文章又是中文地址，
   * 站上立刻变回两种形状。
   *
   * 拼音词典有一兆多，只能放在服务端，所以这里是一次网络往返；请求失败时
   * `useAutoSlug` 用本地规则兜底。
   *
   * 日期前缀用这一篇自己的发布时间，不是今天 —— 编辑回填旧日期是常事，而
   * 前缀存在的意义就是区分同名文章。
   *
   * 地址只跟到生成出来为止。之后再改标题不会动它：改一个错字不该悄悄换掉
   * 一个已经发出去的地址。
   */
  useAutoSlug(
    v.title,
    { enabled: !slugTouched && mode !== "edit", withDate: datePrefix, at: v.publishedAt || null },
    (slug) => set("slug", slug)
  );

  // Ask whether the slug is free while the editor is still typing, so a clash
  // shows up here rather than as a refusal after they press 保存.
  useEffect(() => {
    const slug = v.slug.trim();
    if (!slug) {
      setSlugCheck(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ slug, locale: SITE_LOCALE });
        if (v.id) params.set("id", v.id);
        const response = await fetch(`/api/admin/content/articles/slug?${params}`);
        if (response.ok) setSlugCheck(await response.json());
      } catch {
        // A failed check must not block editing; the endpoint refuses a clash
        // on save regardless.
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [v.slug, v.id]);

  const publishedLocal = useMemo(() => toLocalInput(v.publishedAt), [v.publishedAt]);

  const submit = (status: string) => {
    const missing =
      !v.title.trim() ? "admin.form.field.title" :
      !v.slug.trim() ? "admin.form.field.slug" :
      !v.bodyMarkdown.trim() ? "admin.form.field.body" :
      !v.category.trim() ? "admin.form.field.category" :
      v.heroImage.trim() && !v.heroImageAlt.trim() ? "admin.form.field.imageAlt" : "";
    if (missing) {
      setError(t("admin.form.fillFirst", { field: t(missing) }));
      return;
    }
    setError("");
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("status") as HTMLInputElement).value = status;
    void save(form, status);
  };

  /**
   * Saves without leaving the page.
   *
   * It used to post the form and land on the article list, which threw away
   * whatever the editor was in the middle of. Now the save happens over fetch
   * and the page stays exactly as it was; only the status line changes.
   */
  const save = async (form: HTMLFormElement, status: string) => {
    setSaving(true);
    setSaved(null);
    try {
      const response = await fetch(form.action, {
        method: "POST",
        headers: { accept: "application/json" },
        body: new FormData(form)
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        id?: string;
        slug?: string;
        savedAt?: string;
        warm?: string[];
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error || t("admin.save.failed"));
        return;
      }
      setSaved({ at: formatTime(new Date()), status });
      /* Build the pages this article appears on now, so the editor's own click
         through to the public page is a hit rather than a 1.5s render. */
      warmPages(payload.warm ?? []);
      setV((prev) => ({ ...prev, status }));
      // A new article becomes the article being edited, so the next save
      // updates it instead of refusing the slug as already taken.
      if (!v.id && payload.id) {
        setV((prev) => ({ ...prev, id: payload.id }));
        setSlugTouched(true);
        window.history.replaceState(null, "", `/admin/articles/${payload.id}`);
      }
    } catch {
      setError(t("admin.form.saveFailedOffline"));
    } finally {
      setSaving(false);
    }
  };

  const toggleSecondary = (name: string) => {
    const has = v.secondaryCategories.includes(name);
    set(
      "secondaryCategories",
      has ? v.secondaryCategories.filter((n) => n !== name) : [...v.secondaryCategories, name]
    );
  };

  return (
    <>
      <form ref={formRef} method="post" action="/api/admin/content/articles" className="article-form">
        {/* Values the form posts; the visible controls above drive them. */}
        {v.id ? <input type="hidden" name="id" value={v.id} /> : null}
        <input type="hidden" name="status" defaultValue={v.status} />
        <input type="hidden" name="section" value={v.section} />
        <input type="hidden" name="bodyMarkdown" value={v.bodyMarkdown} />
        <input type="hidden" name="secondaryCategories" value={v.secondaryCategories.join(",")} />
        <input type="hidden" name="tags" value={v.tags.join(",")} />
        <input type="hidden" name="heroImage" value={v.heroImage} />
        <input type="hidden" name="publishedAt" value={v.publishedAt ?? ""} />
        {/* Only present when checked; the endpoint reads absence as false. */}
        {v.featured ? <input type="hidden" name="featured" value="1" /> : null}
        {v.editorArchive ? <input type="hidden" name="editorArchive" value="1" /> : null}
        {v.legacyId ? <input type="hidden" name="legacyId" value={v.legacyId} /> : null}

        <div>
          <div className="admin-card">
            {error ? (
              <p role="alert" style={{ margin: "0 0 12px", color: "#b42318", background: "#fef3f2", padding: "8px 10px", borderRadius: 4 }}>
                {error}
              </p>
            ) : null}

            <div className="field">
              <label htmlFor="af-title">
                {t("admin.form.title")}
                <span className="req">{t("admin.form.required")}</span>
              </label>
              <input
                id="af-title"
                name="title"
                className="admin-input"
                value={v.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="af-subtitle">{t("admin.form.subtitle")}</label>
              <input
                id="af-subtitle"
                name="subtitle"
                className="admin-input"
                value={v.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder={t("admin.form.subtitlePlaceholder")}
              />
            </div>

            <div className="field">
              <label htmlFor="af-slug">
                {t("admin.form.slug")}
                <span className="req">{t("admin.form.required")}</span>
              </label>
              <div className="row">
                <input
                  id="af-slug"
                  name="slug"
                  className="admin-input"
                  style={{ flex: 1, minWidth: 280 }}
                  value={v.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    set("slug", e.target.value);
                  }}
                />
                <button
                  type="button"
                  className="admin-btn"
                  onClick={async () => {
                    setSlugTouched(true);
                    try {
                      set("slug", await requestSlug(v.title, { withDate: datePrefix, at: v.publishedAt || null }));
                    } catch {
                      /* 取不到就不动 —— 把地址清空比保留旧的更糟。 */
                    }
                  }}
                >
                  {t("admin.form.regenSlug")}
                </button>
              </div>
              <div className="row" style={{ marginTop: 6, alignItems: "center", gap: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={datePrefix}
                    onChange={(e) => {
                      setDatePrefix(e.target.checked);
                      try {
                        window.localStorage.setItem("quitccp.slugDatePrefix", e.target.checked ? "1" : "0");
                      } catch {
                        // Not being able to remember the choice is not an error.
                      }
                      if (!slugTouched || mode === "new") set("slug", "");
                    }}
                  />
                  {t("admin.form.datePrefix")}
                </label>
                {slugCheck && !slugCheck.available ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-sm"
                    onClick={() => {
                      setSlugTouched(true);
                      set("slug", slugCheck.suggestion);
                    }}
                  >
                    {t("admin.form.useSuggestion", { slug: slugCheck.suggestion.slice(-18) })}
                  </button>
                ) : null}
              </div>
              <span className="hint">
                {t("admin.form.slugHint")}
                {v.slug
                  ? tRich("admin.form.slugFinal", { url: <code>/news/{v.slug}</code> })
                  : null}
                {mode === "edit" ? t("admin.form.slugEditWarning") : ""}
              </span>
              {slugCheck && !slugCheck.available ? (
                <span className="hint" style={{ color: "#b42318" }}>
                  {t("admin.form.slugTaken", { title: slugCheck.takenBy ?? "" })}
                </span>
              ) : null}
            </div>
          </div>

          <div className="admin-card">
            <div className="field" style={{ margin: 0 }}>
              <span className="cap">
                {t("admin.form.body")}
                <span className="req">{t("admin.form.required")}</span>
              </span>
              <MarkdownEditor
                ref={editor}
                value={v.bodyMarkdown}
                onChange={(next) => set("bodyMarkdown", next)}
                onPickImage={() => setPicker("body")}
              />
            </div>
          </div>

          <div className="admin-card">
            <div className="field" style={{ margin: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <label htmlFor="af-summary" style={{ margin: 0 }}>{t("admin.form.summary")}</label>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={generateSummary}
                  disabled={aiBusy || v.bodyMarkdown.trim().length < 60}
                  title={t("admin.form.aiTitle")}
                >
                  {t(aiBusy ? "admin.form.aiGenerating" : "admin.form.aiSummary")}
                </button>
                {aiError ? (
                  <span role="status" style={{ color: "#b42318", fontSize: 12.5 }}>{aiError}</span>
                ) : null}
              </div>
              <textarea
                id="af-summary"
                name="summary"
                className="admin-textarea"
                style={{ minHeight: 70 }}
                value={v.summary}
                onChange={(e) => set("summary", e.target.value)}
              />
              <div className="row">
                <button
                  type="button"
                  className="admin-btn"
                  onClick={() =>
                    set(
                      "summary",
                      v.bodyMarkdown
                        .replace(/^#.*$/gm, "")
                        .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
                        .replace(/[#>*_`]/g, "")
                        .split(/\n\s*\n/)
                        .map((p) => p.trim())
                        .find(Boolean)
                        ?.slice(0, 160) ?? ""
                    )
                  }
                >
                  {t("admin.form.summaryFromBody")}
                </button>
                <span className="hint">
                  {tRich("admin.form.summaryHint", { n: <b>{v.summary.length}</b> })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.form.publishPanel")}</h3>
            <div className="field">
              <label htmlFor="af-published">{t("admin.form.publishedAt")}</label>
              <input
                id="af-published"
                type="datetime-local"
                className="admin-input"
                value={publishedLocal}
                onChange={(e) => {
                  const next = e.target.value ? new Date(e.target.value).toISOString() : null;
                  set("publishedAt", next);
                  /* 地址里的日期跟着发布时间走，只换日期段。理由见
                     retargetSlugDate 的注释。只在新建时做 —— 改一篇已发布
                     文章的发布时间，不该悄悄挪动线上地址。 */
                  if (mode !== "edit" && datePrefix) {
                    set("slug", retargetSlugDate(v.slug, next));
                  }
                }}
              />
              <span className="hint">{t("admin.form.publishedAtHint")}</span>
            </div>
            {/* In the publish panel rather than further down the page: these are
                decisions made at the moment of publishing, and the panel is the
                one part of the form that is on screen without scrolling. */}
            <div className="field" style={{ marginBottom: 12 }}>
              <span className="cap">{t("admin.form.editorMarks")}</span>
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={v.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                />
                <b>{t("admin.form.featured")}</b>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <input
                  type="checkbox"
                  checked={v.editorArchive}
                  onChange={(e) => set("editorArchive", e.target.checked)}
                />
                <b>{t("admin.form.editorArchive")}</b>
              </label>
              <span className="hint">{t("admin.form.marksHint")}</span>
            </div>

            <div className="row">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={saving}
                onClick={() => submit("published")}
              >
                {saving
                  ? t("admin.form.saving")
                  : t(mode === "new" ? "admin.form.publish" : "admin.form.saveAndPublish")}
              </button>
              <button type="button" className="admin-btn" disabled={saving} onClick={() => submit("draft")}>
                {t(saving ? "admin.form.saving" : "admin.form.saveDraft")}
              </button>
            </div>
            {saved ? (
              <p
                role="status"
                style={{ margin: "8px 0 0", color: "#1f7a4d", fontSize: 13, fontWeight: 600 }}
              >
                {t("admin.form.savedAt", {
                  status: t(saved.status === "published" ? "admin.status.published" : "admin.status.draft"),
                  at: saved.at
                })}
                　
                <a href={`/admin/preview/news/${v.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 400 }}>
                  {t("admin.form.viewLink")}
                </a>
              </p>
            ) : null}
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.form.categoriesPanel")}</h3>
            <div className="field">
              <label htmlFor="af-cat">
                {t("admin.form.mainCategory")}
                <span className="req">{t("admin.form.required")}</span>
              </label>
              <select
                id="af-cat"
                name="category"
                className="admin-select"
                value={v.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">{t("admin.form.pickOne")}</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="hint">{t("admin.form.mainCategoryHint")}</span>
            </div>
            <div className="field">
              <span className="cap">{t("admin.form.secondaryCategories")}</span>
              <div className="article-chips">
                {categories
                  .filter((c) => c.name !== v.category)
                  .map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      className={`article-chip${v.secondaryCategories.includes(c.name) ? " is-on" : ""}`}
                      onClick={() => toggleSecondary(c.name)}
                    >
                      {c.name}
                    </button>
                  ))}
              </div>
              <span className="hint">{t("admin.form.secondaryHint")}</span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-tags">{t("admin.form.tags")}</label>
              <input
                id="af-tags"
                className="admin-input"
                value={v.tags.join(", ")}
                onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              />
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.form.coverPanel")}</h3>
            {v.heroImage ? (
              <img
                src={v.heroImage}
                alt=""
                style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 4, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: 150, background: "#f1f1f4", borderRadius: 4, display: "grid", placeItems: "center", color: "#8a90a0", fontSize: 13 }}>
                {t("admin.form.coverUnset")}
              </div>
            )}
            <div className="row" style={{ margin: "10px 0" }}>
              <button type="button" className="admin-btn" onClick={() => setPicker("hero")}>
                {t("admin.form.pickImage")}
              </button>
              {v.heroImage ? (
                <button type="button" className="admin-btn" onClick={() => set("heroImage", "")}>
                  {t("admin.form.clear")}
                </button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="af-alt">
                {t("admin.form.imageAlt")}
                {v.heroImage ? <span className="req">{t("admin.form.required")}</span> : null}
              </label>
              <input
                id="af-alt"
                name="heroImageAlt"
                className="admin-input"
                value={v.heroImageAlt}
                onChange={(e) => set("heroImageAlt", e.target.value)}
              />
              <span className="hint">{t("admin.form.imageAltHint")}</span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-credit">{t("admin.form.imageCredit")}</label>
              <input
                id="af-credit"
                name="heroCredit"
                className="admin-input"
                value={v.heroCredit}
                onChange={(e) => set("heroCredit", e.target.value)}
              />
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>{t("admin.form.bylinePanel")}</h3>
            <div className="field">
              <label htmlFor="af-author">{t("admin.form.author")}</label>
              <input
                id="af-author"
                name="author"
                className="admin-input"
                list="af-authors"
                value={v.author}
                onChange={(e) => set("author", e.target.value)}
              />
              <datalist id="af-authors">
                {authors.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
              <span className="hint">{t("admin.form.authorHint")}</span>
            </div>
            <div className="field">
              <label htmlFor="af-translator">{t("admin.form.translator")}</label>
              <input
                id="af-translator"
                name="translator"
                className="admin-input"
                value={v.translator}
                onChange={(e) => set("translator", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="af-srct">{t("admin.form.sourceTitle")}</label>
              <input
                id="af-srct"
                name="sourceTitle"
                className="admin-input"
                value={v.sourceTitle}
                onChange={(e) => set("sourceTitle", e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-srcu">{t("admin.form.sourceUrl")}</label>
              <input
                id="af-srcu"
                name="sourceUrl"
                className="admin-input"
                value={v.sourceUrl}
                onChange={(e) => set("sourceUrl", e.target.value)}
              />
              <span className="hint">{t("admin.form.sourceUrlHint")}</span>
            </div>
          </div>
        </div>
      </form>

      <ImagePickerModal
        open={picker !== null}
        fieldLabel={t(picker === "hero" ? "admin.form.coverPanel" : "admin.form.bodyImage")}
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "hero") set("heroImage", url);
          else editor.current?.insertAtCaret(`\n\n![${t("admin.form.insertedImageAlt")}](${url})\n\n`);
          setPicker(null);
        }}
      />
    </>
  );
}
