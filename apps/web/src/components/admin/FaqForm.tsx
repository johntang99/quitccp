"use client";

import { useState } from "react";
import { MarkdownEditor } from "./MarkdownEditor";
import { ImagePickerModal } from "./ImagePickerModal";
import type { FaqCategoryRecord, FaqRecord } from "@/lib/admin/faq-repository";

interface FaqFormProps {
  faq: FaqRecord | null;
  categories: FaqCategoryRecord[];
  canPublish: boolean;
}

/**
 * One question and its answer.
 *
 * The answer uses the same `MarkdownEditor` as an article body -- same toolbar,
 * same side-by-side preview, same image picker -- because that is what the
 * editors already know, and because the public page renders it with the same
 * component an article uses.
 */
export function FaqForm({ faq, categories, canPublish }: FaqFormProps) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [slug, setSlug] = useState(faq?.slug ?? "");
  const [answer, setAnswer] = useState(faq?.answerMarkdown ?? "");
  const [categoryId, setCategoryId] = useState(faq?.categoryId ?? categories[0]?.id ?? "");
  const [status, setStatus] = useState(faq?.status ?? "draft");
  /* Empty on a new question: blank means "put it at the end", which is what
     saveFaq already does when no position arrives. */
  const [position, setPosition] = useState(faq ? String(faq.position) : "");
  const [picking, setPicking] = useState(false);

  /** Mirrors the article editor: the slug follows the question until touched. */
  const [slugTouched, setSlugTouched] = useState(Boolean(faq?.slug));
  const onQuestion = (value: string) => {
    setQuestion(value);
    if (!slugTouched) setSlug(value.trim().replace(/\s+/g, "-").slice(0, 90));
  };

  return (
    <form method="post" action="/api/admin/content/faq" style={{ display: "grid", gap: 16 }}>
      <input type="hidden" name="id" value={faq?.id ?? ""} />
      <input type="hidden" name="answerMarkdown" value={answer} />

      <section className="admin-card" style={{ display: "grid", gap: 12 }}>
        <label>
          问题（Question）
          <input
            className="admin-input"
            name="question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder="例如：三退是否安全？"
            required
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 200px 150px 120px", gap: 12, alignItems: "end" }}>
          <label>
            网址标识（Slug）
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
          </label>
          <label>
            分类（Category）
            <select
              className="admin-select"
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.length === 0 ? <option value="">（尚未建立分类）</option> : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            状态（Status）
            <select
              className="admin-select"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="draft">草稿</option>
              {canPublish ? <option value="published">已发布</option> : null}
              {canPublish ? <option value="archived">已归档</option> : null}
            </select>
          </label>
          {/*
            Ordering by number, not only by the list's ↑↓ buttons.

            Those move one step per click, so putting the last of 相关报道's 24
            questions at the top took twenty-three clicks. Typing the number
            does it once.
          */}
          <label>
            排序（Order）
            <input
              className="admin-input"
              name="position"
              type="number"
              inputMode="numeric"
              step={1}
              value={position}
              placeholder={faq ? "" : "留空＝最后"}
              onChange={(event) => setPosition(event.target.value)}
            />
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
          <strong>排序</strong>：同一分类里数字小的排前面，从 0 开始；留空就排到这个分类的最后。
          数字不必连续——用 10、20、30 留出空档，以后往中间插一条就不用把后面的全改一遍。
          两条填了同一个数字时，先建立的排前面。
        </p>
        {!canPublish ? (
          <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>
            你的权限可以保存草稿；发布请由管理员操作。
          </p>
        ) : null}
      </section>

      <section className="admin-card" style={{ display: "grid", gap: 10 }}>
        <strong>答案（Markdown）</strong>
        <MarkdownEditor value={answer} onChange={setAnswer} onPickImage={() => setPicking(true)} />
        <span style={{ color: "#777", fontSize: 12 }}>
          与文章正文用的是同一个编辑器：空行分段，`## 小标题`、`**加粗**`、`[文字](链接)`。
        </span>
      </section>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="admin-btn admin-btn-primary" type="submit">
          保存
        </button>
        <a className="admin-btn" href="/admin/faq">
          返回列表
        </a>
      </div>

      <ImagePickerModal
        open={picking}
        fieldLabel="答案插图"
        onClose={() => setPicking(false)}
        onSelect={(url) => {
          setAnswer((current) => `${current}\n\n![图片说明](${url})\n`);
          setPicking(false);
        }}
      />
    </form>
  );
}
