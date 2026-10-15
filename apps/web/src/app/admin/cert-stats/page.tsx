import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdminSessionUser } from "@/lib/admin/auth";
import { can } from "@/lib/admin/permissions";

/**
 * 退党证书月度统计 — a link out, not an embed, and that is the whole point of
 * this file.
 *
 * ## Why it is not an iframe
 *
 * It used to be. The snippet that went round was
 *
 *     <iframe src="https://service.tuidang.org/certificate-monthly-stastics?key=…&access=open">
 *
 * and it stopped working. Nobody changed it; browsers changed around it.
 *
 * The page is password-protected in WordPress. The `key=` parameter makes a
 * plugin submit that password on the visitor's behalf, which sets a
 * `wp-postpass_*` cookie, and then redirects to the address without the key --
 * so every later request is authorised by the cookie alone. Inside an iframe
 * on another domain that cookie is a third-party cookie: Safari has blocked
 * those for years, Firefox partitions them, Chrome is phasing them out. So
 * WordPress sees an unauthenticated visitor and renders its password form
 * instead of the chart.
 *
 * Measured 2026-10-15, in a real browser, framing the full URL *including* the
 * key: the frame loads and shows 「This content is password protected」. Adding
 * the same snippet to this admin would reproduce exactly that.
 *
 * A second obstacle sits behind the first: service.tuidang.org answers every
 * non-browser request with Cloudflare's 「Just a moment...」 challenge, and that
 * challenge page carries `x-frame-options: SAMEORIGIN` -- so for any admin
 * without a clearance cookie the frame would be blank even if the password
 * were gone.
 *
 * Opening it in a tab has neither problem: a first-party navigation clears the
 * challenge the way any human visit does, and the password cookie is
 * first-party.
 *
 * ## What should replace this
 *
 * The chart is drawn from a clean endpoint that needs no nonce:
 *
 *     POST https://service.tuidang.org/wp-admin/admin-ajax.php
 *     action=get_monthly_stats&from=2025-10&to=2026-10
 *     -> { success: true, data: { labels: [...], data: [...] } }
 *
 * Calling that from our own server and drawing the chart here would end the
 * whole class of problem -- no frame, no cookies, nothing third-party. The one
 * thing in the way is the Cloudflare challenge on service.tuidang.org: it
 * needs an Allow rule for a secret header, the same shape as the one this
 * project's own self-check probes use. Until that exists, this page is a door,
 * not a window.
 */
export const dynamic = "force-dynamic";

export default async function AdminCertStatsPage() {
  const user = await requireAdminSessionUser();
  if (!can(user, "declarations.read")) {
    return (
      <AdminShell user={user}>
        <section className="admin-card">
          <h2 style={{ marginTop: 0 }}>退党证书统计</h2>
          <p className="dash-note">这个页面需要三退声明的查看权限。</p>
        </section>
      </AdminShell>
    );
  }

  const url = process.env.CERT_STATS_URL?.trim() ?? "";

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>退党证书统计</h2>
        <p className="dash-note">
          按月统计的退党证明办理量，由 service.tuidang.org 提供 —— 证书业务还在那边，不在本站数据库里。
        </p>

        {url ? (
          <>
            <p style={{ margin: "18px 0" }}>
              <a className="admin-btn" href={url} target="_blank" rel="noopener noreferrer">
                打开证书统计 ↗
              </a>
            </p>
            <p className="dash-note">
              会在新标签页打开。页面上可以选起止月份，点 Apply 重新取数。
            </p>
          </>
        ) : (
          <p className="dash-alert">
            <b>还没有配置统计页地址。</b>在 Vercel 的环境变量里加上 <code>CERT_STATS_URL</code>，
            值是带 <code>key=</code> 的完整网址。
          </p>
        )}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>为什么是链接，不是嵌在这一页里</h3>
        <p className="dash-note">
          以前传的是一段 <code>&lt;iframe&gt;</code>，后来不工作了。<b>不是谁改坏了什么，是浏览器的规则变了。</b>
        </p>
        <p className="dash-note">
          那个统计页在 WordPress 里是密码保护的。网址里的 <code>key=</code> 会让插件替访客提交密码、
          种一个 <code>wp-postpass</code> cookie，之后靠这个 cookie 认人。放进 iframe 之后，
          这个 cookie 就成了<b>第三方 cookie</b> —— Safari 早就全面拦截，Firefox 做隔离，Chrome 也在淘汰。
          于是 WordPress 认不出访客，iframe 里显示的是「This content is password protected」而不是图表。
          2026-10-15 用真实浏览器实测过：<b>带着 key 的完整网址，在跨域 iframe 里照样是密码框。</b>
        </p>
        <p className="dash-note">
          后面还有第二道坎：service.tuidang.org 对所有非浏览器请求都回 Cloudflare 的「Just a moment...」
          挑战页，而那个挑战页带 <code>x-frame-options: SAMEORIGIN</code> —— 就算密码保护去掉了，
          对没有通行 cookie 的人来说 iframe 还是白的。
        </p>
        <p className="dash-note">
          新标签页打开则两个问题都没有：首次访问是第一方导航，挑战页像对任何真人一样放行，
          密码 cookie 也是第一方的。
        </p>
        <h4 style={{ margin: "18px 0 6px", fontSize: 14 }}>要彻底解决的话</h4>
        <p className="dash-note" style={{ marginTop: 0 }}>
          图表的数据来自一个不需要 nonce 的接口：
          <code>POST /wp-admin/admin-ajax.php</code>，参数 <code>action=get_monthly_stats&amp;from=&amp;to=</code>。
          只要我们自己的服务器能调到它，就可以在这一页直接画图 —— 没有 iframe、没有 cookie、
          没有任何第三方的东西。唯一挡路的是 service.tuidang.org 上的 Cloudflare 挑战，
          需要在那边加一条「带某个密钥请求头就放行」的规则，形状和本站自检探针用的那条完全一样。
          在那之前，这一页是一扇门，不是一扇窗。
        </p>
      </section>
    </AdminShell>
  );
}
