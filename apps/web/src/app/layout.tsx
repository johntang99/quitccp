import type { Metadata } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import "./globals.css";

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.tuidang.org").replace(/\/$/, "");

export const metadata: Metadata = {
  title: "全球退党服务中心",
  description: "QuitCCP services + media dynamic site",
  metadataBase: new URL(SITE_ORIGIN),
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
    <html lang="zh-CN">
      <head>
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
