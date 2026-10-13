/**
 * The page Next serves when it cannot render one at all.
 *
 * Next falls back to the Pages Router's built-in 500 when a statically
 * generated route fails while being generated on demand -- neither
 * `app/error.tsx` nor `app/global-error.tsx` is reached, which was measured
 * rather than assumed. That case is exactly the one that matters here: the
 * database is unreachable and this reader's page has no cached copy yet, which
 * is every page in the minutes after a deploy.
 *
 * So this file exists to replace 「500: Internal Server Error」 with something
 * that tells a reader what is happening and where else to go. It is the only
 * file outside `app/`, and only because this is the one thing the App Router
 * cannot answer.
 *
 * Styles are inline: at this point no stylesheet of ours has loaded.
 */
export default function ServerError() {
  return (
    <main
      style={{
        margin: 0,
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 32,
        background: "#1d1640",
        color: "#efeaff",
        font: "16px/1.8 system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif"
      }}
    >
      <div style={{ maxWidth: 560 }}>
        <h1 style={{ font: "600 26px/1.5 system-ui, sans-serif", margin: "0 0 20px" }}>
          我们暂时无法加载这个页面
        </h1>
        <p style={{ margin: "0 0 16px" }}>本站近期持续遭受大规模网络攻击。我们正在处理，内容没有丢失。</p>
        <p style={{ margin: "0 0 10px", color: "#bdb3e8" }}>请稍后重试，或访问我们的其它站点：</p>
        <ul style={{ margin: "0 0 28px", paddingInlineStart: "1.3em", color: "#bdb3e8" }}>
          <li>
            声明三退 <a href="https://santui.tuidang.org" style={{ color: "#f0c674" }}>santui.tuidang.org</a>
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
      </div>
    </main>
  );
}
