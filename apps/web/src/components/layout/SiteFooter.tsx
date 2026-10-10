import Link from "next/link";
import { SITE_LANGUAGES, SITE_SOCIALS } from "@/lib/site-languages";

/* Icon paths, keyed by the label in SITE_SOCIALS -- moved here with the icons
   themselves when the topbar was removed. */
const SOCIAL_ICON: Record<string, string> = {
  Facebook: "M14 8.5V6.8c0-.8.2-1.2 1.4-1.2H17V2.6c-.3 0-1.2-.1-2.3-.1-2.4 0-4 1.4-4 4.1v1.9H8v3h2.7V21H14v-8.5h2.6l.4-3H14z",
  "X": "M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.5 3h6.2l4.3 5.6L17.5 3zm-1.1 16.2h1.7L7.7 4.7H5.9l10.5 14.5z",
  YouTube: "M22.5 7.5a2.8 2.8 0 0 0-1.9-2C18.9 5 12 5 12 5s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.5 2.8 2.8 0 0 0 1.9 2C5.1 19 12 19 12 19s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.5zM9.8 15.2V8.8l5.7 3.2-5.7 3.2z"
};

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="foot-brand">
              <span className="seal">退</span>
              <span>全球退党服务中心</span>
            </div>
            <p style={{ margin: 0, maxWidth: "34ch", lineHeight: 1.9 }}>
              Global Service Center for Quitting the CCP
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
            <h5>服务</h5>
            <ul>
              <li>
                <Link href="/services/declare">声明三退</Link>
              </li>
              <li>
                <Link href="/services/cert">办理退党证明</Link>
              </li>
              <li>
                <Link href="/services/verify">查询验证</Link>
              </li>
              <li>
                <Link href="/services/faq">三退问答</Link>
              </li>
              <li>
                <Link href="/resources/tools">安全访问</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>内容</h5>
            <ul>
              <li>
                <Link href="/news">新闻与报告</Link>
              </li>
              <li>
                <Link href="/involve/stories">三退故事</Link>
              </li>
              <li>
                <Link href="/videos">视频</Link>
              </li>
              <li>
                <Link href="/resources">资源馆</Link>
              </li>
              <li>
                <Link href="/about/network">全球网络</Link>
              </li>
            </ul>
          </div>
          <div>
            <h5>关于我们</h5>
            <ul>
              <li>
                <Link href="/about">使命与原则</Link>
              </li>
              <li>
                <Link href="/about/team">理事会与团队</Link>
              </li>
              <li>
                <Link href="/about/accountability">公开与问责</Link>
              </li>
              <li>
                <Link href="/about/accountability">年度报告</Link>
              </li>
              <li>
                <Link href="/services/contact">联系我们</Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© 2005-2026 全球退党服务中心 · 501(c)(3) 非营利组织</span>
          <div className="foot-reach">
            {/* Both came down from the topbar. They sit on the bottom line
                rather than in the brand column because neither is part of the
                site's structure: 免翻墙链接 is a utility a reader inside China
                may need before anything else works, and the social icons are
                where a reader looks once they are no longer in the masthead. */}
            <Link className="foot-reach-link" href="/resources/tools">
              免翻墙链接
            </Link>
            <div className="socials" aria-label="社交渠道">
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
            <Link href="/legal/terms">服务条款</Link> · <Link href="/legal/privacy">隐私政策</Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
