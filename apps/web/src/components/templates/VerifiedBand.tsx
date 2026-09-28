import type { HomeContent } from "@quitccp/content-schema";
import { externalLinkProps } from "@/lib/external-services";

/**
 * 可检验 — the merged 关于我们 + 参与我们 band.
 *
 * Implements `docs/prototypes/non-profit-join-html`. The accountability figures
 * and the four ways to take part used to sit as two pale sections at the foot of
 * the page; here they share one dark panel, with the participation cards
 * straddling its lower edge so the page closes on an action rather than trailing
 * off.
 *
 * Design values live in `globals.css` under `.verified-*`.
 */

interface VerifiedBandProps {
  about: HomeContent["about"];
  involve: HomeContent["involve"];
}

export function VerifiedBand({ about, involve }: VerifiedBandProps) {
  return (
    <section className="verified">
      {/* Gradient panel, gold glow and dot grid. Decoration only. */}
      <div className="verified-panel" aria-hidden="true">
        <span className="verified-glow" />
        <span className="verified-dots" />
      </div>

      <div className="wrap verified-inner">
        <div className="verified-top">
          <div className="verified-intro">
            <span className="verified-eyebrow">{about.eyebrow}</span>
            <h2>
              {about.heading.split("\n").map((line, index) => (
                <span key={line || index}>{line}</span>
              ))}
            </h2>
            <p>{about.lede}</p>
            {about.moreLabel ? (
              <a
                className="verified-more"
                href={about.moreHref}
                {...externalLinkProps(about.moreHref)}
              >
                {about.moreLabel}
              </a>
            ) : null}
          </div>

          <dl className="verified-facts">
            {about.cells.map((cell) => {
              const bars = cell.bars ?? [];
              const hasBars = bars.length > 0;
              return (
                <div className="verified-fact" key={cell.heading || cell.value}>
                  <dt className={`verified-fact-key${hasBars ? " is-figure" : ""}${
                    hasBars ? "" : isLatin(cell.value) ? " is-mono" : ""
                  }`}
                  >
                    {cell.value || cell.heading}
                  </dt>
                  <dd>
                    {/* The lead line labels the bar, so it only appears on the
                        row that has one; the other rows' `heading` is the小标题
                        the 三栏 variant prints above the value. */}
                    {hasBars && cell.heading ? (
                      <span className="verified-fact-lead">{cell.heading}</span>
                    ) : null}
                    {hasBars ? (
                      <span className="verified-split">
                        {bars.map((bar, index) => (
                          <span
                            key={bar.label}
                            className={`verified-split-part verified-split-part--${index + 1}`}
                            style={{ width: `${clamp(bar.percent)}%` }}
                          />
                        ))}
                      </span>
                    ) : null}
                    {cell.body ? <span className="verified-fact-body">{cell.body}</span> : null}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>

        <div className="verified-join-head">
          <h3>{involve.heading}</h3>
          {involve.lede ? <p>{involve.lede}</p> : null}
        </div>

        <div className="verified-cards">
          {involve.items.map((item, index) => (
            <a
              key={`${item.title}-${item.href}`}
              className={`verified-card${item.primary ? " verified-card--primary" : ""}`}
              href={item.href}
              {...externalLinkProps(item.href)}
            >
              <span className="verified-card-top">
                <span className="verified-card-no">{String(index + 1).padStart(2, "0")}</span>
                {item.glyph ? (
                  <span className="verified-card-glyph" aria-hidden="true">
                    {item.glyph}
                  </span>
                ) : null}
              </span>
              <span className="verified-card-title">{item.title}</span>
              <span className="verified-card-body">{item.body}</span>
              {item.primary ? (
                <span className="verified-card-cta">{item.ctaLabel || item.title} →</span>
              ) : (
                <span className="verified-card-link">
                  <span>{item.ctaLabel || item.title}</span>
                  <span aria-hidden="true">→</span>
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function clamp(percent: number): number {
  return Math.max(0, Math.min(100, percent));
}

/**
 * Latin figures like `501(c)(3)` are set in the mono face, Chinese ones like
 * 公开方法 in the serif -- the design does both, and which is which follows from
 * the script rather than from a field an editor would have to remember to set.
 */
function isLatin(value: string): boolean {
  return value.trim().length > 0 && !/[㐀-鿿豈-﫿]/.test(value);
}
