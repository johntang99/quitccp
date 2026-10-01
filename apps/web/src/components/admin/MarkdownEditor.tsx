"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";

/**
 * Markdown editor for article bodies.
 *
 * Deliberately not a WYSIWYG: the 15,000 migrated articles are already Markdown,
 * and a rich-text layer would mean a lossy conversion in both directions. The
 * toolbar writes Markdown into the textarea and the preview renders it, so what
 * an editor sees is what is stored.
 */

type Mode = "edit" | "split" | "preview";

interface MarkdownEditorProps {
  value: string;
  onChange: (next: string) => void;
  /** Opens the shared media library; resolves with the chosen URL. */
  onPickImage: () => void;
}

/**
 * What a parent can ask the editor to do.
 *
 * The media library lives outside this component, so the picker's result has to
 * come back in through a handle. Without one the forms appended the image to the
 * end of the body, wherever the editor had actually put the caret.
 */
export interface MarkdownEditorHandle {
  insertAtCaret: (text: string) => void;
}

/** Wraps or prefixes the selection, then restores focus and a sane caret. */
function apply(
  textarea: HTMLTextAreaElement,
  kind: "wrap" | "line" | "insert",
  a: string,
  b = ""
): { next: string; caret: number } {
  const { value, selectionStart: start, selectionEnd: end } = textarea;
  const selected = value.slice(start, end);

  if (kind === "insert") {
    return { next: value.slice(0, start) + a + value.slice(end), caret: start + a.length };
  }
  if (kind === "wrap") {
    const body = selected || "文字";
    return {
      next: value.slice(0, start) + a + body + b + value.slice(end),
      caret: start + a.length + body.length
    };
  }
  // line: prefix every selected line, extending to the line start so the
  // prefix is not dropped into the middle of a sentence.
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const block = value.slice(lineStart, end) || "文字";
  const prefixed = block
    .split("\n")
    .map((line, i) => (a === "1. " ? `${i + 1}. ${line}` : a + line))
    .join("\n");
  return {
    next: value.slice(0, lineStart) + prefixed + value.slice(end),
    caret: lineStart + prefixed.length
  };
}

/**
 * Minimal Markdown rendering for the preview pane.
 *
 * Escapes first, so a body containing HTML shows as text rather than executing
 * -- article bodies come from a WordPress import and are not trusted markup.
 */
/**
 * An embeddable address, or "" when the host is not one we play.
 *
 * Keeps javascript: and data: out of the preview's iframe, and turns a YouTube
 * watch link into its embed form so the player actually loads.
 */
