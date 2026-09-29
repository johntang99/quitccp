import { hostOf, isFileUrl, toEmbedUrl } from "@/lib/video-host";

export interface PublicVideo {
  slug: string;
  title: string;
  episode: string;
  description: string;
  bodyMarkdown: string;
  sourceUrl: string;
  backupUrl: string;
  coverImage: string;
  coverImageAlt: string;
  speaker: string;
  sourceCredit: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  category: string;
}

function minutes(seconds: number | null): string {
  if (!seconds) return "";
  const hours = Math.floor(seconds / 3600);
  const rest = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} 小时 ${rest} 分` : `${rest} 分钟`;
}

/** Paragraph-level rendering only -- a transcript is prose, not a layout. */
function paragraphs(markdown: string): string[] {
  return markdown
    .replace(/^#{1,6}\s*/gm, "")
    .split(/\n{2,}/)
    .map((block) => block.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

/**
 * The public page for one video.
 *
 * Deliberately not built on the article template: that one renders prose and
 * has no place to put a player, and 233 of these carry only a transcript, so
 * the page has to read well both with and without a video in it.
 */
export function VideoDetail({ video }: { video: PublicVideo }) {
  const host = hostOf(video.sourceUrl);
  const embed = toEmbedUrl(video.sourceUrl);
  const body = paragraphs(video.bodyMarkdown || "");
  const meta = [
    video.publishedAt ? video.publishedAt.slice(0, 10) : "",
    video.category,
    video.episode,
    minutes(video.durationSeconds),
    video.speaker
  ].filter(Boolean);

  return (
    <main className="wrap" style={{ padding: "34px 0 64px", maxWidth: 900 }}>
      <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", display: "flex", gap: 8 }}>
        <a href="/" style={{ color: "var(--muted)" }}>首页</a>
        <span>/</span>
        <a href="/videos" style={{ color: "var(--muted)" }}>视频</a>
        {video.category ? (
          <>
            <span>/</span>
            <span>{video.category}</span>
          </>
        ) : null}
      </p>

      <h1
        style={{
          fontFamily: "var(--serif)",
          fontWeight: 900,
          fontSize: "clamp(24px,3vw,36px)",
          lineHeight: 1.45,
          margin: "12px 0 14px"
        }}
      >
        {video.title}
      </h1>

      {meta.length > 0 ? (
        <p style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--muted)", margin: "0 0 22px" }}>
          {meta.join(" · ")}
        </p>
      ) : null}

      {embed ? (
        <div style={{ margin: "0 0 10px", background: "#111", borderRadius: 4, overflow: "hidden" }}>
          {isFileUrl(embed) ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={embed}
              poster={video.coverImage || undefined}
              controls
              playsInline
              preload="none"
              style={{ width: "100%", display: "block", aspectRatio: "16 / 9", background: "#111" }}
            />
          ) : (
            <iframe
              src={embed}
              title={video.title}
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", aspectRatio: "16 / 9", border: 0, display: "block" }}
            />
          )}
        </div>
      ) : video.coverImage ? (
        <img
          src={video.coverImage}
          alt={video.coverImageAlt || video.title}
          style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "#E4E1D8", marginBottom: 10 }}
        />
      ) : null}

      {embed && !host.reachableInChina ? (
        <p style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)", margin: "0 0 26px" }}>
          本片存放于 {host.label}，大陆需翻墙观看。
          {video.backupUrl ? (
            <>
              {" "}
              <a href={video.backupUrl} target="_blank" rel="noopener noreferrer">
                改看干净世界版本 ↗
              </a>
            </>
          ) : null}
        </p>
      ) : (
        <div style={{ marginBottom: 26 }} />
      )}

      {video.description ? (
        <p style={{ fontSize: 17, lineHeight: 1.9, margin: "0 0 20px" }}>{video.description}</p>
      ) : null}

      {body.length > 0 ? (
        <div className="prose">
          {body.map((text, index) => (
            <p key={index}>{text}</p>
          ))}
        </div>
      ) : null}

      {video.sourceCredit ? (
        <p style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)", marginTop: 28 }}>
          {video.sourceCredit}
        </p>
      ) : null}
    </main>
  );
}
