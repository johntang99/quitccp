"use client";
import { siteHtmlLang } from "@/lib/format";

/**
 * The last word when a page cannot be rendered at all.
 *
 * `app/error.tsx` covers a render that fails inside the layout; this one covers
 * the rest, including a static page that fails while being generated on demand
 * -- the case that matters here, because that is what a reader hits when the
 * database is unreachable and no cached copy of their page exists yet.
 *
 * It carries its own <html> and <body>: at this point the root layout is gone,
 * so nothing else will supply them, and the site's stylesheet is not loaded
 * either. Hence the inline styles -- not a shortcut, the only thing that works.
 */
export default function GlobalError() {
  return (
    <html lang={siteHtmlLang}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          background: "#1d1640",
          color: "#efeaff",
          font: "16px/1.8 system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
        }}
      >
        <main style={{ maxWidth: 560 }}>
          <h1 style={{ font: "600 26px/1.5 system-ui, sans-serif", margin: "0 0 20px" }}>
            我们暂时无法加载这个页面
          </h1>
          <p style={{ margin: "0 0 16px" }}>
            本站近期持续遭受大规模网络攻击。我们正在处理，内容没有丢失。
          </p>
          <p style={{ margin: "0 0 10px", color: "#bdb3e8" }}>请稍后重试，或访问我们的其它站点：</p>
          <ul style={{ margin: "0 0 28px", paddingInlineStart: "1.3em", color: "#bdb3e8" }}>
            <li>
              声明三退{" "}
              <a href="https://santui.tuidang.org" style={{ color: "#f0c674" }}>
                santui.tuidang.org
              </a>
            </li>
            <li>
              查询退党证明{" "}
              <a href="https://service.tuidang.org/cert-verify/" style={{ color: "#f0c674" }}>
                service.tuidang.org
              </a>
            </li>
          </ul>
          <a
            href="/"
            style={{
              display: "inline-block",
              padding: "11px 22px",
              borderRadius: 999,
              background: "#f0c674",
              color: "#1d1640",
              fontWeight: 600,
              textDecoration: "none"
            }}
          >
            重新载入首页
          </a>
        </main>
      </body>
    </html>
  );
}
