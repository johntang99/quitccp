import Link from "next/link";
import type { Route } from "next";
import { MarkdownBody } from "@/components/public/MarkdownBody";
import { markdownToBodyRows } from "@/lib/public-content";
import type { PublicVideoRecord, PublicVideoCard } from "@/lib/public-content";
import { hostOf, isFileUrl, toEmbedUrl } from "@/lib/video-host";

type PublicVideo = PublicVideoRecord;

function minutes(seconds: number | null): string {
  if (!seconds || seconds < 1) return "";
  return `${Math.round(seconds / 60)} 分`;
}

/**
 * Whether the summary is just the opening of the body.
 *
 * The importer set description to the first characters of the body, so printing
 * both showed the same passage twice -- once run together, then again as proper
 * paragraphs.
 */
function isEchoOfBody(summary: string, bodyText: string): boolean {
  const a = summary.replace(/\s+/g, "").slice(0, 40);
  if (a.length < 12) return false;
  return bodyText.replace(/\s+/g, "").includes(a);
}

/** A rough reading time, for the strip under the player. */
function readingMinutes(chars: number): number {
  return Math.max(1, Math.round(chars / 380));
}

/** How many entries the rail will carry before it stops being navigation. */
const TOC_MAX = 16;

/**
 * A caption the importer promoted to a heading, not a section of the piece.
 *
 * The old site put picture credits on their own line, and the WordPress export
 * turned many of them into `###`. On 九评之九 that alone produced eleven
 * 「(大纪元配图)」 entries in a list of fifty-three.
 */
function isCaptionHeading(text: string): boolean {
  const t = text.trim();
  if (/^[（(【[].{0,24}[)）】\]]$/.test(t)) return true;
  return /配图|截图|摄影|供图|图片来源/.test(t) && t.length <= 16;
}

/**
 * The rail's contents list.
 *
 * Built from `h2` when the piece has them, and from `h3` only when it has no
 * `h2` at all -- the imported bodies are inconsistent about which level they
 * use, and mixing both turns a nested outline into a flat list of fifty.
 */
function headingsOf(rows: ReturnType<typeof markdownToBodyRows>): { id: string; text: string }[] {
  const pick = (level: "h2" | "h3") => {
    const out: { id: string; text: string }[] = [];
    rows.forEach((row, index) => {
      if (row.type !== level || !("text" in row)) return;
      const text = row.text.trim();
      if (!text || isCaptionHeading(text)) return;
      out.push({ id: `sec-${index}`, text });
    });
    return out;
  };
  const top = pick("h2");
  return top.length > 0 ? top : pick("h3");
}

function Thumb({ card }: { card: PublicVideoCard }) {
  return (
    <span className="vthumb">
      {card.coverImage ? <img src={card.coverImage} alt="" loading="lazy" /> : null}
      <span className="vmark" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M8 5v14l11-7z" />
        </svg>
      </span>
    </span>
  );
}

/**
 * One film: the player, the text that comes with it, and what to watch next.
 *
 * The two halves trade places depending on the film. Of 905 videos, 147 carry
 * under 300 characters of text and 97 carry over 4,000 -- one runs to 20,617 --
 * so the page cannot be built around either extreme. The contents list and the
 * reading line appear only when the text is long enough to need them, and when
 * it is short the 继续观看 band carries the end of the page instead.
 */
