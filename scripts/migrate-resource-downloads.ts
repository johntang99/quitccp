/**
 * 把「资料下载」这个文章分类拆掉：下载资料进资料管理，专栏文章留在 /news。
 *
 *     npm run migrate:downloads                 # 预演，一个字都不写
 *     npm run migrate:downloads -- --apply
 *
 * ## 这个分类里其实混了两种东西
 *
 * 编辑反映 /news 里有个「资料下载」栏目不该在那儿，应该归到资料管理。查了
 * 那 69 篇，发现它们不是一种东西：
 *
 *   2024–2026 年的 31 篇是真正的下载资料 —— 展板、传单、易拉宝、广播录音、
 *   期刊，正文基本只有图和一个「點擊這裡下載PDF版本」。这些确实属于资料管理。
 *
 *   2021–2022 年的 38 篇是《真相园地》专栏文章 —— 2000 到 6500 字的正文，
 *   配图在文中，一个附件都没有。其中第 64 篇就叫「写在《真相园地》前面的话」，
 *   是这一套的序，里面写着「本栏目主要内容是全面系统讲述法轮功真相」。
 *
 * 把后面这 38 篇塞进资料管理，读者点进资料详情页会看到「暂无可下载文件」，
 * 编辑在资料列表里会看到 38 条没有文件的「资料」。那不是归类，是把文章伪装
 * 成资料。所以这里分两路走：下载资料进资料管理，专栏文章换一个文章分类。
 *
 * ## 已有的 27 份不能按素材地址去判重
 *
 * 资料管理里已经有 27 份，其中 24 份就是这 31 篇里的同一个东西 —— 但不能靠
 * 比对图片地址认出来：编辑建资料时把同样的文件重新上传了一遍，文章用的是
 * media/articles/<hash>.jpg，资料用的是 media/materials/<slug>/1.jpg，同一张
 * 图在库里有两份、地址完全不同。按地址比，24 份全都「没有重合」，会重复建。
 *
 * 更早的一版判重还踩过一个更隐蔽的坑：拿 URL 的文件名当指纹，而 Google Drive
 * 的分享链接全部以 /view 结尾，于是所有 Drive 链接的指纹都是 "view"，五篇
 * 毫不相干的文章互相「命中」。指纹要取 Drive 的文件 ID，不是文件名。
 *
 * 所以判重最后是人工核对出来的：逐篇把文章的图/附件和资料的 files 摆在一起
 * 数，确认是同一份，结果写成下面这张表。表是死的、可审的 —— 比一条猜得不
 * 准的规则可靠。
 *
 * ## 有 6 份资料比文章少了附件
 *
 * 核对时发现的：资料「真相展板 —— 自焚偽案」只有 4 张高清图，而文章末尾那个
 * 「下載PDF版本請點擊這裡」的 PDF 没进去；「景點資料——易拉寶」少了 2 个 PDF；
 * 「三款真相展板」少了 3 个 Dropbox 链接；两份《真相资料》系列的资料只有一个
 * zip，而文章里是「阅读版」和「打印版」两个 PDF；「于朦胧之死」的录音链接在
 * 正文里而不在 files 里，详情页的下载区是空的。
 *
 * 这些文章一删，那些 PDF 就只剩存储里的孤儿文件，站上没有任何入口。所以删
 * 之前先把缺的附件补进对应资料。
 *
 * ## 旧网址
 *
 * 这 69 篇每篇都有 2 条旧 WordPress 网址的重定向指进来（共 136 条）。要删的
 * 31 篇如果直接删，那 136 个旧地址会变成「301 跳过去、再 404」—— 比直接 404
 * 更糟，搜索引擎会一直留着旧地址。所以把那些重定向改指到新的资料页，并给
 * /news/<slug> 和 /resources/<slug> 两个正规地址也各加一条。
 *
 * 留下的 38 篇不用管：文章页按 slug 取，和分类无关，换分类不改网址。
 */

import pg from "pg";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(file: string) {
  try {
    for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      if (process.env[key] !== undefined) continue;
      process.env[key] = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* 可选文件。 */
  }
}

