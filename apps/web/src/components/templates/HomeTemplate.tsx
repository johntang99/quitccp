import { getHomeNews, getHomeVideo, type HomeNewsLive, type HomeVideoLive } from "@/lib/public-content";
import { getHomepageHeroContent } from "@/lib/public-settings";
import { NoWrapTitles } from "@/components/public/NoWrapTitles";
import { formatYi, getSantuiSnapshot, toFeedRow } from "@/lib/santui";
import { HeroBackgroundVideo, HeroGallery, HeroVideo } from "@/components/public/HeroMedia";
import { DawnBand } from "./DawnBand";
import { BroadsheetBand } from "./BroadsheetBand";
import { ScreeningBand } from "./ScreeningBand";
import { VerifiedBand } from "./VerifiedBand";
import { externalLinkProps } from "@/lib/external-services";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString } from "./content-utils";
import type { HomeContent } from "@quitccp/content-schema";
import { resolveHomeContent } from "./home-content";

/**
 * Last-resort rows for the 实时登记册 ticker.
 *
 * !! THESE ARE PLACEHOLDERS, NOT REAL DECLARATIONS. !!
 * The trail is now filled from santui.tuidang.org's 精彩推荐 via
 * `npm run sync:santui` (see `@/lib/santui`), and these are reached only when
 * no snapshot has ever been written -- a fresh database, or a machine that has
 * never run the sync. They read as genuine records of real people and are not,
 * so a deployment that shows them is misconfigured, not merely stale.
 *
 * Content is deliberately NOT editable in the CMS: real declarations belong to
 * the feed, not to an editor. Only the section's layout is configurable.
 */
const streamEntries = [
  {
    region: "No. 464,375,381",
    name: "伍万＊ · 中国大陆",
    text: "在中国大陆从小被动加入了少先队及共青团。在认清中共的本质后，特此郑重声明退出，彻底与其组织决裂。",
    at: "2026-08-08"
  },
  {
    region: "No. 464,375,380",
    name: "陈＊ · 日本",
    text: "出国后看到了国内看不到的报道，才明白过去所受的教育是怎么回事。郑重声明退出党、团、队。",
    at: "2026-08-08"
  },
  {
    region: "No. 464,375,379",
    name: "李＊明 · 中国大陆",
    text: "少年时入队，读书时入团，从未认真想过那意味着什么。今天想清楚了，声明全部退出。",
    at: "2026-08-08"
  },
  {
    region: "No. 464,375,378",
    name: "一个北方人 · 中国大陆",
    text: "看过《九评》之后想了很久。我不愿再与这个组织有任何牵连，特此声明三退。",
    at: "2026-08-07"
  },
  {
    region: "No. 464,375,377",
    name: "王＊ · 加拿大",
    text: "移民后办理身份时才重新面对这段经历。郑重声明退出曾经加入的少先队与共青团。",
    at: "2026-08-07"
  },
  {
    region: "No. 464,375,376",
    name: "张＊华 · 台湾",
    text: "亲友在大陆的遭遇让我无法沉默。声明退出中共的一切组织，与其彻底划清界限。",
    at: "2026-08-07"
  },
  {
    region: "No. 464,375,375",
    name: "刘＊ · 中国大陆",
    text: "在体制内工作多年，见过太多不该发生的事。今日声明退党，只求心里干净。",
    at: "2026-08-06"
  },
  {
    region: "No. 464,375,374",
    name: "小＊ · 香港",
    text: "这几年发生的事让我看清了很多。特此声明退出曾经加入过的共青团与少先队。",
    at: "2026-08-06"
  },
  {
    region: "No. 464,375,373",
    name: "赵＊ · 欧洲",
    text: "在海外生活多年，回头再看那段经历，只想把它彻底了断。郑重声明三退。",
    at: "2026-08-06"
  },
  {
    region: "No. 464,375,372",
    name: "一位退休教师 · 中国大陆",
    text: "教了一辈子书，最后明白有些话不能再替它说。声明退出中共党、团、队组织。",
    at: "2026-08-05"
  }
];

