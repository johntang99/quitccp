"use client";

import { useState } from "react";

interface ArticleToolsProps {
  /** Anchor id of the reuse-terms panel, so 转载说明 has somewhere to go. */
  reuseAnchor: string;
}

/**
 * The row of actions under an article.
 *
 * These were four `href="#"` links: clicking any of them jumped to the top of
 * the page and did nothing else. Each one now does what its label says, and the
 * one we cannot honour -- 下载 PDF, for which nothing in the codebase generates
 * a PDF -- is not shown rather than shown broken.
 */
export function ArticleTools({ reuseAnchor }: ArticleToolsProps) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // Clipboard access is refused on insecure origins and in some browsers;
      // fall back to the old selection trick rather than failing silently.
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        document.execCommand("copy");
        setCopied(true);
      } catch {
        window.prompt("复制这个地址：", url);
      }
      document.body.removeChild(field);
    }
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <button type="button" className="pill" onClick={copyLink}>
        {copied ? "已复制 ✓" : "复制链接"}
      </button>
      <a className="pill" href={`#${reuseAnchor}`}>
        转载说明
      </a>
      <button type="button" className="pill" onClick={() => window.print()}>
        打印
      </button>
    </>
  );
}
