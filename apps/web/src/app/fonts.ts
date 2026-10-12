import { Barlow_Condensed, Noto_Serif_SC } from "next/font/google";

// Headings only. The CSS has always *asked* for Noto Serif SC, but nothing ever
// shipped it, so headings fell back to Songti SC on a Mac and SimSun on Windows,
// where the old 900 weight was synthesised and smeared the strokes.
//
// Body text deliberately does NOT load a webfont: it uses the reader's own CJK
// UI face (PingFang SC / Microsoft YaHei), which is well hinted on both
// platforms and was never the broken part. Serving body text from a webfont
// meant ~2.8MB of unicode-range slices on a long article, because a CJK face is
// delivered as ~100 slices and long Chinese prose touches most of them.
//
// preload:false for the same reason: let the browser fetch only the slices whose
// glyphs are actually on screen.
export const notoSerifSC = Noto_Serif_SC({
  weight: ["700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-serif-sc",
  fallback: ["Songti SC", "serif"],
});

/**
 * The registry figure on the homepage, and nothing else.
 *
 * It has one job: carry 467,293,946 at ~160px in the space 4.67 亿 used to
 * occupy, while a count-up animation runs through it. That rules out the faces
 * already loaded here -- Noto Serif SC's digits are not the same width (nine
 * `1`s are 422px where nine `0`s are 537px, and `tabular-nums` cannot fix it
 * because the face carries no tabular set), so every frame of the animation
 * would be a different width and the whole line would jitter.
 *
 * Barlow Condensed is tabular once `font-variant-numeric` asks for it, and is
 * the narrowest of the condensed faces that are -- which is what lets eleven
 * characters fit a column that previously held four.
 *
 * Latin only, one weight, and in practice only twelve glyphs (0-9 , and the
 * digits' spacing), so this costs a few kilobytes rather than the megabytes a
 * CJK webfont would.
 */
export const barlowCondensed = Barlow_Condensed({
  weight: ["300"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-cond",
  fallback: ["Noto Sans SC", "sans-serif"],
});
