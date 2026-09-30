import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { VideoCategoryList } from "@/components/public/VideoCategoryList";
import { VideoDetail } from "@/components/public/VideoDetail";
import { VideoLibraryIndex } from "@/components/public/VideoLibraryIndex";
import {
  getRenderableVideo,
  getVideoCategory,
  getVideoLibrary,
  listPublicVideoCategories
} from "@/lib/public-content";

/** The section's own CMS page. Everything else is a category or a video. */
const VIDEO_PAGES = new Set(["index"]);

export default async function VideosPage({
  params,
  searchParams
}: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const resolved = await params;
  const slug = resolved.slug?.[0];

  if (slug && !VIDEO_PAGES.has(slug)) {
    // Category first: the section index links to eight of these, and every one
    // of them was a 404 -- the videos were in the database with nothing leading
    // to them. A video slug is the longer, Chinese one, so the two never collide.
    const category = await getVideoCategory(slug, Number((await searchParams).page ?? "1") || 1);
    if (category) {
      const siblings = await listPublicVideoCategories();
      return <VideoCategoryList category={category} siblings={siblings} />;
    }

    const video = await getRenderableVideo(slug);
    if (video) return <VideoDetail video={video} />;
    notFound();
  }

  // The CMS page for this section lists five hand-written shelves with sample
  // titles: it names categories that do not exist, omits three that do, and
  // shows no video from the library. Render the library itself when there is
  // one, and fall back to the page only if there is not.
  const shelves = await getVideoLibrary();
  if (shelves.length > 0) return <VideoLibraryIndex shelves={shelves} />;

  return <PageFromRoute section="videos" slug={slug} />;
}
