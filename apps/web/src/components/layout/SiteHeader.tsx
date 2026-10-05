import Link from "next/link";
import type { Route } from "next";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderBehaviour } from "@/components/layout/HeaderBehaviour";
import { getPublicNav } from "@/lib/public-settings";
import { EXTERNAL_LINK_PROPS, EXTERNAL_SERVICES } from "@/lib/external-services";
import { SITE_LANGUAGES, SITE_SOCIALS } from "@/lib/site-languages";

/** Icon paths, keyed by the label in SITE_SOCIALS. */
const SOCIAL_ICON: Record<string, string> = {
  Facebook: "M14 8.5V6.8c0-.8.2-1.2 1.4-1.2H17V2.6c-.3 0-1.2-.1-2.3-.1-2.4 0-4 1.4-4 4.1v1.9H8v3h2.7V21H14v-8.5h2.6l.4-3H14z",
  "X": "M17.5 3h3l-6.6 7.5L21.8 21h-6l-4.7-6.1L5.6 21h-3l7-8L2.5 3h6.2l4.3 5.6L17.5 3zm-1.1 16.2h1.7L7.7 4.7H5.9l10.5 14.5z",
  YouTube: "M22.5 7.5a2.8 2.8 0 0 0-1.9-2C18.9 5 12 5 12 5s-6.9 0-8.6.5a2.8 2.8 0 0 0-1.9 2A29 29 0 0 0 1 12a29 29 0 0 0 .5 4.5 2.8 2.8 0 0 0 1.9 2C5.1 19 12 19 12 19s6.9 0 8.6-.5a2.8 2.8 0 0 0 1.9-2A29 29 0 0 0 23 12a29 29 0 0 0-.5-4.5zM9.8 15.2V8.8l5.7 3.2-5.7 3.2z",
};

export async function SiteHeader() {
  const navItems = await getPublicNav();
  return (
    <header>
      <HeaderBehaviour />
      <div className="topbar">
        <div className="wrap topbar-in">
          <div className="langs" aria-label="语言切换">
            {SITE_LANGUAGES.map((lang) =>
              lang.href ? (
                <a
                  key={lang.label}
                  href={lang.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {lang.label}
                </a>
              ) : (
                /* No site yet, or this one. Rendered as plain text rather than a
                   dead link -- a reader who clicks and lands on an error learns
                   something worse than "not ready". */
                <span
                  key={lang.label}
                  className={lang.current ? "on" : "soon"}
                  title={lang.note}
                >
                  {lang.label}
                  {lang.current ? "" : <small>（即将推出）</small>}
                </span>
              )
            )}
          </div>
          <div className="topbar-right">
            <Link className="tb-link" href="/resources/tools">
              免翻墙链接
            </Link>
            <div className="socials" aria-label="社交渠道">
              {SITE_SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  aria-label={s.label}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <svg viewBox="0 0 24 24">
                    <path d={SOCIAL_ICON[s.label]} />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="brandbar">
        <div className="wrap brandbar-in">
          <Link href="/" className="brand">
            {/* The banner is the full lockup -- seal and wordmark -- so the
                organisation's name lives in the alt text rather than beside it. */}
            <img
              className="brand-logo"
              src="/logo/banner-2022-1.webp"
              width={1020}
              height={156}
              alt="全球退党服务中心 Global Service Center for Quitting the Chinese Communist Party"
            />
          </Link>
          <div className="brand-cta">
            <a
              className="btn btn--line-light btn--sm"
              href={EXTERNAL_SERVICES.donation}
              {...EXTERNAL_LINK_PROPS}
            >
              捐助我们
            </a>
            <a
              className="btn btn--seal btn--sm"
              href={EXTERNAL_SERVICES.declare}
              {...EXTERNAL_LINK_PROPS}
            >
              我要三退
            </a>
          </div>
        </div>
      </div>

      <div className="menubar">
        <div className="wrap menubar-in">
          {/* Shown only where .nav-links is hidden -- see the .navbtn rules. */}
          <MobileNav
            items={navItems}
            donationHref={EXTERNAL_SERVICES.donation}
            declareHref={EXTERNAL_SERVICES.declare}
            externalProps={EXTERNAL_LINK_PROPS}
          />
          <nav className="nav-links" aria-label="主导航">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href as Route}>
                {item.label}
              </Link>
            ))}
          </nav>

          <form className="search" action="/search" method="get">
            <input type="search" name="q" placeholder="搜索新闻、报告与资料" aria-label="站内搜索" />
            {/* A real submit button, not the decorative icon it replaced: the
                magnifier now does what it looks like it does. Enter still works
                -- this is a plain GET form, so the button adds a way in rather
                than changing the existing one. */}
            <button type="submit" className="search-go" aria-label="搜索">
              <svg viewBox="0 0 24 24" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m16.5 16.5 4 4" />
              </svg>
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
