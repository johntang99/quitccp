import type { ReactNode } from "react";
import Link from "next/link";
import type { Route } from "next";
import { formatNumber } from "@/lib/format";
import { SITE_LOCALE } from "@/lib/site-config";
import { t } from "@/lib/i18n";

/**
 * 访问统计页的小部件。和访问日志页一样用行内条形，不引图表库：每行一个数，
 * 读的只是长短。
 */

const num = (n: number) => formatNumber(n);

function Bar({ value, max, color = "#157347" }: { value: number; max: number; color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        display: "inline-block",
        height: 8,
        borderRadius: 4,
        background: color,
        opacity: 0.75,
        width: `${Math.max(2, (value / Math.max(1, max)) * 140)}px`
      }}
    />
  );
}

export type RankRow = { key: string; label: ReactNode; views: number; visitors?: number };

/** 排行表：名称、条形 + 浏览量、可选访客数、占比。 */
export function RankTable({ rows, head, total, showVisitors = true }: { rows: RankRow[]; head: string; total?: number; showVisitors?: boolean }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  const sum = total ?? rows.reduce((s, r) => s + r.views, 0);
  if (rows.length === 0) return <p className="dash-note">{t("admin.traffic.empty")}</p>;
  return (
    <table className="admin-table" style={{ fontVariantNumeric: "tabular-nums" }}>
      <thead>
        <tr>
          <th>{head}</th>
          <th style={{ width: 220 }}>{t("admin.traffic.col.views")}</th>
          {showVisitors ? <th style={{ width: 90 }}>{t("admin.traffic.col.visitors")}</th> : null}
          <th style={{ width: 70 }}>{t("admin.traffic.col.share")}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key} data-snapshot="data">
            <td style={{ wordBreak: "break-all" }}>{row.label}</td>
            <td>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Bar value={row.views} max={max} />
                {num(row.views)}
              </span>
            </td>
            {showVisitors ? <td>{row.visitors === undefined ? "—" : num(row.visitors)}</td> : null}
            <td>{sum > 0 ? `${((row.views / sum) * 100).toFixed(1)}%` : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** 每日柱状图：一根柱子一天，悬停看数字。 */
export function DailyColumns({ rows }: { rows: { day: string; views: number; visitors: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.views));
  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140, borderBottom: "1px solid #d0d5dd" }}>
        {rows.map((row) => (
          <div
            key={row.day}
            title={`${row.day}  ${t("admin.traffic.col.views")} ${num(row.views)} · ${t("admin.traffic.col.visitors")} ${num(row.visitors)}`}
            style={{ flex: 1, minWidth: 3, background: "#157347", opacity: 0.75, height: `${Math.max(1, (row.views / max) * 100)}%`, borderRadius: "2px 2px 0 0" }}
          />
        ))}
      </div>
      {rows.length > 0 ? (
        <div className="dash-note" style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span>{rows[0].day}</span>
          <span>{t("admin.traffic.peak", { n: num(max) })}</span>
          <span>{rows[rows.length - 1].day}</span>
        </div>
      ) : null}
    </div>
  );
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames([SITE_LOCALE === "zh" ? "zh-Hans" : SITE_LOCALE], { type: "region" });
  } catch {
    return null;
  }
})();

/** 「US」→「美国」。XX 是 Cloudflare 认不出国家的请求（多为 Tor 或卫星网络）。 */
export function countryName(code: string) {
  if (!code || code === "XX" || code === "T1") return t("admin.traffic.country.unknown");
  try {
    return regionNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** 「US|New York|Brooklyn」→「Brooklyn，New York，美国」。 */
export function placeName(value: string) {
  const [country, ...rest] = value.split("|");
  return [...rest.reverse().filter(Boolean), countryName(country)].join(SITE_LOCALE === "zh" ? "，" : ", ");
}

export function sourceTypeName(type: string) {
  return t(`admin.traffic.source.${type}`);
}

export function deviceName(device: string) {
  return t(`admin.traffic.device.${device}`);
}

const LANG_NAMES = (() => {
  try {
    return new Intl.DisplayNames([SITE_LOCALE === "zh" ? "zh-Hans" : SITE_LOCALE], { type: "language" });
  } catch {
    return null;
  }
})();

export function langName(lang: string) {
  if (!lang || lang === "unknown") return t("admin.traffic.country.unknown");
  try {
    return `${LANG_NAMES?.of(lang) ?? lang}（${lang}）`;
  } catch {
    return lang;
  }
}

/** 7 / 30 / 90 天切换。 */
export function RangeSwitch({ days, base }: { days: number; base: string }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {[7, 30, 90].map((d) => (
        <Link
          key={d}
          href={`${base}?days=${d}` as Route}
          className={d === days ? "admin-btn admin-btn-sm admin-btn-primary" : "admin-btn admin-btn-sm"}
          aria-current={d === days ? "page" : undefined}
        >
          {t("admin.traffic.range", { n: d })}
        </Link>
      ))}
    </div>
  );
}

export function parseDays(value: string | string[] | undefined) {
  const d = Number(Array.isArray(value) ? value[0] : value);
  return [7, 30, 90].includes(d) ? d : 30;
}
