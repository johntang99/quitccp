"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";

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
      if (!response.ok || !data.summary) throw new Error(data.error || "生成失败");
      set("summary", data.summary);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "生成失败");
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

  /**
   * The slug for a title.
   *
   * With the prefix on: 2026-09-29-标题. It uses the publication date, which is
   * today for a new article, so two pieces with the same title on different days
   * no longer collide -- 46 of the 74 duplicate titles in the existing 15,515
   * are on different days.
   */
  const buildSlug = (title: string) => {
    const base = title.trim().replace(/\s+/g, "-");
    if (!base || !datePrefix) return base;
    const when = v.publishedAt ? new Date(v.publishedAt) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    const stamp = `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}`;
    return `${stamp}-${base}`;
  };

  // The slug follows the title only until it has been generated once. After
  // that a typo fix in the title must not silently change a live URL.
  useEffect(() => {
    if (slugTouched || mode === "edit") return;
    set("slug", buildSlug(v.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.title, datePrefix, v.publishedAt]);

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
        const params = new URLSearchParams({ slug, locale: "zh" });
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
      !v.title.trim() ? "标题" :
      !v.slug.trim() ? "网址 slug" :
      !v.bodyMarkdown.trim() ? "正文" :
      !v.category.trim() ? "主分类" :
      v.heroImage.trim() && !v.heroImageAlt.trim() ? "封面图说明" : "";
    if (missing) {
      setError(`请先填写「${missing}」。`);
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
      };
      if (!response.ok || !payload.ok) {
        setError(payload.error || "保存失败。");
        return;
      }
      setSaved({ at: new Date().toLocaleTimeString("zh-CN", { hour12: false }), status });
      setV((prev) => ({ ...prev, status }));
      // A new article becomes the article being edited, so the next save
      // updates it instead of refusing the slug as already taken.
      if (!v.id && payload.id) {
        setV((prev) => ({ ...prev, id: payload.id }));
        setSlugTouched(true);
        window.history.replaceState(null, "", `/admin/articles/${payload.id}`);
      }
    } catch {
      setError("保存失败：连不上服务器。");
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
        <input type="hidden" name="locale" value="zh" />
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
              <label htmlFor="af-title">标题（Title）<span className="req">*</span></label>
              <input
                id="af-title"
                name="title"
                className="admin-input"
                value={v.title}
                onChange={(e) => set("title", e.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="af-subtitle">副标题（Subtitle）</label>
              <input
                id="af-subtitle"
                name="subtitle"
                className="admin-input"
                value={v.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                placeholder="可留空。显示在标题下方，比摘要短。"
              />
            </div>

            <div className="field">
              <label htmlFor="af-slug">网址 Slug<span className="req">*</span></label>
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
                  onClick={() => {
                    setSlugTouched(true);
                    set("slug", buildSlug(v.title));
                  }}
                >
                  由标题重新生成
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
                  网址前面加日期（推荐）
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
                    改用 {slugCheck.suggestion.slice(-18)}
                  </button>
                ) : null}
              </div>
              <span className="hint">
                站内现有文章的网址都是中文，这里沿用同一种写法，不需要英文。
                {v.slug ? <> 最终网址：<code>/news/{v.slug}</code></> : null}
                {mode === "edit" ? " 发布后修改会让旧链接失效。" : ""}
              </span>
              {slugCheck && !slugCheck.available ? (
                <span className="hint" style={{ color: "#b42318" }}>
                  这个网址已被《{slugCheck.takenBy}》占用。
                </span>
              ) : null}
            </div>
          </div>

          <div className="admin-card">
            <div className="field" style={{ margin: 0 }}>
              <span className="cap">正文（Body · Markdown）<span className="req">*</span></span>
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
                <label htmlFor="af-summary" style={{ margin: 0 }}>摘要（Summary）</label>
                <button
                  type="button"
                  className="admin-btn admin-btn-sm"
                  onClick={generateSummary}
                  disabled={aiBusy || v.bodyMarkdown.trim().length < 60}
                  title="读完正文后生成 100–150 字摘要"
                >
                  {aiBusy ? "生成中…" : "✦ AI 生成"}
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
                  从正文首段生成
                </button>
                <span className="hint">
                  用于列表卡片与搜索结果。建议 60–160 字。当前 <b>{v.summary.length}</b> 字。AI 生成的是草稿，请先读一遍再保存。
                </span>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>发布（Publish）</h3>
            <div className="field">
              <label htmlFor="af-published">发布时间</label>
              <input
                id="af-published"
                type="datetime-local"
                className="admin-input"
                value={publishedLocal}
                onChange={(e) =>
                  set("publishedAt", e.target.value ? new Date(e.target.value).toISOString() : null)
                }
              />
              <span className="hint">可回填旧日期。没有定时发布：保存即上线。</span>
            </div>
            {/* In the publish panel rather than further down the page: these are
                decisions made at the moment of publishing, and the panel is the
                one part of the form that is on screen without scrolling. */}
            <div className="field" style={{ marginBottom: 12 }}>
              <span className="cap">编辑标记</span>
              <label style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                <input
                  type="checkbox"
                  checked={v.featured}
                  onChange={(e) => set("featured", e.target.checked)}
                />
                <b>重要</b>
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <input
                  type="checkbox"
                  checked={v.editorArchive}
                  onChange={(e) => set("editorArchive", e.target.checked)}
                />
                <b>精彩保留</b>
              </label>
              <span className="hint">
                两者互不影响，可以都勾、都不勾。「重要」给首页与栏目顶部的少量精选，
                「精彩保留」留给过了时效仍值得读的文章。
              </span>
            </div>

            <div className="row">
              <button
                type="button"
                className="admin-btn admin-btn-primary"
                disabled={saving}
                onClick={() => submit("published")}
              >
                {saving ? "保存中…" : mode === "new" ? "发布" : "保存并发布"}
              </button>
              <button type="button" className="admin-btn" disabled={saving} onClick={() => submit("draft")}>
                {saving ? "保存中…" : "保存草稿"}
              </button>
            </div>
            {saved ? (
              <p
                role="status"
                style={{ margin: "8px 0 0", color: "#1f7a4d", fontSize: 13, fontWeight: 600 }}
              >
                ✓ 已保存（{saved.status === "published" ? "已发布" : "草稿"}） · {saved.at}
                　
                <a href={`/news/${v.slug}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 400 }}>
                  查看 ↗
                </a>
              </p>
            ) : null}
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>分类与标签</h3>
            <div className="field">
              <label htmlFor="af-cat">主分类<span className="req">*</span></label>
              <select
                id="af-cat"
                name="category"
                className="admin-select"
                value={v.category}
                onChange={(e) => set("category", e.target.value)}
              >
                <option value="">— 请选择 —</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <span className="hint">决定文章归属的栏目页与面包屑。</span>
            </div>
            <div className="field">
              <span className="cap">副分类</span>
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
              <span className="hint">可多选，文章会同时出现在这些栏目页里。</span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-tags">标签（逗号分隔）</label>
              <input
                id="af-tags"
                className="admin-input"
                value={v.tags.join(", ")}
                onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
              />
            </div>
          </div>

          <div className="admin-card">
            <h3 style={{ marginTop: 0 }}>封面图</h3>
            {v.heroImage ? (
              <img
                src={v.heroImage}
                alt=""
                style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 4, display: "block" }}
              />
            ) : (
              <div style={{ width: "100%", height: 150, background: "#f1f1f4", borderRadius: 4, display: "grid", placeItems: "center", color: "#8a90a0", fontSize: 13 }}>
                未设置
              </div>
            )}
            <div className="row" style={{ margin: "10px 0" }}>
              <button type="button" className="admin-btn" onClick={() => setPicker("hero")}>
                选择图片…
              </button>
              {v.heroImage ? (
                <button type="button" className="admin-btn" onClick={() => set("heroImage", "")}>
                  清除
                </button>
              ) : null}
            </div>
            <div className="field">
              <label htmlFor="af-alt">
                图片说明（Alt）{v.heroImage ? <span className="req">*</span> : null}
              </label>
              <input
                id="af-alt"
                name="heroImageAlt"
                className="admin-input"
                value={v.heroImageAlt}
                onChange={(e) => set("heroImageAlt", e.target.value)}
              />
              <span className="hint">读屏软件会读出这句话；没有它，图片对视障读者等于不存在。</span>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-credit">图片来源</label>
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
            <h3 style={{ marginTop: 0 }}>署名与来源</h3>
            <div className="field">
              <label htmlFor="af-author">作者</label>
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
              <span className="hint">下拉里是站内用过的署名，点一下即可复用。</span>
            </div>
            <div className="field">
              <label htmlFor="af-translator">译者</label>
              <input
                id="af-translator"
                name="translator"
                className="admin-input"
                value={v.translator}
                onChange={(e) => set("translator", e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="af-srct">转载原文标题</label>
              <input
                id="af-srct"
                name="sourceTitle"
                className="admin-input"
                value={v.sourceTitle}
                onChange={(e) => set("sourceTitle", e.target.value)}
              />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-srcu">转载原文链接</label>
              <input
                id="af-srcu"
                name="sourceUrl"
                className="admin-input"
                value={v.sourceUrl}
                onChange={(e) => set("sourceUrl", e.target.value)}
              />
              <span className="hint">填写后文末会注明出处，并加 canonical，避免被判为抄袭。</span>
            </div>
          </div>
        </div>
      </form>

      <ImagePickerModal
        open={picker !== null}
        fieldLabel={picker === "hero" ? "封面图" : "正文图片"}
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "hero") set("heroImage", url);
          else editor.current?.insertAtCaret(`\n\n![图片说明](${url})\n\n`);
          setPicker(null);
        }}
      />
    </>
  );
}
