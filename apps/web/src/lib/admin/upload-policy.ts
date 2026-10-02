/**
 * What an admin is allowed to put into Storage, and where.
 *
 * Shared by the two upload endpoints so the rules are stated once: the ticket
 * issuer and the registrar cannot drift apart and let something through.
 */

/** 200MB. Verified against this project: 100MB and 200MB both upload fine. */
export const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

/**
 * Content types we will issue a ticket for.
 *
 * Deliberately a list rather than a wildcard: an upload form that accepts
 * anything is an upload form that will eventually be handed an .html or .svg
 * and serve it from our own origin.
 */
export const ALLOWED_TYPES = new Map<string, string>([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
  ["image/avif", "avif"],
  ["application/pdf", "pdf"],
  ["application/zip", "zip"],
  ["application/x-zip-compressed", "zip"],
  ["application/x-rar-compressed", "rar"],
  ["application/vnd.rar", "rar"],
  ["application/msword", "doc"],
  ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "docx"],
  ["audio/mpeg", "mp3"],
  ["application/postscript", "ai"],
  ["image/vnd.adobe.photoshop", "psd"],
  ["application/octet-stream", ""]
]);

/** Extensions accepted when the browser reports a vague type. */
const ALLOWED_EXTENSIONS = new Set([
  "jpg", "jpeg", "png", "webp", "gif", "avif",
  "pdf", "zip", "rar", "doc", "docx", "mp3", "ai", "psd"
]);

export function extensionOf(filename: string): string {
  const m = filename.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : "";
}

/**
 * Browsers report .zip as application/zip, application/x-zip-compressed or
 * application/octet-stream depending on the OS, so the extension is the
 * authority and the content type only has to not be something we refuse.
 */
export function isAllowed(filename: string, contentType: string): boolean {
  const ext = extensionOf(filename);
  if (!ALLOWED_EXTENSIONS.has(ext)) return false;
  if (!contentType) return true;
  return ALLOWED_TYPES.has(contentType.toLowerCase());
}

export function sanitizeFolder(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9/_-]/g, "").replace(/^\/+|\/+$/g, "");
  if (!cleaned) return "general";
  if (cleaned.split("/").some((part) => part === "..")) return "general";
  return cleaned;
}

/**
 * Storage keys must be ASCII -- Supabase rejects anything else outright
 * ("Invalid key"), so a Chinese filename cannot be kept as the object name.
 *
 * Stripping it wholesale is what produced keys like `1790909571816-.zip`: every
 * character of 历史重演惊人醒.zip is non-ASCII, so the base name vanished and the
 * reader downloaded a file named after a timestamp. The extension is preserved
 * separately and an empty base falls back to "file", so the key stays legible.
 *
 * The *reader* still gets the original name: see `downloadUrlFor`.
 */
export function sanitizeFilename(value: string): string {
  const ext = extensionOf(value);
  const base = (ext ? value.slice(0, -(ext.length + 1)) : value)
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  const safeBase = base || "file";
  return ext ? `${safeBase}.${ext}` : safeBase;
}

/**
 * A public URL that saves under the name the uploader chose.
 *
 * Supabase honours `?download=<name>` by sending
 * `content-disposition: attachment; filename*=UTF-8''...`, which is how a
 * download keeps a Chinese name even though the stored key cannot.
 */
export function downloadUrlFor(publicUrl: string, originalName: string): string {
  const name = originalName.trim();
  if (!name) return `${publicUrl}?download`;
  return `${publicUrl}?download=${encodeURIComponent(name)}`;
}

/**
 * `<folder>/<timestamp>-<safe name>`, which cannot climb out of its prefix.
 *
 * When the filename is entirely non-ASCII -- 选择与救赎.zip, say -- sanitising
 * leaves nothing, and every such upload would land as `file.zip`, telling
 * whoever browses the bucket nothing and colliding in spirit with the next one.
 * In that case the folder's own name stands in, so the key becomes
 * `materials/xuanze-yu-jiushu/<ts>-xuanze-yu-jiushu.zip`.
 *
 * The reader is unaffected either way: the original name comes back through
 * `?download=` -- see `downloadUrlFor`.
 */
export function objectPathFor(folder: string, filename: string): string {
  const safeFolder = sanitizeFolder(folder);
  let name = sanitizeFilename(filename);
  if (name === "file" || name.startsWith("file.")) {
    const leaf = safeFolder.slice(safeFolder.lastIndexOf("/") + 1);
    const ext = extensionOf(filename);
    if (leaf && leaf !== "general") name = ext ? `${leaf}.${ext}` : leaf;
  }
  return `${safeFolder}/${Date.now()}-${name}`;
}
