import { Fragment } from "react";

/**
 * Keeps a 书名号 title on one line.
 *
 * Chinese has no spaces, so a browser may break anywhere between two Han
 * characters — including the middle of a work's title, which is how
 * 《民族团结法》 ended up split across two lines in the homepage headline.
 * Text between 《 and 》 is unambiguously one name, so it is safe to protect
 * automatically; no editorial judgement is needed.
 */
export function NoWrapTitles({ text }: { text: string }) {
  if (!text.includes("《")) return <>{text}</>;
  // Split on whole 《…》 groups, keeping them as captured parts.
  const parts = text.split(/(《[^》]*》)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("《") && part.endsWith("》") ? (
          <span key={i} style={{ whiteSpace: "nowrap" }}>
            {part}
          </span>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        )
      )}
    </>
  );
}
