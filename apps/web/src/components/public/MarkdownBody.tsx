import type { ReactNode } from "react";
import { ArticleVideo } from "@/components/public/ArticleVideo";
import type { ArticleBodyRow } from "@/lib/public-content";
import { ArticleAudio } from "@/components/public/ArticleAudio";

/**
 * Inline markdown inside one block: links, bold, emphasis.
 *
 * The converter used to flatten `[text](url)` to its label and drop the address,
 * losing every one of the 2,456 links the migration had carefully preserved in
 * the body text.
 */
export function renderInline(text: string): ReactNode[] {
  const pattern = /\[([^\]]+)]\(([^)\s]+)[^)]*\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const at = match.index ?? 0;
    if (at > last) nodes.push(text.slice(last, at));
    if (match[1]) {
      const href = match[2];
      const external = /^https?:\/\//i.test(href) && !href.includes("tuidang.org");
      nodes.push(
        <a
          key={`${at}-a`}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {match[1]}
        </a>
      );
    } else if (match[3]) {
      nodes.push(<strong key={`${at}-b`}>{match[3]}</strong>);
    } else if (match[4]) {
      nodes.push(<em key={`${at}-i`}>{match[4]}</em>);
    }
    last = at + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes.length > 0 ? nodes : [text];
}

/**
 * Renders the block rows of a markdown body: prose, subheadings, quotes,
 * photographs, embedded video and tables.
 *
 * Shared with the article template rather than reimplemented, because the video
 * pages had their own renderer that emitted every block as a bare paragraph.
 * Body photographs, links and bold runs printed as literal markdown source --
 * `![caption](https://…jpg)` as a line of text where the photograph should be.
 */
export function MarkdownBody({ rows }: { rows: ArticleBodyRow[] }) {
  return (
    <>
      {rows.map((row, index) => {
        if (row.type === "table") {
          if (row.head.length === 0 && row.rows.length === 0) return null;
          // Wrapped, because a wide table must scroll rather than push the
          // article's column sideways on a phone.
          return (
            <div key={`table-${index}`} style={{ overflowX: "auto", margin: "26px 0" }}>
              <table className="prose-table">
                {row.head.length > 0 ? (
                  <thead>
                    <tr>
                      {row.head.map((cell, cellIndex) => (
                        <th key={cellIndex}>{cell}</th>
                      ))}
                    </tr>
                  </thead>
                ) : null}
                <tbody>
                  {row.rows.map((cells, rowIndex) => (
                    <tr key={rowIndex}>
                      {cells.map((cell, cellIndex) => (
                        <td key={cellIndex}>{renderInline(cell)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (row.type === "video") {
          if (!row.src) return null;
          return <ArticleVideo key={`video-${index}`} src={row.src} caption={row.caption} />;
        }

        if (row.type === "figure") {
          if (!row.src) return null;
          return (
            <figure key={`figure-${index}`}>
              <img src={row.src} alt={row.alt} style={{ width: "100%", height: "auto", display: "block" }} />
              {row.alt ? <figcaption>{row.alt}</figcaption> : null}
            </figure>
          );
        }

        if (row.type === "audio") {
          if (!row.src) return null;
          return <ArticleAudio key={`audio-${index}`} src={row.src} label={row.label} />;
        }

        if (!row.text) return null;
        const inline = renderInline(row.text);
        if (row.type === "h2") return <h2 key={`h2-${index}`}>{inline}</h2>;
        if (row.type === "h3") return <h3 key={`h3-${index}`}>{inline}</h3>;
        if (row.type === "blockquote") return <blockquote key={`q-${index}`}>{inline}</blockquote>;
        return <p key={`p-${index}`}>{inline}</p>;
      })}
    </>
  );
}
