import Link from "next/link";
import type { Route } from "next";
import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";
import { resolveNewsArticleHref } from "@/lib/news-linking";
import { involveDefaults } from "@quitccp/content-schema";
import { CtaPanel, LinkPanel } from "./section-panels";

/**
 * Empty on purpose.
 *
 * This used to hold invented articles -- plausible headlines with 2026 dates --
 * that rendered whenever a list page had no content of its own. On a site whose
 * entire claim is documentary accuracy, a made-up report is the one thing we
 * cannot ship. A list with nothing in it now renders nothing.
 */
const sampleRows: {
  slug?: string;
  href?: string;
  image?: string;
  title: string;
  date?: string;
  tag?: string;
  summary?: string;
}[] = [];

const NEWS_MENU_SLUGS = new Set(["index", "announcements", "investigations", "commentary", "solidarity", "stories", "notable"]);

const NEWS_TITLE_DEFAULTS: Record<string, string> = {
  index: "新闻与报告",
  announcements: "机构公告与声明",
  investigations: "追查国际调查报告",
  commentary: "专题报导与时政评论",
  solidarity: "国际声援行动",
  stories: "三退新闻与故事",
  notable: "名人退党"
};
const NEWS_SUBMENU_PAGE_SIZE = 10;

export function ListArchiveTemplate({ title, section, slug, content, query }: TemplatePageData) {
  const payload = asRecord(content);
  const pageSubtitle = asString(payload.subtitle, "列表/归档页，支持筛选、分页与排序。");
  const filterLabels = asStringArray(payload.filters, ["全部", "最新发布", "热门阅读"]);
  const dynamicItems = asObjectArray(payload.items).map((row) => ({
    slug: asString(row.slug),
    href: asString(row.href),
    image: asString(row.image),
    title: asString(row.title),
    date: asString(row.date),
    tag: asString(row.tag),
    summary: asString(row.summary)
  }));
  const rows = dynamicItems.length > 0 ? dynamicItems : sampleRows;
  const renderNoImageSlot = (variant: "lead" | "card" | "row" | "doc" | "mini") => (
    <div className={`no-image-slot no-image-slot--${variant}`} aria-label="无配图 / no image">
      无配图 / no image
    </div>
  );

  if (section === "resources" && slug === "culture") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    const cultureDbSlugByTitle: Record<string, string> = {
      "祭仓颉　找回迷失的神性": "祭仓颉-找回迷失的神性",
      "一只蒸羊照见天理帐本": "一只蒸羊照见天理帐本",
      "千年微光：从乌台诗案到人性觉醒的文明回响": "千年微光：从乌台诗案到人性觉醒的文明回响",
      "范仲淹：先天下之忧而忧": "范仲淹：先天下之忧而忧",
      "诗词：静中奇景": "诗词-静中奇景"
    };
    const resolveCultureDbArticleHref = (row: { href: string; slug: string; title: string }) => {
      const mappedSlug = cultureDbSlugByTitle[row.title];
      if (mappedSlug) return `/news/${encodeURIComponent(mappedSlug)}`;
      return resolveNewsArticleHref({
        href: row.href,
        slug: row.slug,
        title: row.title
      });
    };
    const cultureTitle = asString(payload.title, "中华传统文化");
    const cultureSubtitle = asString(payload.subtitle, "传统故事、历史人物与文化专题。");
    const cultureFilterDefaults = ["全部", "传统故事", "历史人物", "诗词", "节气与民俗", "良言善语"];
    const cultureFilterRaw = asStringArray(payload.filters, []);
    const cultureFilters =
      cultureFilterRaw.length === 0 || cultureFilterRaw.join("|") === "全部|最新发布|热门阅读"
        ? cultureFilterDefaults
        : cultureFilterRaw;
    const firstFilterValue = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] ?? "" : value ?? "");
    const safeDecode = (value: string) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };
    const requestedFilter = safeDecode(firstFilterValue(query?.filter)).trim();
    const activeFilter = cultureFilters.includes(requestedFilter) ? requestedFilter : "全部";
    const cultureRows = asObjectArray(payload.items).length
      ? asObjectArray(payload.items).map((row) => ({
          slug: asString(row.slug),
          href: asString(row.href),
          title: asString(row.title),
          date: asString(row.date),
          tag: asString(row.tag),
          summary: asString(row.summary),
          image: asString(row.image, "https://picsum.photos/seed/culture/400/260")
        }))
      : [];
    const matchesCultureFilter = (row: { tag: string; title: string }) => {
      if (activeFilter === "全部") return true;
      if (activeFilter === "传统故事") return row.tag.includes("传统故事");
      if (activeFilter === "历史人物") return row.tag.includes("历史人物") || row.title.includes("乌台") || row.title.includes("范仲淹");
      if (activeFilter === "诗词") return row.tag.includes("诗词");
      if (activeFilter === "节气与民俗") return row.tag.includes("节气") || row.title.includes("仓颉") || row.title.includes("谷雨");
      if (activeFilter === "良言善语") return row.tag.includes("良言善语") || row.tag.includes("诗词");
      return true;
    };
    const filteredCultureRows = cultureRows.filter(matchesCultureFilter);
    const visibleCultureRows = filteredCultureRows.slice(0, 10);
    const pagerItems = asStringArray(payload.pager, ["1", "2", "3", "…", "68", "下一页 →"]);
    const categoryPanel = asRecord(payload.categoryPanel);
    const categoryLinks = asObjectArray(categoryPanel.links).length
      ? asObjectArray(categoryPanel.links).map((row) => ({
          label: asString(row.label),
          count: asString(row.count),
          href: resolveResourceHref(
            asString(row.href, "#"),
            `/resources/culture?category=${encodeURIComponent(asString(row.label).replace(/\s+/g, ""))}`
          )
        }))
      : [
          { label: "传统故事精选", count: "412", href: "/resources/culture?category=传统故事精选" },
          { label: "中华文化", count: "168", href: "/resources/culture?category=中华文化" },
          { label: "历史人物", count: "94", href: "/resources/culture?category=历史人物" },
          { label: "诗词", count: "76", href: "/resources/culture?category=诗词" },
          { label: "良言善语", count: "", href: "/resources/culture?category=良言善语" }
        ];
    const freeUsePanel = asRecord(payload.freeUsePanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).length
      ? asObjectArray(relatedPanel.links).map((row) => ({
          label: asString(row.label),
          href: asString(row.label).includes("解体党文化")
            ? "/resources/book-jieti-dangwenhua"
            : resolveResourceHref(
                asString(row.href, "#"),
                asString(row.label).includes("影片")
                  ? "/videos/party-culture"
                  : asString(row.label).includes("杂志")
                    ? "/resources/magazine"
                    : "/resources"
              )
        }))
      : [
          { label: "《解体党文化》", href: "/resources/book-jieti-dangwenhua" },
          { label: "文化专题影片", href: "/videos/party-culture" },
          { label: "杂志《回归》", href: "/resources/magazine" }
        ];
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={cultureTitle}
          subtitle={cultureSubtitle}
        />
        <InteriorTabs section={section} slug="culture" />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <article>
              <div className="filters">
                {cultureFilters.map((label, index) => (
                  <a
                    key={label}
                    className={`chip${label === activeFilter || (index === 0 && activeFilter === "全部") ? " on" : ""}`}
                    href={index === 0 ? "/resources/culture" : `/resources/culture?filter=${encodeURIComponent(label)}`}
                  >
                    {label}
                  </a>
                ))}
              </div>
              <div className="arch">
                {visibleCultureRows.length > 0 ? (
                  visibleCultureRows.map((row) => (
                    <article key={row.slug} className="arow">
                      <img className="athumb-img" src={row.image} alt="" />
                      <div>
                        <span className="tag">{row.tag || "传统文化"}</span>
                        <Link
                          href={resolveCultureDbArticleHref({
                            href: row.href,
                            slug: row.slug,
                            title: row.title
                          }) as Route}
                        >
                          <h3>{row.title}</h3>
                        </Link>
                        {row.summary ? <p>{row.summary}</p> : null}
                        <p className="meta">{row.date}</p>
                      </div>
                    </article>
                  ))
                ) : (
                  <article className="arow">
                    <div>
                      <span className="tag">{activeFilter}</span>
                      <h3>该分类暂无内容</h3>
                      <p>请切换到其他分类查看。</p>
                    </div>
                  </article>
                )}
              </div>
              <div className="pager">
                {pagerItems.map((item, index) => (
                  <a
                    key={item}
                    className={index === 0 ? "on" : ""}
                    href={
                      item === "下一页 →"
                        ? "/resources/culture?page=2"
                        : item === "…"
                          ? "/resources/culture?page=4"
                          : `/resources/culture?page=${encodeURIComponent(item.replace(/[^\d]/g, "") || "1")}`
                    }
                  >
                    {item}
                  </a>
                ))}
              </div>
            </article>
            <aside className="side">
              <div className="panel">
                <h4>{asString(categoryPanel.title, "分类")}</h4>
                <ul>
                  {categoryLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>
                        {link.label}
                        {link.count ? (
                          <span style={{ color: "var(--muted)", fontFamily: "var(--mono)", fontSize: 13, marginLeft: 8 }}>{link.count}</span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(freeUsePanel.title, "可自由使用")}</h4>
                <p>{asString(freeUsePanel.body, "全部文章可下载、转载、翻译与朗读，无需事先授权。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(freeUsePanel.buttonHref, "/resources/downloads")}>
                  {asString(freeUsePanel.buttonLabel, "资料下载")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {relatedLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "involve" && slug === "stories") {
    // Driven by the CMS, like every other list on the site. The four articles
    // that used to be written into this branch were invented -- named
    // volunteers, datelines, word counts -- and all four linked to the
    // placeholder article page. Editors fill this from 内容管理; until they do,
    // the list, its filters and its pager render nothing rather than fiction.
    const storyRows = rows;
    const storyFilters = asStringArray(payload.filters, []);
    const storyPager = asStringArray(payload.pager, []);
    // Both sidebar panels were written into this branch; they are page content
    // now, with the shared defaults behind them.
    const storyFallback = involveDefaults("involve", "stories");
    const joinPanel = asRecord(payload.joinPanel ?? storyFallback.joinPanel);
    const storyRelated = asRecord(payload.relatedPanel ?? storyFallback.relatedPanel);
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={asString(payload.title, "在服务点的人")}
          subtitle={asString(
            payload.subtitle,
            "现场纪实、义工自述与长期跟踪报导。含原「三退义工」与「义工风采」全部内容。"
          )}
        />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <article>
              {storyFilters.length > 0 ? (
                <div className="filters">
                  {storyFilters.map((label, index) => (
                    <a key={label} className={index === 0 ? "chip on" : "chip"} href="#">
                      {label}
                    </a>
                  ))}
                </div>
              ) : null}
              {storyRows.length > 0 ? (
                <div className="arch">
                  {storyRows.map((row, index) => (
                    <article
                      className="arow"
                      key={row.slug || row.title || index}
                      style={index === 0 ? { paddingTop: 0 } : undefined}
                    >
                      <Link
                        href={
                          resolveNewsArticleHref({
                            href: row.href,
                            slug: row.slug,
                            title: row.title
                          }) as Route
                        }
                        style={{ display: "contents" }}
                      >
                        {row.image ? (
                          <img className="athumb-img" src={row.image} alt="" />
                        ) : (
                          renderNoImageSlot("row")
                        )}
                        <div>
                          {row.tag ? <span className="tag">{row.tag}</span> : null}
                          <h3>{row.title}</h3>
                          {row.summary ? <p>{row.summary}</p> : null}
                          {row.date ? <p className="meta">{row.date}</p> : null}
                        </div>
                      </Link>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">这里还没有内容。</p>
              )}
              {storyRows.length > 0 && storyPager.length > 0 ? (
                <nav className="pager">
                  {storyPager.map((item, index) => (
                    <a key={item} className={index === 0 ? "on" : ""} href="#">
                      {item}
                    </a>
                  ))}
                </nav>
              ) : null}
            </article>
            <aside className="side">
              <CtaPanel panel={joinPanel} fallbackHref="/involve/volunteer" />
              <LinkPanel
                title={asString(storyRelated.title, "相关")}
                links={asObjectArray(storyRelated.links)}
              />
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "news" && NEWS_MENU_SLUGS.has(slug)) {
    const resolvedTitle = asString(payload.title, NEWS_TITLE_DEFAULTS[slug] ?? title);
    const resolvedSubtitle = asString(payload.subtitle, pageSubtitle);
    const pagerItems = asStringArray(payload.pager, ["1", "2", "3", "下一页 →"]);
    const yearPanel = asRecord(payload.yearPanel);
    const yearLinks = asObjectArray(yearPanel.links).map((row) => ({
      label: asString(row.label),
      href: asString(row.href, "#")
    }));
    const renderPager = (
      <nav className="pager">
        {pagerItems.map((item, index) => (
          <a key={item} className={index === 0 ? "on" : ""} href="#">
            {item}
          </a>
        ))}
      </nav>
    );
    const renderYearPanel =
      yearLinks.length > 0 ? (
        <div className="panel">
          <h4>{asString(yearPanel.title, "按年份")}</h4>
          <ul>
            {yearLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href}>{link.label}</a>
              </li>
            ))}
          </ul>
        </div>
      ) : null;

    if (slug === "index") {
      const baseItems = asObjectArray(payload.items).map((row) => ({
        slug: asString(row.slug),
        href: asString(row.href),
        image: asString(row.image),
        tag: asString(row.tag),
        title: asString(row.title),
        summary: asString(row.summary),
        meta: asString(row.meta || row.date),
        isVideo: Boolean(row.isVideo)
      }));
      // Empty, deliberately. This used to hold an invented lead story naming a
      // real congressman and claiming a proclamation entered into the
      // Congressional Record. It is not rendering today because the CMS payload
      // supplies its own lead -- but a page saved without one would have
      // published it as reporting.
      const fallbackLead = {
        slug: "",
        href: "",
        image: "",
        tag: "",
        title: "",
        summary: "",
        meta: ""
      };
      const frontLeadPayload = asRecord(payload.frontLead);
      const frontLead = {
        slug: asString(frontLeadPayload.slug, fallbackLead.slug),
        href: asString(frontLeadPayload.href, fallbackLead.href),
        image: asString(frontLeadPayload.image, fallbackLead.image),
        tag: asString(frontLeadPayload.tag, fallbackLead.tag),
        title: asString(frontLeadPayload.title, fallbackLead.title),
        summary: asString(frontLeadPayload.summary, fallbackLead.summary),
        meta: asString(frontLeadPayload.meta, fallbackLead.meta)
      };
      const frontListRaw = asObjectArray(payload.frontList);
      const frontList =
        frontListRaw.length > 0
          ? frontListRaw.map((row) => ({
              slug: asString(row.slug),
              href: asString(row.href),
              thumb: asString(row.thumb, asString(row.image)),
              tag: asString(row.tag),
              title: asString(row.title),
              meta: asString(row.meta)
            }))
          : [];

      const briefItems = asObjectArray(payload.briefItems).length
        ? asObjectArray(payload.briefItems).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            date: asString(row.date),
            title: asString(row.title)
          }))
        : [];

      const solidarity = asRecord(payload.solidaritySection);
      const solidarityItems = asObjectArray(solidarity.items).length
        ? asObjectArray(solidarity.items).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            image: asString(row.image),
            title: asString(row.title),
            summary: asString(row.summary),
            meta: asString(row.meta)
          }))
        : [];

      const investigations = asRecord(payload.investigationsSection);
      const investigationItems = asObjectArray(investigations.items).length
        ? asObjectArray(investigations.items).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            title: asString(row.title),
            facts: asStringArray(row.facts, []),
            actions: asStringArray(row.actions, [])
          }))
        : [];

      const commentary = asRecord(payload.commentarySection);
      const commentaryItems = asObjectArray(commentary.items).length
        ? asObjectArray(commentary.items).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            image: asString(row.image),
            tag: asString(row.tag),
            title: asString(row.title),
            summary: asString(row.summary),
            meta: asString(row.meta)
          }))
        : [];

      const announcements = asRecord(payload.announcementsSection);
      const announcementItems = asObjectArray(announcements.items).length
        ? asObjectArray(announcements.items).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            date: asString(row.date),
            badge: asString(row.badge),
            title: asString(row.title)
          }))
        : [];

      const stories = asRecord(payload.storiesSection);
      const storyItems = asObjectArray(stories.items).length
        ? asObjectArray(stories.items).map((row) => ({
            slug: asString(row.slug),
            href: asString(row.href),
            image: asString(row.image),
            title: asString(row.title),
            summary: asString(row.summary),
            meta: asString(row.meta),
            isVideo: Boolean(row.isVideo)
          }))
        : [];

      const notable = asRecord(payload.notableSection);
      const testimonials = asObjectArray(notable.testimonials).length
        ? asObjectArray(notable.testimonials).map((row) => ({
            quote: asString(row.quote),
            name: asString(row.name),
            role: asString(row.role),
            image: asString(row.image)
          }))
        : [
            {
              quote:
                "作为外交官，按理应该为国家利益服务，但我在那里做的事大多不是为了国家利益，而是在迫害自己的人民。",
              name: "陈用林",
              role: "中共前外交官\n驻悉尼总领事馆一等秘书",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png"
            },
            {
              quote: "我 1991 年加入中国共产党，当时对它抱有很高的期望，但事实并不像我想像的那样。",
              name: "郝凤军",
              role: "原天津市公安局\n「六一〇」办公室官员",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png"
            },
            {
              quote: "我当记者二十多年，说了二十多年谎话。今天，我说一句真话：我退党。",
              name: "曲吉莲",
              role: "黑龙江佳木斯日报记者\n从业二十余年",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png"
            }
          ];

      const archive = asRecord(payload.archiveSection);
      const archiveCards = asObjectArray(archive.cards).length
        ? asObjectArray(archive.cards).map((row) => ({
            title: asString(row.title),
            body: asString(row.body),
            href: asString(row.href, "#")
          }))
        : [
            { title: "按年份", body: "2005 年至今，约 2,800 篇。逐年浏览。", href: "#" },
            { title: "按栏目", body: "六个栏目的完整列表与标签。", href: "#" },
            { title: "仅报告与文件", body: "调查报告、年度报告与政策文件。", href: "#" },
            { title: "仅影音", body: "影片、纪录片与音频节目。", href: "#" }
          ];
      const archiveNote = asString(
        archive.note,
        "本站全部内容可自由下载、转载、翻译与再制作，无需事先取得授权，注明来源即可。图片请一并保留摄影署名。"
      );
      const archiveNoteLinkLabel = asString(archive.noteLinkLabel, "媒体与记者资料");
      const archiveNoteLinkHref = asString(archive.noteLinkHref, "/resources/press");
      const articlePool = [
        frontLead,
        ...frontList,
        ...briefItems,
        ...solidarityItems,
        ...investigationItems,
        ...commentaryItems,
        ...announcementItems,
        ...storyItems
      ]
        .map((row) => ({
          slug: asString((row as Record<string, unknown>).slug),
          href: asString((row as Record<string, unknown>).href),
          title: asString((row as Record<string, unknown>).title)
        }))
        .filter((row) => row.slug || row.href || row.title);
      if (articlePool.length === 0) {
        articlePool.push({
          slug: frontLead.slug,
          href: frontLead.href,
          title: frontLead.title
        });
      }
      const pickPool = (seed: number) => articlePool[Math.abs(seed) % articlePool.length];
      const resolveIndexArticleHref = (
        row: {
          href?: string;
          slug?: string;
          title?: string;
        },
        seed: number
      ) => {
        const rawHref = asString(row.href);
        const rawSlug = asString(row.slug);
        const rawTitle = asString(row.title);
        const fallback = pickPool(seed);
        const shouldFallback = !rawHref || rawHref === "#" || rawHref === "/news/article";
        return resolveNewsArticleHref({
          href: shouldFallback ? fallback.href : rawHref,
          slug: shouldFallback ? rawSlug || fallback.slug : rawSlug,
          title: rawTitle || fallback.title
        });
      };
      const indexSubtitle = (() => {
        const raw = asString(payload.subtitle).trim();
        if (!raw) {
          return "机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。";
        }
        return raw.includes("所有内容注明来源与日期，可自由转载")
          ? "机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。"
          : raw;
      })();

      return (
        <>
          <InteriorHead section={section} slug={slug} title={resolvedTitle} subtitle={indexSubtitle} />
          <InteriorTabs section={section} slug={slug} />

          <section className="sec" style={{ padding: "48px 0 0" }}>
            <div className="wrap front">
              <article className="lead-big">
                <a href={resolveIndexArticleHref(frontLead, 0)}>
                  {frontLead.image ? <img src={frontLead.image} alt={frontLead.title} /> : renderNoImageSlot("lead")}
                  <div style={{ marginTop: 16 }}>
                    <span className="tag">{frontLead.tag}</span>
                  </div>
                  <h2>{frontLead.title}</h2>
                  <p>{frontLead.summary}</p>
                  <p className="meta">{frontLead.meta}</p>
                </a>
              </article>
              <div className="sec-list">
                {frontList.map((row, index) => (
                  <article key={row.title} className="sec-item">
                    <a href={resolveIndexArticleHref(row, index + 1)}>
                      {row.thumb ? (
                        <img className="sec-item-thumb" src={row.thumb} alt={row.title} />
                      ) : (
                        renderNoImageSlot("mini")
                      )}
                      <div>
                        <span className="tag">{row.tag}</span>
                        <h3>{row.title}</h3>
                        <p className="meta">{row.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "44px 0 0" }}>
            <div className="wrap">
              <div className="brief">
                <div className="brief-hd">
                  <span className="brief-dot" />
                  今日速览 · 每日更新
                </div>
                <ul>
                  {briefItems.map((row, index) => (
                    <li key={`${row.date}-${row.title}`}>
                      <time>{row.date}</time>
                      <a href={resolveIndexArticleHref(row, index + 8)}>
                        {row.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "64px 0 0" }}>
            <div className="wrap">
              <div className="cat-hd">
                <h2>{asString(solidarity.title, "国际声援行动")}</h2>
                <a href={asString(solidarity.moreHref, "/news/solidarity")}>{asString(solidarity.moreLabel, "全部声援行动 →")}</a>
              </div>
              <div className="cat3">
                {solidarityItems.map((row, index) => (
                  <article key={row.title}>
                    <a href={resolveIndexArticleHref(row, index + 20)}>
                      {row.image ? <img src={row.image} alt={row.title} /> : renderNoImageSlot("card")}
                      <h3>{row.title}</h3>
                      <p>{row.summary}</p>
                      <p className="meta">{row.meta}</p>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="dark-cat" style={{ marginTop: 64 }}>
            <div className="wrap">
              <div className="cat-hd">
                <h2>{asString(investigations.title, "追查国际调查报告")}</h2>
                <a href={asString(investigations.moreHref, "/news/investigations")}>{asString(investigations.moreLabel, "全部调查报告 →")}</a>
              </div>
              <p className="lede" style={{ margin: "-10px 0 30px", maxWidth: "64ch" }}>
                {asString(
                  investigations.lede,
                  "由追查迫害法轮功国际组织独立发布，本中心转载。该组织自 2006 年起持续取证，已公开 866 段调查录音与逾 4,000 份文献证据。"
                )}
              </p>
              <div>
                {investigationItems.map((row, index) => (
                  <article key={row.title} className="docrow">
                    <a href={resolveIndexArticleHref(row, index + 40)} style={{ display: "contents" }}>
                      <div>
                        <h3>{row.title}</h3>
                        <div className="facts">
                          {row.facts.map((fact) => (
                            <span key={fact}>{fact}</span>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(row.actions.length > 0 ? row.actions : ["在线阅读", "PDF"]).slice(0, 2).map((action) => (
                          <span key={action} className="docpill">
                            {action}
                          </span>
                        ))}
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "64px 0 0" }}>
            <div className="wrap cat-split">
              <div>
                <div className="cat-hd">
                  <h2>{asString(commentary.title, "专题报导与时政评论")}</h2>
                  <a href={asString(commentary.moreHref, "/news/commentary")}>{asString(commentary.moreLabel, "全部 →")}</a>
                </div>
                <div className="arch">
                  {commentaryItems.map((row, index) => (
                    <article key={row.title} className="arow" style={index === 0 ? { paddingTop: 0 } : undefined}>
                      <a href={resolveIndexArticleHref(row, index + 60)} style={{ display: "contents" }}>
                        {row.image ? <img src={row.image} alt={row.title} /> : renderNoImageSlot("row")}
                        <div>
                          <span className="tag">{row.tag}</span>
                          <h3>{row.title}</h3>
                          <p>{row.summary}</p>
                          <p className="meta">{row.meta}</p>
                        </div>
                      </a>
                    </article>
                  ))}
                </div>
              </div>

              <div>
                <div className="cat-hd">
                  <h2>{asString(announcements.title, "机构公告与声明")}</h2>
                  <a href={asString(announcements.moreHref, "/news/announcement-claims")}>{asString(announcements.moreLabel, "全部 →")}</a>
                </div>
                <div className="arch">
                  {announcementItems.map((row, index) => (
                    <article key={row.title} className="notice-row" style={index === 0 ? { paddingTop: 0 } : undefined}>
                      <a href={resolveIndexArticleHref(row, index + 80)} style={{ display: "contents" }}>
                        <p className="d">{row.date}</p>
                        <div>
                          <span className="badge-official">{row.badge}</span>
                          <h3 style={{ fontSize: 18 }}>{row.title}</h3>
                        </div>
                      </a>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "64px 0 0" }}>
            <div className="wrap">
              <div className="cat-hd">
                <h2>{asString(stories.title, "三退新闻与故事")}</h2>
                <a href={asString(stories.moreHref, "/news/stories")}>{asString(stories.moreLabel, "全部三退新闻 →")}</a>
              </div>
              <div className="cat3">
                {storyItems.map((row, index) => (
                  <article key={row.title}>
                    <a href={resolveIndexArticleHref(row, index + 100)}>
                      {row.image
                        ? row.isVideo
                          ? (
                              <div className="athumb">
                                <img src={row.image} alt={row.title} />
                                <span className="play">▶ 影片</span>
                              </div>
                            )
                          : <img src={row.image} alt={row.title} />
                        : renderNoImageSlot("card")}
                      <h3>{row.title}</h3>
                      <p>{row.summary}</p>
                      <p className="meta">{row.meta}</p>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "64px 0 0" }}>
            <div className="wrap">
              <div className="cat-hd">
                <h2>{asString(notable.title, "名人退党")}</h2>
                <a href={asString(notable.moreHref, "/news/notable")}>{asString(notable.moreLabel, "全部证词 →")}</a>
              </div>
              <div className="testi">
                {testimonials.map((row) => (
                  <article key={row.name}>
                    <blockquote>{row.quote}</blockquote>
                    <div className="who">
                      {/* A portrait we do not have is simply absent: the row is
                          flex, so nothing collapses without a placeholder. */}
                      {row.image ? <img src={row.image} alt={row.name} /> : null}
                      <div>
                        <b>{row.name}</b>
                        <span style={{ whiteSpace: "pre-line" }}>{row.role}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </section>

          <section className="sec" style={{ padding: "64px 0 96px" }}>
            <div className="wrap">
              <div className="cat-hd">
                <h2>{asString(archive.title, "查阅归档")}</h2>
                <a href={asString(archive.moreHref, "#")}>{asString(archive.moreLabel, "高级检索 →")}</a>
              </div>
              <div className="archbox">
                {archiveCards.map((row) => (
                  <a key={row.title} href={row.href}>
                    <b>{row.title}</b>
                    <span>{row.body}</span>
                  </a>
                ))}
              </div>
              <p style={{ fontSize: 13.5, color: "var(--muted)", margin: "22px 0 0", lineHeight: "var(--lh-body)", maxWidth: "72ch" }}>
                {archiveNote}
                <a href={archiveNoteLinkHref} style={{ color: "var(--seal)" }}>
                  {archiveNoteLinkLabel}
                </a>
              </p>
            </div>
          </section>
        </>
      );
    }

    if (slug === "announcements") {
      const rows = asObjectArray(payload.noticeRows)
        .map((row) => ({
          slug: asString(row.slug),
          href: asString(row.href),
          date: asString(row.date),
          badge: asString(row.badge),
          title: asString(row.title),
          summary: asString(row.summary)
        }))
        .slice(0, NEWS_SUBMENU_PAGE_SIZE);
      const subscribePanel = asRecord(payload.subscribePanel);
      const relatedPanel = asRecord(payload.relatedPanel);
      const relatedLinks = asObjectArray(relatedPanel.links).map((row) => ({
        label: asString(row.label),
        href: asString(row.href, "#")
      }));
      return (
        <>
          <InteriorHead section={section} slug={slug} title={resolvedTitle} subtitle={resolvedSubtitle} />
          <InteriorTabs section={section} slug={slug} />
          <section className="sec" style={{ paddingTop: 52 }}>
            <div className="wrap cols">
              <article>
                <div className="arch">
                  {rows.map((row, index) => (
                    <article key={`${row.title}-${index}`} className="notice-row">
                      <a
                        href={resolveNewsArticleHref({
                          href: row.href,
                          slug: row.slug,
                          title: row.title
                        })}
                        style={{ display: "contents" }}
                      >
                        <p className="d">{row.date}</p>
                        <div>
                          <span className="badge-official">{row.badge}</span>
                          <h3>{row.title}</h3>
                          <p>{row.summary}</p>
                        </div>
                      </a>
                    </article>
                  ))}
                </div>
                {renderPager}
              </article>
              <aside className="side">
                <div className="panel panel--seal">
                  <h4>{asString(subscribePanel.title, "订阅公告")}</h4>
                  <p>{asString(subscribePanel.body, "重要公告可通过邮件接收，不需要访问网站。")}</p>
                  <a className="btn btn--seal btn--sm" href={asString(subscribePanel.buttonHref, "#")}>
                    {asString(subscribePanel.buttonLabel, "邮件订阅")}
                  </a>
                </div>
                <div className="panel">
                  <h4>{asString(relatedPanel.title, "相关")}</h4>
                  <ul>
                    {relatedLinks.map((link) => (
                      <li key={link.label}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
                {renderYearPanel}
              </aside>
            </div>
          </section>
        </>
      );
    }

    if (slug === "investigations") {
      const introNotice = asRecord(payload.introNotice);
      const docRows = asObjectArray(payload.docRows)
        .map((row, index) => {
          const mappedActions = asObjectArray(row.actions).map((item) => ({
            label: asString(item.label),
            href: asString(item.href, "#")
          }));
          const inferredVideo = mappedActions.some((item) => item.label.includes("▶") || item.label.includes("观看"));
          return {
            slug: asString(row.slug),
            href: asString(row.href),
            image: asString(row.image),
            isVideo: typeof row.isVideo === "boolean" ? row.isVideo : inferredVideo,
            title: asString(row.title),
            summary: asString(row.summary),
            facts: asStringArray(row.facts, []),
            actions: mappedActions
          };
        })
        .slice(0, NEWS_SUBMENU_PAGE_SIZE);
      const evidencePanel = asRecord(payload.evidencePanel);
      const evidenceItems = asStringArray(evidencePanel.items, []);
      const reusePanel = asRecord(payload.reusePanel);
      return (
        <>
          <InteriorHead section={section} slug={slug} title={resolvedTitle} subtitle={resolvedSubtitle} />
          <InteriorTabs section={section} slug={slug} />
          <section className="sec" style={{ paddingTop: 52 }}>
            <div className="wrap cols">
              <article>
                <div className="notice">
                  <b>{asString(introNotice.title, "关于本栏目")}</b>
                  {asString(introNotice.body)}
                </div>
                <div className="arch" style={{ marginTop: 36 }}>
                  {docRows.map((row, index) => (
                    <article key={`${row.title}-${index}`} className="doc">
                      <a
                        href={resolveNewsArticleHref({
                          href: row.href,
                          slug: row.slug,
                          title: row.title
                        })}
                        className="doc-thumb-link"
                        aria-label={row.title}
                      >
                        {row.image
                          ? row.isVideo
                            ? (
                                <div className="athumb doc-thumb">
                                  <img className="athumb-img" src={row.image} alt={row.title} />
                                  <span className="play">▶ 影片</span>
                                </div>
                              )
                            : <img className="athumb-img doc-thumb" src={row.image} alt={row.title} />
                          : renderNoImageSlot("doc")}
                      </a>
                      <div>
                        <a
                          href={resolveNewsArticleHref({
                            href: row.href,
                            slug: row.slug,
                            title: row.title
                          })}
                        >
                          <h3>{row.title}</h3>
                        </a>
                        <p>{row.summary}</p>
                        <div className="facts">
                          {row.facts.map((fact) => (
                            <span key={fact}>{fact}</span>
                          ))}
                        </div>
                      </div>
                      <div className="act">
                        {row.actions.map((action) => (
                          <a key={action.label} className="pill" href={action.href}>
                            {action.label}
                          </a>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
                {renderPager}
              </article>
              <aside className="side">
                <div className="panel">
                  <h4>{asString(evidencePanel.title, "证据类型")}</h4>
                  <ul>
                    {evidenceItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="panel panel--seal">
                  <h4>{asString(reusePanel.title, "可自由引用")}</h4>
                  <p>{asString(reusePanel.body)}</p>
                  <a className="btn btn--seal btn--sm" href={asString(reusePanel.buttonHref, "/resources/press")}>
                    {asString(reusePanel.buttonLabel, "媒体与记者")}
                  </a>
                </div>
                {renderYearPanel}
              </aside>
            </div>
          </section>
        </>
      );
    }

    if (slug === "notable") {
      const filters = asStringArray(payload.filters, ["全部", "外交与情报", "公安与司法", "党政干部", "媒体", "学界"]);
      const profiles = asObjectArray(payload.profiles).map((row) => ({
        quote: asString(row.quote),
        name: asString(row.name),
        role: asString(row.role),
        image: asString(row.image, "https://picsum.photos/seed/notable/200/200")
      }));
      const aboutPanel = asRecord(payload.aboutPanel);
      const relatedPanel = asRecord(payload.relatedPanel);
      const relatedLinks = asObjectArray(relatedPanel.links).map((row) => ({
        label: asString(row.label),
        href: asString(row.href, "#")
      }));
      return (
        <>
          <InteriorHead section={section} slug={slug} title={resolvedTitle} subtitle={resolvedSubtitle} />
          <InteriorTabs section={section} slug={slug} />
          <section className="sec" style={{ paddingTop: 52 }}>
            <div className="wrap cols">
              <article>
                <div className="filters">
                  {filters.map((label, index) => (
                    <a key={label} className={`chip${index === 0 ? " on" : ""}`} href="#">
                      {label}
                    </a>
                  ))}
                </div>
                <div className="pgrid">
                  {profiles.map((profile) => (
                    <article key={profile.name} className="pcard">
                      <blockquote>{profile.quote}</blockquote>
                      <div className="who">
                        {profile.image ? <img src={profile.image} alt={profile.name} /> : null}
                        <div>
                          <b>{profile.name}</b>
                          <span style={{ whiteSpace: "pre-line" }}>{profile.role}</span>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                {renderPager}
              </article>
              <aside className="side">
                <div className="panel">
                  <h4>{asString(aboutPanel.title, "关于本栏目")}</h4>
                  <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: "0 0 14px" }}>
                    {asString(aboutPanel.body)}
                  </p>
                </div>
                <div className="panel">
                  <h4>{asString(relatedPanel.title, "相关")}</h4>
                  <ul>
                    {relatedLinks.map((link) => (
                      <li key={link.label}>
                        <a href={link.href}>{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
                {renderYearPanel}
              </aside>
            </div>
          </section>
        </>
      );
    }

    const filters = asStringArray(payload.filters, ["全部", "最新"]);
    const newsRowsRaw = asObjectArray(payload.items).map((row) => ({
      slug: asString(row.slug),
      href: asString(row.href),
      image: section === "news" ? asString(row.image) : asString(row.image, "https://picsum.photos/seed/news/640/420"),
      tag: asString(row.tag),
      title: asString(row.title),
      summary: asString(row.summary),
      meta: asString(row.meta || row.date),
      isVideo: Boolean(row.isVideo)
    }));
    const newsRows =
      section === "news" && (slug === "commentary" || slug === "solidarity" || slug === "stories")
        ? newsRowsRaw.slice(0, NEWS_SUBMENU_PAGE_SIZE)
        : newsRowsRaw;
    const sectionPanel = asRecord(payload.sectionPanel);
    const sectionLinks = asObjectArray(sectionPanel.links).map((row) => ({
      label: asString(row.label),
      href: asString(row.href, "#")
    }));
    const reusePanel = asRecord(payload.reusePanel);
    const authorPanel = asRecord(payload.authorPanel);
    const authorLinks = asObjectArray(authorPanel.links).map((row) => ({
      label: asString(row.label),
      href: asString(row.href, "#")
    }));
    const notePanel = asRecord(payload.notePanel);
    const docsPanel = asRecord(payload.docsPanel);
    const docsLinks = asObjectArray(docsPanel.links).map((row) => ({
      label: asString(row.label),
      href: asString(row.href, "#")
    }));
    const ctaPanel = asRecord(payload.ctaPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).map((row) => ({
      label: asString(row.label),
      href: asString(row.href, "#")
    }));

    return (
      <>
        <InteriorHead section={section} slug={slug} title={resolvedTitle} subtitle={resolvedSubtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <article>
              <div className="filters">
                {filters.map((label, index) => (
                  <a key={label} className={`chip${index === 0 ? " on" : ""}`} href="#">
                    {label}
                  </a>
                ))}
              </div>
              <div className="arch">
                {newsRows.map((row, index) => (
                  <article key={`${row.title}-${index}`} className="arow">
                    <a
                      href={resolveNewsArticleHref({
                        href: row.href,
                        slug: row.slug,
                        title: row.title
                      })}
                      style={{ display: "contents" }}
                    >
                      {row.image
                        ? row.isVideo
                          ? (
                              <div className="athumb">
                                <img className="athumb-img" src={row.image} alt="" />
                                <span className="play">▶ 影片</span>
                              </div>
                            )
                          : <img className="athumb-img" src={row.image} alt="" />
                        : section === "news"
                          ? renderNoImageSlot("row")
                          : null}
                      <div>
                        <span className="tag">{row.tag}</span>
                        <h3>{row.title}</h3>
                        <p>{row.summary}</p>
                        <p className="meta">{row.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
              {renderPager}
            </article>
            <aside className="side">
              {slug === "index" ? (
                <>
                  <div className="panel">
                    <h4>{asString(sectionPanel.title, "栏目")}</h4>
                    <ul>
                      {sectionLinks.map((link) => (
                        <li key={link.label}>
                          <a href={link.href}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {renderYearPanel}
                  <div className="panel panel--seal">
                    <h4>{asString(reusePanel.title, "转载")}</h4>
                    <p>{asString(reusePanel.body)}</p>
                    <a className="btn btn--seal btn--sm" href={asString(reusePanel.buttonHref, "/resources")}>
                      {asString(reusePanel.buttonLabel, "进入资源馆")}
                    </a>
                  </div>
                </>
              ) : null}

              {slug === "commentary" ? (
                <>
                  <div className="panel">
                    <h4>{asString(authorPanel.title, "专栏作者")}</h4>
                    <ul>
                      {authorLinks.map((link) => (
                        <li key={link.label}>
                          <a href={link.href}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="panel">
                    <h4>{asString(notePanel.title, "说明")}</h4>
                    <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: 0 }}>
                      {asString(notePanel.body)}
                    </p>
                  </div>
                  {renderYearPanel}
                </>
              ) : null}

              {slug === "solidarity" ? (
                <>
                  <div className="panel">
                    <h4>{asString(docsPanel.title, "议会文件")}</h4>
                    <ul>
                      {docsLinks.map((link) => (
                        <li key={link.label}>
                          <a href={link.href}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="panel panel--seal">
                    <h4>{asString(ctaPanel.title, "参与联署")}</h4>
                    <p>{asString(ctaPanel.body)}</p>
                    <a className="btn btn--seal btn--sm" href={asString(ctaPanel.buttonHref, "/involve/endccp")}>
                      {asString(ctaPanel.buttonLabel, "了解联署")}
                    </a>
                  </div>
                  {renderYearPanel}
                </>
              ) : null}

              {slug === "stories" ? (
                <>
                  <div className="panel panel--seal">
                    <h4>{asString(ctaPanel.title, "你也可以声明")}</h4>
                    <p>{asString(ctaPanel.body)}</p>
                    <a className="btn btn--seal btn--sm" href={asString(ctaPanel.buttonHref, "/services/declare")}>
                      <span className="stamp">{asString(ctaPanel.buttonStamp, "退")}</span>
                      {asString(ctaPanel.buttonLabel, "我要三退")}
                    </a>
                  </div>
                  <div className="panel">
                    <h4>{asString(relatedPanel.title, "相关")}</h4>
                    <ul>
                      {relatedLinks.map((link) => (
                        <li key={link.label}>
                          <a href={link.href}>{link.label}</a>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {renderYearPanel}
                </>
              ) : null}
            </aside>
          </div>
        </section>
      </>
    );
  }

  const base = section === "news" ? "/news" : `/${section}`;
  return (
    <>
      <InteriorHead section={section} slug="index" title={title} subtitle={pageSubtitle} />
      <section className="sec">
        <div className="wrap cols">
          <article>
            <div className="filters">
              {filterLabels.map((label, index) => (
                <a key={label} className={`chip${index === 0 ? " on" : ""}`} href="#">
                  {label}
                </a>
              ))}
            </div>
            <div className="arch">
              {rows.map((row) => (
                <article key={row.slug} className="arow">
                  <div className="athumb">
                    <div className="sectionCard" />
                  </div>
                  <div>
                    <p className="meta">{row.date}</p>
                    <Link href={`${base}/${row.slug || "sample-item-1"}` as Route}>
                      <h3>{row.title}</h3>
                    </Link>
                    <p>{row.summary || "支持大规模归档检索和分页加载，适用于持续增长的文章库。"}</p>
                  </div>
                </article>
              ))}
            </div>
            <div className="pager">
              <a className="on" href="#">
                1
              </a>
              <a href="#">2</a>
              <a href="#">3</a>
            </div>
          </article>
          <aside className="side">
            <section className="panel">
              <h4>归档工具</h4>
              <ul>
                <li>
                  <Link href="/search">站内搜索</Link>
                </li>
                <li>
                  <Link href="/admin/articles">管理文章</Link>
                </li>
                <li>
                  <Link href="/admin/categories">分类维护</Link>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
