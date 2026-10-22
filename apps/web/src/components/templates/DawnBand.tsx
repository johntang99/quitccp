import type { HomeContent } from "@quitccp/content-schema";
import { t } from "@/lib/i18n";
import { EXTERNAL_LINK_PROPS, EXTERNAL_SERVICES, externalLinkProps } from "@/lib/external-services";
import { WitnessCard } from "@/components/public/WitnessCard";
import { RegistryCounter } from "@/components/public/RegistryCounter";

/**
 * 曙光 — the merged 实时登记册 + 我们的服务 band.
 *
 * Implements `docs/prototypes/home-quit-ccp-bright-html`. The two sections used to
 * sit apart with a large dead gap between them; here they share one dawn
 * gradient, with the white service cards straddling its lower edge so the band
 * resolves into the page rather than stopping abruptly.
 *
 * Design values (gradient stops, gold, card shadow, type scale) are lifted from
 * the mockup's inline styles and live in `globals.css` under `.dawn-*`.
 */

interface DawnBandProps {
  registry: HomeContent["registry"];
  services: HomeContent["services"];
  /** 见证者; rendered as the band's fourth card. Omitted when hidden. */
  voices: HomeContent["voices"];
  /** 实时的 End CCP 签署数，已格式化；取不到时为空字符串。 */
  endccpCount: string;
  /** Declaration rows for the feed; only the first `feedCount` are shown. */
  feed: { region: string; name: string; text: string; at: string; kind?: string }[];
  /** ISO timestamp of the last santui sync, when one is available. */
  updatedAt?: string | null;
  /**
   * The exact registry total from the santui snapshot, e.g. 467293946.
   *
   * `registry.count` beside it is the same figure rounded to 「4.67 亿」. The
   * band shows both: the exact number as the headline figure, the rounded one
   * leading the sentence under it, because the two answer different questions
   * -- "how many exactly" and "how big is that".
   *
   * Null on a machine that has never synced, where the band falls back to the
   * 亿 figure alone rather than inventing a precise one.
   */
  total?: number | null;
}

