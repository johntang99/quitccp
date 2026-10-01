import type { HomeContent } from "@quitccp/content-schema";
import { externalLinkProps } from "@/lib/external-services";
import { WitnessCard } from "@/components/public/WitnessCard";

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
  /** Declaration rows for the feed; only the first `feedCount` are shown. */
  feed: { region: string; name: string; text: string; at: string }[];
}

export function DawnBand({ registry, services, voices, feed }: DawnBandProps) {
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
              {/* The numeral and its unit are sized differently in the design,
                  so they are separate spans rather than one string. */}
              <span className="dawn-figure-num">{splitCount(registry.count).value}</span>
              <span className="dawn-figure-unit">{splitCount(registry.count).unit}</span>
            </p>
            <p className="dawn-count-label">{registry.countLabel}</p>
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
                  <span className="dawn-feed-who">退 · {entry.name}</span>
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
                  <span className="dawn-feed-who">退 · {entry.name}</span>
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

        <div className={`dawn-cards${showWitness ? " dawn-cards--4" : ""}`}>
          {services.cards.map((card, index) => (
            <article key={card.title} className="dawn-card">
              <div className="dawn-card-top">
                <span className="dawn-card-tag">
                  {String(index + 1).padStart(2, "0")} · {card.tag}
                </span>
                <span className="dawn-card-rule" aria-hidden="true" />
              </div>
              <h3>{card.title}</h3>
              <p className="dawn-card-desc">{card.body}</p>
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
              <p className="dawn-card-desc dawn-card-desc--quiet">{voices.lede}</p>
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