/** Renders a possibly-multiline string, honouring `\n` as a line break. */
function MultiLine({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <>
      {lines.map((line, index) => (
        <span key={`${line}-${index}`}>
          <NoWrapTitles text={line} />
          {index < lines.length - 1 ? <br /> : null}
        </span>
      ))}
    </>
  );
}

function SectionHead({
  eyebrow,
  heading,
  lede,
  moreLabel,
  moreHref
}: {
  eyebrow: string;
  heading: string;
  lede?: string;
  moreLabel?: string;
  moreHref?: string;
}) {
  return (
    <div className="sec-head">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2 className="h2">{heading}</h2>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {moreLabel && moreHref ? (
        <a className="more" href={moreHref} {...externalLinkProps(moreHref)}>
          {moreLabel}
        </a>
      ) : null}
    </div>
  );
}

/** The article's own page, not the old site's copy of it. */
const newsHref = (slug: string) => `/news/${encodeURIComponent(slug)}`;

/**
 * Swaps the hand-typed lead and 最新发布 rows for live articles.
 *
 * Everything the editor writes -- eyebrow, heading, the 更多 labels, the kicker
 * over the lead -- is kept; only title, summary, image, date and destination
 * come from the database.
 */
function withLiveNews(news: HomeContent["news"], live: HomeNewsLive): HomeContent["news"] {
  const lead = live.lead!;
  return {
    ...news,
    lead: {
      ...news.lead,
      image: lead.image,
      // The chip stays whatever the editor wrote (头条); it labels the slot, not
      // the article.
      meta: (lead.publishedAt ?? "").slice(0, 10),
      title: lead.title,
      body: lead.summary,
      href: newsHref(lead.slug)
    },
    items:
      live.items.length > 0
        ? live.items.map((card) => ({
            title: card.title,
            date: (card.publishedAt ?? "").slice(0, 10),
            href: newsHref(card.slug),
            image: card.image
          }))
        : news.items
  };
}

/**
 * Gives each 专题栏目 card its column's newest article.
 *
 * A card whose name matches no category keeps whatever it had, so adding a
 * column the article table does not know about degrades rather than empties.
 */
function withLiveChannels(
  channels: HomeContent["channels"],
  live: HomeNewsLive
): HomeContent["channels"] {
  return {
    ...channels,
    cards: channels.cards.map((card) => {
      const resolved = live.channelLeads.get(card.title);
      if (!resolved) return card;
      // The category page, replacing the old menu slugs that returned 404.
      const foot = `/news/${resolved.slug}`;
      if (!resolved.card) return { ...card, footHref: foot, leadHref: foot };
      return {
        ...card,
        image: resolved.card.image,
        leadTitle: resolved.card.title,
        leadHref: newsHref(resolved.card.slug),
        footHref: foot
      };
    })
  };
}

