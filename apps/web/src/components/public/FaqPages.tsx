import Link from "next/link";
import type { Route } from "next";
import { CmsMarkdown } from "@/components/public/MarkdownBody";
import { InteriorHead, InteriorTabs } from "@/components/templates/InteriorScaffold";
import type { PublicFaqGroup, PublicFaqItem } from "@/lib/public-content";
import { FaqIndex, FaqSearch } from "./FaqIndex";

const TITLE = "三退问答";
const SUBTITLE = "关于声明、证明、移民与安全的常见问题。点开任意一条查看完整解答。";

/** /services/faq — the card grid. */
export function FaqIndexPage({ groups, q }: { groups: PublicFaqGroup[]; q: string }) {
  const total = groups.reduce((sum, group) => sum + group.total, 0);
  return (
    <>
      <InteriorHead section="services" slug="faq" title={TITLE} subtitle={SUBTITLE} />
      <InteriorTabs section="services" slug="faq" />
      <section className="sec" style={{ paddingTop: 44 }}>
        <div className="wrap">
          <FaqSearch q={q} action="/services/faq" />
          {q ? (
            <p className="faq-crumb" style={{ textAlign: "center" }}>
              「{q}」共找到 {total} 条 · <Link href={"/services/faq" as Route}>显示全部</Link>
            </p>
          ) : null}
          <FaqIndex groups={groups} q={q} />
        </div>
      </section>
    </>
  );
}

/*
 * Categories that the section menu lists in their own right.
 *
 * Most categories are reached through 三退问答 and should leave that tab lit.
 * 相关报道 has its own tab, so on its page the menu has to agree with where
 * the reader actually is.
 */
const TAB_FOR_CATEGORY: Record<string, string> = { xgbd: "coverage" };

/** /services/faq/c/<slug> — every question in one category. */
export function FaqCategoryPage({ group }: { group: PublicFaqGroup }) {
  const tabSlug = TAB_FOR_CATEGORY[group.slug] ?? "faq";
  return (
    <>
      <InteriorHead section="services" slug={tabSlug} title={group.name} subtitle={group.summary} />
      <InteriorTabs section="services" slug={tabSlug} />
      <section className="sec" style={{ paddingTop: 44 }}>
        <div className="wrap">
          <p className="faq-crumb">
            <Link href={"/services/faq" as Route}>三退问答</Link> / {group.name}（{group.total} 条）
          </p>
          <div className="faq-grid" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
            <section className="faq-card faq-surface">
              <ul className="faq-list" style={{ marginTop: 0 }}>
                {group.items.map((item) => (
                  <li key={item.slug}>
                    <Link href={`/services/faq/${encodeURIComponent(item.slug)}` as Route}>
                      <svg className="faq-ico faq-ico--doc" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M6 3h8l4 4v14H6V3Z" />
                        <path d="M14 3v4h4" />
                      </svg>
                      <span>{item.question}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </section>
    </>
  );
}

/** /services/faq/<slug> — one answer. */
export function FaqItemPage({
  item,
  category
}: {
  item: PublicFaqItem;
  category: { slug: string; name: string };
}) {
  /* A question inside 相关报道 lights that tab, the same as its category page:
     the menu should agree with the trail directly under it. */
  const tabSlug = TAB_FOR_CATEGORY[category.slug] ?? "faq";
  return (
    <>
      <InteriorHead section="services" slug={tabSlug} title={item.question} subtitle="" />
      <InteriorTabs section="services" slug={tabSlug} />
      <section className="sec" style={{ padding: "44px 0 88px" }}>
        <div className="wrap">
          <p className="faq-crumb">
            <Link href={"/services/faq" as Route}>三退问答</Link>
            {category.slug ? (
              <>
                {" / "}
                <Link href={`/services/faq/c/${encodeURIComponent(category.slug)}` as Route}>{category.name}</Link>
              </>
            ) : null}
          </p>
          <div className="prose faq-answer faq-surface" style={{ fontSize: 16 }}>
            <CmsMarkdown value={item.answerMarkdown} />
          </div>
          <p style={{ marginTop: 34 }}>
            <Link className="faq-more" href={"/services/faq" as Route}>
              ← 返回全部问答
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
