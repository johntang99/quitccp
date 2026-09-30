"use client";

import { useEffect, useState } from "react";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor } from "./MarkdownEditor";

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

/** Turns a watch/share address into something that can sit in an iframe. */
export function toEmbed(url: string): string {
  const value = url.trim();
  if (!value) return "";
  const youtube =
    value.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  return value;
}

const STATUS_LABEL: Record<string, string> = {
  published: "已发布",
  draft: "草稿",
  archived: "已归档"
};

function platformOf(url: string): string {
  if (!url.trim()) return "";
  if (/youtube\.com|youtu\.be/i.test(url)) return "YouTube";
  if (/ganjing/i.test(url)) return "干净世界";
  if (/vimeo/i.test(url)) return "Vimeo";
  if (/\.mp4(\?|$)/i.test(url)) return "自有文件";
  return "其它";
}

export function VideoForm({ initial, categories, mode }: VideoFormProps) {
  const [value, setValue] = useState<VideoFormValues>(initial);
  const [picker, setPicker] = useState<null | "cover" | "body">(null);
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

  const buildSlug = (title: string) => {
    const base = title.trim().replace(/\s+/g, "-");
    if (!base || !datePrefix) return base;
    const when = value.publishedAt ? new Date(value.publishedAt) : new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}-${base}`;
  };

  useEffect(() => {
    if (slugTouched || mode === "edit") return;
    set("slug", buildSlug(value.title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.title, datePrefix, value.publishedAt]);

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
  const [error, setError] = useState("");

  const set = <K extends keyof VideoFormValues>(key: K, next: VideoFormValues[K]) =>
    setValue((current) => ({ ...current, [key]: next }));

  const embed = toEmbed(value.sourceUrl);
  const isFile = /\.mp4(\?|$)/i.test(value.sourceUrl);

  const validate = (event: React.FormEvent<HTMLFormElement>) => {
    // Same order as the article form: stop at the first thing that is missing
    // rather than listing every complaint at once.
    if (!value.title.trim()) return fail(event, "请填写标题。");
    if (!value.slug.trim()) return fail(event, "请填写网址 slug。");
    if (!value.category.trim()) return fail(event, "请选择分类。");
    if (value.coverImageAlt.trim() && !value.coverImage.trim()) {
      return fail(event, "填了图片说明却没有封面图。");
    }
    setError("");
    return true;
  };

  const fail = (event: React.FormEvent<HTMLFormElement>, message: string) => {
    event.preventDefault();
    setError(message);
    return false;
  };

  return (
    <form method="post" action="/api/admin/content/videos/save" onSubmit={validate}>
      {value.id ? <input type="hidden" name="id" value={value.id} /> : null}

      {error ? (
        <section className="admin-card" style={{ background: "#fdf1f0", borderColor: "#f2c9c4" }}>
          <strong style={{ color: "#b42318" }}>{error}</strong>
        </section>
      ) : null}

      <div className="article-form">
        <div>
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>播放地址</h3>
            <div className="field">
              <label htmlFor="sourceUrl">视频地址</label>
              <input
                className="admin-input"
                id="sourceUrl"
                name="sourceUrl"
                value={value.sourceUrl}
                onChange={(event) => set("sourceUrl", event.target.value)}
                placeholder="https://www.youtube.com/watch?v=… 或 .mp4 地址"
                style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
              />
              <span className="hint">
                支持 YouTube、干净世界、Vimeo，以及 .mp4 文件地址。
                {value.sourceUrl ? ` 识别为：${platformOf(value.sourceUrl)}` : ""}
              </span>
            </div>

            {embed ? (
              <div style={{ maxWidth: 480, marginBottom: 12 }}>
                {isFile ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={embed} controls style={{ width: "100%", borderRadius: 4, background: "#111" }} />
                ) : (
                  <iframe
                    src={embed}
                    title="预览"
                    allowFullScreen
                    style={{ width: "100%", aspectRatio: "16 / 9", border: 0, borderRadius: 4, background: "#111" }}
                  />
                )}
              </div>
            ) : (
              <p className="muted" style={{ margin: "0 0 12px" }}>
                没有播放地址也可以保存——页面会只显示文字，这对旧站那些只有文字稿的集数是对的。
              </p>
            )}

            <div className="field">
              <label htmlFor="backupUrl">干净世界备用地址</label>
              <input
                className="admin-input"
                id="backupUrl"
                name="backupUrl"
                value={value.backupUrl}
                onChange={(event) => set("backupUrl", event.target.value)}
                placeholder="可留空"
                style={{ fontFamily: "ui-monospace, Menlo, monospace" }}
              />
              <span className="hint">YouTube 在大陆打不开，填了这里大陆读者才看得到。</span>
            </div>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>基本信息</h3>
            <div className="field">
              <label htmlFor="title">
                标题<span className="req">*</span>
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
              <label htmlFor="episode">系列集数</label>
              <input
                className="admin-input"
                id="episode"
                name="episode"
                value={value.episode}
                onChange={(event) => set("episode", event.target.value)}
                placeholder="第 12 集 / 第十六期，不是系列就留空"
                style={{ maxWidth: 220 }}
              />
            </div>

            <div className="field">
              <label htmlFor="slug">
                网址 Slug<span className="req">*</span>
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
                  onClick={() => {
                    setSlugTouched(true);
                    set("slug", buildSlug(value.title));
                  }}
                >
                  由标题生成
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
                  网址前面加日期（推荐）
                </label>
                {slugCheck && !slugCheck.available ? (
                  <button
                    className="admin-btn admin-btn-sm"
                    type="button"
                    onClick={() => set("slug", slugCheck.suggestion)}
                  >
                    改用 {slugCheck.suggestion.slice(-18)}
                  </button>
                ) : null}
              </div>
              {slugCheck && !slugCheck.available ? (
                <span className="hint" style={{ color: "#b42318" }}>
                  这个网址已被《{slugCheck.takenBy}》占用。
                </span>
              ) : null}
            </div>

            <div className="field">
              <label htmlFor="speaker">讲者／受访者</label>
              <input
                className="admin-input"
                id="speaker"
                name="speaker"
                value={value.speaker}
                onChange={(event) => set("speaker", event.target.value)}
                placeholder="多位用顿号分隔，可留空"
              />
            </div>

            <div className="field">
              <label htmlFor="description">简介</label>
              <textarea
                className="admin-textarea"
                id="description"
                name="description"
                rows={4}
                value={value.description}
                onChange={(event) => set("description", event.target.value)}
              />
              <span className="hint">列表和分享卡片上显示的一段话。</span>
            </div>

            <div className="field">
              <span className="cap">正文</span>
              <input type="hidden" name="bodyMarkdown" value={value.bodyMarkdown} />
              <MarkdownEditor
                value={value.bodyMarkdown}
                onChange={(next) => set("bodyMarkdown", next)}
                onPickImage={() => setPicker("body")}
              />
              <span className="hint">
                支持 Markdown。播放器下方的文字稿放这里——旧站有 174 个集数只有文字稿没有播放器，
                靠的就是这一栏。
              </span>
            </div>
          </section>
        </div>

        <div className="side">
          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>发布</h3>
            {mode === "edit" ? (
              <p className="muted" style={{ margin: "0 0 10px", fontSize: 13 }}>
                当前状态：<b>{STATUS_LABEL[value.status] ?? value.status}</b>
              </p>
            ) : null}
            <div className="field">
              <label htmlFor="publishedAt">发布时间</label>
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
                onChange={(event) =>
                  set("publishedAt", event.target.value ? new Date(event.target.value).toISOString() : null)
                }
              />
            </div>
            {/* The button is the decision. A separate 状态 dropdown next to a
                generic 保存 meant picking the state and then confirming it, and
                nothing showed which of the two you had actually done. */}
            <div className="row" style={{ marginTop: 10, flexWrap: "wrap", gap: 8 }}>
              <button className="admin-btn admin-btn-primary" type="submit" name="status" value="published">
                发表
              </button>
              <button className="admin-btn" type="submit" name="status" value="draft">
                存草稿
              </button>
              {mode === "edit" && value.status !== "archived" ? (
                <button className="admin-btn" type="submit" name="status" value="archived">
                  归档
                </button>
              ) : null}
              <a className="admin-btn" href="/admin/videos">
                取消
              </a>
            </div>
            <span className="hint" style={{ display: "block", marginTop: 6 }}>
              发表后立即对外可见；存草稿只有后台看得到。
            </span>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>
              分类<span className="req">*</span>
            </h3>
            <select
              className="admin-select"
              name="category"
              value={value.category}
              onChange={(event) => set("category", event.target.value)}
            >
              <option value="">— 请选择 —</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.name}>
                  {category.name}
                </option>
              ))}
            </select>
          </section>

          <section className="admin-card">
            <h3 style={{ marginTop: 0 }}>封面图</h3>
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
                无封面
              </div>
            )}
            <div className="row" style={{ marginTop: 8 }}>
              <button className="admin-btn admin-btn-sm" type="button" onClick={() => setPicker("cover")}>
                选择或上传
              </button>
              {value.coverImage ? (
                <button className="admin-btn admin-btn-sm" type="button" onClick={() => set("coverImage", "")}>
                  移除
                </button>
              ) : null}
            </div>
            <div className="field" style={{ marginTop: 8 }}>
              <label htmlFor="coverImageAlt">图片说明</label>
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
            <h3 style={{ marginTop: 0 }}>来源</h3>
            <div className="field">
              <label htmlFor="sourceCredit">制作方／版权</label>
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
                旧站地址：{value.legacyUrl}
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <ImagePickerModal
        open={picker !== null}
        fieldLabel={picker === "cover" ? "封面图" : "正文图片"}
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "cover") set("coverImage", url);
          else set("bodyMarkdown", `${value.bodyMarkdown}\n\n![图片说明](${url})\n`);
          setPicker(null);
        }}
      />
    </form>
  );
}
