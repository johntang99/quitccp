import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VideoDetail } from "@/components/public/VideoDetail";
import { getRenderableVideo, getVideoSlugByShortCode } from "@/lib/public-content";
import { looksLikeShortCode } from "@/lib/short-code";

/**
 * `/v/<短码>` —— 一支视频的短地址。
 *
 * 和文章那条 `/a/<短码>` 是同一件事，理由写在 app/a/[code]/page.tsx。视频这边
 * 更要紧：标题通常带集数和副题，实测一支的地址 258 个字符，最长的 611 个。
 *
 * 渲染而不是跳转，是为了让从短链进来的人地址栏一直是短的 —— 他再转发出去，
 * 链条不会退化回那堵百分号。`canonical` 指向长地址，收录算在那边。
 */

export const maxDuration = 15;
export const revalidate = 300;

export async function generateStaticParams() {
  return [];
}

async function resolve(code: string): Promise<string | null> {
  /* 形状不对就不查库：挡掉乱敲的地址，不让它变成一次数据库查询。 */
  if (!looksLikeShortCode(code)) return null;
  return getVideoSlugByShortCode(code);
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const slug = await resolve(code);
  if (!slug) return {};
  const video = await getRenderableVideo(slug);
  if (!video) return {};
  return {
    title: video.title,
    description: video.description?.slice(0, 180) || undefined,
    alternates: { canonical: `/videos/${encodeURIComponent(slug)}` },
    openGraph: { type: "video.other", title: video.title, description: video.description?.slice(0, 180) || undefined }
  };
}

export default async function ShortVideoPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slug = await resolve(code);
  if (!slug) notFound();
  const video = await getRenderableVideo(slug);
  if (!video) notFound();
  return <VideoDetail video={video} />;
}
