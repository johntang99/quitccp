import { notFound } from "next/navigation";
import { PageFromRoute } from "@/components/PageFromRoute";
import { VideoDetail } from "@/components/public/VideoDetail";
import { VideoCategoryPage } from "@/components/public/videos/VideoCategoryPage";
import { VideoHomeHeader } from "@/components/public/videos/VideoHomeHeader";
import { VideoSeriesBand } from "@/components/public/videos/VideoSeriesBand";
import {
  CardRow,
  EpisodeRow,
  FeatureBand,
  LeadAndGrid,
  PanelDuo,
  PanelPairs
} from "@/components/public/videos/VideoSections";
import { THEME_BOOTSTRAP } from "@/components/public/videos/VideoThemeToggle";
import type { VideoSort } from "@/lib/public-content";
import { getRenderableVideo, getVideoCategory, getVideoHome, listPublicVideoCategories } from "@/lib/public-content";

/** The section's own CMS page. Everything else is a category or a video. */
const VIDEO_PAGES = new Set(["index"]);

/** Where each series sits in the design. */
const FRONTLINE = "frontline";
const JIUPING = "jiuping";
const PARTY_CULTURE = "party-culture";
const OTHERS = "others";
/** The design's two-panel rows, in order. */
const DUO = ["ironclad", "awakening"];
const PAIRS = ["hope-road", "step-back"];

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
    const query = await searchParams;
    const sort: VideoSort = query.sort === "oldest" ? "oldest" : "latest";
    const category = await getVideoCategory(slug, Number(query.page ?? "1") || 1, sort);
    if (category) {
      const siblings = await listPublicVideoCategories();
      return <VideoCategoryPage category={category} siblings={siblings} />;
    }
    const video = await getRenderableVideo(slug);
    if (video) return <VideoDetail video={video} />;
    notFound();
  }

  const home = await getVideoHome();
  if (home.shelves.length === 0) return <PageFromRoute section="videos" slug={slug} />;

  const find = (key: string) => home.shelves.find((shelf) => shelf.slug === key);
  const pick = (keys: string[]) => keys.map(find).filter(Boolean) as NonNullable<ReturnType<typeof find>>[];

  return (
    <div className="vp">
      {/* Applies the remembered background before first paint, so the reader
          never sees the default flash past. It writes onto <html>, not onto
          this wrapper: React owns this element's attributes and would reset it
          to the server-rendered value at hydration -- which it did, silently
          undoing the choice and logging a hydration mismatch. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      <span className="vp-glow" aria-hidden="true" />

      <VideoHomeHeader shelves={home.shelves} total={home.total} />
      <FeatureBand
        feature={home.feature}
        featureCategory={home.featureCategory}
        upnext={home.upnext}
        shelves={home.shelves}
      />

      {find(FRONTLINE) ? <LeadAndGrid shelf={find(FRONTLINE)!} note="服务点现场、义工纪实与当事人访谈" /> : null}
      {find(JIUPING) ? <VideoSeriesBand shelf={find(JIUPING)!} /> : null}
      <PanelDuo shelves={pick(DUO)} />
      {find(PARTY_CULTURE) ? <EpisodeRow shelf={find(PARTY_CULTURE)!} note="解析党文化如何进入语言、教育与日常生活" /> : null}
      <PanelPairs shelves={pick(PAIRS)} />
      {find(OTHERS) ? <CardRow shelf={find(OTHERS)!} note="专题访谈、现场纪录与更多节目" /> : null}

      <div className="vp-shell" style={{ paddingTop: 72, paddingBottom: 96 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 20,
            flexWrap: "wrap",
            padding: "22px 28px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "var(--panel)",
            fontSize: 14,
            color: "var(--muted)"
          }}
        >
          <span>全部节目可自由下载、转载与再制作</span>
          <span style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <span>同步发布于</span>
            <span style={{ color: "var(--title)" }}>YouTube</span>
            <span style={{ color: "var(--title)" }}>GanJingWorld</span>
          </span>
        </div>
      </div>
    </div>
  );
}
