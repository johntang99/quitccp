"use client";

import { toEmbedUrl } from "@/lib/video-host";
import { t } from "@/lib/i18n";

/**
 * Says that a 干净世界 address is the un-embeddable kind, and offers to fix it.
 *
 * Copying the address out of the browser bar on ganjingworld.com gives the
 * /video/ form. That page is served with
 * `content-security-policy: frame-ancestors 'self' *.ganjing.com`, so inside an
 * iframe it renders nothing at all -- no error on the page, only a line in the
 * console. The /embed/ form carries no such header.
 *
 * The site repairs this when it renders, so an old /video/ address still plays
 * for readers. The reason to say it here anyway is that the editor cannot tell:
 * a black box in the preview looks exactly like a broken video, and the next
 * person to paste one has no way to learn the rule.
 *
 * Nothing is rewritten automatically -- an address changing itself under the
 * editor's hands is its own kind of confusing -- so the button does it, and
 * shows both forms first.
 */
export function GanjingEmbedNotice({ url, onFix }: { url: string; onFix: () => void }) {
  const fixed = toEmbedUrl(url);
  if (!fixed || fixed === url.trim()) return null;

  /* Two sites, one problem, so one notice. Gan Jing World answers an embedded
     /video/ page with a frame-ancestors header and Vimeo answers vimeo.com
     with X-Frame-Options; either way the reader gets an empty rectangle where
     the film should be, and either way the fix is the player address. */
  const vimeo = /vimeo\.com/i.test(url);
  const headline = vimeo
    ? t("admin.vid.embed.vimeoWatch")
    : t("admin.vid.embed.ganjingWatch");
  const action = t(vimeo ? "admin.vid.embed.fixVimeo" : "admin.vid.embed.fixGanjing");

  return (
    <div
      style={{
        margin: "8px 0 0",
        padding: "10px 12px",
        background: "#fffbe9",
        border: "1px solid #f0dca0",
        borderRadius: 4,
        fontSize: 13,
        lineHeight: 1.65,
        color: "#6b5312"
      }}
    >
      <strong style={{ display: "block", marginBottom: 4 }}>{headline}</strong>
      <div style={{ fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, wordBreak: "break-all" }}>
        <div style={{ textDecoration: "line-through", opacity: 0.65 }}>{url.trim()}</div>
        <div style={{ color: "#1f7a4d" }}>{fixed}</div>
      </div>
      <button
        type="button"
        className="admin-btn admin-btn-sm"
        style={{ marginTop: 8 }}
        onClick={onFix}
      >
        {action}
      </button>
    </div>
  );
}