function previewEmbed(url: string): string {
  const value = url.trim();
  if (!/^https?:\/\//i.test(value)) return "";
  const youtube =
    value.match(/youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/) ??
    value.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
  if (youtube) return `https://www.youtube.com/embed/${youtube[1]}`;
  if (/^https?:\/\/[^/]*(ganjing(world)?\.com|vimeo\.com)\//i.test(value)) return value;
  if (/\.(mp4|webm|ogg|mov)(\?|$)/i.test(value)) return value;
  return "";
}

function renderPreview(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const blocks = esc(md).split(/\n{2,}/);
  return blocks
    .map((block) => {
      const t = block.trim();
      if (!t) return "";
      // A markdown table, recognised by the |---|---| separator on line two.
      const tableLines = t.split("\n").map((line) => line.trim());
      if (
        tableLines.length >= 2 &&
        /^\|.*\|$/.test(tableLines[0]) &&
        /^\|[\s:|-]+\|$/.test(tableLines[1])
      ) {
        const cells = (row: string) => row.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim());
        const head = cells(tableLines[0]);
        const body = tableLines.slice(2).filter((line) => /^\|.*\|$/.test(line)).map(cells);
        return `<table class="md-table"><thead><tr>${head
          .map((cell) => `<th>${cell}</th>`)
          .join("")}</tr></thead><tbody>${body
          .map((cells2) => `<tr>${cells2.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
          .join("")}</tbody></table>`;
      }

      const fence = t.match(/^:::\s*video\s+(\S+)/);
      if (fence) {
        const caption = t.split("\n").slice(1).filter((l) => l !== ":::").join(" ");
        // Show the actual player rather than a black rectangle. The block was
        // escaped above, so the address has to be unescaped before use, and only
        // a known video host is allowed through -- the preview is for the
        // editor, but an href is still an href.
        const raw = fence[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const embed = previewEmbed(raw);
        if (embed) {
          return `<figure class="md-video-frame">${
            /\.(mp4|webm|ogg|mov)(\?|$)/i.test(embed)
              ? `<video src="${embed}" controls preload="none"></video>`
              : `<iframe src="${embed}" allowfullscreen loading="lazy"></iframe>`
          }${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
        }
        return `<div class="md-video">▶ 认不出的视频地址${caption ? ` — ${caption}` : ""}</div>`;
      }
      if (/^###\s+/.test(t)) return `<h3>${t.replace(/^###\s+/, "")}</h3>`;
      if (/^##\s+/.test(t)) return `<h2>${t.replace(/^##\s+/, "")}</h2>`;
      if (/^&gt;\s?/.test(t)) return `<blockquote>${t.replace(/^&gt;\s?/gm, "")}</blockquote>`;
      if (/^---+$/.test(t)) return "<hr>";
      if (/^(-|\*)\s+/m.test(t) && t.split("\n").every((l) => /^(-|\*)\s+/.test(l.trim()))) {
        return `<ul>${t.split("\n").map((l) => `<li>${l.replace(/^\s*(-|\*)\s+/, "")}</li>`).join("")}</ul>`;
      }
      if (t.split("\n").every((l) => /^\d+\.\s+/.test(l.trim()))) {
        return `<ol>${t.split("\n").map((l) => `<li>${l.replace(/^\s*\d+\.\s+/, "")}</li>`).join("")}</ol>`;
      }
      return `<p>${t.replace(/\n/g, "<br>")}</p>`;
    })
    .join("\n")
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>");
}

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(function MarkdownEditor(
  { value, onChange, onPickImage },
  handle
) {
  const [mode, setMode] = useState<Mode>("split");
  const ref = useRef<HTMLTextAreaElement>(null);
  /**
   * Where the caret was the last time the editor touched the textarea.
   *
   * Read back instead of `selectionStart` at insert time because opening the
   * media library unmounts focus and, in some browsers, resets the textarea's
   * selection to 0 -- which would file every picked image above the headline.
   * Null means the body has not been clicked into yet, and an insert then goes
   * to the end rather than silently landing before the first line.
   */
  const caretRef = useRef<{ start: number; end: number } | null>(null);

  const rememberCaret = () => {
    const el = ref.current;
    if (el) caretRef.current = { start: el.selectionStart, end: el.selectionEnd };
  };

  const commit = (next: string, caret: number) => {
    onChange(next);
    caretRef.current = { start: caret, end: caret };
    // The caret is restored after React commits the new value, otherwise it
    // jumps to the end of the textarea on every toolbar click.
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  };

  const run = (kind: "wrap" | "line" | "insert", a: string, b = "") => {
    const el = ref.current;
    if (!el) return;
    // Restore the remembered caret first: a toolbar button that opens a prompt
    // (链接, 视频) blurs the textarea before the handler runs.
    const at = caretRef.current;
    if (at) el.setSelectionRange(at.start, at.end);
    const { next, caret } = apply(el, kind, a, b);
    commit(next, caret);
  };

  useImperativeHandle(handle, () => ({
    insertAtCaret: (text: string) => {
      const el = ref.current;
      const at = caretRef.current;
      if (!el) return;
      if (!at) {
        // Never clicked into: append, which is where it used to go anyway.
        const next = `${value}${value.endsWith("\n") || !value ? "" : "\n"}${text}`;
        commit(next, next.length);
        return;
      }
      const next = value.slice(0, at.start) + text + value.slice(at.end);
      commit(next, at.start + text.length);
    }
  }));

  const stats = useMemo(() => {
    const chars = value.replace(/\s/g, "").length;
    return {
      chars,
      minutes: Math.max(1, Math.round(chars / 350)),
      images: (value.match(/!\[[^\]]*\]\(/g) ?? []).length,
      videos: (value.match(/^:::\s*video/gm) ?? []).length,
      links: (value.match(/(^|[^!])\[[^\]]+\]\(/g) ?? []).length
    };
  }, [value]);

  const Btn = ({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" className="md-tool" title={title} onClick={onClick}>
      {children}
    </button>
  );

  return (
    <div className="md">
      <div className="md-bar">
        <Btn title="二级标题" onClick={() => run("line", "## ")}><b>H2</b></Btn>
        <Btn title="三级标题" onClick={() => run("line", "### ")}><b>H3</b></Btn>
        <span className="md-sep" />
        <Btn title="粗体" onClick={() => run("wrap", "**", "**")}><b>B</b></Btn>
        <Btn title="斜体" onClick={() => run("wrap", "*", "*")}><i>I</i></Btn>
        <Btn title="删除线" onClick={() => run("wrap", "~~", "~~")}><s>S</s></Btn>
        <span className="md-sep" />
        <Btn title="引用" onClick={() => run("line", "> ")}>❝</Btn>
        <Btn title="无序列表" onClick={() => run("line", "- ")}>• 列表</Btn>
        <Btn title="有序列表" onClick={() => run("line", "1. ")}>1. 列表</Btn>
        <span className="md-sep" />
        <Btn
          title="插入链接"
          onClick={() => {
            const href = window.prompt("链接地址", "https://");
            if (href) run("wrap", "[", `](${href})`);
          }}
        >
          🔗 链接
        </Btn>
        <Btn title="从媒体库插入图片" onClick={onPickImage}>🖼 图片</Btn>
        <Btn
          title="粘贴 YouTube / 干净世界 链接"
          onClick={() => {
            const src = window.prompt("视频地址（YouTube / 干净世界 / mp4）", "https://");
            if (src) run("insert", `\n::: video ${src}\n说明文字\n:::\n`);
          }}
        >
          ▶ 视频
        </Btn>
        <Btn
          title="插入表格"
          onClick={() => run("insert", "\n| 列一 | 列二 |\n| --- | --- |\n| 内容 | 内容 |\n")}
        >
          ▦ 表格
        </Btn>
        <span className="md-sep" />
        <Btn title="分隔线" onClick={() => run("insert", "\n\n---\n\n")}>— 分隔线</Btn>
        <span className="md-grow">
          {(["edit", "split", "preview"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              className={`md-tool md-mode${mode === m ? " is-on" : ""}`}
              onClick={() => setMode(m)}
            >
              {m === "edit" ? "编辑" : m === "split" ? "并排" : "预览"}
            </button>
          ))}
        </span>
      </div>

      <div className={`md-body md-body--${mode}`}>
        {mode !== "preview" ? (
          <textarea
            ref={ref}
            spellCheck={false}
            value={value}
            onChange={(event) => {
              onChange(event.target.value);
              rememberCaret();
            }}
            onSelect={rememberCaret}
            onClick={rememberCaret}
            onKeyUp={rememberCaret}
            onFocus={rememberCaret}
            placeholder="正文，Markdown 格式。可直接把图片拖进来。"
          />
        ) : null}
        {mode !== "edit" ? (
          // The source is Markdown the editors themselves write, rendered
          // through the escaping pass above.
          <div className="md-prev" dangerouslySetInnerHTML={{ __html: renderPreview(value) }} />
        ) : null}
      </div>

      <div className="md-foot">
        <span>{stats.chars.toLocaleString()} 字</span>
        <span>约 {stats.minutes} 分钟</span>
        <span>
          图片 {stats.images} · 视频 {stats.videos} · 链接 {stats.links}
        </span>
      </div>
    </div>
  );
});