export function DawnBand({ registry, services, voices, feed, updatedAt, total, endccpCount }: DawnBandProps) {
  /*
   * `{{endccp}}` 在卡片文案里就地换成实时签署数。
   *
   * 那段文案原来写着「已有 248 万人签署」，是某次手敲进去的，到 2026-10-17
   * 真实数字已经是 548 万 —— 差了一倍多，而且没人会想起来去改。占位符让编辑
   * 继续掌握整句话怎么写、数字摆在哪，只是不用再去维护数字本身。
   *
   * 取不到数字时连同前后的空格一起去掉，而不是留下一个空洞或者「{{endccp}}」。
   */
  const fillCount = (text: string) =>
    endccpCount ? text.replace(/\{\{\s*endccp\s*\}\}/g, endccpCount) : text.replace(/\s*\{\{\s*endccp\s*\}\}\s*/g, "");
  // The 见证 card only appears when there is something to show in it; without
  // it the row stays the three cards it was.
  const showWitness = voices.enabled && voices.items.length > 0;
  // The design is a row of receding cards, so the row is filled to `feedCount`
  // by cycling whatever entries exist -- the mockup does the same, showing one
  // statement three times. Once the santui feed is wired there will be more
  // than enough entries and the cycling never engages.
  const rows =
    feed.length === 0
      ? []
      : Array.from({ length: registry.feedCount }, (_, i) => feed[i % feed.length]);

  return (
    <section className="dawn">
      {/* Decorative sky: gradient, a low sun glow and the concentric rings
          radiating from it. aria-hidden -- it carries no information. */}
      <div className="dawn-sky" aria-hidden="true">
        <span className="dawn-sun" />
        <span className="dawn-ring dawn-ring--1" />
        <span className="dawn-ring dawn-ring--2" />
        <span className="dawn-ring dawn-ring--3" />
        <span className="dawn-ring dawn-ring--4" />
        <span className="dawn-ring dawn-ring--5" />
        <span className="dawn-grid" />
      </div>

      <div className="wrap dawn-inner">
        <div className="dawn-head">
          <div className="dawn-count">
            <span className="dawn-live">
              <span className="dawn-dot" aria-hidden="true" />
              {registry.liveLabel}
            </span>
            <p className="dawn-figure">
              {/* The exact total once santui has been synced; the rounded 亿
                  figure only while it never has. */}
              {total ? (
                <RegistryCounter total={total} className="dawn-figure-num" />
              ) : (
                <>
                  <span className="dawn-figure-num">{splitCount(registry.count).value}</span>
                  <span className="dawn-figure-unit">{splitCount(registry.count).unit}</span>
                </>
              )}
            </p>
            {/* A hairline the width of the figure. Barlow Condensed at weight
                200 is a very light stroke on a dark gradient, and without
                something under it the figure floats. */}
            <span className="dawn-figure-rule" aria-hidden="true" />
            <p className="dawn-count-label">
              {/* 4.67 亿 leads the sentence as its subject: same face and size
                  as the words after it, told apart by weight and colour. */}
              {total ? <strong className="dawn-count-yi">{registry.count}</strong> : null}
              {registry.countLabel}
            </p>
            {updatedAt ? (
              <p className="count-source">
                来源：全球退党服务中心登记册 · 更新于{" "}
                <time dateTime={updatedAt}>{updatedAt.slice(0, 10)}</time>
                {registry.noteHref ? (
                  <>
                    {" · "}
                    <a href={registry.noteHref} {...externalLinkProps(registry.noteHref)}>
                      {registry.noteLabel}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
            {/* 自己一行，不是续在来源那一句后面。上面一行是在交代这个数字从哪
                来，这一行是请读者去做下一件事 —— 两件事，挤在同一句里读者会把
                它当成第三个出处。它不跟着 updatedAt 走：取不到登记册时间不该让
                联署入口一起消失。 */}
            <p className="count-source">
              <a href={EXTERNAL_SERVICES.endccp} {...EXTERNAL_LINK_PROPS}>
                {t("home.endccpLink")}
              </a>
            </p>
          </div>

          {/* A promoted banner takes the whole right column when one is set;
              clearing the image in the CMS brings the three statistics back. */}
          <div className="dawn-aside">
            {registry.asideImage ? (
              <a
                className="dawn-promo"
                href={registry.asideHref || registry.noteHref}
                {...externalLinkProps(registry.asideHref || registry.noteHref)}
              >
                <img src={registry.asideImage} alt={registry.asideImageAlt} />
              </a>
            ) : (
              <>
                <div className="dawn-stats">
                  {registry.substats.map((stat) => (
                    <span key={`${stat.value}-${stat.label}`}>
                      <b>{stat.value}</b>
                      <span>{stat.label}</span>
                    </span>
                  ))}
                </div>
                <a className="dawn-note" href={registry.noteHref} {...externalLinkProps(registry.noteHref)}>
                  {registry.noteLabel}
                </a>
              </>
            )}
          </div>
        </div>

        {rows.length > 0 ? (
          // The track holds the list twice so translating it -50% loops
          // seamlessly. aria-hidden on the copy keeps screen readers from
          // hearing every declaration a second time.
          <div className="dawn-feed">
            <div className="dawn-feed-track">
              {rows.map((entry, index) => (
                <article key={`a-${entry.region}-${index}`} className="dawn-feed-card">
                  <div className="dawn-feed-top">
                    <span>{entry.region}</span>
                    <span>{entry.at}</span>
                  </div>
                  <p>{entry.text}</p>
                  <span className="dawn-feed-who">
                    <b className="dawn-feed-kind">{entry.kind ?? "三退声明"}</b>
                    <span className="dawn-feed-by">{entry.name}</span>
                  </span>
                </article>
              ))}
              {rows.map((entry, index) => (
                <article
                  key={`b-${entry.region}-${index}`}
                  className="dawn-feed-card"
                  aria-hidden="true"
                >
                  <div className="dawn-feed-top">
                    <span>{entry.region}</span>
                    <span>{entry.at}</span>
                  </div>
                  <p>{entry.text}</p>
                  <span className="dawn-feed-who">
                    <b className="dawn-feed-kind">{entry.kind ?? "三退声明"}</b>
                    <span className="dawn-feed-by">{entry.name}</span>
                  </span>
                </article>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dawn-services-head">
          <div>
            <span className="dawn-eyebrow">{services.eyebrow}</span>
            <h2>{services.heading}</h2>
          </div>
          <a
            className="dawn-more"
            href={services.moreHref}
            {...externalLinkProps(services.moreHref)}
          >
            {services.moreLabel} →
          </a>
        </div>

        {/* The column count follows the number of cards: three service cards
            plus 见证者 made four, and the ENDCCP card makes five. */}
        <div className={`dawn-cards dawn-cards--${services.cards.length + (showWitness ? 1 : 0)}`}>
          {services.cards.map((card, index) => (
            <article key={card.title} className="dawn-card">
              <div className="dawn-card-top">
                <span className="dawn-card-tag">
                  {String(index + 1).padStart(2, "0")} · {card.tag}
                </span>
                <span className="dawn-card-rule" aria-hidden="true" />
              </div>
              <h3>{card.title}</h3>
              {/* The Latin name, where the subject has one people recognise.
                  Same idiom as the 专题栏目 cards, which pair INVESTIGATIONS
                  with 追查国际调查报告 -- only there the Latin line sits above
                  the Chinese one, and here it reads as the name beneath it. */}
              {card.en ? <span className="dawn-card-en">{card.en}</span> : null}
              <p className="dawn-card-desc">{fillCount(card.body)}</p>
              <div className="dawn-card-links">
                {card.links.map((link) => (
                  <a
                    key={`${link.label}-${link.href}`}
                    href={link.href}
                    {...externalLinkProps(link.href)}
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>
              {card.ctaLabel ? (
                <a
                  className="dawn-card-cta"
                  href={card.ctaHref || "#"}
                  {...externalLinkProps(card.ctaHref || "")}
                >
                  {card.ctaLabel}
                </a>
              ) : null}
            </article>
          ))}

          {showWitness ? (
            <article className="dawn-card dawn-card--witness">
              <div className="dawn-card-top">
                <span className="dawn-card-tag">
                  {String(services.cards.length + 1).padStart(2, "0")} · {voices.eyebrow}
                </span>
                <span className="dawn-card-rule" aria-hidden="true" />
              </div>
              <h3>{voices.heading}</h3>
              {/* Skipped when the CMS leaves it blank. Rendering an empty <p>
                  would still claim the paragraph's min-height, so the card
                  would carry the gap without the words. */}
              {voices.lede.trim() ? (
                <p className="dawn-card-desc dawn-card-desc--quiet">{voices.lede}</p>
              ) : null}
              <WitnessCard
                items={voices.items}
                moreLabel={voices.moreLabel}
                moreHref={voices.moreHref}
              />
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Splits "4.64 亿" into the numeral and its unit so each can take the size the
 * design gives it. Falls back to treating the whole string as the numeral.
 */
function splitCount(count: string): { value: string; unit: string } {
  const match = count.trim().match(/^([\d.,]+)\s*(.*)$/);
  if (!match) return { value: count, unit: "" };
  return { value: match[1], unit: match[2] };
}
