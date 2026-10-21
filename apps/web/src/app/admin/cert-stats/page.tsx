import { AdminShell } from "@/components/admin/AdminShell";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";
import { requireAdminSessionUser } from "@/lib/admin/auth";

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
  /* Signing in is the only gate. The owner's decision, 2026-10-15: monthly
     certificate counts are the organisation's own headline number, not
     privileged information, so every role that can reach the admin sees them.
     See the note beside this entry in permission-matrix.ts. */
  const user = await requireAdminSessionUser();
  const url = process.env.CERT_STATS_URL?.trim() ?? "";

  return (
    <AdminShell user={user}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>{t("admin.cert.title")}</h2>
        <p className="dash-note">
          {t("admin.cert.intro")}
        </p>

        {url ? (
          <>
            <p style={{ margin: "18px 0" }}>
              <a className="admin-btn" href={url} target="_blank" rel="noopener noreferrer">
                {t("admin.cert.open")}
              </a>
            </p>
            <p className="dash-note">
              {t("admin.cert.openNote")}
            </p>
          </>
        ) : (
          <p className="dash-alert">
            <b>{t("admin.cert.unconfigured")}</b>
            {tRich("admin.cert.unconfiguredBody", {
              env: <code>CERT_STATS_URL</code>,
              key: <code>key=</code>
            })}
          </p>
        )}
      </section>

      <section className="admin-card">
        <h3 style={{ marginTop: 0 }}>{t("admin.cert.whyLinkTitle")}</h3>
        <p className="dash-note">
          {tRich("admin.cert.why1", {
            iframe: <code>&lt;iframe&gt;</code>,
            notBroken: <b>{t("admin.cert.why1NotBroken")}</b>
          })}
        </p>
        <p className="dash-note">
          {tRich("admin.cert.why2", {
            key: <code>key=</code>,
            cookie: <code>wp-postpass</code>,
            thirdParty: <b>{t("admin.cert.why2ThirdParty")}</b>,
            measured: <b>{t("admin.cert.why2Measured")}</b>
          })}
        </p>
        <p className="dash-note">
          {tRich("admin.cert.why3", { header: <code>x-frame-options: SAMEORIGIN</code> })}
        </p>
        <p className="dash-note">
          {t("admin.cert.why4")}
        </p>
        <h4 style={{ margin: "18px 0 6px", fontSize: 14 }}>{t("admin.cert.fixTitle")}</h4>
        <p className="dash-note" style={{ marginTop: 0 }}>
          {tRich("admin.cert.fixBody", {
            endpoint: <code>POST /wp-admin/admin-ajax.php</code>,
            params: <code>action=get_monthly_stats&amp;from=&amp;to=</code>
          })}
        </p>
      </section>
    </AdminShell>
  );
}
