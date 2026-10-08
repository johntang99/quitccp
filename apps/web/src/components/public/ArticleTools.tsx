"use client";

import { useState } from "react";

/**
 * The row of actions under an article.
 *
 * These were four `href="#"` links: clicking any of them jumped to the top of
 * the page and did nothing else. Each one now does what its label says, and the
 * ones we cannot honour are not shown rather than shown broken -- 下载 PDF,
 * for which nothing in the codebase generates a PDF, and 转载说明, which only
 * scrolled to the 转载条款 panel already visible in the sidebar beside it.
 */
export function ArticleTools() {
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
      <button type="button" className="pill" onClick={() => window.print()}>
        打印
      </button>
    </>
  );
}
