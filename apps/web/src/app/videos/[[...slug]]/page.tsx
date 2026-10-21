import { notFound, permanentRedirect } from "next/navigation";
import { findSlugRedirect, publicPath } from "@/lib/slug-redirects";
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
import { t } from "@/lib/i18n";

/**
 * A content page renders in about a second. Without this it inherits Vercel's
 * 300-second ceiling, and on 2026-10-13 that ceiling is what turned a flood
 * into an outage: ~500 req/s against one article saturated Postgres, every
 * request then blocked on a query it would never get, and each one held its
 * database connection for the full five minutes. The connections never came
 * back fast enough to drain, Postgres stopped accepting new ones, and the
 * whole project went dark -- 86,000 FUNCTION_INVOCATION_TIMEOUTs in 12 hours.
 *
 * Fifteen seconds is far more than this page needs and far less than it takes
 * to exhaust the database. Under load the site now gets slow and sheds
 * requests instead of holding them until something breaks.
 */
export const maxDuration = 15;

/**
 * Lets a copy of the page exist between the reader and Postgres.
 *
 * Without this the route carries `no-store`: every request renders fresh and
 * queries the database, which is exactly the property the 2026-10-13 flood was
 * built around -- 477 million hits on one article, each one its own function
 * invocation and database round trip. The same flood against a cached route is
 * a CDN hit that costs nothing and never reaches Postgres.
 *
 * Five minutes matches `/news` and the homepage, which have been served this
 * way all along. An editor's save calls `revalidatePath`, so a change still
 * appears at once; this is only the ceiling for everything else.
 */
export const revalidate = 300;

/**
 * Empty on purpose, exactly as on /news/[slug]: without it a dynamic segment is
 * treated as fully dynamic and answers `no-store`, whatever `revalidate` says.
 * Measured there, not assumed. Nothing is built ahead; the first reader of each
 * film generates it and everyone after is served the copy.
 */
export async function generateStaticParams() {
  return [];
}


/** The section's own CMS page. Everything else is a category or a video. */
const VIDEO_PAGES = new Set(["index"]);

/** Where each series sits in the design. */
const FRONTLINE = "frontline";
const JIUPING = "jiuping";
const PARTY_CULTURE = "party-culture";
/** The design's two-panel rows, in order. */
const DUO = ["ironclad", "awakening"];
const PAIRS = ["hope-road", "step-back"];

export default async function VideosPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const resolved = await params;
  const slug = resolved.slug?.[0];

  /* No `searchParams`, deliberately -- see `generateStaticParams` below. Paging
     and sorting live at /videos/<slug>/<page>, a route of its own that may be
     dynamic; this one serves the video home, the first page of every series and
     all 760 films, which is what has to be cacheable. */
  if (slug && !VIDEO_PAGES.has(slug)) {
    const category = await getVideoCategory(slug, 1, "latest");
    if (category) {
      const siblings = await listPublicVideoCategories();
      return <VideoCategoryPage category={category} siblings={siblings} />;
    }
    const video = await getRenderableVideo(slug);
    if (video) return <VideoDetail video={video} />;
    const moved = await findSlugRedirect(publicPath.video(decodeURIComponent(slug)));
    if (moved) permanentRedirect(encodeURI(moved));
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

      <VideoHomeHeader shelves={home.shelves} />
      <FeatureBand
        feature={home.feature}
        featureCategory={home.featureCategory}
        featureIsFlagged={home.featureIsFlagged}
        upnext={home.upnext}
        shelves={home.shelves}
      />

      {/* Divides the page's two halves: the single film it opens with above,
          the series shelves below. Without it the first shelf read as part of
          the feature block. */}
      <div className="vp-shell">
        <hr className="vp-divider" />
      </div>

      {/* The note comes off the shelf, not out of this file. It used to be
          written here as well as on the category page, which is how the same
          shelf ends up described two ways; now both read the column an editor
          edits. */}
      {find(FRONTLINE) ? <LeadAndGrid shelf={find(FRONTLINE)!} note={find(FRONTLINE)!.description} /> : null}
      {find(JIUPING) ? <VideoSeriesBand shelf={find(JIUPING)!} /> : null}
      <PanelDuo shelves={pick(DUO)} />
      {find(PARTY_CULTURE) ? <EpisodeRow shelf={find(PARTY_CULTURE)!} note={find(PARTY_CULTURE)!.description} /> : null}
      <PanelPairs shelves={pick(PAIRS)} />

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
          <span>{t("video.freeToUse")}</span>
          <span style={{ display: "flex", gap: 20, alignItems: "center" }}>
            <span>{t("video.alsoOn")}</span>
            <span style={{ color: "var(--title)" }}>YouTube</span>
            <span style={{ color: "var(--title)" }}>GanJingWorld</span>
          </span>
        </div>
      </div>
    </div>
  );
}
