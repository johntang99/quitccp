import type { ReactNode } from "react";
import { t } from "./index";

/**
 * 句子里嵌着标签的文案。
 *
 * 后台有很多这样的句子：「还没认到 <code>/api/cron/selfcheck</code>。」
 * 「它回答的是<b>什么时候开始的</b>」。把整句搬进语言包时，如果把标签那段
 * 换成普通字符串，渲染出来的字一样，但等宽体和加粗没了 —— 文案快照比的是
 * 文字，抓不到这种退步。
 *
 * 所以文案里仍然只写占位符，由这里把占位符换成真的节点：
 *
 *   tRich("admin.dash.defense.neverBody", { path: <code>/api/cron/selfcheck</code> })
 *
 * 字符串值照旧（它们先走 t() 的替换），节点值才在这里拼。这样译者看到的是
 * 一句完整的话，而不是三段碎片 —— 碎片换成别的语言就拼不回一个句子。
 */
export function tRich(
  key: string,
  vars: Record<string, ReactNode>
): ReactNode[] {
  const plain: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(vars)) {
    if (typeof value === "string" || typeof value === "number") plain[name] = value;
  }
  const raw = t(key, plain);

  const out: ReactNode[] = [];
  const pattern = /\{(\w+)\}/g;
  let last = 0;
  for (let m = pattern.exec(raw); m; m = pattern.exec(raw)) {
    if (m.index > last) out.push(raw.slice(last, m.index));
    const node = vars[m[1]];
    /* 认不出的占位符原样留着，和 t() 一样 —— 吞掉它只会让人找不到哪里漏了。 */
    out.push(node === undefined ? m[0] : node);
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push(raw.slice(last));
  return out.map((part, i) => <span key={i}>{part}</span>);
}
