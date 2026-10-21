import Link from "next/link";
import { SITE_LANGUAGES, SITE_SOCIALS } from "@/lib/site-languages";
import { SECTION_CONFIG, loadSectionNavOverrides, mergeSectionNav } from "@/lib/section-nav";
import { t } from "@/lib/i18n";

/* Icon paths, keyed by the label in SITE_SOCIALS -- moved here with the icons
   themselves when the topbar was removed. */
const SOCIAL_ICON: Record<string, string> = {
  Facebook: "M14 8.5V6.8c0-.8.2-1.2 1.4-1.2H17V2.6c-.3 0-1.2-.1-2.3-.1-2.4 0-4 1.4-4 4.1v1.9H8v3h2.7V21H14v-8.5h2.6l.4-3H14z",
  "X": "M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.5 3h6.2l4.3 5.6L17.5 3zm-1.1 16.2h1.7L7.7 4.7H5.9l10.5 14.5z",
  YouTube: "M22.5 7.5a2.8 2.8 0 0 0-1.9-2C18.9 5 12 5 12 5s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.5 2.8 2.8 0 0 0 1.9 2C5.1 19 12 19 12 19s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.5zM9.8 15.2V8.8l5.7 3.2-5.7 3.2z"
};

/**
 * The footer, with the sections called what the editors call them.
 *
 * Only the four places that are genuinely a section's NAME follow the entry in
 * 页面内容 -> nav/section-tabs.json: the two column headings that name one, and
 * the three links that go to a section's own front page. An editor who renames
 * 我们的服务 to 三退登记与证明 would otherwise leave the footer saying the old
 * word, with nothing in the admin able to reach it.
 *
 * Everything else here keeps its own wording on purpose, and auto-filling it
 * would be a different change nobody asked for: /about reads 使命与原则 rather
 * than the section's 关于我们, and 三退故事 / 安全访问 / 办理退党证明 each say
 * something the tab they point at does not.
 *
 * ## Why 公开与问责 is not here
 *
 * It used to appear twice in this column, once as 公开与问责 and again as
 * 年度报告, both pointing at /about/accountability. Removed 2026-10-14 at the
 * board's request, together with the tab in nav/section-tabs.json.
 *
 * The reason is not that the page is wrong. It is that it is a directory of
 * the places a hostile party would go to file something false about us -- the
 * IRS exempt-organization search, ProPublica, Charity Navigator -- and the
 * centre would rather not advertise them while it is under attack.
 *
 * The page itself is still published and still reachable at its address, and
 * nine pages still link to it where the link means something in context. Form
 * 990 remains a public record either way; this removes a standing signpost,
 * not the disclosure.
 */
export async function SiteFooter() {
  const sections = await loadSections();
  const name = (key: string, fallback: string) => sections[key]?.label?.trim() || fallback;

  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="foot-brand">
              <span className="seal">退</span>
              <span>{t("site.name")}</span>
            </div>
            <p style={{ margin: 0, maxWidth: "34ch", lineHeight: 1.9 }}>
              {t("site.nameEn")}
              <br />
              40-46 Main Street, Flushing, NY 11354
            </p>
            {/* The same list as the header: the footer used to show three
                languages where the header showed six, so a reader could not tell
                which was the real set. */}
            <div className="acct-links" style={{ marginTop: 20 }}>
              {SITE_LANGUAGES.filter((lang) => lang.href).map((lang) => (
                <a
                  key={lang.label}
                  className="pill"
                  style={{ background: "transparent", borderColor: "rgba(255,255,255,.2)", color: "var(--lav)" }}
                  href={lang.href as string}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {lang.label}
                </a>
              ))}
            </div>

          </div>
          <div>
            <h5>{name("services", t("footer.services"))}</h5>
            <ul>
              <li>
                <Link href="/services/declare">{t("footer.declare")}</Link>
              </li>
              <li>
                <Link href="/services/cert">{t("footer.cert")}</Link>
              </li>
              <li>
                <Link href="/services/verify">{t("footer.verify")}</Link>
              </li>
              <li>
                <Link href="/services/faq">{t("footer.faq")}</Link>
              </li>
              <li>
                <Link href="/resources/tools">{t("footer.tools")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>{t("footer.content")}</h5>
            <ul>
              <li>
                <Link href="/news">{name("news", t("footer.news"))}</Link>
              </li>
              <li>
                <Link href="/involve/stories">{t("footer.stories")}</Link>
              </li>
              <li>
                <Link href="/videos">{name("videos", t("footer.videos"))}</Link>
              </li>
              <li>
                <Link href="/resources">{name("resources", t("footer.resources"))}</Link>
              </li>
              <li>
                <Link href="/about/network">{t("footer.network")}</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>{name("about", t("footer.about"))}</h5>
            <ul>
              <li>
                <Link href="/about">{t("footer.mission")}</Link>
              </li>
              <li>
                <Link href="/about/team">{t("footer.team")}</Link>
              </li>
              <li>
                <Link href="/services/contact">{t("footer.contact")}</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>{t("footer.copyright", { site: t("site.name") })}</span>
          <div className="foot-reach">
            {/* Both came down from the topbar. They sit on the bottom line
                rather than in the brand column because neither is part of the
                site's structure: 免翻墙链接 is a utility a reader inside China
                may need before anything else works, and the social icons are
                where a reader looks once they are no longer in the masthead. */}
            <Link className="foot-reach-link" href="/resources/tools">
              {t("footer.mirrors")}
            </Link>
            <div className="socials" aria-label={t("footer.aria.socials")}>
              {SITE_SOCIALS.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24">
                    <path d={SOCIAL_ICON[social.label]} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
          <span>
            {/* Both documents were imported from www.tuidang.org on 2026-10-07
                and live in the CMS now; the old copies stop resolving when that
                domain becomes this site. */}
            <Link href="/legal/terms">{t("footer.terms")}</Link> · <Link href="/legal/privacy">{t("footer.privacy")}</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

/**
 * Never throws: a database hiccup leaves the shipped names in place rather
 * than taking the footer -- and with it every page -- down with it.
 */
async function loadSections() {
  try {
    return mergeSectionNav(SECTION_CONFIG, await loadSectionNavOverrides());
  } catch {
    return SECTION_CONFIG;
  }
}
