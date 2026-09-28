import type { HomeContent } from "@quitccp/content-schema";
import { externalLinkProps } from "@/lib/external-services";

/**
 * 报刊头版 — the merged 新闻与报告 + 专题栏目 band.
 *
 * Implements `docs/prototypes/home-news-section-html`. The two sections used to read as
 * unrelated blocks; here they share one broadsheet page: masthead rules, a
 * lead story set against a numbered 最新发布 column, then the four 专题栏目
 * cards under a rule-flanked band title.
 *
 * Design values (rules, type scale, card shadow and hover motion) are lifted
 * from the mockup's inline styles and live in `globals.css` under `.bsheet-*`.
 * All hover states are CSS, so this stays a server component.
 */

interface BroadsheetBandProps {
  news: HomeContent["news"];
  channels: HomeContent["channels"];
}

export function BroadsheetBand({ news, channels }: BroadsheetBandProps) {
  const kicker = [news.lead.kicker, news.lead.meta].filter(Boolean).join(" · ");

  return (
    <section className="sec bsheet">
      <div className="wrap">
        <div className="bsheet-brow" aria-hidden="true" />

        <div className="bsheet-masthead">
          <div className="bsheet-title">
            <span className="bsheet-eyebrow">{news.eyebrow}</span>
            <h2>{news.heading}</h2>
          </div>
          <div className="bsheet-masthead-aside">
            <span className="bsheet-dateline">{dateline()}</span>
            <a className="bsheet-more" href={news.moreHref} {...externalLinkProps(news.moreHref)}>
              {news.moreLabel} →
            </a>
          </div>
        </div>

        <div className="bsheet-double" aria-hidden="true" />

        <div className="bsheet-body">
          <a
            className="bsheet-lead"
            href={news.lead.href}
            {...externalLinkProps(news.lead.href)}
          >
            {news.lead.image ? <img src={news.lead.image} alt="" /> : null}
            <div className="bsheet-lead-meta">
              {news.lead.tag ? <span className="bsheet-chip">{news.lead.tag}</span> : null}
              {kicker ? <span>{kicker}</span> : null}
            </div>
            <h3>{news.lead.title}</h3>
            <p>{news.lead.body}</p>
          </a>

          <div className="bsheet-gutter" aria-hidden="true" />

          <div className="bsheet-latest">
            <div className="bsheet-latest-head">
              <span className="bsheet-latest-title">{news.listTitle}</span>
              <span className="bsheet-latest-en">{news.listTitleEn}</span>
            </div>
            {news.items.map((row, index) => (
              <a
                key={`${row.title}-${row.date}`}
                className="bsheet-row"
                href={row.href}
                {...externalLinkProps(row.href)}
              >
                <span className="bsheet-row-num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="bsheet-row-text">
                  <span className="bsheet-row-date">{row.date}</span>
                  <span className="bsheet-row-title">{row.title}</span>
                </span>
                {row.image ? <img src={row.image} alt="" /> : <span className="bsheet-row-blank" />}
              </a>
            ))}
            <a
              className="bsheet-latest-more"
              href={news.listMoreHref}
              {...externalLinkProps(news.listMoreHref)}
            >
              {news.listMoreLabel}
              <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>

        {channels.enabled ? (
          <>
            <div className="bsheet-band">
              <span className="bsheet-band-rule" aria-hidden="true" />
              <h3>{channels.heading}</h3>
              <span className="bsheet-band-rule" aria-hidden="true" />
            </div>

            <div className="bsheet-cats">
              {channels.cards.map((card) => (
                <article key={card.title} className="bsheet-cat">
                  <div className="bsheet-cat-head">
                    {card.en ? <span className="bsheet-cat-en">{card.en}</span> : null}
                    <span className="bsheet-cat-name">{card.title}</span>
                  </div>
                  <a
                    className="bsheet-cat-thumb"
                    href={card.leadHref}
                    tabIndex={-1}
                    aria-hidden="true"
                    {...externalLinkProps(card.leadHref)}
                  >
                    {card.image ? <img src={card.image} alt="" /> : <span />}
                    {/* `badge` marks the item as a video in every channels
                        variant; here that becomes the corner pill. */}
                    {card.badge ? <span className="bsheet-cat-video">▶ 视频</span> : null}
                  </a>
                  <a
                    className="bsheet-cat-lead"
                    href={card.leadHref}
                    {...externalLinkProps(card.leadHref)}
                  >
                    {card.leadTitle}
                  </a>
                  <a
                    className="bsheet-cat-foot"
                    href={card.footHref}
                    {...externalLinkProps(card.footHref)}
                  >
                    <span>{card.footLabel.replace(/\s*→\s*$/, "")}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                </article>
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Masthead dateline, e.g. 「2026年9月28日 · 星期一」.
 *
 * Computed rather than edited: a broadsheet dateline is today's date, and a
 * stored one would go stale silently. The homepage revalidates every 5 minutes,
 * so it turns over shortly after midnight New York time -- the clock the
 * service centre stamps its own article dates with, which are printed a few
 * centimetres away in this same band.
 */
function dateline(now: Date = new Date()): string {
  const options: Intl.DateTimeFormatOptions = { timeZone: "America/New_York" };
  const day = new Intl.DateTimeFormat("zh-CN", {
    ...options,
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(now);
  const weekday = new Intl.DateTimeFormat("zh-CN", { ...options, weekday: "long" }).format(now);
  return `${day} · ${weekday}`;
}
