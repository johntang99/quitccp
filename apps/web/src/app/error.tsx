"use client";

import Link from "next/link";
import { t } from "@/lib/i18n";

/**
 * What a reader sees when a page cannot be rendered.
 *
 * It exists because of 2026-10-13. The page data layer used to answer a failed
 * database read with a hard-coded fallback -- the prototype's own copy -- and
 * Next, seeing a successful render, cached it. For several hours the homepage
 * showed 四亿六千多万 and an article list from August, with nothing to tell a
 * reader it was not current. Nobody could distinguish it from the real site.
 *
 * So a failure is now allowed to be a failure. That buys two things: Next keeps
 * serving the last good copy of any page it already has, and where it has none,
 * this page says plainly what is happening instead of inventing content.
 *
 * On a site whose own words are 「每一分钱、每一个数字，都可以被检验」, showing a
 * number that cannot be checked is worse than showing nothing.
 *
 * The other addresses are not decoration. santui and service are separate
 * systems on separate infrastructure; when this one is down they are usually
 * not, and a reader who came to declare 三退 can still do it.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="sec">
      <div className="wrap">
        <article className="sectionCard">
          <h1 className="sectionTitle">{t("error.title")}</h1>
          <p>{t("error.body")}</p>
          <p className="muted">{t("error.others")}</p>
          <ul className="muted" style={{ lineHeight: 2, margin: "8px 0 20px", paddingInlineStart: "1.2em" }}>
            <li>
              {t("error.declare")}{" "}
              <a href="https://santui.tuidang.org" rel="noopener noreferrer">
                santui.tuidang.org
              </a>
            </li>
            <li>
              {t("error.cert")}{" "}
              <a href="https://service.tuidang.org/cert-verify/" rel="noopener noreferrer">
                service.tuidang.org
              </a>
            </li>
          </ul>
          <div className="hero-cta">
            <button type="button" className="btn btn--seal" onClick={reset}>
              {t("error.retry")}
            </button>
            <Link className="btn btn--line" href="/">
              {t("error.home")}
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
