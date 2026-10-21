/**
 * 后台到底能不能用 —— 走一遍编辑每天要做的动作。
 *
 * ## 为什么已有的检查不够
 *
 * verify-site 看的是「页面返回 200 吗」，admin:snapshot 看的是「文字没被改掉
 * 吗」，admin:rendered 看的是「英文站还剩多少中文」。三个都不碰写入：一个
 * 保存按钮昨天还好、今天因为一条约束变了而 500，这三个检查全是绿的。
 *
 * 所以这里真的去建、去改、去删：
 *
 *     npm run admin:flows             # 本地中文站 :4020
 *     npm run admin:flows -- --en     # 本地英文站 :4021
 *
 * ## 这个脚本会往真库里写东西
 *
 * 本地开发连的就是生产那个 Supabase。所以：
 *
 *   - 建出来的东西一律是草稿，标题和 slug 带 ZZTEST- 前缀，跑完就删
 *   - 删除放在 finally 里，中途失败也会清；清不掉会大声报出来，并把 id 打出来
 *   - 不碰主题、站点设置、立即发布 —— 那三样生产正在读，改了会影响线上
 *
 * 留下来的东西都能一眼认出来：在后台搜 ZZTEST 就能找到。
 */

const EN = process.argv.includes("--en");
const BASE = process.env.ADMIN_FLOWS_BASE ?? (EN ? "http://localhost:4021" : "http://localhost:4020");
/** 另一个站，用来验跨语言隔离；两个都在才做那一组。 */
const OTHER = EN ? "http://localhost:4020" : "http://localhost:4021";

const PROBE = process.env.PROBE_BYPASS_SECRET?.trim();
const REMOTE = !/^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const probeHeaders: Record<string, string> = PROBE && REMOTE ? { "x-quitccp-probe": PROBE } : {};

/** 标记：跑完没删掉的东西，靠它在后台认出来。 */
const MARK = `ZZTEST-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}`;

let passed = 0;
const failures: string[] = [];
/** 建出来的东西，连同怎么删它。倒序执行。 */
const trash: { what: string; remove: () => Promise<void> }[] = [];

function ok(name: string, detail = "") {
  passed += 1;
  console.log(`  ✓ ${name}${detail ? `　${detail}` : ""}`);
}
function bad(name: string, detail: string) {
  failures.push(`${name} —— ${detail}`);
  console.log(`  ✗ ${name}　${detail}`);
}
async function check(name: string, fn: () => Promise<string | void>) {
  try {
    const detail = await fn();
    ok(name, detail || "");
  } catch (error) {
    bad(name, error instanceof Error ? error.message : String(error));
  }
}
function expect(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

/* ── 会话 ───────────────────────────────────────────────────────────── */

class Session {
  private jar: string[] = [];
  constructor(readonly base: string) {}

  private take(res: Response) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const pair = c.split(";")[0];
      const name = pair.split("=")[0];
      const i = this.jar.findIndex((x) => x.startsWith(`${name}=`));
      if (i >= 0) this.jar[i] = pair;
      else this.jar.push(pair);
    }
  }

  get cookie() {
    return this.jar.join("; ");
  }

  async get(path: string, init: RequestInit = {}) {
    const res = await fetch(this.base + path, {
      ...init,
      headers: { cookie: this.cookie, ...probeHeaders, ...(init.headers as object) },
      redirect: "manual"
    });
    this.take(res);
    return res;
  }

  /** 后台的写接口都收 form，而且要 accept: json 才会把失败原因讲清楚。 */
  async post(path: string, fields: Record<string, string>) {
    const res = await fetch(this.base + path, {
      method: "POST",
      body: new URLSearchParams(fields),
      headers: {
        cookie: this.cookie,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
        ...probeHeaders
      },
      redirect: "manual"
    });
    this.take(res);
    return res;
  }

  async json(path: string) {
    const res = await this.get(path, { headers: { accept: "application/json" } });
    expect(res.status === 200, `${path} → ${res.status}`);
    return res.json();
  }

  async login(email: string, password: string) {
    await this.get("/admin/login");
    const res = await this.post("/api/admin/auth/login", { email, password });
    return res;
  }
}

/* ── 各组检查 ───────────────────────────────────────────────────────── */

