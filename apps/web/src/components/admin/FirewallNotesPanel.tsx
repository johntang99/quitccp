/**
 * 防火墙里那几条放行规则，以及它们怎么坏。
 *
 * ## 为什么只在中文站显示
 *
 * 每个 Vercel 项目的防火墙规则是独立的，这里记的是**中文站那个项目**的三条
 * —— 其中「免翻 reverse proxy」是给墙内读者用的反代，别的站根本没有这条。
 * 把它显示在英文站的后台不是「没翻译」，是给的信息不对。
 *
 * 新开一个站，它有自己的规则，也该有自己的一份说明。
 *
 * ## 为什么是一段说明而不是一项自动检查
 *
 * 见最后一段：探针验不了它。Node 的 fetch 复用连接，不带放行头的请求会骑在
 * 已经放行过的连接上，永远返回正常。
 *
 * 文案保持中文，不进语言包 —— 它只给中文站的运维看。
 */
export function FirewallNotesPanel() {
  return (
      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>防火墙里的放行规则</h3>
        <p className="dash-note">
          这里记的是几条<b>绕过全部防火墙规则</b>的放行规则。它们在 <b>Vercel</b> 的防火墙里，
          不在 Cloudflare —— <code>tuidang.org</code> 在 Cloudflare 上只做 DNS，网站托管在 Vercel。
          （只有 <code>service</code>、<code>santui</code> 那几个子域是 Cloudflare 代理的。）
          找错地方会白费很多时间，这是 2026-10-15 真发生过的事。
        </p>
        <table className="admin-table" style={{ maxWidth: 760 }}>
          <thead>
            <tr><th style={{ width: 210 }}>规则</th><th style={{ width: 230 }}>认什么</th><th>给谁用</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Allow 免翻 reverse proxy v2</td>
              <td>出口 IP <b>并且</b> <code>td-auth</code> 请求头</td>
              <td>Tom 维护的免翻墙反代。墙内读者靠它访问本站</td>
            </tr>
            <tr>
              <td style={{ color: "#B54708" }}>Allow 免翻 reverse proxy（旧）</td>
              <td>只认 <code>td-auth</code> 请求头</td>
              <td><b>待删。</b>只为换密钥期间不断线而保留，Tom 确认新密钥生效后就撤掉</td>
            </tr>
            <tr>
              <td>Bypass for selfcheck probe</td>
              <td><code>x-quitccp-probe</code> 请求头</td>
              <td>上面「站点防护」里那三项需要真实渲染页面的检查</td>
            </tr>
          </tbody>
        </table>
        <p className="dash-note">
          <b>Vercel 的 Bypass 会终止后续全部规则</b> —— 不只是跳过机器人挑战，而是连按 ASN 的封禁、
          按 IP 的 300 次/分限速一起跳过。所以命中放行规则的请求，等于对全站免检。
          反代那条绕不开：一台代理替很多人取页面，一分钟 300 次一下就超，不给它免检墙内就打不开。
        </p>
        <p className="dash-note">
          v2 比旧的那条严得多：<b>两个条件是「并且」</b>，光知道请求头、不是从那个 IP 来的照样被挡。
          实测过 —— 拿着正确的新密钥从别处请求，返回 429。
        </p>
        <p className="dash-alert">
          <b>免翻墙打不开了，先看这里。</b>命令行 <code>npx vercel firewall rules list</code>
          　看那条 <code>Allow 免翻 reverse proxy v2</code> 还在不在、是不是还排在
          「Rate limit per IP」上面。排到下面去就会被 300 次/分那条挡住，表现和被删掉一样。
          <br />
          <b>还有一个新的失效方式：反代换了服务器、出口 IP 变了，这条规则就不再匹配。</b>
          表现是墙内打不开，而本站这边一切正常、没有任何报错 —— 对我们来说那只是又一个被挑战的请求。
          遇到这种情况先问 Tom 现在的出口 IP，再用 <code>rules edit</code> 改掉。
        </p>
        <p className="dash-note" style={{ marginBottom: 0 }}>
          为什么这里是一段说明而不是一项自动检查：探针没法可靠地验证它。
          Node 的 fetch 会复用连接，而「站点防护」的其他探针正带着放行头在同一个连接池上跑，
          所以一个不带头的请求也会骑在已经放行过的连接上，永远返回正常 —— 测不出规则是不是被删了。
          同样的原因，原来那项「防火墙挑战」探针也已经撤掉了。
        </p>
      </section>
  );
}