/** 留下来的 38 篇专栏文章的新家。序言里的栏目名就叫《真相园地》。 */
const COLUMN_CATEGORY = {
  slug: "zhenxiang-yuandi",
  name: "真相园地",
  description: "全面系统讲述法轮功真相，揭穿中共制造的种种谎言。2022 年的专栏文章。",
  /*
   * 先不进 /news 的栏目栏 —— 和「破除党文化」「制止活摘器官」「传统文化文章」
   * 一样是专题归档。要不要露出来是编辑的决定，后台一个开关的事。
   */
  is_news_listing: false,
  sort_order: 820
};

/**
 * 31 篇下载资料的归属，逐篇人工核对出来的。
 *
 *   skip   —— 资料管理里已有同一份，文章删掉即可
 *   enrich —— 资料管理里已有，但缺了文章里的附件，补进去
 *   create —— 资料管理里没有，新建
 */
type Plan =
  | { action: "skip"; article: string; material: string }
  | { action: "enrich"; article: string; material: string; labels?: Record<string, string> }
  | { action: "create"; article: string; material: string; title?: string; category: string; labels?: Record<string, string> };

/**
 * 附件标签为什么要手写一份。
 *
 * 标签默认取正文里的链接文字，大多数时候那就是最贴切的说法（「历史重演惊人醒
 * （打印版）」）。但旧站有几处的链接文字根本不能当按钮用：
 *
 *   三款真相展板的三个 Dropbox 链接，正文里全写作「下载链接」—— 照搬的结果
 *   是详情页上三个一模一样的按钮，读者不知道哪个对应哪块展板。
 *
 *   景點易拉寶的第一个 PDF，正文里的链接文字只有一个「退」字 —— 旧站那行本
 *   身就是坏的。
 *
 *   「點擊這裡」「下载地址」这类纯按钮文字，脱离上下文就没有意义。
 *
 * 下面按地址里的一段特征字串指定标签。自动认不出好标签时，宁可手写几条，也
 * 不要让站上出现一排分不清的按钮。
 */

