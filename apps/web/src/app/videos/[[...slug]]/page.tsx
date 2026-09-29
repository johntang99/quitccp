import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { VideoDetail } from "@/components/public/VideoDetail";
import { getRenderableVideo } from "@/lib/public-content";

/** The section's own CMS pages; anything else under /videos is a video slug. */
const VIDEO_PAGES = new Set(["index"]);

export default async function VideosPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  const slug = resolved.slug?.[0];

  // A video's slug is its own path segment, the same shape articles use under
  // /news. Without this every video in the library 404s, which is what the
  // admin's preview link would have hit.
  if (slug && !VIDEO_PAGES.has(slug)) {
    const video = await getRenderableVideo(slug);
    if (video) return <VideoDetail video={video} />;
    notFound();
  }

  return <PageFromRoute section="videos" slug={slug} />;
}
