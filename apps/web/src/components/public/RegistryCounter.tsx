"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";

const FROM = 400_000_000;
const DURATION_MS = 3000;
/** Eleven characters, the same count as any nine-digit total. See `fit` below. */
const SAMPLE = "467,293,946";

function format(value: number): string {
  /* 本站的千分位写法：中文和英文是 467,645,280，德文是 467.645.280。
     以前写死 en-US —— 对中英两种语言恰好一样，德文站上就不地道了。
     必须显式传 locale，不能省略参数：不传时读运行环境的区域设置，
     服务端和浏览器算出来不一样，水合会报 mismatch 而且数字会跳一下。 */
  return formatNumber(Math.round(value));
}

/**
 * The registry total, counted up from 四亿 on arrival.
 *
 * The old site does the same thing with an Elementor widget; two things here
 * are deliberately different.
 *
 * **The figure is always the real one.** `total` comes from the santui snapshot
 * the cron refreshes every six hours, and it is what the server renders -- the
 * count-up only takes over once this component mounts in a browser. A crawler,
 * a reader with JavaScript off, and anyone who has asked for reduced motion all
 * see 467,293,946 immediately rather than a number stuck at four hundred
 * million.
 *
 * **The line does not move while it counts.** 400,000,000 and 467,293,946 are
 * both eleven characters, and Barlow Condensed's digits are all one width once
 * `tabular-nums` is on, so the figure occupies exactly the same box in every
 * frame. Measured over a full run: zero pixels of width change. The old site
 * has neither property, which is why its counter visibly shakes.
 */
export function RegistryCounter({ total, className }: { total: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  /* `null` until the browser takes over, so the server's markup -- the real
     total -- is what the first paint shows and what non-JS readers keep. */
  const [shown, setShown] = useState<number | null>(null);

  /**
   * Size the figure to the column it is in, rather than trusting a number
   * written into the stylesheet.
   *
   * A hard-coded size is wrong the moment anything around it moves: a narrower
   * column, a wider promo card, a font that failed to load. When it is wrong it
   * is not subtly wrong -- eleven characters at 174px run 88px into the card
   * beside them.
   *
   * Measuring `SAMPLE` rather than the digits currently on screen matters:
   * early in the animation the element may hold a shorter string, and sizing to
   * that would leave the finished figure too large. Tabular digits make one
   * measurement good for the whole run.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const column = el.parentElement?.parentElement;
    if (!column) return;

    const fit = () => {
      const probe = document.createElement("span");
      const style = getComputedStyle(el);
      probe.style.cssText = [
        "position:absolute",
        "visibility:hidden",
        "white-space:pre",
        "font-size:100px",
        `font-family:${style.fontFamily}`,
        `font-weight:${style.fontWeight}`,
        `letter-spacing:${style.letterSpacing}`,
        "font-variant-numeric:tabular-nums",
        "font-feature-settings:'tnum' 1"
      ].join(";");
      probe.textContent = SAMPLE;
      document.body.appendChild(probe);
      const at100 = probe.getBoundingClientRect().width;
      probe.remove();
      if (!at100) return;

      /* 7% of the column stays empty so the figure never sits flush against
         the promo card. */
      const size = Math.floor((100 * column.clientWidth * 0.93) / at100);
      const width = Math.round((at100 * size) / 100);
      el.style.fontSize = `${size}px`;
      /* Hold the full figure's width even while a shorter string is on screen,
         so nothing shifts during the count. */
      el.style.minWidth = `${width}px`;
      /* The hairline under the figure is a sibling, not a child, so it cannot
         read this width itself -- it would otherwise stretch to the whole
         column and run 49px past the digits it is meant to sit under. */
      column.style.setProperty("--figure-w", `${width}px`);
    };

    fit();
    /* Webfonts land after first paint; measuring before Barlow Condensed is
       ready sizes to the fallback and leaves the figure the wrong size. */
    document.fonts?.ready.then(fit).catch(() => {});
    const observer = new ResizeObserver(fit);
    observer.observe(column);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let start: number | null = null;
    const step = (now: number) => {
      if (start === null) start = now;
      const progress = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      setShown(FROM + (total - FROM) * eased);
      if (progress < 1) {
        frame.current = requestAnimationFrame(step);
      } else {
        /* Land on the figure itself. Easing arithmetic in floating point
           finishes a digit or two short of it. */
        frame.current = 0;
        setShown(total);
      }
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [total]);

  const text = format(shown ?? total);

  return (
    <span ref={ref} className={className}>
      {/* The thousands separators carry the gold that 「亿」 used to provide,
          and break the eleven characters into readable groups. Rebuilding the
          string rather than setting text is what lets them be styled. */}
      {text.split("").map((char, index) =>
        char === "," ? (
          <span key={index} className="dawn-figure-sep">
            ,
          </span>
        ) : (
          char
        )
      )}
    </span>
  );
}
