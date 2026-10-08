"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePickerModal } from "./ImagePickerModal";
import { MarkdownEditor, type MarkdownEditorHandle } from "./MarkdownEditor";
import { formatBytes, uploadFile } from "@/lib/admin/upload-client";

/**
 * The single 资料 form, used for both creating and editing.
 *
 * Posts to a plain form endpoint so it still works without JavaScript; the only
 * pieces that need JS are the image picker and the file-row editor.
 *
 * Unlike the article form this one leads with the preview image and the file
 * list, because that is what a material *is* — on the old site each of these
 * was a post whose body was one big picture and a download link. The Markdown
 * body is there for the few that carry real explanatory text.
 */

export interface MaterialFileValue {
  label: string;
  url: string;
  kind: string;
}

export interface MaterialFormValues {
  id?: string;
  slug: string;
  title: string;
  summary: string;
  bodyMarkdown: string;
  coverImage: string;
  coverImageAlt: string;
  files: MaterialFileValue[];
  status: string;
  featured: boolean;
  publishedAt: string | null;
  categoryIds: string[];
}

interface MaterialFormProps {
  initial: MaterialFormValues;
  categories: { id: string; name: string; slug: string }[];
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

/** The label a reader sees on the button, guessed from the address. */
function kindOf(url: string): string {
  const m = url.trim().match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  if (!m) return "";
  const ext = m[1].toUpperCase();
  return ext === "JPEG" ? "JPG" : ext;
}

export function MaterialForm({ initial, categories, mode }: MaterialFormProps) {
  const [coverImage, setCoverImage] = useState(initial.coverImage);
  const [files, setFiles] = useState<MaterialFileValue[]>(initial.files.length ? initial.files : []);
  // Which field the shared media library is filling, or null when it is shut.
  const [picker, setPicker] = useState<"cover" | "body" | null>(null);
  const [selected, setSelected] = useState<string[]>(initial.categoryIds);
  const [body, setBody] = useState(initial.bodyMarkdown);
  const editor = useRef<MarkdownEditorHandle>(null);

  /*
   * The slug follows the title, the same way the article editor does it.
   *
   * It stops following the moment the editor types in the slug box, and never
   * follows at all when editing an existing material: a slug is the public URL,
   * and fixing a typo in a title must not silently break every link to it.
   */
  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(mode === "edit");
  const [datePrefix, setDatePrefix] = useState(true);

  useEffect(() => {
    try {
      // Shares the article editor's setting -- one preference, not two.
      setDatePrefix(window.localStorage.getItem("quitccp.slugDatePrefix") !== "0");
    } catch {
      // Private browsing refuses storage; the default stands.
    }
  }, []);

  /*
   * The slug is the download page's URL, so it drops the characters that do not
   * belong in one -- quotes, brackets, 、？！ and the full-width punctuation the
   * titles are full of -- and lowercases the rest. Nothing is invented: not one
   * of the site's existing slugs contains a capital letter.
   *
   * Chinese is left as it is. Romanising it would need a pinyin dictionary
   * shipped to the browser, and the slug stays editable for anyone who wants
   * the pinyin form the older material slugs use.
   */
  const buildSlug = (value: string) => {
    const base = value
      .trim()
      .toLowerCase()
      .replace(/[\s\u3000]+/g, "-")
      .replace(/[^0-9a-z\u3400-\u4dbf\u4e00-\u9fff-]+/g, "")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!base || !datePrefix) return base;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${base}`;
  };

  useEffect(() => {
    if (slugTouched) return;
    setSlug(buildSlug(title));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, datePrefix, slugTouched]);

  const updateFile = (index: number, patch: Partial<MaterialFileValue>) =>
    setFiles((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  // Per-row upload state. A 60MB zip takes tens of seconds, so each row shows
  // its own percentage rather than the form showing one global spinner.
  const [progress, setProgress] = useState<Record<number, number>>({});
  const [uploadError, setUploadError] = useState<Record<number, string>>({});

  const handleUpload = async (index: number, file: File) => {
    setUploadError((rows) => ({ ...rows, [index]: "" }));
    setProgress((rows) => ({ ...rows, [index]: 0 }));
    try {
      const result = await uploadFile(file, {
        // Grouped by material, so a slug's files stay together in the bucket.
        // The slug as it stands now, not as it was when the form opened.
        folder: `materials/${slug || "unfiled"}`,
        onProgress: (percent) => setProgress((rows) => ({ ...rows, [index]: percent }))
      });
      updateFile(index, {
        url: result.url,
        kind: kindOf(result.name),
        // Only fill the label if the editor has not written one.
        ...(files[index]?.label ? {} : { label: result.name })
      });
    } catch (error) {
      setUploadError((rows) => ({ ...rows, [index]: (error as Error).message }));
    } finally {
      setProgress((rows) => {
        const next = { ...rows };
        delete next[index];
        return next;
      });
    }
  };

  return (
    <form method="post" action="/api/admin/content/materials" className="admin-card" style={{ display: "grid", gap: 18 }}>
      {initial.id ? <input type="hidden" name="id" value={initial.id} /> : null}
      {/* The file rows are a repeatable structure, so they travel as one JSON
          field rather than as files[0][label]-style names the server would have
          to reassemble. The editor never sees it. */}
      <input type="hidden" name="filesJson" value={JSON.stringify(files)} />
      <input type="hidden" name="categoryIds" value={selected.join(",")} />
      <input type="hidden" name="coverImage" value={coverImage} />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <label style={{ display: "grid", gap: 4 }}>
          标题（Title）
          <input
            className="admin-input"
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          网址代号（Slug）
          <input
            className="admin-input"
            name="slug"
            value={slug}
            onChange={(event) => {
              setSlugTouched(true);
              setSlug(event.target.value);
            }}
            required
          />
          <span style={{ fontSize: 12, color: "#888" }}>
            {mode === "edit"
              ? "改它会改变公开网址，原链接会失效。"
              : slugTouched
                ? "已手动修改，不再跟随标题。"
                : "跟随标题自动生成，你也可以自己改。"}
          </span>
        </label>
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        简介（Summary）
        <textarea className="admin-textarea" name="summary" defaultValue={initial.summary} style={{ minHeight: 70 }} />
      </label>

      <fieldset style={{ border: "1px solid #e8e8e8", borderRadius: 6, padding: 14 }}>
        <legend style={{ fontSize: 13, color: "#555" }}>预览图（Preview image）</legend>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 14, alignItems: "start" }}>
          <button
            type="button"
            onClick={() => setPicker("cover")}
            style={{ padding: 0, border: "1px solid #ececec", background: "none", cursor: "pointer", lineHeight: 0 }}
            title="更换预览图"
          >
            {coverImage ? (
              <img src={coverImage} alt="" style={{ width: 148, height: 148, objectFit: "contain", background: "#fafafa", display: "block" }} />
            ) : (
              <span style={{ display: "grid", placeItems: "center", width: 148, height: 148, fontSize: 12, color: "#999" }}>未设置</span>
            )}
          </button>
          <div style={{ display: "grid", gap: 8 }}>
            <button className="admin-btn" type="button" onClick={() => setPicker("cover")} style={{ justifySelf: "start" }}>
              选择图片…
            </button>
            <input
              className="admin-input"
              value={coverImage}
              placeholder="图片地址"
              onChange={(event) => setCoverImage(event.target.value)}
            />
            <label style={{ display: "grid", gap: 4, fontSize: 13 }}>
              图片说明（Alt，给读屏软件用）
              <input className="admin-input" name="coverImageAlt" defaultValue={initial.coverImageAlt} />
            </label>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #e8e8e8", borderRadius: 6, padding: 14 }}>
        <legend style={{ fontSize: 13, color: "#555" }}>下载文件（Files）</legend>
        <p style={{ margin: "0 0 10px", fontSize: 12, color: "#777" }}>
          每一个文件一行。可直接上传（最大 200MB，ZIP／PDF／图片等），也可粘贴外部链接。没有链接的行不会显示在页面上。
        </p>
        <div style={{ display: "grid", gap: 8 }}>
          {files.length === 0 ? <p style={{ margin: 0, fontSize: 13, color: "#777" }}>还没有文件。</p> : null}
          {files.map((file, index) => (
            <div key={index} style={{ display: "grid", gridTemplateColumns: "1fr 2fr 80px auto auto", gap: 8, alignItems: "center" }}>
              <input
                className="admin-input"
                value={file.label}
                placeholder="按钮文字，如「传单套件（ZIP）」"
                onChange={(event) => updateFile(index, { label: event.target.value })}
              />
              <input
                className="admin-input"
                value={file.url}
                placeholder="文件地址"
                onChange={(event) => {
                  const url = event.target.value;
                  // Fill the format from the address unless someone typed one.
                  updateFile(index, { url, kind: file.kind || kindOf(url) });
                }}
              />
              <input
                className="admin-input"
                value={file.kind}
                placeholder="格式"
                onChange={(event) => updateFile(index, { kind: event.target.value })}
              />
              <label className="admin-btn" style={{ padding: "3px 8px", fontSize: 12, cursor: "pointer" }}>
                上传…
                <input
                  type="file"
                  style={{ display: "none" }}
                  onChange={(event) => {
                    const picked = event.target.files?.[0];
                    // Clear the input so re-picking the same file still fires.
                    event.target.value = "";
                    if (picked) void handleUpload(index, picked);
                  }}
                />
              </label>
              <button
                className="admin-btn"
                type="button"
                style={{ padding: "3px 8px", fontSize: 12 }}
                onClick={() => setFiles((rows) => rows.filter((_, i) => i !== index))}
              >
                删除
              </button>
              {progress[index] !== undefined ? (
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                  <progress value={progress[index]} max={100} style={{ flex: 1 }} />
                  <span style={{ color: "#555", minWidth: 36 }}>{progress[index]}%</span>
                </div>
              ) : null}
              {uploadError[index] ? (
                <p style={{ gridColumn: "1 / -1", margin: 0, fontSize: 12, color: "#b42318" }}>{uploadError[index]}</p>
              ) : null}
            </div>
          ))}
          <div>
            <button
              className="admin-btn"
              type="button"
              style={{ padding: "3px 10px", fontSize: 12 }}
              onClick={() => setFiles((rows) => [...rows, { label: "", url: "", kind: "" }])}
            >
              添加文件
            </button>
          </div>
        </div>
      </fieldset>

      <fieldset style={{ border: "1px solid #e8e8e8", borderRadius: 6, padding: 14 }}>
        <legend style={{ fontSize: 13, color: "#555" }}>分类（Categories）</legend>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {categories.map((category) => (
            <label key={category.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 14 }}>
              <input
                type="checkbox"
                checked={selected.includes(category.id)}
                onChange={(event) =>
                  setSelected((rows) =>
                    event.target.checked ? [...rows, category.id] : rows.filter((id) => id !== category.id)
                  )
                }
              />
              {category.name}
            </label>
          ))}
        </div>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "#777" }}>第一个勾选的分类作为主分类，决定它出现在哪个卡片下。</p>
      </fieldset>

      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 13, color: "#555" }}>正文（可留空）</span>
        <input type="hidden" name="bodyMarkdown" value={body} />
        <MarkdownEditor ref={editor} value={body} onChange={setBody} onPickImage={() => setPicker("body")} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, alignItems: "end" }}>
        <label style={{ display: "grid", gap: 4 }}>
          发布时间（Published at）
          <input className="admin-input" type="datetime-local" name="publishedAt" defaultValue={toLocalInput(initial.publishedAt)} />
        </label>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="featured" value="1" defaultChecked={initial.featured} />
          重要（Featured）
        </label>
        <div />
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button className="admin-btn admin-btn--primary" name="status" value="published" type="submit">
          发表
        </button>
        <button className="admin-btn" name="status" value="draft" type="submit">
          存草稿
        </button>
        <button className="admin-btn" name="status" value="archived" type="submit">
          归档
        </button>
        <a className="admin-btn" href="/admin/materials">
          取消
        </a>
        <span style={{ alignSelf: "center", fontSize: 13, color: "#777" }}>
          当前状态：{initial.status === "published" ? "已发布" : initial.status === "draft" ? "草稿" : "已归档"}
          {mode === "new" ? "（尚未保存）" : ""}
        </span>
      </div>

      <ImagePickerModal
        open={picker !== null}
        fieldLabel={picker === "cover" ? "预览图" : "正文图片"}
        onClose={() => setPicker(null)}
        onSelect={(url) => {
          if (picker === "cover") setCoverImage(url);
          else editor.current?.insertAtCaret(`\n\n![图片说明](${url})\n\n`);
          setPicker(null);
        }}
      />
    </form>
  );
}
