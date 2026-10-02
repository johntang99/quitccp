import { NewsArchiveBand } from "@/components/public/news/NewsArchiveBand";
import { NewsCategoryPanel } from "@/components/public/news/NewsCategoryPanel";
import { CommentaryBand, InvestigationsBand } from "@/components/public/news/NewsFeatureBands";
import { NewsHeader } from "@/components/public/news/NewsHeader";
import { NewsHero } from "@/components/public/news/NewsHero";
import { getNewsHome } from "@/lib/public-content";

export const revalidate = 300;

/** The two categories the design gives a band of their own. */
const INVESTIGATIONS = "worldwide-investigation";
const COMMENTARY = "topics-commentary";

export default async function NewsIndexPage() {
  const home = await getNewsHome();
  const today = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });

  const investigations = home.categories.find((block) => block.slug === INVESTIGATIONS);
  const commentary = home.categories.find((block) => block.slug === COMMENTARY);

  // The remaining six fill the panel rows, in the section's fixed order, two to
  // a row. Categories with nothing in them drop out rather than show empty.
  const panels = home.categories.filter(
    (block) => block.slug !== INVESTIGATIONS && block.slug !== COMMENTARY && block.lead
  );
  const rowA = panels.slice(0, 2);
  const rowB = panels.slice(2, 4);
  const rowC = panels.slice(4);

  return (
    <div className="news-page">
      <NewsHeader today={today} />
      <NewsHero featured={home.featured} latest={home.latest} />
      <NewsArchiveBand items={home.archive} />

      <div className="news-shell news-body">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 4 }}>
          <span style={{ fontFamily: "var(--serif)", fontWeight: 700, fontSize: "clamp(24px, 2.6vw, 32px)" }}>
            按栏目浏览
          </span>
          <span style={{ flexGrow: 1, height: 1, background: "var(--ink-band)" }} aria-hidden="true" />
          <span
            style={{
              fontFamily: "var(--sans)",
              fontWeight: 500,
              fontSize: 13,
              letterSpacing: "0.08em",
              color: "var(--ink-dim)",
              whiteSpace: "nowrap"
            }}
          >
            {home.categories.filter((block) => block.lead).length} 个栏目
          </span>
        </div>

        {rowA.length > 0 ? (
          <div className="news-panel-row">
            {rowA.map((block) => (
              <NewsCategoryPanel key={block.slug} block={block} variant="text" />
            ))}
          </div>
        ) : null}

        {investigations?.lead ? <InvestigationsBand block={investigations} /> : null}

        {rowB.length > 0 ? (
          <div className="news-panel-row">
            {rowB.map((block) => (
              <NewsCategoryPanel key={block.slug} block={block} variant="cover" />
            ))}
          </div>
        ) : null}

        {commentary?.lead ? <CommentaryBand block={commentary} /> : null}

        {rowC.length > 0 ? (
          <div className="news-panel-row">
            {rowC.map((block) => (
              <NewsCategoryPanel key={block.slug} block={block} variant="text" />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
