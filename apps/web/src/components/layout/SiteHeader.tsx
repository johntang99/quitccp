import Link from "next/link";
import type { Route } from "next";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderBehaviour } from "@/components/layout/HeaderBehaviour";
import { getPublicNav } from "@/lib/public-settings";
import { EXTERNAL_LINK_PROPS, EXTERNAL_SERVICES } from "@/lib/external-services";
import { LanguagePicker } from "@/components/layout/LanguagePicker";
import { t } from "@/lib/i18n";
import { SITE_LOGO_IMAGE } from "@/lib/site-config";

export async function SiteHeader() {
  const navItems = await getPublicNav();
  return (
    <header>
      <HeaderBehaviour />
      <div className="brandbar">
        <div className="wrap brandbar-in">
          <Link href="/" className="brand">
            {/*
              两种标识排法，取决于这个站有没有整套做成一张图的横幅。

              中文站有：印章和字标都在图里，组织名就留在 alt 里，不用再排一遍。

              英文站没有 —— 机构的英文标识本来就是「圆印 + 两行字」，他们自己
              的英文站也是这么摆的。所以这里把印章和字标分开排，而不是把一张
              方印塞进横幅的位置拉成一条。字标是文字不是图：换一种语言只要改
              两条文案，不用做图。
            */}
            <img
              className={SITE_LOGO_IMAGE.kind === "mark" ? "brand-seal" : "brand-logo"}
              src={SITE_LOGO_IMAGE.src}
              width={SITE_LOGO_IMAGE.width}
              height={SITE_LOGO_IMAGE.height}
              alt={SITE_LOGO_IMAGE.kind === "mark" ? "" : t("header.aria.logo")}
              aria-hidden={SITE_LOGO_IMAGE.kind === "mark" ? true : undefined}
            />
            {SITE_LOGO_IMAGE.kind === "mark" ? (
              <span className="brand-wordmark">
                <span className="brand-wordmark-top">{t("header.wordmarkTop")}</span>
                <span className="brand-wordmark-sub">{t("header.wordmarkSub")}</span>
              </span>
            ) : null}
          </Link>
          <div className="brand-cta">
            {/* Where the topbar's row of six languages used to be. A dropdown
                costs one click to open, but stops six foreign words competing
                with the organisation's own name for the top of every page. */}
            <LanguagePicker />
            {/* 「捐助我们」缩成「捐助」是为了给下面这个按钮腾地方 —— 四个
                控件在窄屏上排不下，反馈里明确同意了这个取舍。 */}
            <a
              className="btn btn--line-light btn--sm"
              href={EXTERNAL_SERVICES.donation}
              {...EXTERNAL_LINK_PROPS}
            >
              {t("header.donate")}
            </a>
            <a
              className="btn btn--line-light btn--sm"
              href={EXTERNAL_SERVICES.endccp}
              {...EXTERNAL_LINK_PROPS}
            >
              {t("header.endccp")}
            </a>
            <a
              className="btn btn--seal btn--sm"
              href={EXTERNAL_SERVICES.declare}
              {...EXTERNAL_LINK_PROPS}
            >
              {t("header.declare")}
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
            endccpHref={EXTERNAL_SERVICES.endccp}
            declareHref={EXTERNAL_SERVICES.declare}
            externalProps={EXTERNAL_LINK_PROPS}
          />
          <nav className="nav-links" aria-label={t("header.aria.nav")}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href as Route}>
                {item.label}
              </Link>
            ))}
          </nav>

          <form className="search" action="/search" method="get">
            <input type="search" name="q" placeholder={t("header.searchPlaceholder")} aria-label={t("header.aria.search")} />
            {/* A real submit button, not the decorative icon it replaced: the
                magnifier now does what it looks like it does. Enter still works
                -- this is a plain GET form, so the button adds a way in rather
                than changing the existing one. */}
            <button type="submit" className="search-go" aria-label={t("header.aria.searchGo")}>
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