const PLAN: Plan[] = [
  { action: "skip",   article: "2026-10-08-gei-gong-zhi-dan-wei-peng-you-de-yi-feng-xin", material: "letter-gongzhi" },
  { action: "skip",   article: "2026-10-08-zhi-yi-xiang-qiu-xue-de-ni-liu-xue-sheng-pian", material: "student-overseas" },
  { action: "skip",   article: "2026-09-02-tui-guang-jiu-ping-xi-lie-zhan-ban", material: "tuiguang-jiuping-xilie-zhanban" },
  { action: "skip",   article: "2026-08-29-shou-gang-nue-sha-can-an-xiao-shi-zai-gang-shui-zhi-xia-de-361-ge-sheng-ming", material: "shougang-nuesha-canan" },
  { action: "skip",   article: "2026-08-28-zhong-qiu-ji-yu", material: "letter-moon-festival" },
  { action: "skip",   article: "2026-08-28-yi-feng-zai-qiu-liang-shi-fen-xie-gei-hua-ren-peng-you-de-xin", material: "letter-autumn" },
  { action: "skip",   article: "2026-08-25-tui-dang-zheng-ming-yi-la-bao", material: "tuidang-zhengming-yilabao" },
  { action: "enrich", article: "2026-07-26-zhen-xiang-zhan-ban-zi-fen-wei-an", material: "zhenxiang-zhanban-zifen-weian" },
  /* 「更新版」是 7 月的新一版，PDF 和 6 月那封不是同一个文件 —— 标题相近但内容不同，两份都留。 */
  { action: "create", article: "2026-07-08-gei-hai-wai-hua-ren-peng-you-de-yi-feng-xin-geng-xin-ban", material: "gei-haiwai-huaren-pengyou-gengxinban", category: "leaflets",
    labels: { "letter_HR_For-Print.pdf": "下载PDF版本" } },
  { action: "skip",   article: "2026-06-17-zhen-xiang-zhan-ban-quan-ni-san-tui-pan-ni-ping-an", material: "zhenxiang-zhanban-quan-ni-santui" },
  { action: "skip",   article: "2026-06-15-gei-hai-wai-hua-ren-can-guan-lao-ban-de-yi-feng-xin", material: "gei-haiwai-huaren-canguan-laoban" },
  { action: "skip",   article: "2026-06-15-gei-hai-wai-hua-ren-peng-you-de-yi-feng-xin", material: "gei-haiwai-huaren-pengyou" },
  { action: "skip",   article: "2026-06-03-tui-dang-zheng-ming-guan-wu-san-tui-ni-ke-yi-fang-xin", material: "tuidang-zhengming-fangxin" },
  { action: "enrich", article: "2026-06-03-san-kuan-zhen-xiang-zhan-ban-tui-dang-zheng-shu", material: "sankuan-zhenxiang-zhanban-tuidang-zhengshu",
    labels: { "HP_A2_1.pdf": "展板一 高清 PDF", "HP_A2_2.pdf": "展板二 高清 PDF", "HP_A2_3.pdf": "展板三 高清 PDF" } },
  { action: "skip",   article: "2026-06-03-tui-dang-zheng-ming-chuan-dan-zheng-jian-ti", material: "tuidang-zhengming-chuandan" },
  /*
   * 2026-05 和 2025-01 两篇同标题，正文详略不同，但「可下载的东西」是同一个
   * Drive 文件（1_Op4Iyo3QWMhkw7a1dCcSFWSpbkhkAd6），资料管理里那份用的也是
   * 它。作为资料它们是一份，不是两份，所以两篇都删。
   */
  { action: "skip",   article: "2026-05-10-zhen-xiang-chuan-dan-zhi-zheng-zhong-gong-huo-zhai-qi-guan-shou-wei-xing-cun", material: "zhenxiang-chuandan-huozhai-qiguan" },
  { action: "skip",   article: "2025-01-01-zhen-xiang-chuan-dan-zhi-zheng-zhong-gong-huo-zhai-qi-guan-shou-wei-xing-cun", material: "zhenxiang-chuandan-huozhai-qiguan" },
  { action: "skip",   article: "2026-05-02-zhen-xiang-chuan-dan-dao-you-peng-you-yuan-nin-yi-shan-dang-san-zai", material: "zhenxiang-chuandan-daoyou" },
  { action: "enrich", article: "2026-04-30-jing-dian-zhen-xiang-guang-bo-yu-meng-long-zhi-si-jiu-ju-huo-zhai-yu-san-tui", material: "2026-04-30-jing-dian-zhen-xiang-guang-bo-yu-meng-long-zhi-si-jiu-ju-huo-zhai-yu-san-tui",
    labels: { "1NTKUONbM": "广播录音下载" } },
  { action: "create", article: "2026-04-30-jing-dian-yong-ji-ben-zhen-xiang-guang-bo", material: "jingdian-jiben-zhenxiang-guangbo", category: "broadcast",
    labels: { "1cb6K1USBfJrFwBXH": "广播录音下载" } },
  { action: "skip",   article: "2026-04-23-zhen-xiang-zhan-ban-2", material: "zhenxiang-zhanban-2" },
  { action: "skip",   article: "2026-04-23-4-25-zhen-xiang-zhan-ban", material: "425-zhenxiang-zhanban" },
  { action: "enrich", article: "2026-04-22-jing-dian-zi-liao-yi-la-bao", material: "jingdian-ziliao-yilabao",
    labels: { "Quit-CCP.pdf": "易拉宝——退党证明", "False-Fire.pdf": "易拉宝——自焚真相" } },
  { action: "skip",   article: "2026-04-20-zhen-xiang-zhan-ban", material: "zhenxiang-zhanban" },
  { action: "enrich", article: "2024-12-12-zhen-xiang-zi-liao-li-shi-chong-yan-jing-ren-xing", material: "lishi-chongyan-jingrenxing" },
  /* 标题跟着已有的两份兄弟资料走：《历史重演惊人醒》《选择与救赎》，不带「真相资料：」前缀。 */
  { action: "create", article: "2024-12-12-zhen-xiang-zi-liao-hui-yan-shi-zheng-xie", material: "huiyan-shi-zhengxie", title: "《慧眼识正邪》", category: "leaflets" },
  { action: "enrich", article: "2024-12-12-zhen-xiang-zi-liao-xuan-ze-yu-jiu-shu", material: "xuanze-yu-jiushu" },
  { action: "create", article: "2024-12-12-zhen-xiang-zi-liao-quan-qiu-hua-ren-de-zui-gao-rong-yao", material: "quanqiu-huaren-zuigao-rongyao", title: "《全球华人的最高荣耀》", category: "leaflets" },
  /* 广播稿：正文就是播出去的那段话，音频是附件。 */
  { action: "create", article: "2022-03-13-bie-zai-dang-xiao-fen-hong-le", material: "bie-zai-dang-xiaofenhong", category: "broadcast",
    labels: { "audio-4da4e78e49.mp3": "广播录音下载" } },
  { action: "create", article: "2021-05-17-san-tui-qi-kan-er", material: "santui-qikan-2", category: "leaflets",
    labels: { "file-77nij3.docx": "第二期 Word 版", "file-u0pxab.pdf": "第二期 PDF 版" } },
  { action: "create", article: "2021-04-09-san-tui-qi-kan-yi", material: "santui-qikan-1", category: "leaflets",
    labels: { "file-1slg6r.pdf": "第一期 PDF 版", "file-1jm9i5b.docx": "第一期 Word 版" } }
];

