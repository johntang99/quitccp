"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface MobileNavItem {
  href: string;
  label: string;
}

/**
 * The phone menu.
 *
 * The base stylesheet hides `.nav-links` below 980px and put nothing in its
 * place, so every section of the site -- 新闻与报告, 视频, 我们的服务, the lot --
 * was unreachable from a phone unless the reader already knew the URL. This is
 * the control that opens them.
 *
 * It carries the two calls to action as well: they sit in the brand bar on a
 * wide screen, where there is room for them beside the logo.
 */
export function MobileNav({
  items,
  donationHref,
  declareHref,
  externalProps
}: {
  items: MobileNavItem[];
  donationHref: string;
  declareHref: string;
  /** target/rel for the off-site buttons, from the server's shared constant. */
  externalProps: { target?: string; rel?: string };
}) {
  const [open, setOpen] = useState(false);
  // Where the sheet starts: the bottom of the sticky menu bar, measured rather
  // than assumed, because the bar only reaches its sticky offset once the page
  // has been scrolled.
  const [top, setTop] = useState(0);
  const panelId = useId();
  const pathname = usePathname();
  const button = useRef<HTMLButtonElement>(null);

  const measure = useCallback(() => {
    const bar = button.current?.closest<HTMLElement>(".menubar");
    setTop(bar ? Math.max(0, Math.round(bar.getBoundingClientRect().bottom)) : 0);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [open, measure]);

  // A tap on a link navigates without unmounting this component, so the panel
  // would otherwise stay open over the page the reader just asked for.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Without this the page scrolls behind the open panel.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isCurrent = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      <button
        ref={button}
        type="button"
        className="navbtn"
        aria-label={open ? "关闭菜单" : "打开菜单"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="navbtn-bars" data-open={open ? "1" : undefined} aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span className="navbtn-label">菜单</span>
      </button>

      {/* Portalled to <body>, and rendered only while open.
          Portalled because .menubar carries a backdrop-filter, which makes it
          the containing block for position:fixed descendants -- inside it the
          full-screen scrim collapsed to a 54px strip lying over the menu bar,
          swallowing the taps meant for the close button. A phone has no Escape
          key, so that left the menu with no way out.
          Rendered only while open so a closed panel keeps every nav link out of
          the tab order of a page that is not showing them. */}
      {open
        ? createPortal(
        <>
          <div className="navsheet-scrim" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="navsheet" id={panelId} style={{ top, maxHeight: `calc(100vh - ${top}px)` }}>
            <nav aria-label="移动端主导航">
              {items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href as Route}
                  className="navsheet-link"
                  data-on={isCurrent(item.href) ? "1" : undefined}
                  aria-current={isCurrent(item.href) ? "page" : undefined}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="navsheet-cta">
              <a className="btn btn--line btn--sm" href={donationHref} {...externalProps}>
                捐助我们
              </a>
              <a className="btn btn--seal btn--sm" href={declareHref} {...externalProps}>
                我要三退
              </a>
            </div>
          </div>
        </>,
            document.body
          )
        : null}
    </>
  );
}
