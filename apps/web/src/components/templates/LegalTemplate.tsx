import { CmsMarkdown } from "@/components/public/MarkdownBody";
import type { TemplatePageData } from "./types";
import { asRecord, asString } from "./content-utils";

/**
 * The privacy policy and the terms of service.
 *
 * These are single documents, not pages assembled out of panels, so the whole
 * body is one Markdown field -- which is also what makes them editable without
 * a bespoke form. The other long documents on the site use LongFormTemplate,
 * but every branch of that is written around a particular page's panels.
 *
 * Both were imported from www.tuidang.org on 2026-10-07, ahead of the cutover
 * that makes this site answer for that domain.
 */
export function LegalTemplate({ title, content }: TemplatePageData) {
  const payload = asRecord(content);
  const heading = asString(payload.title, title);
  const subtitle = asString(payload.subtitle);
  const intro = asRecord(payload.intro);
  const body = asString(intro.body);
  const updated = asString(intro.updated);

  return (
    <section className="sec" style={{ padding: "56px 0 88px" }}>
      <div className="wrap" style={{ maxWidth: 820 }}>
        <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(28px, 3.4vw, 40px)", lineHeight: 1.25 }}>
          {heading}
        </h1>
        {subtitle ? (
          <p className="muted" style={{ marginTop: 12, fontSize: 16, lineHeight: 1.7 }}>
            {subtitle}
          </p>
        ) : null}
        {updated ? (
          <p className="eyebrow" style={{ marginTop: 16 }}>
            最后更新：{updated}
          </p>
        ) : null}
        <div className="prose faq-surface" style={{ marginTop: 28, fontSize: 16 }}>
          <CmsMarkdown value={body} />
        </div>
      </div>
    </section>
  );
}