async function groupAuth(email: string, password: string) {
  console.log("\n【登录与会话】");

  await check("未登录打开后台会被挡下", async () => {
    const anon = new Session(BASE);
    const res = await anon.get("/admin/articles");
    expect(res.status === 307 || res.status === 302 || res.status === 303, `返回 ${res.status}，没跳转`);
    const to = res.headers.get("location") ?? "";
    expect(to.includes("/admin/login"), `跳去了 ${to}`);
    return `→ ${res.status} ${to.replace(BASE, "")}`;
  });

  await check("密码错了不给会话", async () => {
    const wrong = new Session(BASE);
    await wrong.get("/admin/login");
    await wrong.post("/api/admin/auth/login", { email, password: `${password}-wrong` });
    const res = await wrong.get("/admin/dashboard");
    expect(res.status !== 200, "拿错密码也进去了");
    return `总览 → ${res.status}`;
  });

  const session = new Session(BASE);
  await check("正确的密码能登录", async () => {
    const res = await session.login(email, password);
    expect(res.status === 303 || res.status === 302, `登录返回 ${res.status}`);
    expect(session.cookie.length > 0, "没拿到会话 cookie");
  });

  await check("登录后能打开总览", async () => {
    const res = await session.get("/admin/dashboard");
    expect(res.status === 200, `总览 → ${res.status}`);
  });

  return session;
}

async function groupPermissions(s: Session) {
  console.log("\n【权限边界】");

  await check("能打开用户管理", async () => {
    const res = await s.get("/admin/users");
    expect(res.status === 200, `→ ${res.status}`);
  });

  await check("能打开审计日志", async () => {
    const res = await s.get("/admin/audit");
    expect(res.status === 200, `→ ${res.status}`);
  });

  /*
   * 这一条是权限矩阵里最要紧的一格：一个能发超级管理员的管理员，等于多绕
   * 几步的超级管理员。接口必须自己拦，不能只靠前端不显示那个选项。
   */
  /*
   * 这个接口拒绝的方式是「303 跳回表单，地址里带 ?error=」，不是 403 JSON ——
   * 因为它要服务一个没有 JavaScript 也能用的表单。所以光看状态码判断不了成败：
   * 成功也是 303。真正的判据是「那个账号有没有被建出来」。
   */
  const ghost = `${MARK.toLowerCase()}@example.invalid`;
  await check("管理员不能发超级管理员", async () => {
    const res = await s.post("/api/admin/users", {
      intent: "create",
      email: ghost,
      name: MARK,
      role: "super_admin",
      password: "a-very-long-throwaway-password"
    });
    expect(res.status === 303 || res.status === 403, `返回 ${res.status}`);

    /* 这个接口只有 POST（GET 是 405），所以从用户管理那一页上看它在不在。 */
    const page = await s.get("/admin/users");
    expect(page.status === 200, `用户管理页 → ${page.status}`);
    const html = await page.text();
    expect(!html.includes(ghost), "拒绝失败：这个账号真的被建出来了");

    const reason = new URL(res.headers.get("location") ?? "http://x/", BASE).searchParams.get("error");
    expect(reason, "被拒了，但没把原因带回表单 —— 编辑会看到一个没有说明的空页");
    return `拒了，且说明了原因：「${reason}」`;
  });
}