/** 12:47 — blank when a duration was never recovered, rather than 0:00. */
function clockOf(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`
    : `${minutes}:${String(rest).padStart(2, "0")}`;
}

/**
 * Swaps the hand-typed feature and four cards for live videos.
 *
 * The editor keeps the eyebrow, heading, lede, the 本期推荐 chip, the button
 * labels and the series nav. The secondary button's destination follows the
 * feature's own series, so it cannot go on saying 查看全部调查影像 while the
 * feature is a different kind of film.
 */
function withLiveVideo(video: HomeContent["video"], live: HomeVideoLive): HomeContent["video"] {
  const feature = live.feature!;
  const href = `/videos/${encodeURIComponent(feature.slug)}`;
  const minutes = feature.durationSeconds ? `${Math.round(feature.durationSeconds / 60)} 分` : "";
  const seriesHref = video.series.find((row) => row.label === live.featureCategory)?.href;

  return {
    ...video,
    featured: {
      ...video.featured,
      image: feature.coverImage,
      title: feature.title,
      body: feature.description,
      href,
      duration: clockOf(feature.durationSeconds),
      meta: [live.featureCategory, feature.episode, minutes].filter(Boolean),
      primaryHref: href,
      secondaryHref: seriesHref ?? "/videos/archive",
      secondaryLabel: live.featureCategory
        ? `查看全部${live.featureCategory}`
        : video.featured.secondaryLabel
    },
    items:
      live.items.length > 0
        ? live.items.map((row, index) => ({
            title: row.card.title,
            meta: [row.category, row.card.episode].filter(Boolean).join(" · "),
            href: `/videos/${encodeURIComponent(row.card.slug)}`,
            image: row.card.coverImage,
            duration: clockOf(row.card.durationSeconds),
            // Only the newest carries it, the way the hand-written list did.
            badge: index === 0 ? "NEW" : ""
          }))
        : video.items
  };
}

export async function HomeTemplate({ content }: TemplatePageData) {
  const heroFallback = await getHomepageHeroContent();
  const payload = asRecord(content);
  const home = resolveHomeContent(payload);
  // The articles in the 主要新闻 band and the four 专题栏目 cards come from the
  // article table, not from what someone last typed into the homepage admin.
  // The editor still owns the headings, the labels and which four columns show.
  const [liveNews, liveVideo, santui] = await Promise.all([
    getHomeNews(home.channels.cards.map((card) => card.title)),
    getHomeVideo(),
    getSantuiSnapshot()
  ]);

  // The hero also has a legacy shape (payload.hero + payload.subtitle) and a
  // settings-backed fallback, both of which predate this schema. Keep honouring
  // them so an un-migrated entry still renders the right words.
  const legacyHero = asRecord(payload.hero);
  const heroTitleRaw = asString(legacyHero.title, home.hero.title || heroFallback.title);
  const heroTitle =
    heroTitleRaw === "让每一个想离开的人，都能留下记录。"
      ? "让每一个想离开的人， 都能留下记录。"
      : heroTitleRaw;
  const heroBody = asString(legacyHero.body, home.hero.body || heroFallback.body);
  const heroEyebrow = asString(payload.subtitle, home.hero.eyebrow);

  const legacyStream = asObjectArray(payload.streamEntries).map((row) => ({
    region: asString(row.region),
    name: asString(row.name),
    text: asString(row.text),
    at: asString(row.at)
  }));
  // Real declarations first. The CMS rows, and failing those the placeholders,
  // only stand in while the santui snapshot is missing or has never been run.
  const streamRows =
    santui && santui.declarations.length > 0
      ? santui.declarations.map(toFeedRow)
      : legacyStream.length > 0
        ? legacyStream
        : streamEntries;

  const { hero, services, news, channels, video, voices, network, resources, about, involve } = home;

  // 卡片叠加·照片 and 卡片叠加·视频 are the same layout with a different backdrop,
  // so both wear the `full-bleed` class and the seventeen CSS rules written for
  // it keep working untouched.
  const heroUsesVideo = hero.variant === "full-bleed-video";
  const isCardOverlay = hero.variant === "full-bleed" || heroUsesVideo;
  const heroLayout = isCardOverlay ? "full-bleed" : hero.variant;
  // The headline figure is santui's, not ours; the CMS value is the fallback
  // for a machine that has never synced.
  const liveCount = santui ? formatYi(santui.total) : "";
  const registry = liveCount ? { ...home.registry, count: liveCount } : home.registry;

  const heroActions = (
    <div className="hero-cta">
      {hero.actions.map((action) => (
        <a
          key={`${action.label}-${action.href}`}
          className={action.variant === "line-light" ? "btn btn--line-light" : "btn btn--seal"}
          href={action.href}
          {...externalLinkProps(action.href)}
        >
          {action.stamp ? <span className="stamp">{action.stamp}</span> : null}
          {action.label}
        </a>
      ))}
    </div>
  );

  const registryCount = (
    <div>
      <p className="eyebrow">{registry.eyebrow}</p>
      <p className="count">{registry.count}</p>
      <p className="count-label">{registry.countLabel}</p>
      {santui ? (
        <p className="count-source">
          来源：全球退党服务中心登记册 · 更新于{" "}
          <time dateTime={santui.fetchedAt}>{santui.fetchedAt.slice(0, 10)}</time>
        </p>
      ) : null}
      <a className="count-note" href={registry.noteHref} {...externalLinkProps(registry.noteHref)}>
        {registry.noteLabel}
      </a>
      <div className="substats">
        {registry.substats.map((stat) => (
          <div className="substat" key={`${stat.value}-${stat.label}`}>
            <b>{stat.value}</b>
            <span>{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const registryStream = (
    <div className="reg-right">
      <div className="stream">
        <div className="stream-hd">
          <span className="dot" />
          <span>{registry.streamHeading}</span>
        </div>
        <div className="track">
          {streamRows.concat(streamRows).map((entry, idx) => (
            <article key={`${entry.name}-${idx}`} className="entry">
              <div className="entry-top">
                <span>{entry.region}</span>
                <span>{entry.at}</span>
              </div>
              <p className="entry-body">{entry.text}</p>
              <div className="entry-foot">
                <span className="seal seal--sm">退</span>
                <span>
                  {"kind" in entry && entry.kind ? `${entry.kind} · ` : ""}
                  {entry.name}
                </span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {hero.enabled ? (
        <section className={`hero hero--${heroLayout}`}>
          {/* site.css already defines `.hero-media` as the full-bleed layer
              behind the scrim -- absolute, object-fit:cover, with the
              prototype's own filter and mirror treatment. full-bleed reuses it
              rather than inventing a second mechanism. The split variants use
              `.hero-aside`, which is an ordinary grid column. */}
          {isCardOverlay && (hero.video.src || hero.image) ? (
            heroUsesVideo && hero.video.src ? (
              // Renders its own `.hero-media` layer, because its speaker button
              // has to sit outside that layer to be clickable at all.
              <HeroBackgroundVideo
                src={hero.video.src}
                // The admin has its own 封面图 field; the hero photograph is
                // the fallback, so leaving that field blank still gives the
                // video a first frame and still gives the readers who never
                // get the video something to look at.
                poster={hero.video.poster || hero.image}
                alt={hero.imageAlt}
                hasAudio={hero.video.hasAudio}
              />
            ) : (
              <div className="hero-media">
                <img src={hero.image} alt={hero.imageAlt} />
              </div>
            )
          ) : null}
          <div className="hero-scrim" />
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <p className="eyebrow eyebrow--onink">{heroEyebrow}</p>
              <h1>
                <MultiLine text={heroTitle} />
              </h1>
              <p>{heroBody}</p>
              {heroActions}
            </div>
            {hero.variant === "photo-split" ? (
              <div className="hero-aside">
                {hero.image ? <img src={hero.image} alt={hero.imageAlt} /> : null}
                {hero.imageAlt ? <p className="hero-media-caption">{hero.imageAlt}</p> : null}
              </div>
            ) : null}
            {hero.variant === "gallery-split" ? (
              <div className="hero-aside">
                <HeroGallery items={hero.gallery} />
              </div>
            ) : null}
            {hero.variant === "video-split" ? (
              <div className="hero-aside">
                <HeroVideo
                  src={hero.video.src}
                  poster={hero.video.poster}
                  caption={hero.video.caption}
                />
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* The dawn variant merges 实时登记册 with 我们的服务 into one band, so the
          standalone services section below is suppressed while it is active. */}
      {registry.enabled && registry.variant === "dawn" ? (
        <DawnBand
          registry={registry}
          services={services}
          voices={voices}
          feed={streamRows}
          updatedAt={santui?.fetchedAt ?? null}
        />
      ) : null}

      {registry.enabled && registry.variant !== "dawn" ? (
        <section className={`sec reg-sec reg-sec--${registry.variant}`}>
          <div className="wrap reg">
            {registry.variant !== "stream-only" ? registryCount : null}
            {registry.variant !== "count-only" ? registryStream : null}
          </div>
        </section>
      ) : null}

      {services.enabled && !(registry.enabled && registry.variant === "dawn") ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={services.eyebrow}
              heading={services.heading}
              moreLabel={services.moreLabel}
              moreHref={services.moreHref}
            />
            <div className={services.variant === "list" ? "sec-list" : `cards${services.variant === "cards2" ? "2" : "3"}`}>
              {services.cards.map((card) => (
                <article key={card.title} className="card">
                  <p className="card-tag">{card.tag}</p>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.links.map((row) => (
                      <li key={`${row.label}-${row.href}`}>
                        <a href={row.href} {...externalLinkProps(row.href)}>
                          <span>{row.label}</span>
                          <em>more</em>
                        </a>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 报刊头版 absorbs 专题栏目, the way 曙光 absorbs 我们的服务. */}
      {news.enabled && news.variant === "broadsheet" ? (
        <BroadsheetBand news={liveNews.lead ? withLiveNews(news, liveNews) : news} channels={withLiveChannels(channels, liveNews)} />
      ) : null}

      {news.enabled && news.variant !== "broadsheet" ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={news.eyebrow}
              heading={news.heading}
              moreLabel={news.moreLabel}
              moreHref={news.moreHref}
            />
            <div className={`news news--${news.variant}`}>
              <article className="lead">
                <a href={news.lead.href} style={{ display: "contents" }} {...externalLinkProps(news.lead.href)}>
                  {news.lead.image ? (
                    <div className="lead-thumb">
                      <img src={news.lead.image} alt="" />
                    </div>
                  ) : null}
                  <div className="sectionCard">
                    {news.lead.tag ? <p className="tag">{news.lead.tag}</p> : null}
                    <h3>{news.lead.title}</h3>
                    <p>{news.lead.body}</p>
                    <p className="meta">{news.lead.meta}</p>
                  </div>
                </a>
              </article>
              <div className="list">
                {news.items.map((row) => (
                  <article key={`${row.title}-${row.date}`} className="item">
                    <a href={row.href} style={{ display: "contents" }} {...externalLinkProps(row.href)}>
                      <div className="thumb">
                        {row.image ? <img src={row.image} alt="" /> : <div className="sectionCard" />}
                      </div>
                      <div>
                        <p className="meta">{row.date}</p>
                        <h4>{row.title}</h4>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {channels.enabled && !(news.enabled && news.variant === "broadsheet") ? (
        <section className="sec">
          <div className="wrap">
            <div className={`chan chan--${channels.variant}`}>
              {channels.cards.map((card) => (
                <article key={card.title} className="chan-card">
                  <h3>{card.title}</h3>
                  <a className="chan-lead" href={card.leadHref} {...externalLinkProps(card.leadHref)}>
                    <div className="thumb">
                      {card.image ? <img src={card.image} alt="" /> : <div className="sectionCard" />}
                      {card.badge ? <span className="badge">{card.badge}</span> : null}
                    </div>
                    <h4>{card.leadTitle}</h4>
                  </a>
                  <ul className="chan-list" />
                  <p className="chan-foot">
                    <a href={card.footHref} {...externalLinkProps(card.footHref)}>
                      {card.footLabel}
                    </a>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {video.enabled && video.variant === "screening" ? (
        <ScreeningBand video={liveVideo.feature ? withLiveVideo(video, liveVideo) : video} />
      ) : null}

      {video.enabled && video.variant !== "screening" ? (
        <section id="video" className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={video.eyebrow}
              heading={video.heading}
              moreLabel={video.moreLabel}
              moreHref={video.moreHref}
            />
            <div className={`vids vids--${video.variant}`}>
              {video.items.map((item) => (
                <article className="vid" key={`${item.title}-${item.href}`}>
                  <a href={item.href} style={{ display: "contents" }} {...externalLinkProps(item.href)}>
                    <div className="thumb">
                      {item.image ? <img src={item.image} alt="" /> : <div className="sectionCard" />}
                    </div>
                    <h4>{item.title}</h4>
                    <p className="meta">{item.meta}</p>
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 曙光 carries 见证者 as its fourth card, so the standalone band steps aside. */}
      {voices.enabled && !(registry.enabled && registry.variant === "dawn") ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={voices.eyebrow}
              heading={voices.heading}
              lede={voices.lede}
              moreLabel={voices.moreLabel}
              moreHref={voices.moreHref}
            />
            <div className={`voices voices--${voices.variant}`}>
              {voices.items.map((item) => (
                <article className="voice" key={item.name}>
                  <blockquote>{item.quote}</blockquote>
                  <div className="voice-who">
                    {item.image ? <img src={item.image} alt="" /> : null}
                    <div>
                      <b>{item.name}</b>
                      <span>
                        <MultiLine text={item.role} />
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {network.enabled ? (
        // Light rather than the dark band it used to be, so it breaks the run
        // of purple between 影音节目 above and 关于我们 below. Colours come from
        // .net-light in globals.css.
        <section className="sec net-light">
          <div className={`wrap net net--${network.variant}`}>
            <div>
              <p className="eyebrow">{network.eyebrow}</p>
              <h2 className="h2">
                <MultiLine text={network.heading} />
              </h2>
              <p className="net-body">{network.body}</p>
              <a
                className="btn btn--line"
                href={network.buttonHref}
                {...externalLinkProps(network.buttonHref)}
              >
                {network.buttonLabel}
              </a>
            </div>
            <div>
              <p className="eyebrow" style={{ marginBottom: 8 }}>
                {network.citiesLabel}
              </p>
              <div className="cities">
                {network.cities.map((city) => (
                  <div key={city}>{city}</div>
                ))}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {resources.enabled ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={resources.eyebrow}
              heading={resources.heading}
              moreLabel={resources.moreLabel}
              moreHref={resources.moreHref}
            />
            <div className={`res res--${resources.variant}`}>
              {resources.items.map((item) => (
                <a key={`${item.label}-${item.href}`} href={item.href} {...externalLinkProps(item.href)}>
                  <span>{item.label}</span>
                  <em>{item.tag}</em>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 可检验 absorbs 参与我们, the way 曙光 absorbs 我们的服务 and 见证者. */}
      {about.enabled && about.variant === "verified" ? (
        <VerifiedBand about={about} involve={involve} />
      ) : null}

      {about.enabled && about.variant !== "verified" ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead
              eyebrow={about.eyebrow}
              heading={about.heading}
              lede={about.lede}
              moreLabel={about.moreLabel}
              moreHref={about.moreHref}
            />
            <div className={`acct acct--${about.variant}`}>
              {about.cells.map((cell) => (
                <div className="acct-cell" key={cell.heading}>
                  <h4>{cell.heading}</h4>
                  {cell.value ? <p className="val">{cell.value}</p> : null}
                  {cell.bars && cell.bars.length > 0 ? (
                    <div className="bars">
                      {cell.bars.map((bar, index) => (
                        <div className="bar" key={bar.label}>
                          {/* Widths were hardcoded pixel values; derive them from
                              the percentage so an editor changing 84% -> 70%
                              actually moves the bar. */}
                          <i
                            className={index === 1 ? "b2" : index === 2 ? "b3" : undefined}
                            style={{ width: `${Math.max(0, Math.min(100, bar.percent))}%` }}
                          />
                          {bar.label}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <p style={cell.bars && cell.bars.length > 0 ? { marginTop: 14 } : undefined}>{cell.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {involve.enabled && !(about.enabled && about.variant === "verified") ? (
        <section className="sec">
          <div className="wrap">
            <SectionHead eyebrow={involve.eyebrow} heading={involve.heading} />
            <div className={`act act--${involve.variant}`}>
              {involve.items.map((item) => (
                <a key={item.title} href={item.href} {...externalLinkProps(item.href)}>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
