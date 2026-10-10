import type { Metadata } from "next";
import { notoSerifSC } from "./fonts";
import { loadTheme, themeToCss } from "@/lib/public-theme";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./globals.css";

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tuidang.org").replace(/\/$/, "");

export const metadata: Metadata = {
  /* A page that sets no title of its own gets the centre's name; one that does
     gets "<its title> — 全球退党服务中心". */
  title: { default: "全球退党服务中心", template: "%s — 全球退党服务中心" },
  description:
    "全球退党服务中心：三退声明登记与证书、新闻与调查报告、影片与可自由取用的真相资料。",
  metadataBase: new URL(SITE_ORIGIN),
  /*
   * No canonical here.
   *
   * This used to be `canonical: "/"`, which the root layout hands to every page
   * underneath it -- so all 15,527 articles told search engines that their
   * canonical version was the homepage, i.e. that each of them was a duplicate
   * of it. Pages that know their own address declare it; the rest are better
   * off with no claim than with a wrong one.
   */
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = await loadTheme();
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "全球退党服务中心",
    url: SITE_ORIGIN,
    email: "service@tuidang.org",
    sameAs: [
      "https://www.tuidang.org",
    ],
  };

  return (
    // suppressHydrationWarning: the videos page writes the reader's remembered
    // background onto <html> before first paint, so the served markup and the
    // hydrating markup legitimately differ by that one attribute.
    <html
      lang="zh-CN"
      className={notoSerifSC.variable}
      suppressHydrationWarning
    >
      <head>
        <style
          id="theme-tokens"
          dangerouslySetInnerHTML={{ __html: themeToCss(theme) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
      </head>
      <body>
        <SiteHeader />
        <main className="mainContent">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
