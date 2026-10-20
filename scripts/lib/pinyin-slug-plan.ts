/**
 * 全站地址改拼音 —— 这份计划是怎么算出来的。
 *
 * 预演脚本和实跑脚本共用这一个文件，不是各写一份。验过的是 A、跑的是 B，
 * 是这类迁移最容易犯也最致命的错：报告上一切正常，库里改出另一个样子。
 *
 * 整份计划是纯函数：同样的输入永远得到同样的输出，和查询顺序、和跑第几遍
 * 都无关。已经发出去的地址不能因为重跑一次就变。
 */

import { slugifyTitle } from "../../apps/web/src/lib/admin/slugify";

export type Kind = "article" | "video";

export type Row = {
  id: string;
  title: string;
  slug: string;
  published_at: string | null;
  kind: Kind;
};

export type Change = Row & {
  next: string;
  /** 撞名时加的序号，没撞就是 0 */
  bump: number;
  /** 是否动用了「保住标题末尾」 */
  tailed: boolean;
};

export type Plan = {
  changes: Change[];
  /** 标题拼不出任何字母数字的，保持原样，单列出来 */
  skipped: Row[];
};

export const PATH_PREFIX: Record<Kind, string> = {
  article: "/news/",
  video: "/videos/"
};

export const TABLE: Record<Kind, string> = {
  article: "cms_articles",
  video: "cms_videos"
};

/** 公开地址。库里存的是没编码的 slug，跳转表里存的也是 —— 两边要一致。 */
export function publicPath(kind: Kind, slug: string): string {
  return `${PATH_PREFIX[kind]}${slug}`;
}

/**
 * 从所有内容算出完整计划。
 *
 * 必须拿全量来算，哪怕这一趟只打算改 20 条：地址的唯一性是对着全站判的，
 * 只拿 20 条算出来的答案，等下一批跑的时候就不作数了。
 */
export function buildPlan(rows: Row[]): Plan {
  /* 先按一个稳定的顺序排，整份计划才和数据库返回的顺序无关。 */
  const sorted = [...rows].sort((a, b) => {
    const ta = a.published_at ?? "";
    const tb = b.published_at ?? "";
    if (ta !== tb) return ta < tb ? -1 : 1;
    return a.id < b.id ? -1 : 1;
  });

  const base = (row: Row) => slugifyTitle(row.title, { withDate: true, date: row.published_at });

  /*
   * 第一遍：先看默认地址有没有重的。重了的那些，整组都改用「保住标题末尾」，
   * 谁也不占那个笼统的地址 —— 否则就是「谁先来谁拿干净地址」，而先来后到
   * 取决于查询顺序。
   */
  const crowded = new Map<string, number>();
  for (const row of sorted) {
    const s = base(row);
    if (!s) continue;
    const key = `${row.kind}:${s}`;
    crowded.set(key, (crowded.get(key) ?? 0) + 1);
  }

  const taken: Record<Kind, Set<string>> = { article: new Set(), video: new Set() };
  const changes: Change[] = [];
  const skipped: Row[] = [];

  for (const row of sorted) {
    const plain = base(row);
    if (!plain) {
      /* 标题里没有一个能转成拼音的字（纯泰文、纯符号）。绝不自动给一个
         随便的地址 —— 保持原样，交给人看。 */
      skipped.push(row);
      continue;
    }

    let next = plain;
    let tailed = false;
    if ((crowded.get(`${row.kind}:${plain}`) ?? 0) > 1) {
      const withTail = slugifyTitle(row.title, {
        withDate: true,
        date: row.published_at,
        keepTail: true
      });
      if (withTail) {
        next = withTail;
        tailed = true;
      }
    }

    const stem = next;
    let bump = 0;
    while (taken[row.kind].has(next)) {
      bump += 1;
      next = `${stem}-${bump + 1}`; // 第二条是 -2，第三条是 -3
    }
    taken[row.kind].add(next);
    changes.push({ ...row, next, bump, tailed });
  }

  return { changes, skipped };
}

/** 读全站内容。两张表的列名一样，所以一个查询形状够用。 */
export async function fetchRows(client: { query: (sql: string) => Promise<{ rows: unknown[] }> }): Promise<Row[]> {
  const rows: Row[] = [];
  for (const kind of ["article", "video"] as const) {
    const r = await client.query(
      `select id::text, title, slug, published_at from ${TABLE[kind]}`
    );
    for (const row of r.rows as Omit<Row, "kind">[]) rows.push({ ...row, kind });
  }
  return rows;
}
