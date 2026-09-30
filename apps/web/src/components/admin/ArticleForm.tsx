"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor } from "./MarkdownEditor";

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
  status: string;
  section: string;
  legacyId?: number;
}

interface ArticleFormProps {
  initial: ArticleFormValues;
  categories: { name: string; slug: string }[];
  authors: string[];
  /** Name of the signed-in editor, used as the default byline on a new article. */
  currentUser: string;
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

export function ArticleForm({ initial, categories, authors, currentUser, mode }: ArticleFormProps) {
  const [v, setV] = useState<ArticleFormValues>({
    ...initial,
    author: initial.author || (mode === "new" ? currentUser : "")
  });
  const [picker, setPicker] = useState<null | "hero" | "body">(null);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  // Date prefix is on unless the editor turned it off. New articles get
  // 2026-09-29-标题; the 15,515 migrated ones keep the slugs they were imported
  // with, because changing a live URL breaks every link to it.
  const [datePrefix, setDatePrefix] = useState(true);
  const [slugCheck, setSlugCheck] = useState<{ available: boolean; takenBy?: string; suggestion: string } | null>(null);
  const [error, setError] = useState("");
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
    form.submit();
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
                value={v.bodyMarkdown}
                onChange={(next) => set("bodyMarkdown", next)}
                onPickImage={() => setPicker("body")}
              />
            </div>
          </div>

          <div className="admin-card">
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="af-summary">摘要（Summary）</label>
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
                  用于列表卡片与搜索结果。建议 60–160 字。当前 <b>{v.summary.length}</b> 字
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
            <div className="row">
              <button type="button" className="admin-btn admin-btn-primary" onClick={() => submit("published")}>
                {mode === "new" ? "发布" : "保存并发布"}
              </button>
              <button type="button" className="admin-btn" onClick={() => submit("draft")}>
                保存草稿
              </button>
            </div>
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
          else set("bodyMarkdown", `${v.bodyMarkdown}\n\n![图片说明](${url})\n`);
          setPicker(null);
        }}
      />
    </>
  );
}
