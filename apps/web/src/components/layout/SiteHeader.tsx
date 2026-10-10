import Link from "next/link";
import type { Route } from "next";
import { MobileNav } from "@/components/layout/MobileNav";
import { HeaderBehaviour } from "@/components/layout/HeaderBehaviour";
import { getPublicNav } from "@/lib/public-settings";
import { EXTERNAL_LINK_PROPS, EXTERNAL_SERVICES } from "@/lib/external-services";
import { LanguagePicker } from "@/components/layout/LanguagePicker";

export async function SiteHeader() {
  const navItems = await getPublicNav();
  return (
    <header>
      <HeaderBehaviour />
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
            {/* Where the topbar's row of six languages used to be. A dropdown
                costs one click to open, but stops six foreign words competing
                with the organisation's own name for the top of every page. */}
            <LanguagePicker />
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
