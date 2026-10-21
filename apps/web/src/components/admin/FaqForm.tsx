"use client";

import { useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
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
          {t("admin.faq.question")}
          <input
            className="admin-input"
            name="question"
            value={question}
            onChange={(event) => onQuestion(event.target.value)}
            placeholder={t("admin.faq.questionPlaceholder")}
            required
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 200px 150px 120px", gap: 12, alignItems: "end" }}>
          <label>
            {t("admin.faq.slug")}
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
            {t("admin.faq.category")}
            <select
              className="admin-select"
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
            >
              {categories.length === 0 ? <option value="">{t("admin.faq.noCategories")}</option> : null}
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("admin.faq.status")}
            <select
              className="admin-select"
              name="status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="draft">{t("admin.status.draft")}</option>
              {canPublish ? <option value="published">{t("admin.status.published")}</option> : null}
              {canPublish ? <option value="archived">{t("admin.status.archived")}</option> : null}
            </select>
          </label>
          {/*
            Ordering by number, not only by the list's ↑↓ buttons.

            Those move one step per click, so putting the last of 相关报道's 24
            questions at the top took twenty-three clicks. Typing the number
            does it once.
          */}
          <label>
            {t("admin.faq.order")}
            <input
              className="admin-input"
              name="position"
              type="number"
              inputMode="numeric"
              step={1}
              value={position}
              placeholder={faq ? "" : t("admin.faq.orderPlaceholder")}
              onChange={(event) => setPosition(event.target.value)}
            />
          </label>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 12.5, lineHeight: 1.7 }}>
          {tRich("admin.faq.orderNote", { order: <strong>{t("admin.faq.orderNoteWord")}</strong> })}
        </p>
        {!canPublish ? (
          <p style={{ margin: 0, color: "#8a6d1f", fontSize: 13 }}>
            {t("admin.faq.draftOnly")}
          </p>
        ) : null}
      </section>

      <section className="admin-card" style={{ display: "grid", gap: 10 }}>
        <strong>{t("admin.faq.answer")}</strong>
        <MarkdownEditor value={answer} onChange={setAnswer} onPickImage={() => setPicking(true)} />
        <span style={{ color: "#777", fontSize: 12 }}>
          {t("admin.faq.answerNote")}
        </span>
      </section>

      <div style={{ display: "flex", gap: 10 }}>
        <button className="admin-btn admin-btn-primary" type="submit">
          {t("admin.faq.save")}
        </button>
        <a className="admin-btn" href="/admin/faq">
          {t("admin.faq.backToList")}
        </a>
      </div>

      <ImagePickerModal
        open={picking}
        fieldLabel={t("admin.faq.imageField")}
        onClose={() => setPicking(false)}
        onSelect={(url) => {
          setAnswer((current) => `${current}\n\n![${t("admin.form.insertedImageAlt")}](${url})\n`);
          setPicking(false);
        }}
      />
    </form>
  );
}
