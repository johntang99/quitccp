import Link from "next/link";
import { EXTERNAL_LINK_PROPS, EXTERNAL_SERVICES } from "@/lib/external-services";
import { SITE_LANGUAGES } from "@/lib/site-languages";

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
          <span>
            <a href={EXTERNAL_SERVICES.termsOfService} {...EXTERNAL_LINK_PROPS}>
              服务条款
            </a>{" "}
            ·{" "}
            <a href={EXTERNAL_SERVICES.privacyPolicy} {...EXTERNAL_LINK_PROPS}>
              隐私政策（官方）
            </a>
          </span>
        </div>
      </div>
    </footer>
  );
}