const IMG = /!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const LINK = /\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g;
const FILEISH = /\.(pdf|docx?|zip|mp3|m4a|rar|pptx?|xlsx?)(\?|$)/i;
const SHARE = /drive\.google\.com|dropbox\.com/i;

/** 和后台表单 kindOf() 同一套规则，免得手工建的和界面建的长得不一样。 */
function kindOf(url: string): string {
  const m = url.trim().match(/\.([a-z0-9]{2,5})(?:\?|$)/i);
  if (!m) return "";
  const ext = m[1].toUpperCase();
  return ext === "JPEG" ? "JPG" : ext;
}

interface MaterialFile { url: string; kind: string; label: string }

/**
 * 从文章正文里把「可下载的东西」拆出来：图片按 高清图片 N 排，附件用正文里
 * 原来的链接文字当标签。
 *
 * 「下载」这种纯按钮文字不作标签 —— 旧站的写法是 [标题](x.pdf)[下载](x.pdf)，
 * 同一个地址连着出现两次，第二个只是个按钮。照搬会得到一个叫「下载」的附件，
 * 和前面那个指向同一个文件。
 */
function relabel(files: MaterialFile[], labels?: Record<string, string>): MaterialFile[] {
  if (!labels) return files;
  const used = new Set<string>();
  const out = files.map((f) => {
    const hit = Object.keys(labels).find((k) => f.url.includes(k));
    if (!hit) return f;
    used.add(hit);
    return { ...f, label: labels[hit] };
  });
  /* 写了却没对上任何地址的标签，多半是地址改过了 —— 别静静地按旧标签放过去。 */
  const stale = Object.keys(labels).filter((k) => !used.has(k));
  if (stale.length > 0) throw new Error(`标签对不上地址：${stale.join("、")}`);
  return out;
}

