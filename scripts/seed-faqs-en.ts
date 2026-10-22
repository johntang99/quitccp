/**
 * 英文站的三退问答。
 *
 *     npm run seed:faq -- --locale en            # 预演
 *     npm run seed:faq -- --locale en --apply
 *
 * ## 为什么这一批是译的，不是搬的
 *
 * 文章和影片都是从 global.tuidang.org 搬过来的 —— 那边有现成的英文内容。
 * 问答那边没有：已有英文站只有 Home / Topics / About Us / Donation 四页，
 * 没有问答板块。所以这 18 条是从中文站译的。
 *
 * ## 译了哪 18 条，没译哪些
 *
 * 中文站有 46 条。其中 24 条归在「相关报道」下 —— 那其实是几千到一万字的
 * 长文章，被当成问答存着，不是「问题与答案」。英文读者打开问答页要的是
 * 「三退是什么」「证明怎么办」「安不安全」，不是一万字的报导。所以不译。
 *
 * 另有 4 条「移民常见问题」是长篇法律分析，带假设案例、引 INA 条款。那是
 * 有法律后果的文本，译得不准会误导正在办移民的人。留给内容组找懂美国移民法
 * 的人来译，这里不碰 —— 页面上宁可少四条，不要四条似是而非的法律解释。
 *
 * 剩下 18 条：三退 5、退党证明 6、安全与隐私 2、移民政策 5。
 *
 * ## 几条措辞上的取舍
 *
 * 中文原文里「邪党」「毒誓」「天灭中共」这类说法，在中文读者那里是有来历的
 * 固定表达。直译成英文（evil party / vicious oath）在英文读者看来是另一回事。
 * 这里按意思译，保留原文的立场和力度，但不生造英文里不存在的说法。
 *
 * 费用「300 美元」照译不改 —— 价格是事实，不是文案。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface Faq {
  slug: string;
  category: string;
  question: string;
  answer: string;
}

const MORE = "\n\nMore in our [questions and answers](/services/faq).";

const FAQS: Faq[] = [
  /* ── 三退 ───────────────────────────────────────────────────── */
  {
    slug: "what-is-quitting-the-ccp",
    category: "st",
    question: "What does “quitting the CCP” mean?",
    answer:
      "It means publicly declaring that you are leaving every organisation of the Chinese Communist Party — the Party itself, the Communist Youth League and the Young Pioneers. You can record that statement on the centre's [statements site](https://santui.tuidang.org) under your real name or any name you choose." +
      MORE
  },
  {
    slug: "why-quit-the-ccp",
    category: "st",
    question: "Why withdraw?",
    answer:
      "Since it took power the Chinese Communist Party has caused the deaths of some 80 million people. It has ruled by violence, enriched its officials at the public's expense, concealed the truth behind lies, and taken away people's freedoms by every means available to it.\n\n" +
      "Vast numbers of Chinese people were led into joining the Party, the Youth League or the Young Pioneers, and swore an oath to give their lives to it and to fight for it as long as they lived. Almost nobody who swore that oath ever meant to keep it.\n\n" +
      "Withdrawing is how a person sets that oath aside: a public statement, under your own name or another, leaving every CCP organisation you once joined. It takes a few minutes and it costs nothing.\n\n" +
      "You can make yours on the centre's [statements site](https://santui.tuidang.org)." +
      MORE
  },
  {
    slug: "how-to-quit-the-ccp",
    category: "st",
    question: "How do I withdraw?",
    answer:
      "**Online**\n\n" +
      "- Go to www.tuidang.org and choose [Make a statement](https://santui.tuidang.org), or write to us through Contact us at the foot of any page.\n\n" +
      "**By telephone**\n\n" +
      "- Call the centre on +1 (888) 976-6568.\n\n" +
      "**By email**\n\n" +
      "- Write to [santui@tuidang.org](mailto:santui@tuidang.org).\n\n" +
      "**Through a volunteer**\n\n" +
      "- Volunteers at service points — in your own city or at tourist sites abroad — can record your statement for you on the spot.\n\n" +
      "**In public**\n\n" +
      "- You can also post your statement publicly, in a public place."
  },
  {
    slug: "do-unpaid-dues-count-as-leaving",
    category: "st",
    question: "If I stopped paying dues years ago, have I already left?",
    answer:
      "No. Article 6 of the Party's own constitution requires every probationary member to swear an oath before the Party flag: to uphold the Party's programme, obey its discipline, keep its secrets, be loyal to it, fight for communism all their life, be ready at any moment to sacrifice everything for the Party and the people, and never betray the Party.\n\n" +
      "The Party is an organisation you can join but not leave. Simply ceasing to pay dues is passive: you have never said anything, and the oath still stands as far as the Party is concerned. Leaving means stating it yourself — declaring plainly that you are out and that the oath you swore is void." +
      MORE
  },
  {
    slug: "can-i-withdraw-on-someone-elses-behalf",
    category: "st",
    question: "Can I withdraw on someone else's behalf?",
    answer:
      "You cannot decide for another person. But where someone has clearly said they wish to leave the Party, the League or the Pioneers, another person may submit the statement for them on the [statements site](https://santui.tuidang.org/)." +
      MORE
  },

  /* ── 退党证明 ───────────────────────────────────────────────── */
  {
    slug: "what-is-a-certificate-of-withdrawal",
    category: "tdzs",
    question: "What is a certificate of withdrawal?",
    answer:
      "It is a document that attests, under your real name, that you have left every organisation of the Chinese Communist Party.\n\n" +
      "The CCP's record at home and abroad has made its members unwelcome in much of the world, and free countries increasingly ask about membership and hold members to account. Yet a great many people joined the Party, the League or the Pioneers under pressure, under false pretences, or without understanding what they were joining. The certificate gives those people a way out: a safe, documented withdrawal in their own name.\n\n" +
      "Whether you are in mainland China or abroad, you can [apply online](/services/cert). The Global Service Center runs the training, the application and the verification, and has been the one body issuing this document for more than ten years; it is recognised by immigration lawyers and by US immigration authorities.\n\n" +
      "Applying for a certificate also counts as having made your withdrawal." +
      MORE
  },
  {
    slug: "how-to-apply-for-a-certificate",
    category: "tdzs",
    question: "How do I apply for a certificate?",
    answer:
      "Apply through the centre's site — see [the application page](/services/cert) for details.\n\n" +
      "If you are in the United States you can also apply in person at our New York office; see [Contact us](/services/contact).\n\n" +
      "The fee is US$300. Applicants watch a training video of about an hour and pass a short test. The certificate attests a withdrawal **in your real name**, so you must take the training and apply yourself." +
      MORE
  },
  {
    slug: "why-apply-early-if-leaving-china",
    category: "tdzs",
    question: "Why should I apply early if I am leaving, or plan to leave, China?",
    answer:
      "Take the United States as the example. Anyone who is, or has been, a member of the Communist Party or an affiliated organisation cannot be admitted as an immigrant. Under INA 212(a)(3)(D), as applied by US Citizenship and Immigration Services and the Department of Homeland Security, an applicant must provide documentation that they left the Party and its organisations — generally at least five years earlier. It is the applicant's responsibility to provide it.\n\n" +
      "Countries built on universal values treat the CCP as a threat, and anyone who joined its organisations, or who identifies with communist ideology, may be judged a risk to national security. For more than twenty years the Global Service Center has supported people making that break, and has issued certificates of withdrawal in Chinese and English — together with the course and the test that go with them." +
      MORE
  },
  {
    slug: "i-registered-on-epoch-times-can-i-still-apply",
    category: "tdzs",
    question: "I registered my withdrawal on the Epoch Times site. Can I still apply for a certificate?",
    answer:
      "Yes — [apply here](/services/cert).\n\nIf you still have the lookup code from that earlier registration, you can add it during the application." +
      MORE
  },
  {
    slug: "what-if-my-certificate-has-a-mistake",
    category: "tdzs",
    question: "What if my certificate is issued with a mistake in it?",
    answer:
      "Our staff can amend it. The steps are on the [certificate amendment page](https://service.tuidang.org/cert-modify/)." +
      MORE
  },
  {
    slug: "how-to-verify-a-certificate",
    category: "tdzs",
    question: "How is a certificate verified?",
    answer:
      "If you need to confirm a certificate — for an immigration application or for any other purpose — use the [certificate verification system](https://service.tuidang.org/cert-verify/).\n\n" +
      "**Please note:**\n\n" +
      "- The certificate number (16 digits beginning TD) is not the same as the lookup password from the [statements site](https://santui.tuidang.org).\n\n" +
      "- The system currently covers certificates issued after 18 August 2020.\n\n" +
      "- To look up a statement of withdrawal rather than a certificate, go [here](https://santui.tuidang.org/index/querybyid)." +
      MORE
  },

  /* ── 安全与隐私 ─────────────────────────────────────────────── */
  {
    slug: "is-withdrawing-safe",
    category: "aqys",
    question: "Is withdrawing safe?",
    answer:
      "Yes. Since the movement began, more than 460 million people have recorded a statement on the centre's site, under their own names or under other names." +
      MORE
  },
  {
    slug: "is-applying-for-a-certificate-safe",
    category: "aqys",
    question: "Is applying for a certificate safe?",
    answer:
      "Yes. Everything on your certificate is held in confidence by the centre. Please also keep your own copy of the certificate and its number safe, so that they are not disclosed by accident." +
      MORE
  },

  /* ── 移民相关政策 ───────────────────────────────────────────── */
  {
    slug: "uscis-on-communist-party-membership",
    category: "ymzc",
    question: "What is USCIS's position on Communist Party membership?",
    answer:
      "United States immigration policy has long refused applicants from communist and totalitarian states on national-security grounds. In October 2020 USCIS set out its rule on CCP members emigrating to the United States: unless a waiver is available, no one who is a member of a communist party, of an affiliated organisation, or of any totalitarian party may be admitted as an immigrant. It also noted two exceptions, and one further case that may be decided at the officer's discretion." +
      MORE
  },
  {
    slug: "uscis-discretionary-waivers",
    category: "ymzc",
    question: "When can a waiver be granted?",
    answer:
      "INA 212(a)(3)(D), which covers members of totalitarian parties, sets out two exceptions under which a waiver may be granted:\n\n" +
      "- Provide [a certificate of withdrawal](/services/cert) showing that you left the Party and its organisations, generally at least five years ago.\n\n" +
      "- Show that you are not a threat to the security of the United States." +
      MORE
  },
  {
    slug: "members-must-provide-the-certificate-themselves",
    category: "ymzc",
    question: "Who has to provide the proof of withdrawal?",
    answer:
      "Whether someone is a member of the Party or of an affiliated organisation is for the immigration officer to determine. If the officer concludes from their enquiries that an applicant is or was a member, the applicant must provide proof that they left. That responsibility is the applicant's; the US government does not carry it.\n\n" +
      "An applicant who answers the membership question falsely on **Form I-485** will have the application refused if the facts turn out otherwise." +
      MORE
  },
  {
    slug: "non-immigrant-visas-also-ask",
    category: "ymzc",
    question: "Do non-immigrant visas ask about Party membership too?",
    answer:
      "Yes. Form DS-160 asks for your personal details, contact details, passport and travel information, any previous travel to the United States, family information, and your education and employment history — and it asks directly whether you are a member of the Communist Party or an affiliated organisation.\n\n" +
      "US entry policy towards members of CCP organisations has tightened in recent years. A B1/B2 visa may be refused on those grounds, or granted for a much shorter period — a month instead of ten years." +
      MORE
  },
  {
    slug: "naturalised-citizens-may-also-be-removed",
    category: "ymzc",
    question: "Can a naturalised citizen be removed over Party membership?",
    answer:
      "Naturalisation can be revoked if a person becomes a member of, or affiliated with, the Communist Party, another totalitarian party or a terrorist organisation within five years of being naturalised. As a rule, someone involved in such an organisation cannot establish attachment to the Constitution or a disposition towards the good order and happiness of the United States, and so does not meet the requirements for naturalisation.\n\n" +
      "Involvement found within five years of naturalisation is treated as evidence that the person concealed or misrepresented it during the immigration process, and was not eligible in the first place." +
      MORE
  }
];

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

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i < 0 ? undefined : process.argv[i + 1];
}

