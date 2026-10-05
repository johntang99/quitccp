"use client";

import { useEffect } from "react";

/**
 * Two things the header cannot work out from CSS alone.
 *
 * **How far it may slide up.** Only the menu row stays on screen; the language
 * strip and the brand banner scroll away above it. That means a sticky `top` of
 * minus their combined height -- a number that changes with the breakpoint and,
 * on phones, with the language strip's own wrapping, so it cannot be written as
 * a constant. It is measured here and published as `--sticky-offset`.
 *
 * **Whether the page has been scrolled.** Over a full-bleed hero the header
 * starts transparent and turns solid once it is no longer sitting on the
 * picture. `data-scrolled` carries that, and the CSS does the rest.
 *
 * Both are written to the element rather than held in React state: this runs on
 * every scroll frame, and re-rendering a tree for a boolean is how a header
 * starts to feel heavy.
 */
export function HeaderBehaviour() {
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    const measure = () => {
      const topbar = header.querySelector<HTMLElement>(".topbar");
      const brandbar = header.querySelector<HTMLElement>(".brandbar");
      const away = (topbar?.offsetHeight ?? 0) + (brandbar?.offsetHeight ?? 0);
      header.style.setProperty("--sticky-offset", `${-away}px`);
      // The hero is pulled up by the whole header in overlay mode, so it needs
      // the full height too, not just the part that scrolls away.
      document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
      // Anything else that pins itself -- the interior sub-menu, a sidebar --
      // has to clear the one row that stays, so it is published rather than
      // copied as a constant into each of those rules.
      const menubar = header.querySelector<HTMLElement>(".menubar");
      if (menubar) {
        document.documentElement.style.setProperty("--menubar-h", `${menubar.offsetHeight}px`);
      }
      return away;
    };

    let away = measure();

    const onScroll = () => {
      // Solid as soon as the bar has begun to travel, rather than at some
      // arbitrary distance: the switch then coincides with the header leaving
      // the top of the picture instead of happening at an unrelated moment.
      const scrolled = window.scrollY > Math.max(away, 1) * 0.6;
      if (scrolled) header.setAttribute("data-scrolled", "true");
      else header.removeAttribute("data-scrolled");
    };

    // ResizeObserver rather than a resize listener: the language strip rewraps
    // when a font loads or the zoom changes, neither of which fires `resize`.
    const observer = new ResizeObserver(() => {
      away = measure();
      onScroll();
    });
    observer.observe(header);

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      observer.disconnect();
    };
  }, []);

  return null;
}
