import type { Metadata } from "next";
import { t } from "@/lib/i18n";

/**
 * 文章分享卡片用的 metadata，长地址 /news/<slug> 和短地址 /a/<短码> 共用。
 *
 * Signal、WhatsApp、Telegram 等靠这些标签拼出「配图 + 标题 + 摘要」的卡片；
 * 缺了 og:image，分享出去只剩一条网址。两个地址曾各写一份，一份补了图、另一份
 * 没补 —— 所以收在这里。
 */
export function articleShareMetadata(
  article: { title: string; content?: unknown },
  path: string,
  canonical: string
): Metadata {
  const content = (article.content ?? {}) as Record<string, unknown>;
  const summary = typeof content.dek === "string" ? content.dek.slice(0, 180) : "";
  const hero = (content.heroFigure ?? {}) as { image?: unknown; alt?: unknown };
  const image = typeof hero.image === "string" && hero.image ? hero.image : undefined;
  const title = article.title.trim();
  return {
    title,
    description: summary || undefined,
    alternates: { canonical },
    openGraph: {
      type: "article",
      url: path,
      siteName: t("site.name"),
      title,
      description: summary || undefined,
      images: image ? [{ url: image, alt: typeof hero.alt === "string" && hero.alt ? hero.alt : title }] : undefined
    },
    twitter: { card: image ? "summary_large_image" : "summary" }
  };
}