async function groupArticle(s: Session) {
  console.log("\n【文章：建 → 读 → 改 → 修订 → 还原 → 删】");

  /*
   * 分类得是库里真有的那几个 slug。接口会校验，填错直接拒 ——
   * 这是对的（填错了就把文章存成没有分类，比拒掉糟得多），但也意味着
   * 这个脚本不能瞎编一个分类名。
   */
  let category = "";
  await check("取得文章分类清单", async () => {
    const data = await s.json("/api/admin/content/categories");
    const rows: { slug: string; name: string }[] = data.rows ?? [];
    expect(rows.length > 0, "一个分类都没有");
    /* 保存接口认的是名字，不是 slug（视频那个接口也一样）。 */
    category = rows[0].name;
    return `${rows.length} 个，用「${category}」`;
  });
  if (!category) return;

  const slug = `${MARK.toLowerCase()}-article`;
  const title = `${MARK} 冒烟测试文章`;
  let id = "";

  await check("新建草稿", async () => {
    const res = await s.post("/api/admin/content/articles", {
      title,
      slug,
      section: "news",
      category,
      status: "draft",
      bodyMarkdown: "这是一条自动测试建出来的草稿，跑完就会删掉。"
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status === 200, `返回 ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
    id = body.id ?? body.articleId ?? "";
    expect(id, `没拿到 id：${JSON.stringify(body).slice(0, 160)}`);
    trash.push({
      what: `文章 ${title}（id ${id}）`,
      remove: async () => {
        await s.post("/api/admin/content/articles/delete", { id });
      }
    });
    return `id ${id.slice(0, 8)}…`;
  });

  if (!id) return;

  await check("列表里查得到", async () => {
    const data = await s.json(`/api/admin/content/articles?q=${encodeURIComponent(MARK)}&pageSize=20`);
    const rows: { id: string; title: string }[] = data.rows ?? data.items ?? [];
    expect(rows.some((r) => r.id === id), `搜 ${MARK} 没搜到刚建的那条（回了 ${rows.length} 条）`);
  });

  await check("草稿在公开站是 404", async () => {
    const res = await fetch(`${BASE}/news/${slug}`, { headers: probeHeaders, redirect: "manual" });
    expect(res.status === 404, `公开站返回 ${res.status} —— 草稿不该能被外面看到`);
    return "→ 404";
  });

  const newTitle = `${MARK} 改过的标题`;
  await check("改标题", async () => {
    const res = await s.post("/api/admin/content/articles", {
      id,
      title: newTitle,
      slug,
      section: "news",
      category,
      status: "draft",
      bodyMarkdown: "改过一次，为的是看修订历史有没有记下来。"
    });
    expect(res.status === 200, `返回 ${res.status}`);
  });

  let revisionId = "";
  await check("修订历史记下了这次改动", async () => {
    const data = await s.json("/api/admin/revisions?entityType=article");
    const rows: { id: string; entityId?: string; entity_id?: string }[] = data.rows ?? [];
    const mine = rows.filter((r) => (r.entityId ?? r.entity_id) === id);
    expect(mine.length > 0, `修订表里没有这篇的记录（共 ${rows.length} 条）`);
    revisionId = mine[0].id;
    return `${mine.length} 条`;
  });

  if (revisionId) {
    await check("还原到上一版", async () => {
      const res = await s.post("/api/admin/revisions/restore", { revisionId });
      expect(res.status === 200 || res.status === 303, `返回 ${res.status}`);
    });
  }

  await check("删除", async () => {
    const res = await s.post("/api/admin/content/articles/delete", { id });
    expect(res.status === 200 || res.status === 303, `返回 ${res.status}`);
    const data = await s.json(`/api/admin/content/articles?q=${encodeURIComponent(MARK)}&pageSize=20`);
    const rows: { id: string }[] = data.rows ?? data.items ?? [];
    expect(!rows.some((r) => r.id === id), "删完还在列表里");
    /* 已经删掉了，别在 finally 里再删一次。 */
    const i = trash.findIndex((t) => t.what.includes(id));
    if (i >= 0) trash.splice(i, 1);
  });
}

async function groupCategory(s: Session) {
  console.log("\n【分类：建 → 改名 → 删】");

  const catSlug = `${MARK.toLowerCase()}-cat`;
  let id = "";

  /*
   * 这个接口不回 JSON，成功失败都是 303 —— 所以 id 要回头从列表里按 slug 认。
   * 第一版脚本等它回 id，没等到就不往垃圾桶里登记，于是真建出来的那条分类
   * 没被清掉，留在了库里。认领这一步同时也是「真的建成了吗」的判据。
   */
  await check("新建分类", async () => {
    const res = await s.post("/api/admin/content/categories", {
      name: `${MARK} 测试分类`,
      slug: catSlug,
      sortOrder: "999"
    });
    expect(res.status === 303 || res.status === 200, `返回 ${res.status}`);

    const data = await s.json("/api/admin/content/categories");
    const rows: { id: string; slug: string }[] = data.rows ?? [];
    const mine = rows.find((r) => r.slug === catSlug);
    expect(mine, "接口没报错，但列表里没有这条分类");
    id = mine!.id;
    trash.push({
      what: `分类 ${catSlug}（id ${id}）`,
      remove: async () => {
        await s.post("/api/admin/content/categories/delete", { id });
      }
    });
    return `id ${id.slice(0, 8)}…`;
  });

  if (!id) return;

  const renamed = `${MARK} 改过的分类`;
  await check("改名", async () => {
    const res = await s.post("/api/admin/content/categories", {
      id,
      name: renamed,
      slug: catSlug,
      sortOrder: "999"
    });
    expect(res.status === 303 || res.status === 200, `返回 ${res.status}`);
    const data = await s.json("/api/admin/content/categories");
    const rows: { id: string; name: string }[] = data.rows ?? [];
    const mine = rows.find((r) => r.id === id);
    expect(mine?.name === renamed, `改完列表里还是「${mine?.name}」`);
  });

  await check("删除", async () => {
    const res = await s.post("/api/admin/content/categories/delete", { id });
    expect(res.status === 200 || res.status === 303, `返回 ${res.status}`);
    const data = await s.json("/api/admin/content/categories");
    const rows: { id: string }[] = data.rows ?? [];
    expect(!rows.some((r) => r.id === id), "删完还在列表里");
    const i = trash.findIndex((t) => t.what.includes(id));
    if (i >= 0) trash.splice(i, 1);
  });
}

async function groupVideo(s: Session) {
  console.log("\n【视频：建 → 删】");

  /* 分类必须是现有的，否则接口会拒 —— 先问它有哪些。 */
  let category = "";
  await check("取得视频分类清单", async () => {
    const res = await s.get("/admin/videos/new");
    expect(res.status === 200, `新建页 → ${res.status}`);
    const html = await res.text();
    const m = [...html.matchAll(/<option value="([^"]+)"/g)].map((x) => x[1]).filter((v) => v && v !== "");
    category = m[0] ?? "";
    expect(category, "新建页上一个分类选项都没有");
    return `用「${category}」`;
  });

  if (!category) return;

  let id = "";
  const slug = `${MARK.toLowerCase()}-video`;
  await check("新建草稿", async () => {
    const res = await s.post("/api/admin/content/videos/save", {
      title: `${MARK} 冒烟测试视频`,
      slug,
      category,
      status: "draft",
      sourceUrl: "https://www.ganjingworld.com/video/zztest"
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status === 200, `返回 ${res.status} ${JSON.stringify(body).slice(0, 200)}`);
    id = body.id ?? "";
    if (id) {
      trash.push({
        what: `视频 ${MARK}（id ${id}）`,
        remove: async () => {
          await s.post("/api/admin/content/videos/delete", { id });
        }
      });
    }
    return id ? `id ${id.slice(0, 8)}…` : "（接口没回 id）";
  });

  if (!id) return;

  await check("删除", async () => {
    const res = await s.post("/api/admin/content/videos/delete", { id });
    expect(res.status === 200 || res.status === 303, `返回 ${res.status}`);
    const i = trash.findIndex((t) => t.what.includes(id));
    if (i >= 0) trash.splice(i, 1);
  });
}

async function groupReadOnly(s: Session) {
  console.log("\n【只读的几页与接口】");

  const pages: [string, string][] = [
    ["总览", "/admin/dashboard"],
    ["页面内容", "/admin/content"],
    ["图片视频库", "/admin/media"],
    ["影片拼接台", "/admin/video-studio"],
    ["证书统计", "/admin/cert-stats"],
    ["三退声明", "/admin/declarations"],
    ["修订历史", "/admin/revisions"],
    ["访问日志", "/admin/logs"],
    ["主题与排版", "/admin/theme"],
    ["站点设置", "/admin/settings"],
    ["我的账号", "/admin/account"],
    ["编辑手册", "/admin/users/guide"]
  ];
  for (const [name, path] of pages) {
    await check(name, async () => {
      const res = await s.get(path);
      expect(res.status === 200, `→ ${res.status}`);
    });
  }

  await check("媒体库列表接口", async () => {
    const data = await s.json("/api/admin/media/list");
    const rows = data.rows ?? data.items ?? data.files ?? [];
    expect(Array.isArray(rows), `回的不是列表：${JSON.stringify(data).slice(0, 120)}`);
    return `${rows.length} 项`;
  });
}

/* ── 跨语言隔离 ─────────────────────────────────────────────────────── */

async function groupCrossLocale(s: Session, email: string, password: string) {
  console.log("\n【跨语言隔离】");

  const probe = await fetch(`${OTHER}/admin/login`, { redirect: "manual" }).catch(() => null);
  if (!probe) {
    console.log(`    － 另一个站（${OTHER}）没开，这一组跳过`);
    return;
  }

  const other = new Session(OTHER);
  await check(`登录另一个站（${OTHER.replace("http://localhost:", ":")}）`, async () => {
    const res = await other.login(email, password);
    expect(res.status === 303 || res.status === 302, `登录返回 ${res.status}`);
  });

  /*
   * 要有分类才能建文章。英文站现在一个分类都没有（locale='en' 的行数是 0），
   * 那不是这个脚本的毛病，是「英文站还没有内容」这件待办本身 —— 所以要说清楚
   * 是哪一种，别让它看起来像个失败。
   */
  let category = "";
  const cats = await s.json("/api/admin/content/categories").catch(() => ({ rows: [] }));
  const catRows: { slug: string; name: string }[] = cats.rows ?? [];
  if (catRows.length === 0) {
    console.log(`    － 这个站（${BASE.replace("http://localhost:", ":")}）还没有任何文章分类，建不出文章，这一组跳过`);
    console.log("      这正是待办里的那条：英文站的 locale='en' 一行内容都没有。");
    return;
  }
  category = catRows[0].name;

  const slug = `${MARK.toLowerCase()}-cross`;
  const title = `${MARK} 跨语言测试`;
  let id = "";

  await check(`在本站（${BASE.replace("http://localhost:", ":")}）建一篇草稿`, async () => {
    const res = await s.post("/api/admin/content/articles", {
      title,
      slug,
      section: "news",
      category,
      status: "draft",
      /* 故意把 locale 填成另一个站 —— 接口应该不听，用自己部署的那个。 */
      locale: EN ? "zh" : "en",
      bodyMarkdown: "验跨语言隔离用的草稿。"
    });
    const body = await res.json().catch(() => ({}));
    expect(res.status === 200, `返回 ${res.status} ${JSON.stringify(body).slice(0, 160)}`);
    id = body.id ?? "";
    expect(id, "没拿到 id");
    trash.push({
      what: `跨语言测试文章（id ${id}）`,
      remove: async () => {
        await s.post("/api/admin/content/articles/delete", { id });
      }
    });
  });

  if (!id) return;

  await check("本站列表里有它", async () => {
    const data = await s.json(`/api/admin/content/articles?q=${encodeURIComponent(MARK)}&pageSize=20`);
    const rows: { id: string }[] = data.rows ?? data.items ?? [];
    expect(rows.some((r) => r.id === id), "自己站上反而找不到");
  });

  /*
   * 这一条是整个多语言方案的地基：请求体里填了另一个站的 locale，接口也必须
   * 按部署来存。不然英文站的编辑新建一篇文章，会出现在中文站的栏目页上，而
   * 在自己站上找不到 —— 而且不报错。
   */
  await check("另一个站的列表里没有它（请求体里的 locale 被忽略）", async () => {
    const data = await other.json(`/api/admin/content/articles?q=${encodeURIComponent(MARK)}&pageSize=20`);
    const rows: { id: string }[] = data.rows ?? data.items ?? [];
    expect(!rows.some((r) => r.id === id), "串台了：另一个站也看得见这条");
    return `对面回了 ${rows.length} 条`;
  });

  await check("删掉", async () => {
    const res = await s.post("/api/admin/content/articles/delete", { id });
    expect(res.status === 200 || res.status === 303, `返回 ${res.status}`);
    const i = trash.findIndex((t) => t.what.includes(id));
    if (i >= 0) trash.splice(i, 1);
  });
}

/* ── 收尾 ───────────────────────────────────────────────────────────── */

async function takeOutTrash() {
  if (trash.length === 0) return;
  console.log(`\n【清理】还剩 ${trash.length} 样要删`);
  for (const item of [...trash].reverse()) {
    try {
      await item.remove();
      console.log(`  ✓ 删掉 ${item.what}`);
    } catch (error) {
      console.log(`  ✗ 没删掉 ${item.what} —— ${error instanceof Error ? error.message : error}`);
      failures.push(`清理失败：${item.what}`);
    }
  }
}

async function main() {
  const email = process.env.VERIFY_ADMIN_EMAIL;
  const password = process.env.VERIFY_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("需要 VERIFY_ADMIN_EMAIL / VERIFY_ADMIN_PASSWORD");

  console.log(`\n========== 走一遍后台 ${BASE} ==========`);
  console.log(`标记：${MARK}　（跑完没删掉的东西，在后台搜这个就能找到）`);

  const session = await groupAuth(email, password);
  try {
    await groupPermissions(session);
    await groupArticle(session);
    await groupCategory(session);
    await groupVideo(session);
    await groupReadOnly(session);
    await groupCrossLocale(session, email, password);
  } finally {
    await takeOutTrash();
  }

  console.log(`\n  ${passed} 项通过，${failures.length} 项没过`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`    ✗ ${f}`);
    process.exit(1);
  }
  console.log("\n✓ 全部通过。\n");
}

main().catch(async (error) => {
  await takeOutTrash();
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