const HAN = /[一-鿿]/;

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));

  const locale = (arg("--locale") ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  if (!locale) throw new Error("要指定 --locale，例如 --locale en");
  if (locale === "zh") throw new Error("拒绝往 zh 写。中文站是生产，编辑每天在用。");
  if (locale !== "en") throw new Error(`目前只有 en 的问答，--locale ${locale} 没有可播的内容`);

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  console.log(`\n========== 给 ${locale} 站播问答${apply ? "" : "（预演）"} ==========\n`);

  /* 硬检查，和页面正文那边同一条规矩：英文里不该有汉字。 */
  const dirty = FAQS.filter((f) => HAN.test(f.question) || HAN.test(f.answer));
  if (dirty.length > 0) {
    console.log(`  ✗ ${dirty.length} 条里还有汉字：`);
    for (const f of dirty) console.log(`      ${f.slug}`);
    process.exit(1);
  }
  console.log("  ✓ 没有汉字残留");

  const { data: cats, error: catError } = await db
    .from("cms_faq_categories")
    .select("id, slug, name")
    .eq("locale", locale);
  if (catError) throw new Error(`读不到问答分类：${catError.message}`);
  const catId = new Map((cats ?? []).map((c) => [String(c.slug), String(c.id)]));

  const missing = [...new Set(FAQS.map((f) => f.category))].filter((c) => !catId.has(c));
  if (missing.length > 0) {
    throw new Error(`这些问答分类还没建：${missing.join("、")} —— 先跑 npm run seed:site -- --locale ${locale} --apply`);
  }

  const byCat = new Map<string, number>();
  for (const f of FAQS) byCat.set(f.category, (byCat.get(f.category) ?? 0) + 1);
  for (const [slug, n] of byCat) {
    const name = (cats ?? []).find((c) => String(c.slug) === slug)?.name;
    console.log(`  ${String(n).padStart(3)} 条  ${name}（${slug}）`);
  }

  if (!apply) {
    console.log("\n（预演，一个字都没写。加 --apply 才真跑。）\n");
    return;
  }

  const rows = FAQS.map((f, index) => ({
    slug: f.slug,
    locale,
    question: f.question,
    answer_markdown: f.answer,
    category_id: catId.get(f.category)!,
    position: index,
    status: "published"
  }));

  const { error } = await db.from("cms_faqs").upsert(rows, { onConflict: "slug,locale" });
  if (error) throw new Error(`写失败：${error.message}`);
  console.log(`\n  ✓ 问答 ${rows.length} 条\n`);
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
