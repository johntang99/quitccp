/**
 * Where a video actually plays from.
 *
 * Shared by the admin list and the public page. "自有" means the file sits on a
 * server we control -- currently still the old site's, which is why the label
 * says so rather than just "self-hosted": those 213 files have to move before
 * tuidang.org goes away, and a list that hides where they are makes that easy to
 * forget.
 */
export type VideoHost = "youtube" | "ganjing" | "vimeo" | "tuidang" | "file" | "none" | "other";

export interface HostInfo {
  key: VideoHost;
  label: string;
  /** True when mainland readers can reach it. */
  reachableInChina: boolean;
}

export function hostOf(url: string): HostInfo {
  const value = (url ?? "").trim();
  if (!value) return { key: "none", label: "无地址", reachableInChina: false };
  if (/youtube\.com|youtu\.be/i.test(value)) return { key: "youtube", label: "YouTube", reachableInChina: false };
  if (/ganjing/i.test(value)) return { key: "ganjing", label: "干净世界", reachableInChina: true };
  if (/vimeo\.com/i.test(value)) return { key: "vimeo", label: "Vimeo", reachableInChina: false };
  if (/(^|\/\/)(www\.)?tuidang\.org/i.test(value)) return { key: "tuidang", label: "自有（旧站）", reachableInChina: false };
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(value)) return { key: "file", label: "自有文件", reachableInChina: true };
  return { key: "other", label: "其它", reachableInChina: false };
}

/**
 * The YouTube video id in a watch, share or embed address; "" for anything else.
 *
 * Deliberately strict: the id is interpolated into a URL the server fetches, so
 * anything that is not plainly an id must not get through.
 */
export function youtubeIdOf(url: string): string {
  const value = (url ?? "").trim();
  const match =
    value.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,20})/) ??
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,20})/) ??
    value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,20})/);
  return match ? match[1] : "";
}

/** Turns a watch or share address into one that can sit in an iframe. */
export function toEmbedUrl(url: string): string {
  const value = (url ?? "").trim();
  if (!value) return "";
  const youtube =
    value.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;

  // Gan Jing World serves its watch pages with
  // `content-security-policy: frame-ancestors 'self' *.ganjing.com`, so a
  // /video/ address put in an iframe renders nothing at all -- the browser
  // refuses it and says so only in the console. The /embed/ form carries no
  // such header. Converting here means an editor can paste whichever address
  // they copied from the site and it still plays.
  const ganjing = value.match(
    /ganjingworld\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?(?:video|embed|live)\/([A-Za-z0-9]+)/
  );
  if (ganjing) return `https://www.ganjingworld.com/embed/${ganjing[1]}`;

  return value;
}

export function isFileUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|ogv|mov)(\?|$)/i.test((url ?? "").trim());
}