function filesFromBody(body: string): MaterialFile[] {
  const out: MaterialFile[] = [];
  const seen = new Set<string>();
  let n = 0;
  for (const m of body.matchAll(IMG)) {
    if (seen.has(m[1])) continue;
    seen.add(m[1]);
    n += 1;
    out.push({ url: m[1], kind: kindOf(m[1]), label: `高清图片 ${n}` });
  }
  for (const m of body.matchAll(LINK)) {
    const [, text, url] = m;
    if (!FILEISH.test(url) && !SHARE.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const label = text.replace(/\s+/g, " ").trim();
    const bare = /^(下载|下載|點擊這裡|点击这里|链接|鏈接)$/.test(label) || /^https?:\/\//.test(label);
    out.push({ url, kind: kindOf(url), label: bare ? "下载" : label });
  }
  return out;
}

/** 正文里把已经变成附件的图片和下载链接去掉，留下说明文字。 */
function bodyWithoutFiles(body: string): string {
  return body
    .replace(IMG, "")
    .replace(LINK, (whole, text: string, url: string) =>
      FILEISH.test(url) || SHARE.test(url) ? "" : whole)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));
  const apply = process.argv.includes("--apply");
  const actor = "migrate-resource-downloads";

  const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  console.log(`\n===== 拆「资料下载」分类${apply ? "" : "（预演）"} =====\n`);

  const { rows: cat } = await c.query(
    `select id from cms_article_categories where locale='zh' and slug='resource-downloads'`);
  if (cat.length === 0) throw new Error("找不到 resource-downloads 分类 —— 可能已经跑过了");
  const catId = String(cat[0].id);

  const { rows: arts } = await c.query(
    `select a.* from cms_articles a join cms_article_category_map m on m.article_id=a.id
     where m.category_id=$1 and a.locale='zh' order by a.published_at desc nulls last`, [catId]);
  console.log(`  分类下 ${arts.length} 篇`);

  const bySlug = new Map(arts.map((a: any) => [String(a.slug), a]));
  const planned = new Set(PLAN.map((p) => p.article));

  /* 表和库对不上就停 —— 中间有人加过文章、或者 slug 变了，继续跑会漏掉东西。 */
  const missing = PLAN.filter((p) => !bySlug.has(p.article));
  const unplanned = arts.filter((a: any) => !planned.has(String(a.slug)));
  if (missing.length > 0) {
    console.log(`\n  ✗ 表里有 ${missing.length} 篇在库里找不到：`);
    for (const p of missing) console.log(`      ${p.article}`);
    throw new Error("计划表和库对不上");
  }
  console.log(`  下载资料 ${PLAN.length} 篇（表里写定），专栏文章 ${unplanned.length} 篇`);
  if (unplanned.length !== arts.length - PLAN.length) throw new Error("数目对不上");

  const { rows: mcats } = await c.query(
    `select id, slug, name from cms_material_categories where locale='zh'`);
  const mcatId = new Map(mcats.map((m: any) => [String(m.slug), String(m.id)]));

  const { rows: mats } = await c.query(
    `select id, slug, title, files from cms_materials where locale='zh'`);
  const matBySlug = new Map(mats.map((m: any) => [String(m.slug), m]));

  /* ---------- 算出要做什么 ---------- */

  interface Enrich { material: string; title: string; add: MaterialFile[] }
  interface Create { slug: string; title: string; category: string; row: Record<string, unknown>; files: MaterialFile[] }
  const enrich: Enrich[] = [];
  const create: Create[] = [];
  const skipped: string[] = [];

  for (const p of PLAN) {
    const a = bySlug.get(p.article)!;
    const body = String(a.body_markdown ?? "");

    if (p.action === "skip") {
      const m = matBySlug.get(p.material);
      if (!m) throw new Error(`${p.article}：说是已有资料 ${p.material}，但库里没有`);
      skipped.push(`${a.title}  →  ${m.title}`);
      continue;
    }

    if (p.action === "enrich") {
      const m = matBySlug.get(p.material);
      if (!m) throw new Error(`${p.article}：要补的资料 ${p.material} 不在库里`);
      const have = new Set((Array.isArray(m.files) ? m.files : []).map((f: any) => String(f.url)));
      /* 只补附件，不补图 —— 图编辑已经重新上传过一份了，再加一份是重复。 */
      const add = relabel(filesFromBody(body), p.labels).filter(
        (f) => (FILEISH.test(f.url) || SHARE.test(f.url)) && !have.has(f.url));
      if (add.length > 0) enrich.push({ material: p.material, title: String(m.title), add });
      else skipped.push(`${a.title}  →  ${m.title}（已无缺件）`);
      continue;
    }

    if (matBySlug.has(p.material)) throw new Error(`要新建的 slug 已被占用：${p.material}`);
    const cid = mcatId.get(p.category);
    if (!cid) throw new Error(`找不到资料分类 ${p.category}`);
    const files = relabel(filesFromBody(body), p.labels);
    create.push({
      slug: p.material,
      title: p.title ?? String(a.title),
      category: p.category,
      files,
      row: {
        slug: p.material,
        locale: "zh",
        title: p.title ?? String(a.title),
        summary: String(a.summary ?? "").slice(0, 600),
        body_markdown: bodyWithoutFiles(body),
        cover_image: String(a.hero_image ?? ""),
        cover_image_alt: String(a.hero_image_alt ?? ""),
        files: JSON.stringify(files),
        status: String(a.status ?? "published"),
        featured: false,
        published_at: a.published_at,
        legacy_url: String(a.legacy_url ?? ""),
        legacy_id: a.legacy_id,
        created_by: actor,
        updated_by: actor
      }
    });
  }

  console.log(`\n  ── 已在资料管理里、文章可删 ${skipped.length} 篇 ──`);
  for (const s of skipped) console.log(`     ${s}`);

  console.log(`\n  ── 给 ${enrich.length} 份已有资料补上文章里的附件 ──`);
  for (const e of enrich) {
    console.log(`     ${e.title}  (+${e.add.length})`);
    for (const f of e.add) console.log(`        ${f.kind.padEnd(5)} ${f.label.slice(0, 28).padEnd(30)} ${f.url.slice(-58)}`);
  }

  console.log(`\n  ── 新建 ${create.length} 份资料 ──`);
  for (const x of create) {
    console.log(`     [${x.category}] ${x.title}   (${x.slug})`);
    console.log(`        正文 ${String(x.row.body_markdown).length} 字，封面${x.row.cover_image ? "有" : "无"}，附件 ${x.files.length}`);
    for (const f of x.files) console.log(`        ${f.kind.padEnd(5)} ${f.label.slice(0, 28).padEnd(30)} ${f.url.slice(-58)}`);
  }

  /* ---------- 重定向 ---------- */
  const matCat = new Map<string, string>();
  for (const p of PLAN) {
    if (p.action === "create") matCat.set(p.material, p.category);
  }
  const { rows: existingMap } = await c.query(
    `select m.slug material, c.slug category from cms_materials m
       join cms_material_category_map mm on mm.material_id=m.id
       join cms_material_categories c on c.id=mm.category_id
     where m.locale='zh' order by mm.position`);
  for (const r of existingMap) if (!matCat.has(String(r.material))) matCat.set(String(r.material), String(r.category));

  const redirects: { from: string; to: string }[] = [];
  for (const p of PLAN) {
    const cs = matCat.get(p.material);
    if (!cs) throw new Error(`算不出 ${p.material} 的资料分类，没法定重定向目标`);
    const to = `/resources/downloads/${cs}/${p.material}`;
    redirects.push({ from: `/news/${p.article}`, to }, { from: `/resources/${p.article}`, to });
  }
  const { rows: inbound } = await c.query(
    `select id, legacy_url, destination_url from cms_redirects
     where destination_url = any($1::text[]) and locale='zh'`,
    [PLAN.flatMap((p) => [`/news/${p.article}`, `/resources/${p.article}`])]);
  console.log(`\n  ── 旧网址 ──`);
  console.log(`     新加 ${redirects.length} 条正规地址重定向（/news/<slug> 和 /resources/<slug>）`);
  console.log(`     改指 ${inbound.length} 条已有的旧 WordPress 重定向，免得 301 跳过去再 404`);

  console.log(`\n  ── 留在 /news 的 ${unplanned.length} 篇专栏文章 ──`);
  console.log(`     新分类「${COLUMN_CATEGORY.name}」(${COLUMN_CATEGORY.slug})，${COLUMN_CATEGORY.is_news_listing ? "进" : "不进"}栏目栏`);
  for (const a of unplanned.slice(0, 5)) console.log(`     ${a.title}`);
  console.log(`     …… 共 ${unplanned.length} 篇`);

  console.log(`\n  ── 最后 ──`);
  console.log(`     删掉 ${PLAN.length} 篇已搬成资料的文章，然后删掉「资料下载」分类`);

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    await c.end();
    return;
  }

  /* ---------- 真写 ---------- */

  /* 先把要删的 31 篇整行存一份。删了才发现判错，得有东西可以还原。 */
  const dump = resolve(process.cwd(), "backups", `resource-downloads-${new Date().toISOString().slice(0, 10)}.json`);
  writeFileSync(dump, JSON.stringify(PLAN.map((p) => bySlug.get(p.article)), null, 1), "utf8");
  console.log(`\n  ✓ 要删的 ${PLAN.length} 篇已整行备份到 ${dump}`);

  await c.query("begin");
  try {
    for (const e of enrich) {
      const m = matBySlug.get(e.material)!;
      const next = [...(Array.isArray(m.files) ? m.files : []), ...e.add];
      await c.query(
        `update cms_materials set files=$1::jsonb, updated_at=now(), updated_by=$2 where id=$3`,
        [JSON.stringify(next), actor, m.id]);
    }
    console.log(`  ✓ 补件 ${enrich.length} 份`);

    for (const x of create) {
      const { rows } = await c.query(
        `insert into cms_materials
           (slug, locale, title, summary, body_markdown, cover_image, cover_image_alt, files,
            status, featured, published_at, legacy_url, legacy_id, created_by, updated_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13,$14,$15) returning id`,
        [x.row.slug, x.row.locale, x.row.title, x.row.summary, x.row.body_markdown, x.row.cover_image,
         x.row.cover_image_alt, x.row.files, x.row.status, x.row.featured, x.row.published_at,
         x.row.legacy_url, x.row.legacy_id, x.row.created_by, x.row.updated_by]);
      await c.query(
        `insert into cms_material_category_map (material_id, category_id, position) values ($1,$2,0)`,
        [rows[0].id, mcatId.get(x.category)]);
    }
    console.log(`  ✓ 新建 ${create.length} 份`);

    const { rows: colCat } = await c.query(
      `insert into cms_article_categories (slug, name, description, is_news_listing, sort_order, locale)
       values ($1,$2,$3,$4,$5,'zh')
       on conflict (slug, locale) do update set name=excluded.name, description=excluded.description
       returning id`,
      [COLUMN_CATEGORY.slug, COLUMN_CATEGORY.name, COLUMN_CATEGORY.description,
       COLUMN_CATEGORY.is_news_listing, COLUMN_CATEGORY.sort_order]);
    const colId = String(colCat[0].id);
    await c.query(
      `update cms_article_category_map set category_id=$1 where category_id=$2 and article_id=any($3::uuid[])`,
      [colId, catId, unplanned.map((a: any) => a.id)]);
    console.log(`  ✓ ${unplanned.length} 篇专栏文章归到「${COLUMN_CATEGORY.name}」`);

    for (const r of redirects) {
      await c.query(
        `insert into cms_redirects (legacy_url, destination_url, status_code, locale)
         values ($1,$2,301,'zh')
         on conflict (legacy_url, locale) do update set destination_url=excluded.destination_url`,
        [r.from, r.to]);
    }
    for (const r of inbound) {
      const slug = String(r.destination_url).replace(/^\/(news|resources)\//, "");
      const p = PLAN.find((x) => x.article === slug)!;
      await c.query(`update cms_redirects set destination_url=$1 where id=$2`,
        [`/resources/downloads/${matCat.get(p.material)}/${p.material}`, r.id]);
    }
    console.log(`  ✓ 重定向 新加 ${redirects.length} 条、改指 ${inbound.length} 条`);

    const ids = PLAN.map((p) => bySlug.get(p.article)!.id);
    await c.query(`delete from cms_article_category_map where article_id=any($1::uuid[])`, [ids]);
    const del = await c.query(`delete from cms_articles where id=any($1::uuid[])`, [ids]);
    console.log(`  ✓ 删掉 ${del.rowCount} 篇文章`);

    const { rows: left } = await c.query(
      `select count(*)::int n from cms_article_category_map where category_id=$1`, [catId]);
    if (left[0].n !== 0) throw new Error(`「资料下载」下还挂着 ${left[0].n} 篇，不删分类`);
    await c.query(`delete from cms_article_categories where id=$1`, [catId]);
    console.log(`  ✓ 删掉「资料下载」分类`);

    await c.query("commit");
  } catch (error) {
    await c.query("rollback");
    throw error;
  }

  console.log("\n✓ 跑完了。记得让页面重新生成（资料页和 /news 都有缓存）。\n");
  await c.end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