export function VideoDetail({ video }: { video: PublicVideo }) {
  const host = hostOf(video.sourceUrl);
  const embed = toEmbedUrl(video.sourceUrl);
  const body = markdownToBodyRows(video.bodyMarkdown || "");
  const bodyText = body.map((row) => ("text" in row ? row.text : "")).join(" ");
  const showDescription = Boolean(video.description) && !isEchoOfBody(video.description, bodyText);
  const chars = video.bodyMarkdown.replace(/\s+/g, "").length;
  const allHeadings = headingsOf(body);
  // Past a point a list stops being navigation and becomes a second article.
  const headings = allHeadings.slice(0, TOC_MAX);
  const headingsHidden = allHeadings.length - headings.length;
  // A contents list for a three-paragraph note is furniture, not navigation.
  const showToc = headings.length >= 3 && chars >= 1200;

  const railVideos = video.siblings.slice(0, 3);
  const bandVideos = video.siblings.slice(3, 7);
  const categoryHref = video.categorySlug ? (`/videos/${video.categorySlug}` as Route) : ("/videos" as Route);

  return (
    <>
      <header className="vstage">
        <div className="wrap">
          <p className="vcrumb">
            <Link href={"/" as Route}>首页</Link>
            <span aria-hidden="true">/</span>
            <Link href={"/videos" as Route}>视频</Link>
            {video.category ? (
              <>
                <span aria-hidden="true">/</span>
                <Link href={categoryHref}>{video.category}</Link>
              </>
            ) : null}
          </p>

          <div className="vstage-in">
            {video.category || video.episode ? (
              <p className="vseries">
                {video.category ? <span>{video.category}</span> : null}
                {video.episode ? <span className="vep">{video.episode}</span> : null}
              </p>
            ) : null}
            <h1 className="vtitle">{video.title}</h1>

            <div className="vplayer">
              {embed ? (
                isFileUrl(embed) ? (
                  // eslint-disable-next-line jsx-a11y/media-has-caption
                  <video src={embed} poster={video.coverImage || undefined} controls playsInline preload="none" />
                ) : (
                  <iframe
                    src={embed}
                    title={video.title}
                    allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                )
              ) : video.coverImage ? (
                <img src={video.coverImage} alt={video.coverImageAlt || video.title} />
              ) : null}
            </div>

            <div className="vmeta">
              {video.publishedAt ? <span className="vnum">{video.publishedAt.slice(0, 10)}</span> : null}
              {embed ? (
                <span className="vhost">
                  <i aria-hidden="true" />
                  {host.label}
                </span>
              ) : null}
              {minutes(video.durationSeconds) ? <span>片长 {minutes(video.durationSeconds)}</span> : null}
              {chars > 0 ? (
                <span>
                  约 <b className="vnum">{chars.toLocaleString("zh-CN")}</b> 字
                  {chars >= 1200 ? (
                    <>
                      {" · 阅读约 "}
                      <b className="vnum">{readingMinutes(chars)}</b> 分钟
                    </>
                  ) : null}
                </span>
              ) : null}
              {embed && !host.reachableInChina && video.backupUrl ? (
                <a className="vghost" href={video.backupUrl} target="_blank" rel="noopener noreferrer">
                  改看干净世界版本 ↗
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="wrap">
        <div className={`vgrid${showToc || railVideos.length > 0 ? "" : " vgrid--solo"}`}>
          <article className="vsheet">
            {showDescription ? <p className="vlede">{video.description}</p> : null}

            {body.length > 0 ? (
              <div className="prose vprose">
                <MarkdownBody rows={body} headingIds={showToc} />
              </div>
            ) : null}

            {video.sourceCredit ? <p className="vcredit">{video.sourceCredit}</p> : null}
          </article>

          {showToc || railVideos.length > 0 ? (
            <aside className="vrail">
              {showToc ? (
                <nav className="vbox" aria-label="本片文字目录">
                  <h2>本片文字目录</h2>
                  <ul className="vtoc">
                    {headings.map((item) => (
                      <li key={item.id}>
                        <a href={`#${item.id}`}>{item.text}</a>
                      </li>
                    ))}
                  </ul>
                  {headingsHidden > 0 ? (
                    <p className="vtoc-rest">另有 {headingsHidden} 节，继续往下读</p>
                  ) : null}
                </nav>
              ) : null}

              {railVideos.length > 0 ? (
                <div className="vbox">
                  <h2>{video.category ? `${video.category} · 同系列` : "同系列"}</h2>
                  <div className="vmini">
                    {railVideos.map((card) => (
                      <Link key={card.slug} href={`/videos/${encodeURIComponent(card.slug)}` as Route}>
                        {card.coverImage ? <img src={card.coverImage} alt="" loading="lazy" /> : <span className="vmini-gap" />}
                        <span>
                          <b>{card.title}</b>
                          <em className="vnum">
                            {card.episode ? `${card.episode} · ` : ""}
                            {card.publishedAt ? card.publishedAt.slice(0, 10) : ""}
                          </em>
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}
            </aside>
          ) : null}
        </div>
      </main>

      {bandVideos.length > 0 ? (
        <section className="vmore">
          <div className="wrap">
            <div className="vmore-head">
              <div>
                <p className="eyebrow">继续观看</p>
                <h2>{video.category || "影音节目"}</h2>
              </div>
              <Link className="vmore-link" href={categoryHref}>
                查看全部{video.category ? ` ${video.category}` : ""} →
              </Link>
            </div>
            <div className="vcards">
              {bandVideos.map((card) => (
                <Link className="vcard" key={card.slug} href={`/videos/${encodeURIComponent(card.slug)}` as Route}>
                  <Thumb card={card} />
                  {video.category ? <span className="vtag">{video.category}</span> : null}
                  <h3>{card.title}</h3>
                  <span className="vfoot vnum">{card.publishedAt ? card.publishedAt.slice(0, 10) : ""}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
