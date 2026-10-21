"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { tRich } from "@/lib/i18n/rich";

/**
 * 「删掉会牵连什么」—— 删除对话框里的那一段。
 *
 * 为什么要有它：2026-10-16 编辑把「铁证如山」32 集改成视频重新发布，再删掉重复的
 * 文章版。判断是对的，内容确实搬了。但有 32 条旧 WP 链接指着那些文章，删完全部
 * 变成 308 跳 404，断了四天。编辑当时是唯一知道「内容搬去了视频区」的人，缺的只是
 * 一句提示。
 *
 * 对话框一打开就查，不等第二次点击：要让人看见的东西不能藏在多一次点击后面。查询
 * 约 600 毫秒，所以先写「正在检查」而不是留白 —— 留白会被当成「没有牵连」。
 *
 * 颜色只在真有死链时变橙。拼音迁移给每一篇都留了一条自己旧地址的跳转，所以「有
 * 旧链接指向这一篇」对一万六千篇都成立；要是这种情况也亮橙色，这块面板一周之内
 * 就会变成没人看的东西。
 *
 * 查不出来时说「查不到」，并且不挡着删除。一个因为自己坏了就不让人干活的提示，
 * 下一次就会被绕过去。
 */
export function DeleteImpact({ kind, id }: { kind: "article" | "video"; id: string }) {
  const [state, setState] = useState<"loading" | "done" | "failed">("loading");
  const [data, setData] = useState<{
    redirects: number;
    external: number;
    hasOwnOld: boolean;
    redirectSample: string[];
    inbound: { kind: string; id: string; label: string }[];
    inboundTotal: number;
  } | null>(null);

  useEffect(() => {
    const abort = new AbortController();
    (async () => {
      try {
        const response = await fetch(
          `/api/admin/content/impact?kind=${kind}&id=${encodeURIComponent(id)}`,
          { signal: abort.signal }
        );
        const body = await response.json();
        if (!response.ok || !body.ok) throw new Error(body.error ?? String(response.status));
        setData(body);
        setState("done");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        setState("failed");
      }
    })();
    return () => abort.abort();
  }, [kind, id]);

  const box: React.CSSProperties = {
    margin: "0 0 14px",
    padding: "9px 11px",
    borderRadius: 5,
    fontSize: 13,
    lineHeight: 1.65
  };
  const quiet = { ...box, background: "#f4f5f8", color: "#8a90a0" };

  if (state === "loading") return <p style={quiet}>{t("admin.impact.checking")}</p>;
  if (state === "failed" || !data) {
    return <p style={quiet}>{t("admin.impact.failed")}</p>;
  }

  const { external, hasOwnOld, redirectSample, inbound, inboundTotal } = data;
  const thing = t(kind === "video" ? "admin.impact.thing.video" : "admin.impact.thing.article");

  if (external === 0 && inboundTotal === 0) {
    return (
      <p style={{ ...box, background: "#eef7f0", color: "#2f6b42" }}>
        {t("admin.impact.clear")}
        {hasOwnOld ? t("admin.impact.onlyOwnOld") : ""}
      </p>
    );
  }

  /* 站内有内容链接过来，才是真的会留下死链 —— 只有这一种情况变橙。 */
  const serious = inboundTotal > 0;
  const tone = serious
    ? { background: "#fdf3e7", color: "#7a4a16", hint: "#9a6a36" }
    : { background: "#f4f5f8", color: "#5a6072", hint: "#8a90a0" };

  return (
    <div style={{ ...box, background: tone.background, color: tone.color }}>
      <b>{t(serious ? "admin.impact.serious" : "admin.impact.confirmFirst")}</b>

      {external > 0 ? (
        <p style={{ margin: "6px 0 0" }}>
          {tRich("admin.impact.external", { n: <b>{external}</b>, thing })}
          {redirectSample.length > 0 ? (
            <span style={{ color: tone.hint }}>
              {t("admin.impact.externalSample", {
                list: redirectSample.slice(0, 2).join(t("admin.listSep")),
                more: external > 2 ? t("admin.impact.externalMore") : ""
              })}
            </span>
          ) : null}
          <br />
          <span style={{ color: tone.hint }}>{t("admin.impact.externalHint")}</span>
        </p>
      ) : null}

      {inboundTotal > 0 ? (
        <p style={{ margin: "6px 0 0" }}>
          {tRich("admin.impact.inbound", { n: <b>{inboundTotal}</b>, thing })}
          <br />
          {inbound.map((row) => {
            /* 每一条直接链到它自己的编辑页。牵连的往往不是文章 —— 问答在
               /admin/faq，视频在 /admin/videos，写死一个入口就是指错地方。 */
            const href = EDIT_PATH[row.kind]?.(row.id);
            const name = `${KIND_NAME[row.kind] ?? row.kind}${t("admin.art.delete.name", { title: row.label })}`;
            return (
              <span key={`${row.kind}-${row.id}`} style={{ color: tone.hint }}>
                {href ? (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: tone.color }}>
                    {name} ↗
                  </a>
                ) : (
                  name
                )}
                <br />
              </span>
            );
          })}
          {inboundTotal > inbound.length ? (
            <span style={{ color: tone.hint }}>
              {t("admin.impact.inboundMore", { n: inboundTotal - inbound.length })}
              <br />
            </span>
          ) : null}
          <span style={{ color: tone.hint }}>{t("admin.impact.inboundHint")}</span>
        </p>
      ) : null}
    </div>
  );
}

const KIND_NAME: Record<string, string> = {
  article: t("admin.kind.article"),
  video: t("admin.kind.video"),
  faq: t("admin.kind.faq"),
  page: t("admin.kind.page")
};

/* 页面内容没有按 id 的编辑页，落到列表页；其余三类都能直接点进去。 */
const EDIT_PATH: Record<string, (id: string) => string> = {
  article: (id) => `/admin/articles/${id}`,
  video: (id) => `/admin/videos/${id}`,
  faq: (id) => `/admin/faq/${id}`,
  page: () => "/admin/content"
};
