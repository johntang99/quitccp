import { Noto_Serif_SC } from "next/font/google";

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
