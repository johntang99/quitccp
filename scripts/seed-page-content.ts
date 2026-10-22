/**
 * 给一个新语言的站播页面正文。先做首页。
 *
 *     npm run seed:pages -- --locale en            # 预演
 *     npm run seed:pages -- --locale en --apply
 *
 * ## 为什么不是手写一份 JSON
 *
 * pages/home.json 是 15KB、十四个区块、一百多个文案字段。手写一份英文的，结构
 * 对不对要靠眼睛看 —— 少一个键，那一块在页面上就是空的或者直接报错，而且只有
 * 打开首页才会发现。
 *
 * 所以这里的做法是：**拿中文站那份做模子**，深拷一份，按「路径 → 英文」逐个
 * 覆盖文案，再把该关的区块关掉。结构由模子保证，这个脚本只负责换字。
 *
 * 最后有一道硬检查：译完之后整份 JSON 里不该再有汉字。还有剩的就拒绝写入，并
 * 把路径列出来。没有这道检查，漏译的字段会安安静静留在英文站上 —— 这正是这个
 * 项目反复踩过的那种坑：检查只看形状，不看事实。
 *
 * ## 哪些区块先关掉，为什么
 *
 *   news / video / channels
 *       列的是具体的中文文章和视频。把标题译成英文，链接还是指向中文内容 ——
 *       英文读者点进去是一篇中文文章。英文站现在一条内容都没有，空着比假装有
 *       内容要好。等英文编辑发了稿，在后台把开关打开就行。
 *
 *   voices
 *       高智晟、关贵敏、黄晓敏这些人的退党声明**原话**。把真实人物说过的话
 *       转述成英文挂在他们名下，是替他们说话 —— 这不是一个播种脚本该做的事。
 *       要上这一块，得由编辑提供有出处的英文译文。
 *
 *   hero
 *       中文站现在挂的是某一周的新闻（「今年前三季逾千万人三退」），还链着一篇
 *       中文文章。英文站换成一段讲机构自己在做什么的开场白 —— 那是事实陈述，
 *       不会过期，也不依赖任何还不存在的内容。
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── 要播哪些页 ───────────────────────────────────────────────────── */

interface PagePlan {
  /** cms_content_entries 里的 path，中英两边一样。 */
  path: string;
  /** 路径 → 英文。null 表示清空。 */
  en: Record<string, string | null>;
  /** 整块关掉的区块：键是区块名，值是要一并清空的列表字段。 */
  disable?: Record<string, string[]>;
  /** 整个丢掉的子对象。 */
  drop?: string[];
  /**
   * 清空成 [] 的列表。
   *
   * 和 disable 的区别：disable 关的是「有 enabled 开关的整块」，clear 对付的是
   * 嵌在里面的条目数组 —— 比如视频页的 sections[0].items，它列的是具体某几支
   * 中文视频，英文站一支都没有。清空之后那一节只剩标题和「全部影片 →」，
   * 等英文编辑发了片子再填。
   */
  clear?: string[];
}

/* ── 英文文案 ─────────────────────────────────────────────────────── */

/**
 * 路径 → 英文。路径就是 JSON 里的位置，`a.b[0].c` 这种写法。
 *
 * 值为 null 表示「把这个字段清空」（用于那些只在中文站有意义的东西）。
 */
const HOME_EN: Record<string, string | null> = {
  title: "Home",
  subtitle: "Founded 2005 · Headquartered in New York · 100+ service points worldwide",

  /* 开场。不挂具体新闻，讲机构在做什么。 */
  "hero.eyebrow": "Founded 2005 · 100+ service points worldwide",
  "hero.title": "Everyone who wants out should be able to put it on record.",
  "hero.body":
    "The Global Service Center for Quitting the Chinese Communist Party records public statements withdrawing from the Party, the Youth League and the Young Pioneers, and issues certificates of withdrawal. We also document human-rights abuses and support volunteers at more than a hundred service points. In twenty years we have recorded over 460 million statements.",
  "hero.actions[0].label": "Make a statement",
  "hero.actions[1].label": "What we do",

  /* 关于我们 */
  "about.eyebrow": "About us · Support us",
  "about.heading": "Every dollar and every number\ncan be checked.",
  "about.lede":
    "The Global Service Center for Quitting the Chinese Communist Party was founded in 2005. It is a non-profit registered in the United States, with its head office in New York. Our financial statements, governance and counting method are all public.",
  "about.moreLabel": "Download our profile (PDF) →",
  "about.cells[0].heading": "Why we need your support",
  "about.cells[0].value": "Under attack",
  "about.cells[0].body":
    "The people who object to this work are hitting this site with tens of thousands of requests a second. Protection, bandwidth and servers all cost money. If you think the work should continue, please support it.",
  "about.cells[1].heading": "Registration and legal status",
  "about.cells[1].body":
    "A non-profit registered in the United States; donations are tax-deductible. Our annual Form 990 is on the public record.",
  "about.cells[2].heading": "Counting and safety",
  "about.cells[2].value": "Method published",
  "about.cells[2].body":
    "How statements are counted, how duplicates are removed and how often the figure updates are all set out in full. Threats directed at this organisation are kept in a separate public file.",

  /* 参与我们 */
  "involve.eyebrow": "Get involved",
  "involve.heading": "Four ways to take part",
  "involve.lede": "Any one of them helps reach more people.",
  "involve.items[0].title": "Make a statement",
  "involve.items[0].body":
    "Submit under your own name or anonymously. It takes a few minutes, and you can request a certificate afterwards.",
  "involve.items[0].ctaLabel": "Start now",
  "involve.items[0].glyph": "1",
  "involve.items[1].title": "Become a volunteer",
  "involve.items[1].body":
    "Help at a service point in your city, or work online on translation and archiving.",
  "involve.items[1].ctaLabel": "Sign up",
  "involve.items[1].glyph": "2",
  "involve.items[2].title": "Sign the petition",
  "involve.items[2].body": "Add your name to the End CCP petition and tell your government where you stand.",
  "involve.items[2].ctaLabel": "Sign the petition",
  "involve.items[2].glyph": "3",
  "involve.items[3].title": "Download materials",
  "involve.items[3].body":
    "Display boards, leaflets, placards and audio-visual material, free to use.",
  "involve.items[3].ctaLabel": "Go to downloads",
  "involve.items[3].glyph": "4",

  /* 全球网络 */
  "network.eyebrow": "Global network",
  "network.heading": "More than a hundred service points worldwide, kept running by volunteers",
  "network.body":
    "Service points sit near tourist sites, community centres and transport hubs. Volunteers help people register on the spot, answer questions about certificates and immigration, and pass on statements made on paper.",
  "network.buttonLabel": "Find your nearest service point",
  "network.citiesLabel": "Some of our service points",
  "network.cities[0]": "New York",
  "network.cities[1]": "Los Angeles",
  "network.cities[2]": "San Francisco",
  "network.cities[3]": "Toronto",
  "network.cities[4]": "Vancouver",
  "network.cities[5]": "Washington DC",
  "network.cities[6]": "London",
  "network.cities[7]": "Berlin",
  "network.cities[8]": "Paris",
  "network.cities[9]": "Taipei",
  "network.cities[10]": "Tokyo",
  "network.cities[11]": "Seoul",
  "network.cities[12]": "Hong Kong",
  "network.cities[13]": "Bangkok",
  "network.cities[14]": "Jeju",
  "network.cities[15]": "Sydney",
  "network.cities[16]": "Melbourne",
  "network.cities[17]": "Auckland",

  /* 实时登记册 */
  "registry.eyebrow": "Live register",
  "registry.liveLabel": "Live register · those who stepped away",
  "registry.countLabel": "people have publicly declared their withdrawal from the Party, the League and the Pioneers",
  "registry.noteLabel": "How this figure is counted →",
  "registry.count": "466 million",
  "registry.substats[0].label": "Online submission",
  "registry.substats[1].label": "Covered by the audit trail",
  "registry.substats[2].label": "Archive searchable",
  /* 这张配图是中文出版物的封面，换语言的站该自己挑图。 */
  "registry.asideImageAlt": null,

  /* 服务 */
  "services.eyebrow": "Statements & certificates",
  "services.heading": "Statements, documentation, media and the tools to reach people",
  "services.moreLabel": "See all services",
  "services.cards[0].tag": "Register",
  "services.cards[0].title": "Statements & certificates",
  "services.cards[0].body":
    "Statements may be made under your own name or anonymously. You can also request a certificate of withdrawal in Chinese and English, which a third party can verify online.",
  "services.cards[0].ctaLabel": "Make a statement →",
  "services.cards[0].links[0].label": "Withdraw from the Party, League or Pioneers",
  "services.cards[0].links[1].label": "Request a certificate",
  "services.cards[0].links[2].label": "Look up and verify a certificate",
  "services.cards[0].links[3].label": "Certificates and immigration applications",
  "services.cards[0].links[4].label": "Safe access and censorship-circumvention tools",
  "services.cards[1].tag": "Document",
  "services.cards[1].title": "Investigation, archive and testimony",
  "services.cards[1].body":
    "We collect and verify cases of human-rights abuse, preserve first-hand accounts from those involved, and submit them to parliaments, institutions and the press.",
  "services.cards[1].ctaLabel": "Go to the newsroom →",
  /*
   * 链接也得改，不只是文案。
   *
   * 这些 href 是跟着中文站的栏目 slug 来的（worldwide-investigation、
   * topics-commentary…）。英文站有自己的一套栏目，那些 slug 根本不存在 ——
   * 页面照常渲染、文案也对，点下去才是 404。npm run links:check 就是为这个
   * 加的；2026-10-22 它一次查出 11 条。
   */
  "services.cards[1].links[0].href": "/news/religious-persecution",
  "services.cards[1].links[1].href": "/news/terror-in-china",
  "services.cards[1].links[2].href": "/news/tuidang",
  "services.cards[1].links[3].href": "/news/international-support",
  "services.cards[1].links[4].href": "/news/global-infiltration",
  "services.cards[1].links[5].href": "/news/endccp",
  "services.cards[2].links[4].href": "/news/tuidang-statements",
  "voices.moreHref": "/news/tuidang-statements",
  "services.cards[1].links[0].label": "Case files",
  "services.cards[1].links[1].label": "Investigation reports",
  "services.cards[1].links[2].label": "First-hand accounts",
  "services.cards[1].links[3].label": "Parliamentary and institutional attention",
  "services.cards[1].links[4].label": "CCP infiltration",
  "services.cards[1].links[5].label": "Countering the CCP",
  "services.cards[2].tag": "Petition",
  "services.cards[2].title": "End CCP",
  "services.cards[2].body":
    "A public petition open to people everywhere, telling governments and international bodies where they stand on the CCP's abuses. {{endccp}} people have signed.",
  "services.cards[2].ctaLabel": "Sign the petition →",
  "services.cards[2].links[0].label": "Nine Commentaries on the Communist Party",
  "services.cards[2].links[1].label": "Full text of the petition",
  "services.cards[2].links[2].label": "Collect signatures in person",
  "services.cards[2].links[3].label": "Petition materials to download",
  "services.cards[2].links[4].label": "Announcements and statements",

  /* 资源馆（中文站这一块现在是关着的，英文站也保持关着，但文案照译） */
  "resources.eyebrow": "Resources",
  "resources.heading": "Tools, guides and public documents",
  "resources.moreLabel": "Browse all resources",
  "resources.items[0].label": "Safe access tools",
  "resources.items[1].label": "How to submit a statement",
  "resources.items[2].label": "How to verify a certificate",
  "resources.items[3].label": "Public reports",
  "resources.items[4].label": "Working with the press",
  "resources.items[5].label": "Terms of use",

  /* 下面这几块整块关掉，文案还是要译 —— 编辑在后台打开时该看到英文标题。 */
  "news.eyebrow": "News & reports",
  "news.heading": "Latest coverage",
  "news.listTitle": "Just published",
  "news.moreLabel": "Go to the newsroom",
  "news.listMoreLabel": "Browse everything",
  "video.eyebrow": "Video",
  "video.heading": "Films and programmes",
  "video.moreLabel": "Go to the video library",
  "video.latestLabel": "Newly added",
  /*
   * 见证者。这些是真实人物退党声明的原话。
   *
   * 2026-10-22 定的做法：翻译，不回避 —— 媒体转述外语发言本来就要翻译，
   * 关键是不改原意。所以这里逐句直译，不概括、不润色、不替说话的人把话
   * 说得更漂亮。人名用英文报导里通行的拼法（Gao Zhisheng、Chen Yonglin
   * 这几位都有固定写法），不另起一套。
   */
  "voices.eyebrow": "In their own words",
  "voices.heading": "Why they chose to say it publicly",
  "voices.moreLabel": "More testimony →",
  "voices.items[0].name": "Gao Zhisheng",
  "voices.items[0].role": "Human-rights lawyer, three times nominated for the Nobel Peace Prize",
  "voices.items[0].quote":
    "\u201cI am leaving this evil party, which has no benevolence, no righteousness and no humanity. This is the proudest day of my life\u2026 I believe the root of China\u2019s problems can only be resolved by discarding this evil system\u2026 Spreading the Nine Commentaries and encouraging people to withdraw is the most effective and most peaceful means there has been so far.\u201d",
  "voices.items[1].name": "Guan Guimin",
  "voices.items[1].role": "Celebrated tenor",
  "voices.items[1].quote":
    "\u201cOnly when it \u2014 the Chinese Communist Party \u2014 falls will Chinese people have a good life, and only then will our nation have hope. Otherwise we Chinese will go on in darkness for ever. I hope everyone can see this clearly, and leave the Communist Party.\u201d",
  "voices.items[2].name": "Huang Xiaomin",
  "voices.items[2].role": "Olympic swimmer",
  "voices.items[2].quote":
    "\u201cI feel deep shame at having once been a member of the Communist Party. I joined unwillingly, I have had no contact with any Party organisation for more than ten years and have paid no dues \u2014 in effect I left long ago. But I feel I should still say so clearly and formally, to rid myself completely and from within of the Party\u2019s poison, and to leave this evil party.\u201d",
  "voices.items[3].name": "Chen Yonglin",
  "voices.items[3].role": "Former CCP diplomat, Sydney",
  "voices.items[3].quote":
    "\u201cAs a diplomat I was supposed to serve the national interest, but most of what I did there was not in the national interest \u2014 it was persecuting my own people.\u201d \u201cThe withdrawal movement is the conscience of the Chinese nation waking up. It gives the Chinese people hope.\u201d",
  "voices.items[4].name": "Han Guangsheng",
  "voices.items[4].role": "Former director of the Shenyang Justice Bureau",
  "voices.items[4].quote":
    "\u201cThe CCP is not, as it endlessly proclaims, a party that puts the people\u2019s interests above all. It is a vested interest that puts its own one-party rule above all \u2014 despotic and brutal, corrupt through and through, utterly hypocritical and utterly weak. Such a party is now wholly irreconcilable with my own ideals and convictions. I therefore solemnly declare: I withdraw from the Chinese Communist Party.\u201d",
  "voices.items[5].name": "Hao Fengjun",
  "voices.items[5].role": "Former official, Tianjin 610 Office",
  "voices.items[5].quote":
    "When I joined the Chinese Communist Party I had high expectations of it, but the reality was not what I had imagined. What it now imposes on mainland China is a dark rule, a system without human rights. I therefore solemnly declare that I withdraw from the Communist Party and all of its organisations.",
  "channels.heading": "Series"
};

/**
 * 首页这三块不关，只把里面的中文样例清空。
 *
 * 2026-10-22 实测纠正的一个判断：news / video / channels 的内容**是实时从库里
 * 查的**（getHomeNews、getHomeVideo，都按 locale 过滤），CMS 里那串条目只是
 * 没有实时数据时的兜底。所以英文站发了第一篇文章，首页会自己填上 —— 我验过：
 * 发一篇，首页立刻出现。
 *
 * 当初我把三块整个关掉，是因为它们显示着中文样例。那判断只对了一半：该清的是
 * 样例，不是开关。关掉的代价是等英文有了内容，编辑得先找到一个藏在 JSON 里的
 * 开关才能让首页显示新闻 —— 没人会想到去找。
 *
 * 清空仍然必要：中文标题、人名留在数据里，哪天兜底被触发，中文就回来了。
 */
const HOME_CLEAR = ["news.items", "video.items", "video.series", "channels.cards"];

/** 这些子对象整个清掉：它们是「某一篇具体的中文内容」。 */
const HOME_DROP = ["news.lead", "video.featured", "registry.asideImage", "hero.video", "hero.gallery", "hero.image"];


/* ── 三退登记与证明（/services） ──────────────────────────────────── */

const SERVICES_EN: Record<string, string | null> = {
  title: "Certificates of withdrawal, applied for online",
  subtitle:
    "We do three things: record your statement of withdrawal, issue a certificate in Chinese and English to those who need one, and let anyone verify a certificate online. Recording a statement and verifying a certificate are free; a certificate is issued in your real name and carries a processing fee.",
  "hero.imageAlt": "Volunteers helping people register at a service point",
  "hero.figureAlt": "A sample certificate of withdrawal, in Chinese and English",

  "verifyBand.eyebrow": "Verify",
  "verifyBand.title": "Check a certificate",
  "verifyBand.body":
    "Enter the certificate number in our verification system to confirm the date it was issued and its current status. The service is open to everyone: an institution can check for itself without contacting us.",
  "verifyBand.note":
    "You will need the certificate number (16 digits beginning TD), the holder's name and date of birth. It covers certificates issued after 18 August 2020.",
  "verifyBand.inputLabel": "Certificate number",
  "verifyBand.inputPlaceholder": "for example TD-2026-0071824",
  "verifyBand.buttonLabel": "Verify",

  "certSection.eyebrow": "Certificate of withdrawal",
  "certSection.title": "Applying for a certificate",
  "certSection.paragraphs[0]":
    "A certificate of withdrawal is a document we issue in Chinese and English. It gives the holder's name, the organisations they have left, the date of the statement and the certificate number.",
  "certSection.paragraphs[1]":
    "You need to have made a statement first. If you made one some time ago, you can apply for a replacement using the details you gave then.",
  "certSection.subheading": "What you need",
  "certSection.subbody":
    "You need to have made a statement first. If you made one some time ago, you can apply for a replacement using the details you gave then.",
  "certSection.noticeTitle": "Please note",
  "certSection.noticeBody":
    "The certificate is issued by this centre. It is not a government document, and it is no guarantee of the outcome of any immigration application. Whether and how it is taken into account is for the receiving institution to decide.",
  "certSection.actions[0].label": "Apply for a certificate",
  "certSection.actions[1].label": "Read the common questions first",
  "certSection.actionStamp": "Apply",
  "certSection.samplePanel.title": "Sample certificate",
  "certSection.samplePanel.alt": "Sample certificate",
  "certSection.relatedPanel.title": "Related",
  "certSection.relatedPanel.links[0].label": "Certificates and immigration applications",
  "certSection.relatedPanel.links[1].label": "Verification for third parties",
  "certSection.relatedPanel.links[2].label": "Changes and replacements",
  "certSection.relatedPanel.links[3].label": "Common questions",

  "processCards[0].tag": "Step one",
  "processCards[0].title": "Make your statement",
  "processCards[0].body":
    "Fill in a short statement naming the organisations you are leaving. You may use your real name, another name or a handle; no identity documents are required.",
  "processCards[0].foot": "Fully anonymous if you wish · no account needed",
  "processCards[0].links[0].label": "Make a statement",
  "processCards[0].links[0].meta": "about 3 minutes",
  "processCards[0].links[1].label": "What does withdrawing mean?",
  "processCards[0].links[1].meta": "Q&A",
  "processCards[0].links[2].label": "Why withdraw?",
  "processCards[0].links[2].meta": "Q&A",
  "processCards[0].links[3].label": "Safety and privacy",
  "processCards[0].links[3].meta": "please read",

  "processCards[1].tag": "Step two (optional)",
  "processCards[1].title": "Apply for a certificate",
  "processCards[1].body":
    "If you need written proof for an immigration or residency application, or for any other purpose, you can apply for a certificate in Chinese and English.",
  "processCards[1].foot": "Issued in your real name · PDF",
  "processCards[1].links[0].label": "Apply for a certificate",
  "processCards[1].links[0].meta": "online",
  "processCards[1].links[1].label": "How it relates to immigration applications",
  "processCards[1].links[1].meta": "explained",
  "processCards[1].links[2].label": "Certificate questions",
  "processCards[1].links[3].label": "Changes and replacements",
  "processCards[1].links[3].meta": "service",

  "processCards[2].tag": "Third parties",
  "processCards[2].title": "Look up and verify",
  "processCards[2].body":
    "Any institution or individual can verify a certificate online using its number. No need to contact us, and no login.",
  "processCards[2].foot": "Open to all · no authorisation needed",
  "processCards[2].links[0].label": "Enter a certificate number",
  "processCards[2].links[0].meta": "open",
  "processCards[2].links[1].label": "Sample certificate and security features",
  "processCards[2].links[1].meta": "explained",
  "processCards[2].links[2].label": "A note for receiving institutions",
  "processCards[2].links[3].label": "Contact us to confirm",
  "processCards[2].links[3].meta": "contact",

  "primaryAction.label": "Apply on this site",
  "primaryAction.stamp": "Apply",
  "secondaryAction.label": "Apply via Gan Jing World",

  "contactSection.title": "Need to correct something, or lost your certificate?",
  "contactSection.body":
    "If a name on a statement is wrong or needs changing, or a certificate has been lost and needs reissuing, write to us. Volunteers handle these by hand, which usually takes a few working days. Please tell us roughly when the original statement was made and what it said, so we can match it.",
  "contactSection.primaryAction.label": "Request a change",
  "contactSection.secondaryAction.label": "Contact a service point",

  "immigrationSection.eyebrow": "Immigration policy and questions",
  "immigrationSection.title": "Coverage and guidance on residency applications",
  "immigrationSection.lede":
    "What follows is published reporting and a summary of policy, offered for reference. We do not give legal advice; for your own case, consult a licensed immigration lawyer.",
  "immigrationSection.moreLabel": "All related coverage →"
};


/* ── 影音节目（/videos） ──────────────────────────────────────────── */

/*
 * 这一页上，每一节列的都是具体某几支中文影片。英文站一支都没有，所以条目
 * 全部清空，只留下节名和「全部影片 →」—— 栏目骨架在，内容等编辑填。
 * 节名沿用建站时播下的那套英文视频分类名，两处要对得上。
 */
const VIDEOS_EN: Record<string, string | null> = {
  title: "Films and programmes",
  subtitle:
    "Footage from the ground, interviews with those involved, investigative film and documentary series. All programmes may be freely downloaded, reposted and re-edited.",
  moreButtonLabel: "Load more",

  "sections[0].eyebrow": "Tuidang Frontline",
  "sections[0].title": "Tuidang Frontline",
  "sections[0].lede": "From the service points: volunteers at work, and the people they meet.",
  "sections[0].moreLabel": "All films →",

  "sections[1].eyebrow": "Breaking Party Culture",
  "sections[1].title": "Breaking Party Culture",
  "sections[1].lede": "How Party culture worked its way into language, schooling and everyday life.",
  "sections[1].moreLabel": "All films →",

  "sections[2].eyebrow": "Nine Commentaries",
  "sections[2].title": "Nine Commentaries on the Communist Party",
  "sections[2].lede":
    "Including video and audio editions of the Nine Commentaries, How the Specter of Communism Is Ruling Our World, and The Ultimate Goal of Communism.",
  "sections[2].moreLabel": "All films →",

  "sections[3].eyebrow": "Ironclad Evidence",
  "sections[3].title": "Ironclad Evidence",
  "sections[3].lede": "The filmed editions of the WOIPFG investigations.",
  "sections[3].moreLabel": "All films →",

  "sections[4].eyebrow": "Journey of Awakening",
  "sections[4].title": "Journey of Awakening",
  "sections[4].lede": "A documentary series filmed over many years.",
  "sections[4].moreLabel": "All films →"
};


/* ── 书籍与文集（/resources） ─────────────────────────────────────── */

/*
 * 这几本书都有通行的英文书名，《九评》的九章标题也有正式英译 —— 用它们，
 * 不要另起炉灶重译一遍。英文读者是按这些名字去找这些书的。
 */
const RESOURCES_EN: Record<string, string | null> = {
  title: "Books and writings",
  subtitle:
    "The Nine Commentaries on the Communist Party and the books that followed it: full text, audio and translations. All free to read and download, and free to repost and re-edit.",

  "featuredBook.title": "Nine Commentaries on the Communist Party",
  "featuredBook.body":
    "The first book to set out systematically what the Chinese Communist Party is. Since it appeared in 2004 it has passed from hand to hand among Chinese people around the world, and it began the movement to withdraw — more than 460 million people have now publicly declared that they are leaving the Party, the Youth League and the Young Pioneers.",
  "featuredBook.yearLine": "First published 2004 · translated into more than 30 languages",
  "featuredBook.imageAlt": "Cover of Nine Commentaries on the Communist Party",
  "featuredBook.tocHeading": "Contents",
  "featuredBook.formats[0].label": "Read online",
  "featuredBook.formats[3].label": "Audio and video",
  "featuredBook.formats[4].label": "Translations and downloads",
  "featuredBook.toc[0].index": "1",
  "featuredBook.toc[0].title": "On What the Communist Party Is",
  "featuredBook.toc[1].index": "2",
  "featuredBook.toc[1].title": "On the Beginnings of the Chinese Communist Party",
  "featuredBook.toc[2].index": "3",
  "featuredBook.toc[2].title": "On the Tyranny of the Chinese Communist Party",
  "featuredBook.toc[3].index": "4",
  "featuredBook.toc[3].title": "On How the Communist Party Is an Anti-Universe Force",
  "featuredBook.toc[4].index": "5",
  "featuredBook.toc[4].title": "On the Collusion of Jiang Zemin with the CCP to Persecute Falun Gong",
  "featuredBook.toc[5].index": "6",
  "featuredBook.toc[5].title": "On How the Chinese Communist Party Destroyed Traditional Culture",
  "featuredBook.toc[6].index": "7",
  "featuredBook.toc[6].title": "On the Chinese Communist Party's History of Killing",
  "featuredBook.toc[7].index": "8",
  "featuredBook.toc[7].title": "On How the Chinese Communist Party Is an Evil Cult",
  "featuredBook.toc[8].index": "9",
  "featuredBook.toc[8].title": "On the Unscrupulous Nature of the Chinese Communist Party",

  "otherWorksSection.eyebrow": "Other works",
  "otherWorksSection.title": "Companion volumes",
  "otherWorks[0].title": "Disintegrating the Party Culture",
  "otherWorks[0].body":
    "How Party culture entered the language, the schools, the way people think and ordinary life — and a clear-eyed account of setting it aside.",
  "otherWorks[0].imageAlt": "Cover of Disintegrating the Party Culture",
  "otherWorks[0].formats[0].label": "Read online",
  "otherWorks[0].formats[1].label": "E-book",
  "otherWorks[1].title": "How the Specter of Communism Is Ruling Our World",
  "otherWorks[1].body":
    "What communism is at root, and why it seems set against humanity at every turn. Includes the full text, reporting and scholarly commentary.",
  "otherWorks[1].imageAlt": "Cover of How the Specter of Communism Is Ruling Our World",
  "otherWorks[1].formats[0].label": "Read online",
  "otherWorks[2].title": "The Ultimate Goal of Communism",
  "otherWorks[2].body":
    "What is communism finally for, and where does that leave us? Full text and audio edition.",
  "otherWorks[2].imageAlt": "Cover of The Ultimate Goal of Communism",
  "otherWorks[2].formats[0].label": "Read online",
  "otherWorks[2].formats[3].label": "All editions",
  "otherWorks[3].title": "Ironclad Evidence (e-book)",
  "otherWorks[3].body":
    "An English-narrated teaching film setting out the evidence that the CCP has harvested organs from living Falun Gong practitioners. In lecture form, it presents the main findings of more than a decade of WOIPFG investigation, together with the background to each inquiry and its sources, and shows how the pieces fit together.\n\nIt covers investigations into five members of the CCP Politburo Standing Committee, a vice-chairman of the Central Military Commission, a defence minister, the head of the military's general logistics health department, and a large number of transplant surgeons, political and legal affairs officials, \"610 Office\" staff and courts.",
  "otherWorks[3].imageAlt": "Ironclad Evidence",
  "otherWorks[3].formats[0].label": "Download the film",
  "otherWorks[3].formats[1].label": "Read online",

  "reuseNotice.title": "Everything here is free to use",
  "reuseNotice.body":
    "Download it, print it, repost it, translate it, re-edit it. You do not need our permission and you do not need to tell us. Commercial use is not restricted either — only do not charge in our name or speak on our behalf. Please credit the source.",

  "relatedSection.eyebrow": "Further reading",
  "relatedSection.title": "Scholarly commentary and coverage",
  "relatedSection.lede": "Commentary, analysis and news coverage of the books above.",
  "relatedSection.moreLabel": "All related articles →"
};


/* ── 参与支持（/involve） ─────────────────────────────────────────── */

const INVOLVE_EN: Record<string, string | null> = {
  title: "Keep the service points open.",
  subtitle:
    "Recording a statement is free to everyone, and always will be. What costs money is the stalls, the printing, the systems and the security — run by a team with very few paid staff and a great many volunteers.",

  "donatePanel.eyebrow": "Donate",
  "donatePanel.title": "Give on our donations page",
  "donatePanel.body":
    "Donations are handled on our own donations page, monthly or one-off. We are a 501(c)(3) non-profit registered in the United States, so gifts are tax-deductible.",
  "donatePanel.buttonLabel": "Go to donations",
  "donatePanel.footnote": "Opens the donations page on www.tuidang.org in a new window.",

  "donateStats.items[0].value": "Still under attack",
  "donateStats.items[0].label": "Protection, bandwidth and servers all cost money",
  "donateStats.items[1].value": "Mostly volunteers",
  "donateStats.items[1].label": "The day-to-day work is unpaid",
  "donateStats.items[2].value": "Any amount helps",
  "donateStats.items[2].label": "Monthly or one-off, whichever suits you",
  "donateStats.items[3].label": "Tax-deductible",
  "donateStats.note":
    "Our accounts are audited by an independent firm, and our annual Form 990 is on the public record.",

  "useOfFunds.title": "Where your donation goes",
  "useOfFunds.items[0]": "Stalls and materials at service points",
  "useOfFunds.items[1]": "Printing boards, leaflets and booklets",
  "useOfFunds.items[2]": "The registry and issuing certificates",
  "useOfFunds.items[3]": "The website and its defences",
  "useOfFunds.items[4]": "Translation",

  "otherDonationWays.title": "Other ways to give",
  "otherDonationWays.links[0].label": "By cheque",
  "otherDonationWays.links[1].label": "Bank transfer",
  "otherDonationWays.links[2].label": "Employer matching",
  "otherDonationWays.links[3].label": "Legacy gifts",

  "volunteerBand.eyebrow": "Become a volunteer",
  "volunteerBand.title": "Most of this work is done by volunteers",
  "volunteerBand.lede":
    "You can help at a service point in your own city, or work online on translation, archiving and technical tasks. However much time you have is fine.",
  "volunteerBand.links[0].label": "Helping at a service point",
  "volunteerBand.links[1].label": "Translation (English, German, Korean, Japanese, Romanian)",
  "volunteerBand.links[2].label": "Video editing and subtitles",
  "volunteerBand.links[3].label": "Archiving and proofreading",
  "volunteerBand.links[4].label": "Technical and site maintenance",
  "volunteerBand.links[5].label": "Starting a service point in your city",
  "volunteerBand.moreLabel": "Sign up →",

  "endccpBlock.eyebrow": "The ENDCCP petition",
  "endccpBlock.title": "Add your name",
  "endccpBlock.body":
    "ENDCCP is a public petition open to people everywhere, telling governments and international bodies where they stand on the CCP's abuses of human rights. The text is public, and signatories choose whether their names appear.\n\nSince it began, the campaign has run events in many countries: car rallies across the United States, street signature drives and international conferences. Reports from each of them are in News & reports.",
  "endccpBlock.buttons[0].label": "Sign the petition",
  "endccpBlock.buttons[1].label": "Past campaigns",
  "endccpBlock.progressTitle": "Signatures so far",
  "endccpBlock.progressNote": "people have signed, across more than 90 countries and territories.",

  "actCards[0].title": "Make a statement",
  "actCards[0].body": "The most direct kind of support. Anonymous if you wish, and it takes minutes.",
  "actCards[1].title": "Download and hand out materials",
  "actCards[1].body": "Display boards, leaflets and audio-visual material, free to use.",
  "actCards[2].title": "Repost our reporting",
  "actCards[2].body": "No permission needed — just credit the source.",
  "actCards[3].title": "Tell one person",
  "actCards[3].body": "Send this site to someone who might need it.",

  "storiesHeading.eyebrow": "Volunteer stories",
  "storiesHeading.title": "The people at the service points",
  "storiesHeading.moreLabel": "All volunteer stories →"
};


/* ── 关于我们（/about） ───────────────────────────────────────────── */

/*
 * team.people 里只有第一位是真名（理事长汪志远，公开人物，英文作 Wang Zhiyuan），
 * 其余三位中文站写的就是「姓名占位」—— 照样留占位，不要编名字出来。
 */
const ABOUT_EN: Record<string, string | null> = {
  title: "Who we are, and how to check us.",
  subtitle:
    "The Global Service Center for Quitting the Chinese Communist Party was founded in 2005. It is a 501(c)(3) non-profit registered in the United States, with its head office in New York. We record statements withdrawing from the Party, the Youth League and the Young Pioneers and issue certificates; we document and publish evidence of human-rights abuses; and volunteers help people in person at more than a hundred service points worldwide.",

  "intro.eyebrow": "About us",
  "intro.paragraphs[0]":
    "In November 2004, after the Nine Commentaries on the Communist Party appeared, people in China began publicly declaring that they were leaving the Party, the Youth League and the Young Pioneers. The Global Service Center for Quitting the Chinese Communist Party was founded in New York in January 2005 so that those statements could be recorded in full, kept, and checked.",
  "intro.paragraphs[1]":
    "In twenty years we have recorded more than 460 million statements. People submit them themselves and may use their real name, another name or a handle; we ask for no identity documents and do not verify who the person is. What we undertake is to keep the exact wording and the time of every statement, and to make them publicly searchable.",
  "intro.principlesHeading": "Our principles",
  "intro.principles[0].label": "Voluntary.",
  "intro.principles[0].text":
    "Every statement is made and submitted by the person themselves. We do not make statements on anyone's behalf, and we do not accept statements submitted for someone else.",
  "intro.principles[1].label": "What is free, and what is not.",
  "intro.principles[1].text":
    "Recording a statement and verifying a certificate are free. A certificate is issued in your real name and carries a processing fee, collected only through official channels. We never take payment through a private account or an intermediary.",
  "intro.principles[2].label": "Protection.",
  "intro.principles[2].text":
    "You may remain entirely anonymous. We collect no personal information beyond the statement itself; our servers are in the United States, with encryption and access controls. See ",
  "intro.principles[2].linkLabel": "our privacy and data-protection notice",
  "intro.principles[3].label": "Openness.",
  "intro.principles[3].text":
    "How we count, our accounts, our governance and our annual work are all public. So are the threats and attacks directed at this organisation.",
  "intro.body":
    "In November 2004, after the Nine Commentaries on the Communist Party appeared, people in China began publicly declaring that they were leaving the Party, the Youth League and the Young Pioneers. The Global Service Center for Quitting the Chinese Communist Party was founded in New York in January 2005 so that those statements could be recorded in full, kept, and checked.\n\nIn twenty years we have recorded more than 460 million statements. People submit them themselves and may use their real name, another name or a handle; we ask for no identity documents and do not verify who the person is. What we undertake is to keep the exact wording and the time of every statement, and to make them publicly searchable.\n\n## Our principles\n\n**Voluntary.** Every statement is made and submitted by the person themselves. We do not make statements on anyone's behalf, and we do not accept statements submitted for someone else.\n\n**What is free, and what is not.** Recording a statement and verifying a certificate are free. A certificate is issued in your real name and carries a processing fee, collected only through official channels. We never take payment through a private account or an intermediary.\n\n**Protection.** You may remain entirely anonymous. We collect no personal information beyond the statement itself; our servers are in the United States, with encryption and access controls. See [our privacy and data-protection notice](/services/privacy).\n\n**Openness.** How we count, our accounts, our governance and our annual work are all public. So are the threats and attacks directed at this organisation.",
  "intro.sidebarTitle": "On this page",
  "intro.sidebarLinks[0].label": "Numbers and method",
  "intro.sidebarLinks[1].label": "Global network",
  "intro.sidebarLinks[2].label": "Board and team",
  "intro.sidebarLinks[3].label": "Milestones",
  "intro.downloadPanelTitle": "Download",
  "intro.downloadPanelBody":
    "A one-page profile in Chinese and English: how we began, what we do, our size and our principles. Free to repost.",
  "intro.downloadPanelButtonLabel": "Profile PDF (Chinese / English)",

  "numbersBand.eyebrow": "Numbers and method",
  "numbersBand.heading": "How this figure is counted",
  "numbersBand.lede":
    "We publish our method in full: what counts, how duplicates are removed, how often the figure updates, and what it cannot tell you. Anyone can judge from that what the number means and where its limits are.",
  "numbersBand.stats[0].label": "Statements recorded",
  "numbersBand.stats[1].label": "Added per day, on average",
  "numbersBand.stats[2].label": "The figure updates",
  "numbersBand.stats[2].value": "every 10 minutes",
  "numbersBand.stats[3].label": "Recording began",
  "numbersBand.actions[0].label": "The method in full",
  "numbersBand.actions[1].label": "Yearly figures and where they come from",

  "network.eyebrow": "Global network",
  "network.heading": "More than a hundred service points, kept running by volunteers",
  "network.lede":
    "Service points sit near tourist sites, community centres and transport hubs. Volunteers help people register on the spot, answer questions about certificates and immigration, and pass on statements made on paper.",
  "network.stats[0].label": "Service points worldwide",
  "network.stats[1].label": "Countries and territories",
  "network.stats[2].label": "Registered volunteers",
  "network.stats[3].label": "Cost of recording a statement",
  "network.moreLabel": "Find a service point →",

  "team.eyebrow": "Board and team",
  "team.heading": "The people responsible",
  "team.lede":
    "There are very few paid staff; most of the work is done by volunteers. Below are the board members and the people who lead each area.",
  "team.people[0].name": "Wang Zhiyuan",
  "team.people[0].roleLine1": "Chairman",
  "team.people[0].roleLine2": "since 2005",
  "team.people[1].name": "To be announced",
  "team.people[1].roleLine1": "Board member",
  "team.people[1].roleLine2": "Legal and compliance",
  "team.people[2].name": "To be announced",
  "team.people[2].roleLine1": "Board member",
  "team.people[2].roleLine2": "Finance",
  "team.people[3].name": "To be announced",
  "team.people[3].roleLine1": "Secretary General",
  "team.people[3].roleLine2": "Service-point network",

  "history.eyebrow": "Milestones",
  "history.heading": "2005 to today",
  "history.timeline[0].body":
    "The Nine Commentaries on the Communist Party are published, and people begin declaring publicly that they are leaving the Party's organisations.",
  "history.timeline[1].body":
    "The Global Service Center is founded in New York and begins recording and keeping statements systematically.",
  "history.timeline[2].body":
    "Statements pass 20 million; service points outside China begin to be set up in numbers.",
  "history.timeline[3].body":
    "Certificates of withdrawal are introduced, with online verification open to third parties.",
  "history.timeline[4].body": "Statements pass 350 million; the site launches in further languages.",
  "history.timeline[5].body":
    "Twenty years since the Nine Commentaries; statements pass 430 million.",
  "history.timeline[6].body":
    "Members of the United States Congress issue a joint statement commending the movement, entered into the Congressional Record.",
  "history.contactTitle": "Contact us",
  "history.contactLinks[0].label": "Press and interviews",
  "history.contactLinks[1].label": "Service points and volunteers",
  "history.contactLinks[2].label": "Questions about certificates",

  "accountability.eyebrow": "Openness and accountability",
  "accountability.heading": "Finances, governance and safety",
  "accountability.lede":
    "We are a 501(c)(3) non-profit registered in the United States, EIN 03-0581933, filing with the Internal Revenue Service as required. Form 990 is a public record by law: anyone can look it up on the IRS site by EIN, or read the same filing on ProPublica, Charity Navigator and other third-party sites. We do not republish those documents here — the reason is below.",
  "accountability.cells[0].title": "Registration and legal status",
  "accountability.cells[0].body":
    "A non-profit registered in the United States; donations are tax-deductible. EIN 03-0581933.",
  "accountability.cells[1].title": "Who we file with",
  "accountability.cells[1].value": "The IRS",
  "accountability.cells[1].body":
    "Form 990 is filed annually with the IRS and becomes a public record by law. Reading it does not go through us and does not need our consent.",
  "accountability.cells[2].title": "Safety and threats",
  "accountability.cells[2].value": "Public file",
  "accountability.cells[2].body":
    "This organisation has received bomb threats and other threatening letters on several occasions. Those incidents, the reports made and what followed are on the record.",
  "accountability.links[0].label": "IRS tax-exempt organisation search (by EIN 03-0581933)",
  "accountability.links[3].label": "How we count",
  "accountability.moreLabel": "Annual report →"
};


/* ── 理事会与团队（/about/team） ──────────────────────────────────── */

const ABOUT_TEAM_EN: Record<string, string | null> = {
  title: "The people responsible",
  subtitle:
    "There are very few paid staff; most of the work is done by volunteers. Below are the board members and the people who lead each area.",
  "boardPanel.eyebrow": "Board",
  "boardPanel.people[0].name": "Wang Zhiyuan",
  "boardPanel.people[0].roleLine1": "Chairman",
  "boardPanel.people[0].roleLine2": "since 2005",
  "boardPanel.people[1].name": "To be announced",
  "boardPanel.people[1].roleLine1": "Board member",
  "boardPanel.people[1].roleLine2": "Legal and compliance",
  "boardPanel.people[2].name": "To be announced",
  "boardPanel.people[2].roleLine1": "Board member",
  "boardPanel.people[2].roleLine2": "Finance",
  "boardPanel.people[3].name": "To be announced",
  "boardPanel.people[3].roleLine1": "Secretary General",
  "boardPanel.people[3].roleLine2": "Service-point network",
  "staffPanel.eyebrow": "Staff",
  "notePanel.heading": "About names and photographs",
  "notePanel.body":
    "Naming an organisation's leadership is normal practice for international NGOs, and it is part of what we promise on this site. But some colleagues, and their families in mainland China, could be put at risk by it. A few people are therefore listed by role rather than by name, and we say so here rather than leave it unexplained.",
  "joinPanel.title": "Join us",
  "joinPanel.body": "Most of this work is done by volunteers. However much time you have is fine.",
  "joinPanel.buttonLabel": "Become a volunteer",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Milestones",
  "relatedPanel.links[1].label": "Contact us"
};

/* ── 退党大事记（/about/history） ─────────────────────────────────── */

const ABOUT_HISTORY_EN: Record<string, string | null> = {
  title: "2005 to today",
  subtitle:
    "From the first public statements after the Nine Commentaries appeared, to the more than 460 million recorded today.",
  "timeline[0].body":
    "The Nine Commentaries on the Communist Party are published, and people begin declaring publicly that they are leaving the Party's organisations.",
  "timeline[1].body":
    "The Global Service Center is founded in New York and begins recording and keeping statements systematically.",
  "timeline[2].body":
    "The first Global Quit-the-CCP Month is held in July; it has run every year since.",
  "timeline[3].body":
    "Statements pass 20 million; service points outside China begin to be set up in numbers.",
  "timeline[4].body":
    "Certificates of withdrawal are introduced, with online verification open to third parties.",
  "timeline[5].body": "The End CCP petition is launched worldwide.",
  "timeline[6].body": "Statements pass 350 million; the site launches in further languages.",
  "timeline[7].body": "The End CCP motorcade travels through all fifty US states.",
  "timeline[8].body": "Twenty years since the Nine Commentaries; statements pass 430 million.",
  "timeline[9].body":
    "The centre receives several letters threatening bomb attacks. These were reported to the police and are on the public record.",
  "timeline[10].body":
    "Members of the United States Congress issue a joint statement commending the movement, entered into the Congressional Record; 31 people receive their certificates of withdrawal on Capitol Hill.",
  "relatedLinks[0].label": "Figures by year",
  "relatedLinks[1].label": "Announcements and statements",
  "relatedLinks[2].label": "Nine Commentaries, full text"
};

/* ── 真相点资料下载（/resources/downloads） ──────────────────────── */

const RESOURCES_DOWNLOADS_EN: Record<string, string | null> = {
  title: "Materials to download",
  subtitle:
    "Display boards, leaflets, placards, audio and photographs. Editable source files and print-resolution finals, free to use, with no permission needed.",

  "downloadCards[0].title": "Display boards and banners",
  "downloadCards[0].body":
    "Large-format material for service points and rallies. AI and PSD source files plus print-resolution finals, CMYK, with fonts embedded and outlined versions included.",
  "downloadCards[0].foot": "216 items · source files and finals",
  "downloadCards[0].items[0].label": "Withdrawal boards",
  "downloadCards[0].items[0].meta": "86 items",
  "downloadCards[0].items[1].label": "Persecution boards",
  "downloadCards[0].items[1].meta": "64 items",
  "downloadCards[0].items[2].label": "Banners and backdrops",
  "downloadCards[0].items[2].meta": "42 items",
  "downloadCards[0].items[3].label": "End CCP petition material",
  "downloadCards[0].items[3].meta": "24 items",

  "downloadCards[1].title": "Leaflets and booklets",
  "downloadCards[1].body":
    "A4, A5 and tri-fold, suited to handing out at service points and to posting. Most are already available in English, German, Korean, Japanese and Romanian.",
  "downloadCards[1].foot": "184 items · PDF and source files",
  "downloadCards[1].items[0].label": "Introductory leaflets",
  "downloadCards[1].items[0].meta": "38 items",
  "downloadCards[1].items[1].label": "About the certificate",
  "downloadCards[1].items[1].meta": "16 items",
  "downloadCards[1].items[2].label": "Nine Commentaries readers",
  "downloadCards[1].items[2].meta": "22 items",
  "downloadCards[1].items[3].label": "Other languages",
  "downloadCards[1].items[3].meta": "108 items",

  "downloadCards[2].title": "Placards and stickers",
  "downloadCards[2].body":
    "Kits for rallies, marches and signature drives. Bilingual versions and blank templates you can fill in with local details.",
  "downloadCards[2].foot": "62 items · print-ready",
  "downloadCards[2].items[0].label": "Rally placards",
  "downloadCards[2].items[0].meta": "34 items",
  "downloadCards[2].items[1].label": "Signature-table material",
  "downloadCards[2].items[1].meta": "18 items",
  "downloadCards[2].items[2].label": "Stickers and badges",
  "downloadCards[2].items[2].meta": "10 items",

  "downloadCards[3].title": "Broadcasts and audio",
  "downloadCards[3].body":
    "Audio programmes and scripts, for radio, online sharing and playing on site. Includes the audio edition of the Nine Commentaries and the Voices of Tuidang series.",
  "downloadCards[3].foot": "audio and scripts",
  "downloadCards[3].items[0].label": "Voices of Tuidang series",
  "downloadCards[3].items[1].label": "Nine Commentaries, audio edition",
  "downloadCards[3].items[2].label": "Broadcast scripts",
  "downloadCards[3].items[2].meta": "editable",

  "assetsSection.eyebrow": "Other material",
  "assetsSection.title": "Photographs, forms and the logo",
  "assets[0].title": "Photo library",
  "assets[0].badge": "Flickr album",
  "assets[0].body":
    "Photographs from events, service points and certificate presentations over the years, at high resolution and free to use.",
  "assets[1].title": "Paper registration form",
  "assets[1].badge": "PDF · for volunteers",
  "assets[1].body": "The paper form volunteers use on site, for people who cannot submit online.",
  "assets[2].title": "Logo and typeface",
  "assets[2].badge": "Brand guide",
  "assets[2].body": "Our logo, colours and how to use them.",
  "assets[3].title": "Other languages",
  "assets[3].badge": "6 languages",
  "assets[3].body": "Material in English, German, Korean, Japanese and Romanian, gathered in one place.",

  "proseSections[0].heading": "Printing notes",
  "proseSections[0].body":
    "Board artwork is set up for CMYK output, with fonts embedded in the source files. If the Source Han typeface is not available where you are, use the outlined version supplied — otherwise a font substitution on opening will shift the layout.",
  "proseSections[1].heading": "If you print and hand these out locally",
  "proseSections[1].body":
    "Do send us photographs. We will add them to the photo library and show them to other service points — a lot of good practice travels that way.",
  "proseSections[2].heading": "Printing in quantity",
  "proseSections[2].body":
    "Service points can help with bulk printing and delivery. Write to us with the quantity, the language and what it is for.",

  "assistPanel.title": "Need a hand?",
  "assistPanel.body":
    "Service points can help with bulk printing and delivery, and can advise on adapting material locally.",
  "assistPanel.buttonLabel": "Contact us",

  "reuseNotice.title": "Everything here is free to use",
  "reuseNotice.body":
    "Download it, print it, repost it, translate it, re-edit it. You do not need our permission and you do not need to tell us. Commercial use is not restricted either — only do not charge in our name or speak on our behalf. Please credit the source.",

  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Find a service point",
  "relatedPanel.links[1].label": "Become a volunteer",
  "relatedPanel.links[2].label": "Uncensored access",
  "relatedPanel.links[3].label": "Press and media"
};


/* ── 三退问答（/services/faq） ────────────────────────────────────── */

const SERVICES_FAQ_EN: Record<string, string | null> = {
  title: "Questions and answers",
  subtitle:
    "Common questions about statements, certificates and safety. If yours is not here, write to us.",
  "filters[0]": "All",
  "filters[1]": "Statements",
  "filters[2]": "Certificates",
  "filters[3]": "Safety and privacy",
  "filters[4]": "Immigration",
  "faqs[0].question": "What does withdrawing mean?",
  "faqs[0].answer":
    "It means publicly declaring that you are leaving the three organisations: the Communist Party, the Youth League and the Young Pioneers.",
  "faqs[1].question": "Is a statement valid under a pen name or a handle?",
  "faqs[1].answer": "Yes. What matters is that the person has said it publicly.",
  "faqs[2].question": "Is there a charge for a certificate?",
  "faqs[2].answer":
    "Making a statement is free. A certificate is issued in your real name and carries a processing fee; the amount and the steps are set out on the official application page.",
  "fullFaqPanel.title": "The full set",
  "fullFaqPanel.note": "Maintained on tuidang.org, which is the authoritative version.",
  "fullFaqPanel.links[0].label": "What does withdrawing mean?",
  "fullFaqPanel.links[1].label": "Why withdraw?",
  "fullFaqPanel.links[2].label": "How do I withdraw?",
  "fullFaqPanel.links[3].label": "If I stopped paying dues years ago, have I already left?",
  "fullFaqPanel.links[4].label": "What is a certificate of withdrawal?",
  "fullFaqPanel.links[5].label": "How do I apply for one?",
  "fullFaqPanel.links[6].label": "How is a certificate verified?",
  "fullFaqPanel.links[7].label": "All questions →",
  "linksPanel.title": "Still have a question",
  "linksPanel.links[0].label": "Safety and privacy",
  "linksPanel.links[1].label": "Immigration policy",
  "linksPanel.links[2].label": "Find a service point",
  "linksPanel.links[3].label": "Contact us",
  "readyPanel.title": "Ready?",
  "readyPanel.body":
    "A statement takes about three minutes, can be entirely anonymous, and is free.",
  "readyPanel.buttonLabel": "Make a statement",
  "readyPanel.buttonStamp": "Quit"
};

/* ── 成为义工（/involve/volunteer） ──────────────────────────────── */

const INVOLVE_VOLUNTEER_EN: Record<string, string | null> = {
  title: "Most of this work is done by volunteers",
  subtitle:
    "You can help at a service point in your own city, or work online on translation, editing and archiving. However much time you have is fine — there is no minimum.",

  "roles[0].title": "Helping at a service point",
  "roles[0].tag": "in person",
  "roles[0].body": "Staff a service point in your city, helping people register and answering questions.",
  "roles[1].title": "Translation",
  "roles[1].tag": "remote",
  "roles[1].body": "English, German, Korean, Japanese, Romanian. Articles, subtitles and materials.",
  "roles[2].title": "Video editing and subtitles",
  "roles[2].tag": "remote",
  "roles[2].body": "Editing footage, making subtitles and encoding.",
  "roles[3].title": "Archiving and proofreading",
  "roles[3].tag": "remote",
  "roles[3].body": "Entering paper statements, organising the archive and proofreading.",
  "roles[4].title": "Technical and site maintenance",
  "roles[4].tag": "remote",
  "roles[4].body": "Front end, back end, security and operations.",
  "roles[5].title": "Starting a service point in your city",
  "roles[5].tag": "in person",
  "roles[5].body": "We provide the materials, the training and remote support.",

  "signupForm.eyebrow": "Sign up",
  "signupForm.categoryLabel": "What would you like to help with?",
  "signupForm.categoryOptions[0]": "In person",
  "signupForm.categoryOptions[1]": "Translation",
  "signupForm.categoryOptions[2]": "Video and audio",
  "signupForm.categoryOptions[3]": "Writing and archiving",
  "signupForm.categoryOptions[4]": "Technical",
  "signupForm.categoryOptions[5]": "Not sure yet",
  "signupForm.cityLabel": "Your city",
  "signupForm.cityPlaceholder": "for example: Toronto",
  "signupForm.timeLabel": "Roughly how much time",
  "signupForm.timePlaceholder": "for example: half a day at weekends",
  "signupForm.timeHint": "There is no minimum. An hour a week is welcome.",
  "signupForm.contactLabel": "How to reach you",
  "signupForm.contactPlaceholder": "email, or any other way",
  "signupForm.contactHint":
    "Used only to contact you about volunteering. Nothing else, and never passed to anyone outside.",
  "signupForm.submitLabel": "Send",

  "storiesPanel.title": "What volunteers actually do",
  "storiesPanel.body": "A few accounts from the service points say it better than any description.",
  "storiesPanel.buttonLabel": "Volunteer stories",

  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Find a service point",
  "relatedPanel.links[1].label": "Download boards and leaflets",
  "relatedPanel.links[2].label": "Uncensored access",
  "relatedPanel.links[3].label": "Contact us"
};


/* ── 退党证书（/services/cert） ──────────────────────────────────── */

const SERVICES_CERT_EN: Record<string, string | null> = {
  title: "Certificate of withdrawal",
  subtitle:
    "A written record in Chinese and English, issued by this centre, with a unique number and open online verification. Issued in your real name; you complete a short training course and test, and there is a processing fee.",

  "introSections[0].heading": "What the certificate is",
  "introSections[0].body":
    "A document in Chinese and English, giving the holder's name, the organisations left, the date of the statement and the certificate number, issued and sealed by this centre.",
  "introSections[1].heading": "What you need first",
  "introSections[1].body":
    "You need to have made a statement. If you made one some time ago, you can apply for a replacement using the details you gave then.",
  "introSections[2].heading": "How it works, and how long it takes",
  "introSections[2].body":
    "You watch a training video (about an hour) and pass a short test. After that the certificate is issued as a PDF, which you can print yourself.",
  "introSections[3].heading": "Why to apply early if you are leaving China",
  "introSections[3].body":
    "A number of countries ask about party membership during visa and residency checks. If you have in fact left, having the document already is easier than arranging it under time pressure.",
  "intro.body":
    "## What the certificate is\n\nA document in Chinese and English, giving the holder's name, the organisations left, the date of the statement and the certificate number, issued and sealed by this centre.\n\n## What you need first\n\nYou need to have made a statement. If you made one some time ago, you can apply for a replacement using the details you gave then.\n\n## How it works, and how long it takes\n\nYou watch a training video (about an hour) and pass a short test. After that the certificate is issued as a PDF, which you can print yourself.\n\n## Why to apply early if you are leaving China\n\nA number of countries ask about party membership during visa and residency checks. If you have in fact left, having the document already is easier than arranging it under time pressure.\n\nEvery certificate carries a unique number, and anyone — any institution or individual — can [verify it online](/services/verify) without contacting us and without authorisation.",

  "steps[0]": "1 Make a statement",
  "steps[1]": "2 Apply",
  "steps[2]": "3 Take the test",
  "steps[3]": "4 Receive the certificate",

  "ctaActions[0].label": "Apply for a certificate",
  "ctaActions[0].stamp": "Quit",
  "ctaActions[1].label": "Read the common questions first",

  "noticePanel.title": "Before you apply",
  "noticePanel.body":
    "The certificate is issued by this centre. It is not a government document, and it is no guarantee of the outcome of any immigration or residency application. Whether and how it is taken into account is for the receiving institution to decide. It is issued in your real name, you must apply yourself, you complete a training course and test, and there is a processing fee; making a statement itself is always free. Apply only through our official channels — this site or Gan Jing World. Anyone else offering to apply on your behalf, to speed it up or to guarantee the result has nothing to do with us.",

  "samplePanel.title": "Sample certificate",
  "samplePanel.alt": "Sample certificate of withdrawal",
  "samplePanel.caption": "Chinese and English, with a unique number and how to verify it.",

  "applyActions.items[0].label": "Apply on this site",
  "applyActions.items[0].stamp": "Quit",
  "applyActions.items[1].label": "Apply via Gan Jing World",
  "applyActions.items[2].label": "Read the common questions first",
  "applyActions.destinationNote":
    "The application opens service.tuidang.org or Gan Jing World in a new window. It looks different from this site; that is normal.",

  "readyPanel.title": "Not made a statement yet?",
  "readyPanel.body":
    "A certificate follows from a statement. Making one takes about three minutes and can be entirely anonymous.",
  "readyPanel.buttonLabel": "Make a statement first",
  "readyPanel.buttonStamp": "Quit",

  "relatedPanel.title": "Related questions",
  "relatedPanel.links[0].label": "What is a certificate of withdrawal?",
  "relatedPanel.links[1].label": "How do I apply for one?",
  "relatedPanel.links[2].label": "Why apply early if you are leaving China?",
  "relatedPanel.links[3].label": "How is a certificate verified?",
  "relatedPanel.links[4].label": "Is withdrawing safe?"
};

/* ── 声明三退（/services/declare） ───────────────────────────────── */

const SERVICES_DECLARE_EN: Record<string, string | null> = {
  title: "Declare your withdrawal from the Party, the League and the Pioneers",
  subtitle:
    "You write and submit this statement yourself. We keep the exact wording and the time it was submitted, and make it publicly searchable. It is free, needs no account, and can be entirely anonymous.",

  "handoff.eyebrow": "Submit online",
  "handoff.heading": "Submit your statement on the Tuidang site",
  "handoff.body":
    "Statements are received and publicly archived by the centre's Tuidang site. It is free throughout, needs no account, and you may use any name you choose.",
  "handoff.actions[0].label": "Go and submit a statement",
  "handoff.actions[0].stamp": "Quit",
  "handoff.actions[1].label": "Check on my statement",
  "handoff.actions[1].note":
    "Use the lookup password you were given when you submitted. It is not the same as a certificate number.",
  "handoff.destinationNote":
    "The link opens santui.tuidang.org in a new window. That is the statements site run by this centre; it looks different from this one, and that is normal.",

  "safetyNotice.title": "About your safety",
  "safetyNotice.body":
    "You do not need to give your real name, any identity document or any contact details. If you are in mainland China, read about safe access first. [Uncensored access](/resources/tools), and clear your browsing history afterwards. [Read the full privacy and safety notice](/services/privacy)",
  "safetyNotice.toolsLabel": "Uncensored access",
  "safetyNotice.middleText": ", and clear your browsing history afterwards.",
  "safetyNotice.privacyLabel": "Read the full privacy and safety notice",

  "todayPanel.title": "Today",
  "todayPanel.body": "people have submitted a statement today.",

  "offlinePanel.title": "If the link above will not open",
  "offlinePanel.intro": "You can also submit a statement these ways.",
  "offlinePanel.hotlineLabel": "Telephone",
  "offlinePanel.emailLabel": "Email",
  "offlinePanel.hotlines[0].region": "United States",
  "offlinePanel.hotlines[1].region": "Canada",
  "offlinePanel.hotlines[2].region": "Taiwan",
  "offlinePanel.hotlines[3].region": "Hong Kong",
  "offlinePanel.hotlines[4].region": "Japan",
  "offlinePanel.hotlines[5].region": "South Korea",

  "otherWaysPanel.title": "Other ways",
  "otherWaysPanel.links[0].label": "In person at a service point",
  "otherWaysPanel.links[1].label": "By telephone",
  "otherWaysPanel.links[2].label": "By email",

  "readyPanel.title": "Not sure yet?",
  "readyPanel.links[0].label": "What does withdrawing mean?",
  "readyPanel.links[1].label": "Why withdraw?",
  "readyPanel.links[2].label": "If I stopped paying dues years ago, have I already left?",
  "readyPanel.links[3].label": "Is a statement valid under a pen name?",
  "readyPanel.links[4].label": "Safety and privacy"
};


/* ── 中华传统文化（/resources/culture） ─────────────────────────── */

/* items 是十篇具体的中文文章，连 slug 都是中文，英文站一篇都没有 —— 清空。 */
const RESOURCES_CULTURE_EN: Record<string, string | null> = {
  title: "Chinese traditional culture",
  subtitle:
    "Traditional stories, historical figures, poetry and longer essays. Includes everything from the former Culture, Chinese Culture and Selected Traditional Stories sections, free to repost and to read aloud.",
  "filters[0]": "All",
  "filters[1]": "Traditional stories",
  "filters[2]": "Historical figures",
  "filters[3]": "Poetry",
  "filters[4]": "Seasons and customs",
  "filters[5]": "Words of kindness",
  "pager[5]": "Next →",
  "categoryPanel.title": "Categories",
  "categoryPanel.links[0].label": "Selected traditional stories",
  "categoryPanel.links[1].label": "Chinese culture",
  "categoryPanel.links[2].label": "Historical figures",
  "categoryPanel.links[3].label": "Poetry",
  "categoryPanel.links[4].label": "Words of kindness",
  "freeUsePanel.title": "Free to use",
  "freeUsePanel.body":
    "Every article may be downloaded, reposted, translated and read aloud — useful for cards, broadcast scripts and display boards.",
  "freeUsePanel.buttonLabel": "Downloads",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Disintegrating the Party Culture",
  "relatedPanel.links[1].label": "The Return magazine"
};


/* ── 数字与统计方法（/about/numbers） ───────────────────────────── */

const ABOUT_NUMBERS_EN: Record<string, string | null> = {
  title: "How this figure is counted",
  subtitle:
    "We publish our method in full: what counts, how duplicates are removed, how often the figure updates, and what it cannot tell you. Anyone can judge from that what the number means and where its limits are.",
  "stats[0].label": "Statements recorded",
  "stats[1].label": "Added per day, on average",
  "stats[2].label": "Updates",
  "stats[2].value": "every 10 minutes",
  "stats[3].label": "Recording began",
  "actions[0].label": "Download the yearly figures (CSV)",

  "sections[0].heading": "What counts",
  "sections[0].paragraphs[0]":
    "Each statement submitted publicly counts as one record. Where a single statement names several people — a family declaring together, for instance — it counts as the number of people named.",
  "sections[0].paragraphs[1]":
    "Statements may be submitted through the website, at a service point, by telephone or email, or passed on by a volunteer. All of them use the same numbering; none is counted separately.",
  "sections[1].heading": "How duplicates are removed",
  "sections[1].paragraphs[0]":
    "Identical statements submitted under the same name within a short period are merged into one. But because we ask for no identity documents, we cannot rule out one person making several statements under different names. That is a known limit of this figure, and we do not hide it.",
  "sections[2].heading": "How often it updates",
  "sections[2].paragraphs[0]":
    "The counter on the home page syncs with the register every ten minutes. It shows the running total of records, not an estimate.",
  "sections[3].heading": "What the figure does not mean",
  "sections[3].paragraphs[0]":
    "It is not a count of people who oppose the CCP, and it is not any kind of opinion poll. It means one thing: this many statements have been submitted, recorded and kept.",
  "sections[3].paragraphs[1]": "Being clear about the limits matters more to us than making the number sound bigger.",
  "sections[4].heading": "Getting the data",
  "sections[4].paragraphs[0]":
    "Figures by year, month-on-month change and regional breakdown are in the annual report, free to download and cite. Researchers who need finer data are welcome to write to us.",

  "citationPanel.label": "For the press",
  "citationPanel.title": "Citing this",
  "citationPanel.body":
    "Yes, cite it freely. Please give the source and the date you took the figure, since it changes daily.",
  "relatedLinks[0].label": "Global network",
  "relatedLinks[1].label": "Annual report (PDF)",
  "relatedLinks[2].label": "Research enquiries"
};

/* ── 全球网络（/about/network） ─────────────────────────────────── */

const ABOUT_NETWORK_EN: Record<string, string | null> = {
  title: "More than a hundred service points, kept running by volunteers",
  subtitle:
    "Service points sit near tourist sites, community centres and transport hubs. Volunteers help people register on the spot, answer questions about certificates and immigration, and pass on statements made on paper.",
  "stats[0].label": "Service points worldwide",
  "stats[1].label": "Countries and territories",
  "stats[2].label": "Registered volunteers",
  "stats[3].label": "Cost of recording a statement",
  "filters[0]": "All",
  "filters[1]": "North America",
  "filters[2]": "Europe",
  "filters[3]": "Asia-Pacific",
  "filters[4]": "Oceania",
  "pager[3]": "Next →",

  "mapBlock.label": "Map",
  "mapBlock.text":
    "An interactive map goes here. Selecting a service point shows its address, opening hours and how to get in touch. Whether street-level locations are published is decided case by case, on safety grounds.",

  "locations[0].title": "New York · Flushing",
  "locations[0].tag": "North America",
  "locations[0].meta": "daily, 10:00–18:00",
  "locations[0].body":
    "Around Main Street and Roosevelt Avenue, staffed by volunteers every day. You can make a statement, apply for a certificate and collect one here.",
  "locations[1].title": "Taipei · Taipei Main Station",
  "locations[1].tag": "Asia-Pacific",
  "locations[1].meta": "daily, 11:00–19:00",
  "locations[1].body":
    "On the station forecourt, running for more than ten years. Help with registering on the spot and with questions about certificates.",
  "locations[2].title": "South Korea · Jeju",
  "locations[2].tag": "Asia-Pacific",
  "locations[2].meta": "follows the cruise timetable",
  "locations[2].body":
    "Volunteers take turns at the harbour, the duty-free shops and the main sights, mainly meeting cruise passengers.",
  "locations[3].title": "London · Chinatown",
  "locations[3].tag": "Europe",
  "locations[3].meta": "Saturdays and Sundays, 12:00–18:00",
  "locations[3].body": "A weekend stall in Chinatown, with help available in Chinese and English.",

  "offeringsPanel.title": "What a service point can do",
  "offeringsPanel.items[0]": "Record a statement on the spot",
  "offeringsPanel.items[1]": "Apply for and collect a certificate",
  "offeringsPanel.items[2]": "Questions about certificates and immigration",
  "offeringsPanel.items[3]": "Pass on a statement made on paper",
  "offeringsPanel.items[4]": "Pick up materials",

  "setupPanel.title": "Starting one in your city",
  "setupPanel.links[0].label": "Become a volunteer",
  "setupPanel.links[1].label": "Download boards and leaflets",
  "setupPanel.links[2].label": "Contact us",

  "ctaPanel.title": "No service point near you?",
  "ctaPanel.body":
    "You can make a statement online, or by telephone or email. All of them carry the same weight.",
  "ctaPanel.buttonLabel": "Make a statement online"
};

/* ── ENDCCP 征签（/involve/endccp） ─────────────────────────────── */

const INVOLVE_ENDCCP_EN: Record<string, string | null> = {
  title: "The End CCP petition",
  subtitle:
    "A public petition open to people everywhere, telling governments and international bodies where they stand on the CCP's abuses of human rights.",
  "intro.body":
    "## What the petition says\n\nThe petition asks governments to confront the CCP's treatment of people of faith, dissidents and ethnic minorities, and to act against those responsible for the persecution. The full text is public; please read it before you sign.\n\n## How to sign\n\nYou can sign online, or on paper at a service point or at an event. Signatories choose whether their name is shown — if you choose not to, we count you in the total and display nothing.",
  "stats[0].label": "Signatures",
  "stats[1].label": "Countries and territories",
  "stats[2].label": "Added per year, on average",
  "stats[2].value": "1 million+",
  "stats[3].label": "Launched",
  "actions.title": "Past campaigns",
  "signPanel.title": "Add your name",
  "signPanel.body": "Please read the full text before signing. You may sign anonymously.",
  "signPanel.buttonLabel": "Go and sign",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Full text of the petition",
  "relatedPanel.links[1].label": "Announcements and statements",
  "relatedPanel.links[1].href": "/news/tuidang-statements",
  "relatedPanel.links[2].label": "Collecting signatures in person",
  "relatedPanel.links[3].label": "Petition materials to download"
};

/* ── 义工故事（/involve/stories） ──────────────────────────────── */

const INVOLVE_STORIES_EN: Record<string, string | null> = {
  title: "The people at the service points",
  subtitle:
    "Reports from the ground, volunteers in their own words, and longer pieces followed over time. Includes everything from the former Tuidang Volunteers and Volunteer Profiles sections.",
  "joinPanel.title": "You can join them",
  "joinPanel.body": "However much time you have is fine — in your own city, or online.",
  "joinPanel.buttonLabel": "Become a volunteer",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Global network",
  "relatedPanel.links[1].label": "Volunteer films",
  "relatedPanel.links[2].label": "Tuidang news and stories"
};


/* ── 公开与问责（/about/accountability） ───────────────────────── */

const ABOUT_ACCOUNTABILITY_EN: Record<string, string | null> = {
  title: "How to check us",
  subtitle:
    "We are a 501(c)(3) non-profit registered in the United States, EIN 03-0581933, filing with the Internal Revenue Service as required. Form 990 is a public record by law: anyone can look it up on the IRS site by EIN, or read the same filing on ProPublica, Charity Navigator and other third-party sites. We do not republish those documents here — the reason is below.",

  "summaryCells[0].title": "Registration and legal status",
  "summaryCells[0].body":
    "A non-profit registered in the United States; donations are tax-deductible. EIN 03-0581933.",
  "summaryCells[1].title": "Who we file with",
  "summaryCells[1].value": "The IRS",
  "summaryCells[1].body":
    "Form 990 is filed annually with the IRS and becomes a public record by law. Reading it does not go through us and does not need our consent.",
  "summaryCells[2].title": "Safety and threats",
  "summaryCells[2].value": "Public file",
  "summaryCells[2].body":
    "This organisation has received bomb threats and other threatening letters on several occasions. Those incidents, the reports made and what followed are on the record.",
  "summaryLinks[0].label": "IRS tax-exempt organisation search (by EIN 03-0581933)",
  "summaryLinks[3].label": "How we count",

  "proseSections[0].heading": "Why there are no documents to download here",
  "proseSections[0].paragraphs[0]":
    "We do prepare and keep full accounts and annual reports. We do not publish them together on this site, and the reason is the people in them: documents like these name staff, volunteers and donors and show who dealt with whom, and many of those people have family in mainland China. Cross-border pressure on Chinese people abroad is a long-standing fact, and gathering all of this on one site would simply save the other side the work.",
  "proseSections[0].paragraphs[1]":
    "That is not the same as not being open. Under United States law the Form 990 of a 501(c)(3) is itself a public record: it sits with the IRS, is published by the IRS, does not pass through our hands and is not ours to control — which makes it easier to check, and harder to dispute, than a PDF we posted ourselves. The link above goes to the official search.",
  "proseSections[0].paragraphs[2]":
    "Funders, auditors, government bodies and anyone else with a proper reason can ask for the full annual report or accounts through Contact us, and we will provide them through the usual process.",
  "proseSections[1].heading": "Governance",
  "proseSections[1].paragraphs[0]":
    "The board is the highest decision-making body; its members, their responsibilities and their terms are public. There are very few paid staff, and most of the work is done by volunteers.",
  "proseSections[2].heading": "Security incidents",
  "proseSections[2].paragraphs[0]":
    "Since 2025 the centre has received several letters threatening bomb attacks, and extortion letters, all reported to law enforcement. We have chosen to put these on the public record — what the letters said, how they were reported and what has happened since.",
  "proseSections[2].paragraphs[1]":
    "An organisation that records the attacks on itself is easier to check than one that only shows its achievements.",
  "proseSections[3].heading": "Privacy and data",
  "proseSections[3].paragraphs[0]":
    "We collect no personal information beyond the statement itself and ask for no identity documents. Our servers are in the United States, with encryption and access controls. See our privacy and data-protection notice.",

  "downloadsPanel.title": "Check through official channels",
  "downloadsPanel.links[0].label": "IRS tax-exempt organisation search (by EIN 03-0581933)",
  "downloadsPanel.links[3].label": "How we count",
  "downloadsPanel.links[4].label": "Privacy and data protection",
  "thirdPartyPanel.title": "Third-party records",
  "thirdPartyPanel.links[2].label": "IRS tax-exempt organisation search"
};

/* ── 其他支持方式（/involve/other-ways） ───────────────────────── */

const INVOLVE_OTHER_WAYS_EN: Record<string, string | null> = {
  title: "Ways to help that cost nothing",
  subtitle:
    "Beyond donating and volunteering, a few other things help just as much — and some of them cost no money and not much time.",
  "intro.body":
    "## Employer matching\n\nMany employers run matching-gift schemes, which may match your donation or even double it. We are a 501(c)(3) registered in the United States and meet the requirements of most such schemes.\n\n## Cheques and bank transfers\n\nIf paying online is difficult, you can post a cheque to our New York office or send a bank transfer. Write to us for the account details — and do not trust account details from any other source.\n\n## Legacy gifts\n\nIf you are considering including the centre in a will or trust, write to us and we will provide the legal information you need.\n\n## Professional skills\n\nHelp with law, accountancy, security, translation and design is often worth more to us than the same amount in money.",
  "actCards[0].title": "Make a statement",
  "actCards[0].body": "The most direct way. Anonymous if you wish, and it takes minutes.",
  "actCards[1].title": "Download and hand out materials",
  "actCards[1].body": "Display boards, leaflets and audio-visual material, free to print and use.",
  "actCards[2].title": "Repost our reporting",
  "actCards[2].body": "No permission needed in advance — just credit the source.",
  "actCards[3].title": "Pass on a way around the firewall",
  "actCards[3].body": "For people inside China, often all that is missing is an address that will open.",
  "donatePanel.title": "Donate",
  "donatePanel.body": "US$20 a month keeps a service point running for about a week.",
  "donatePanel.buttonLabel": "Donate",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Become a volunteer",
  "relatedPanel.links[1].label": "Contact us"
};

/* ── 安全与隐私说明（/services/privacy） ───────────────────────── */

const SERVICES_PRIVACY_EN: Record<string, string | null> = {
  title: "Safety and privacy",
  subtitle:
    "You do not need to provide any identity document, and you may remain entirely anonymous. This page sets out what we collect, what we do not, where the data is held, and where the risk actually lies.",
  "intro.body":
    "## What we do not collect\n\nNo real name, no identity document, no address and no other information that could identify you.\n\n## What we do collect\n\nOnly the name you sign with, a region if you choose to give one, the text of the statement, and the time it was submitted.\n\n## Where the risk actually lies\n\nThe risk is usually in the network connection and in traces left on your own device, rather than in the form itself.",
  "sections[0].heading": "What we do not collect",
  "sections[0].body":
    "No real name, no identity document, no address and no other information that could identify you.",
  "sections[1].heading": "What we do collect",
  "sections[1].body":
    "Only the name you sign with, a region if you choose to give one, the text of the statement, and the time it was submitted.",
  "sections[2].heading": "Where the risk actually lies",
  "sections[2].body":
    "The risk is usually in the network connection and in traces left on your own device, rather than in the form itself.",
  "alertPanel.title": "The most important thing first",
  "alertPanel.body":
    "No website or tool can promise complete safety. We set out what we do and where the limits are, and leave the judgement to you.",
  "highlightsPanel.title": "In short",
  "highlightsPanel.items[0]": "No identity document needed",
  "highlightsPanel.items[1]": "You may be entirely anonymous",
  "highlightsPanel.items[2]": "Data is never sold or passed on",
  "highlightsPanel.items[3]": "No advertising trackers",
  "toolsPanel.title": "Reaching us from a restricted network",
  "toolsPanel.body":
    "If you are somewhere the network is controlled, read about safe access before deciding how to reach this site.",
  "toolsPanel.buttonLabel": "Uncensored access",
  "linksPanel.title": "Related",
  "linksPanel.links[0].label": "Is withdrawing safe?",
  "linksPanel.links[1].label": "Make a statement online",
  "linksPanel.links[2].label": "Change your details"
};


/* ── 查验证明（/services/verify） ──────────────────────────────── */

const SERVICES_VERIFY_EN: Record<string, string | null> = {
  title: "Verify a certificate of withdrawal",
  subtitle:
    "Enter the certificate number to see the date it was issued and its status. The service is open to everyone: an institution can check for itself without contacting us.",
  "intro.body":
    "## What a result means\n\n**Valid.** The number was issued by this centre, the record exists, and the certificate has not been cancelled.\n\n**No such number.** The number is not among those issued. It may have been mistyped, or it may not have come from this centre.\n\n**Cancelled.** The number was issued but has since been cancelled, for instance because details were corrected or the certificate was reissued.\n\n## What verification checks\n\nVerification confirms that this centre did issue the certificate. It does not confirm the identity of the person named.",

  "handoff.eyebrow": "Verify online",
  "handoff.heading": "Check a number in the verification system",
  "handoff.body":
    "The service is open to everyone, with no registration and no authorisation. A result shows only whether the number was issued by this centre, the date, and the status — never the text of the statement or any other personal information.",
  "handoff.actions[0].label": "Verify a certificate",
  "handoff.actions[0].stamp": "Check",
  "handoff.actions[0].note":
    "You will need the certificate number (16 digits beginning TD), the holder's name and date of birth. It currently covers certificates issued after 18 August 2020.",
  "handoff.actions[2].label": "Check on a statement",
  "handoff.actions[2].note":
    "Statements and certificates are two different systems. To check on a statement, use the lookup password you were given when you submitted it, not a certificate number.",
  "handoff.destinationNote":
    "The link opens service.tuidang.org in a new window. That is the centre's certificate verification system; it looks different from this site, and that is normal.",

  "verifyForm.eyebrow": "Verify online",
  "verifyForm.numberLabel": "Certificate number",
  "verifyForm.numberHint": "In the form TD-2026-0071824. Please enter it in full.",
  "verifyForm.nameLabel": "Name on the certificate",
  "verifyForm.nameHint": "Used as a cross-check. It must match the printed name exactly.",
  "verifyForm.namePlaceholder": "Enter the name",
  "verifyForm.buttonLabel": "Verify",
  "verifyForm.buttonStamp": "Check",

  "scopeSection.resultHeading": "What a result means",
  "scopeSection.scopeHeading": "What verification checks",
  "scopeSection.scopeBody":
    "Verification confirms that this centre did issue the certificate. It does not confirm the identity of the person named.",
  "resultMeaning[0].heading": "Valid.",
  "resultMeaning[0].body":
    "The number was issued by this centre, the record exists, and the certificate has not been cancelled.",
  "resultMeaning[1].heading": "No such number.",
  "resultMeaning[1].body":
    "The number is not among those issued. It may have been mistyped, or it may not have come from this centre.",
  "resultMeaning[2].heading": "Cancelled.",
  "resultMeaning[2].body":
    "The number was issued but has since been cancelled, for instance because details were corrected or the certificate was reissued.",

  "antiFraudPanel.title": "What to look for",
  "antiFraudPanel.items[0]": "A unique number, bottom right",
  "antiFraudPanel.items[1]": "Chinese and English side by side",
  "antiFraudPanel.items[2]": "The centre's seal",
  "antiFraudPanel.items[3]": "Verifiable online, on this page",

  "institutionNotice.title": "A note for receiving institutions",
  "institutionNotice.body":
    "This service is open to everyone, with no registration and no authorisation. A result shows only whether the number was issued by this centre, the date, and the status — never the text of the statement or any other personal information.",

  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Applying for a certificate",
  "relatedPanel.links[1].label": "How is a certificate verified?",
  "relatedPanel.links[2].label": "Contact us to confirm",
  "relatedPanel.links[3].label": "A note for receiving institutions (PDF)"
};

/* ── 信息变更（/services/contact） ─────────────────────────────── */

const SERVICES_CONTACT_EN: Record<string, string | null> = {
  title: "Changes and contact",
  subtitle:
    "Correct the details on a statement, replace a lost certificate, or ask about your record. Handled by hand at the centre.",
  "intro.body":
    "## How requests are handled, and how long they take\n\nEvery request is checked and handled by a volunteer, which usually takes a few working days. When details are corrected, a certificate is reissued with a new number; the old number is cancelled, and verifying it will show that it was cancelled and point to the new one.\n\n## About statements already published\n\nIf a name or contact detail is wrong, we can correct it. But the text of a statement that has been published is not deleted — keeping the exact wording and the time of every statement is the point of this register. If your situation is unusual, say so above and we will look at it specifically.",

  "handoff.eyebrow": "Send a request",
  "handoff.heading": "Use the contact form",
  "handoff.body":
    "Correcting the details on a statement, replacing a lost certificate or asking about a record all go through the centre's contact form, and are checked and handled by a volunteer.",
  "handoff.actions[0].label": "Contact us",
  "handoff.actions[0].stamp": "Send",
  "handoff.actions[0].note":
    "Please give the certificate number. If you do not have it, tell us the name you signed with, roughly when, and how you submitted (website, service point, telephone, or passed on by a volunteer), so a volunteer can find the record.",
  "handoff.actions[1].label": "Questions about a statement",
  "handoff.actions[1].note":
    "If what you need to correct is a statement rather than a certificate, get in touch through the Tuidang site.",
  "handoff.destinationNote": "The link opens the contact page on www.tuidang.org in a new window.",

  "processingSections[0].heading": "How requests are handled, and how long they take",
  "processingSections[0].body":
    "Every request is checked and handled by a volunteer, which usually takes a few working days. When details are corrected, a certificate is reissued with a new number; the old number is cancelled, and verifying it will show that it was cancelled and point to the new one.",
  "processingSections[1].heading": "About statements already published",
  "processingSections[1].body":
    "If a name or contact detail is wrong, we can correct it. But the text of a statement that has been published is not deleted — keeping the exact wording and the time of every statement is the point of this register. If your situation is unusual, say so above and we will look at it specifically.",

  "onsitePanel.title": "In person",
  "onsitePanel.body":
    "Any of our hundred-plus service points can help with changes and replacements, with no appointment needed.",
  "onsitePanel.buttonLabel": "Find a service point",

  "contactPanel.title": "Get in touch directly",
  "contactPanel.orgName": "Global Service Center for Quitting the Chinese Communist Party",
  "contactPanel.links[0].label": "Questions about certificates",
  "contactPanel.links[1].label": "Service points and volunteers",
  "contactPanel.links[2].label": "Press and interviews",

  "reminderPanel.title": "A reminder",
  "reminderPanel.body":
    "The fee for a certificate is paid only on the centre's official application page. We never take payment through a private account or an intermediary, and we will never call or text you asking for a card number, a verification code or a password."
};


/* ── 影音各栏目页（/videos/*） ────────────────────────────────── */

/*
 * 七页同构：标题、简介、一支「本期推荐」、一格样例影片、再利用说明。
 * 推荐与样例指的都是具体的中文影片，英文站一支都没有 —— 丢掉、清空。
 * 再利用说明七页一模一样，所以抽出来共用，省得七份各写一遍、日后各改各的。
 */
const VIDEO_REUSE_EN: Record<string, string | null> = {
  "reuseNote.title": "Every film may be freely downloaded, reposted and re-edited",
  "reuseNote.body":
    "No permission needed in advance — just credit the source. If the embedded player will not load, which is common where the network is restricted, use one of the other platform links below or download the MP4 directly.",
  "reuseNote.linkLabel": "About safe access",
  /* 这一排在五页上一模一样，所以放在共用的这份里。 */
  "platformLinks[0].label": "Gan Jing World",
  "platformLinks[2].label": "Wangmen (reachable inside China)",
  "platformLinks[3].label": "Download MP4"
};

const VIDEO_SECTION_PAGES: {
  path: string;
  title: string;
  subtitle: string;
  more?: string;
  /** 这一页自己多出来的文案（比如 others 的筛选）。 */
  extra?: Record<string, string | null>;
}[] = [
  {
    path: "pages/videos-frontline.json",
    title: "Tuidang Frontline",
    subtitle:
      "From the service points: volunteers at work and interviews with the people they meet. First-hand footage from more than a hundred service points worldwide, added to continually.",
    more: "Load more"
  },
  {
    path: "pages/videos-ironclad.json",
    title: "Ironclad Evidence",
    subtitle:
      "The filmed editions of the WOIPFG investigations. Thirty-two episodes, presenting the recorded evidence one piece at a time and setting out how it fits together and where it came from.",
    more: "See all 32 episodes",
    extra: {
      episodesTitle: "Episodes (selected)",
      "introNote.title": "About this series",
      "introNote.body":
        "The series is produced by the World Organization to Investigate the Persecution of Falun Gong (WOIPFG) and reposted here. WOIPFG has been gathering evidence since 2006 and has published 866 investigative recordings and more than 4,000 documents. Each episode states when and how its evidence was obtained, and the reference numbers of the documents involved.",
      "introNote.linkLabel": "WOIPFG investigation reports"
    }
  },
  {
    path: "pages/videos-jiuping.json",
    title: "Nine Commentaries",
    subtitle:
      "Video and audio editions of the Nine Commentaries on the Communist Party, Disintegrating the Party Culture, How the Specter of Communism Is Ruling Our World, and The Ultimate Goal of Communism.",
    extra: {
      episodesTitle: "The nine commentaries",
      secondaryGridTitle: "Other series"
    }
  },
  {
    path: "pages/videos-step-back.json",
    title: "A Step Back",
    subtitle:
      "Interviews with people who once worked inside the system, or who lived through a turning point, on how they left and what happened afterwards.",
    more: "Load more interviews"
  },
  {
    path: "pages/videos-awakening.json",
    title: "Journey of Awakening",
    subtitle:
      "A documentary series filmed over many years, following this movement and the people in it across two decades."
  },
  {
    path: "pages/videos-party-culture.json",
    title: "Breaking Party Culture",
    subtitle:
      "How Party culture worked its way into language, schooling, thinking and everyday life. A series made to accompany the book Disintegrating the Party Culture.",
    extra: { episodesTitle: "All episodes" }
  },
  {
    path: "pages/videos-others.json",
    title: "Other series",
    subtitle:
      "Rallies and marches, international conferences and forums, audio programmes, and anything that does not belong to one of the series above.",
    more: "Load more",
    extra: {
      "filters[0]": "All",
      "filters[1]": "Rallies and marches",
      "filters[2]": "Conferences and forums",
      "filters[3]": "Voices of Tuidang (audio)",
      "filters[4]": "Culture"
    }
  }
];


/* ── 杂志《回归》各期（/resources/magazine/*） ──────────────────── */

/*
 * 十页同构：标题、本期专题、「本期概要」与「阅读方式」两段、底下三个相关链接。
 * 后两段和相关链接十页完全一样，抽出来共用。
 *
 * 刊名《回归》译作 The Return —— 与建站脚本里 nav/section-tabs 的译法一致，
 * 两处对不上会让读者以为是两本刊物。
 */
const MAGAZINE_SHARED_EN: Record<string, string | null> = {
  "sections[0].heading": "In this issue",
  "sections[1].heading": "How to read it",
  "sections[1].body":
    "You can go back to the magazine's home page for the current issue, and get the PDF, the EPUB and material to share from the downloads area.",
  "relatedLinks[0].label": "Back to the magazine",
  "relatedLinks[1].label": "Downloads",
  "relatedLinks[2].label": "Press and media"
};

const MAGAZINE_ISSUES: { path: string; title: string; subtitle: string; summary: string }[] = [
  {
    path: "pages/resources-magazine-2024-autumn.json",
    title: "The Return, Autumn 2024",
    subtitle: "In focus: culture and belief.",
    summary:
      "On recovering and rebuilding traditional culture where it meets, and collides with, modern values."
  },
  {
    path: "pages/resources-magazine-2024-winter.json",
    title: "The Return, Winter 2024",
    subtitle: "In focus: a younger generation, and its choices.",
    summary:
      "How younger people's understanding has shifted as their information environment changed, and what they did about it."
  },
  {
    path: "pages/resources-magazine-2025-spring.json",
    title: "The Return, Spring 2025",
    subtitle: "In focus: service points abroad.",
    summary:
      "How service points organise themselves, handle risk and talk to the public."
  },
  {
    path: "pages/resources-magazine-2025-summer.json",
    title: "The Return, Summer 2025",
    subtitle: "In focus: Party culture and everyday language.",
    summary:
      "Through vocabulary, narrative and habits of thought, how Party culture still shapes ordinary life."
  },
  {
    path: "pages/resources-magazine-2025-autumn.json",
    title: "The Return, Autumn 2025",
    subtitle: "In focus: why I said it publicly.",
    summary:
      "Public statements and interviews alongside them, showing how people in very different circumstances came to decide."
  },
  {
    path: "pages/resources-magazine-2025-winter.json",
    title: "The Return, Winter 2025",
    subtitle: "Cover story: the people at the service points.",
    summary:
      "Volunteers on the ground and the running of service points: what keeps a long-term effort going."
  },
  {
    path: "pages/resources-magazine-2026-spring.json",
    title: "The Return, Spring 2026",
    subtitle: "Cover story: twenty years, 460 million statements.",
    summary:
      "The turning points of twenty years, reports from the service points, and news of international support."
  },
  {
    path: "pages/resources-magazine-archive.json",
    title: "The Return: back issues",
    subtitle: "Every issue of The Return, by year.",
    summary: "A quick way into past issues, for research and for citing over the long term."
  }
];


/* ── 三本书的详情页（/resources/*） ────────────────────────────── */

/* 书名用通行英译，与 /resources 首页上的那份对齐。 */
const BOOK_PAGES: { path: string; title: string; subtitle: string; about: string; reading: string; links: string[] }[] = [
  {
    path: "pages/resources-book-jieti-dangwenhua.json",
    title: "Disintegrating the Party Culture",
    subtitle: "Recognising how Party culture formed, through language, schooling and behaviour.",
    about:
      "The book sets out how Party culture works its way into everyday speech, into social attitudes and into judgements of right and wrong, so that a reader can recognise those framings and step out of them.",
    reading:
      "This page is the way in to the book; downloadable editions are in the resources section, and service points use it for reading and discussion in person.",
    links: ["Back to books and writings", "Materials to download", "Chinese traditional culture"]
  },
  {
    path: "pages/resources-book-mogui-shijie.json",
    title: "How the Specter of Communism Is Ruling Our World",
    subtitle: "The historical reach of communist ideology, and how it works today.",
    about:
      "The book traces how communism spread through politics, culture and society, and uses specific cases to explain its effect on the modern order.",
    reading:
      "It reads well alongside our features and commentary; editions suited to sharing online and in print are in the downloads section.",
    links: ["Back to books and writings", "Features and commentary", "Downloads"]
  },
  {
    path: "pages/resources-book-gongchanzhuyi-zhongji.json",
    title: "The Ultimate Goal of Communism",
    subtitle: "What communism is finally for, traced through its ideas and its practice.",
    about:
      "Following both the historical record and what can be observed now, the book explains the logic of communism's final aim, and what individuals and societies can do in response.",
    reading:
      "This page gathers the reading in one place; the full material is in the downloads area, for sharing onward and for teaching.",
    links: ["Back to books and writings", "News and reports", "Downloads"]
  }
];


/* ── 免翻墙链接（/resources/tools） ────────────────────────────── */

/*
 * 这一页讲的是怎么在受管控的网络下安全访问。措辞要准：说「更安全」不说
 * 「安全」，说「可能留下痕迹」不说「不会留下痕迹」—— 把边界说清楚比把话说满
 * 重要，读者据此判断自身处境。中文原文就是这么写的，英文照这个分寸来。
 */
const RESOURCES_TOOLS_EN: Record<string, string | null> = {
  title: "Uncensored access",
  subtitle:
    "Several ways to reach this site, and Tuidang material, from a restricted network. Weigh up your own situation before choosing one.",
  "intro.body":
    "## Which one to choose\n\nIf you only want to read — a mirror address is the simplest. Nothing to install, and no software left on your device.\n\nIf you need reliable access over time — use the app. Mirror addresses stop working; the app updates its routes itself. But it stays on your device.\n\nIf reaching any website is difficult — subscribe by email. The content comes to your inbox and you never connect to this site at all.\n\n## Clearing traces afterwards\n\nBrowsing history, downloads and caches can all leave traces. If someone else may look at your device, clear your browsing data afterwards.\n\nIf you install the app, think about whether having it on your device is safe for you.\n\n## Passing these on\n\nYou can write a mirror address down, put it in a text message, or tell someone in person, and let them decide for themselves whether to use it.\n\n## If none of the addresses will open\n\nAddresses being blocked is normal. Get in touch any of the ways below and we will give you one that currently works.",

  "accessCards[0].kicker": "Option one",
  "accessCards[0].title": "Mirror addresses",
  "accessCards[0].body":
    "Alternative addresses, usually needing nothing installed. Note one or two down, and refresh them from time to time.",
  "accessCards[0].buttonLabel": "See the mirror list",
  "accessCards[1].kicker": "Option two",
  "accessCards[1].title": "Wangmen and other apps",
  "accessCards[1].body":
    "Once installed, it reaches this site and related material directly — the choice for reliable access over time.",
  "accessCards[1].buttonLabel": "Download the app",
  "accessCards[2].kicker": "Option three",
  "accessCards[2].title": "Email subscription",
  "accessCards[2].body":
    "No website at all: summaries and links arrive in your inbox.",
  "accessCards[2].buttonLabel": "Subscribe",
  "accessCards[3].kicker": "Option four",
  "accessCards[3].title": "Text-only version",
  "accessCards[3].body": "A low-bandwidth page, for slow or temporary connections.",
  "accessCards[3].buttonLabel": "Go to the text-only version",

  "guideSections[0].heading": "Which one to choose",
  "guideSections[0].paragraphs[0]":
    "If you only want to read — a mirror address is the simplest. Nothing to install, and no software left on your device.",
  "guideSections[0].paragraphs[1]":
    "If you need reliable access over time — use the app. Mirror addresses stop working; the app updates its routes itself. But it stays on your device.",
  "guideSections[0].paragraphs[2]":
    "If reaching any website is difficult — subscribe by email. The content comes to your inbox and you never connect to this site at all.",
  "guideSections[1].heading": "Clearing traces afterwards",
  "guideSections[1].paragraphs[0]":
    "Browsing history, downloads and caches can all leave traces. If someone else may look at your device, clear your browsing data afterwards.",
  "guideSections[1].paragraphs[1]":
    "If you install the app, think about whether having it on your device is safe for you.",
  "guideSections[2].heading": "Passing these on",
  "guideSections[2].paragraphs[0]":
    "You can write a mirror address down, put it in a text message, or tell someone in person, and let them decide for themselves whether to use it.",
  "guideSections[3].heading": "If none of the addresses will open",
  "guideSections[3].paragraphs[0]":
    "Addresses being blocked is normal. Get in touch any of the ways below and we will give you one that currently works.",

  "noticePanel.title": "Weigh up your situation first",
  "noticePanel.body":
    "No tool can promise complete safety. If you are unsure whether your device is safe, avoid leaving anything identifiable behind.",
  "safetyPanel.title": "Your safety",
  "safetyPanel.body":
    "We ask for no identity documents and record nothing that identifies you. The full account is on the safety and privacy page.",
  "safetyPanel.buttonLabel": "Safety and privacy",
  "reminderPanel.title": "A reminder",
  "reminderPanel.body":
    "This centre never asks for your identity documents, banking details or passwords through any tool. If a page asks you for those, it is not ours.",

  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Mirror address updates",
  "relatedPanel.links[1].label": "Make a statement online",
  "relatedPanel.links[2].label": "Is withdrawing safe?",
  "relatedPanel.links[3].label": "Downloads",
  "relatedPanel.links[4].label": "Contact us"
};


/* ── 杂志《回归》主页（/resources/magazine） ──────────────────── */

const RESOURCES_MAGAZINE_EN: Record<string, string | null> = {
  title: "The Return",
  subtitle:
    "A monthly published by the Global Service Center for Quitting the Chinese Communist Party, built around people's stories, with current affairs, economics, history and culture alongside. Available online and as a digital edition.",
  "intro.body":
    "## About The Return\n\nThe Return is published by the Global Service Center for Quitting the Chinese Communist Party. It began on 18 October 2025 and appears monthly. It is built around people's stories — the lives worth recording along the way back — together with writing on the current affairs, economics, history and culture readers care about, and each month a Tuidang report and stories from volunteers.\n\n## Subscribing and reading\n\nThe Return is available online and as a digital edition, published for a general readership on a membership basis. The online edition can be read directly; the digital edition is posted issue by issue. Subscriptions, sharing and submissions are all welcome.",

  "featuredIssue.title": "The Return: recording this chapter",
  "featuredIssue.body":
    "The Return is published by the Global Service Center for Quitting the Chinese Communist Party and began on 18 October 2025. It is built around people's stories — the lives and events worth recording along the way back — together with writing on current affairs, economics, history and culture, and each month a Tuidang report and stories from volunteers. Its opening editorial put it this way: an end to the CCP, and a return — to China, to tradition, to common sense, to a normal society.",
  "featuredIssue.note":
    "The Return is a membership publication, available online and as a digital edition. A printed edition will follow when the time is right.",
  "featuredIssue.yearLine": "Founded October 2025 · monthly · online and digital editions",
  "featuredIssue.imageAlt": "Cover of the first issue of The Return",
  "featuredIssue.actions[0].label": "Online edition",
  "featuredIssue.actions[1].label": "Digital edition",
  "featuredIssue.actions[2].label": "Become a member",

  "issuesSection.eyebrow": "Digital edition",
  "issuesSection.title": "Back issues, online",
  "issues[0].title": "The Return, first issue",
  "issues[0].summary": "Read online",
  "issues[0].archiveText": "The Return\\nFirst issue",
  "issues[1].title": "The Return, second issue",
  "issues[1].summary": "Read online",
  "issues[1].archiveText": "The Return\\nSecond issue",
  "issues[2].title": "The Return, third issue",
  "issues[2].summary": "Read online",
  "issues[2].archiveText": "The Return\\nThird issue",
  "issues[3].title": "The Return, fourth issue",
  "issues[3].summary": "Read online",
  "issues[3].archiveText": "The Return\\nFourth issue",
  "issues[4].title": "The Return, fifth issue",
  "issues[4].summary": "Read online",
  "issues[4].archiveText": "The Return\\nFifth issue",
  "issues[5].title": "The Return, sixth issue",
  "issues[5].summary": "Read online",
  "issues[5].archiveText": "The Return\\nSixth issue",
  "issues[6].title": "The Return, seventh issue",
  "issues[6].summary": "Read online",
  "issues[6].archiveText": "The Return\\nSeventh issue",
  "issues[7].title": "The Return, eighth issue",
  "issues[7].summary": "Read online",
  "issues[7].archiveText": "The Return\\nEighth issue",
  "issues[8].title": "The Return, ninth issue",
  "issues[8].summary": "Read online",
  "issues[8].archiveText": "The Return\\nNinth issue",
  "issues[9].title": "The Return, tenth issue",
  "issues[9].summary": "Read online",
  "issues[9].archiveText": "The Return\\nTenth issue",
  "issues[10].title": "The Return, eleventh issue",
  "issues[10].summary": "Read online",
  "issues[10].archiveText": "The Return\\nEleventh issue",

  "proseSections[0].heading": "About The Return",
  "proseSections[0].body":
    "The Return is published by the Global Service Center for Quitting the Chinese Communist Party. It began on 18 October 2025 and appears monthly. It is built around people's stories — the lives worth recording along the way back — together with writing on the current affairs, economics, history and culture readers care about, and each month a Tuidang report and stories from volunteers.",
  "proseSections[1].heading": "Subscribing and reading",
  "proseSections[1].body":
    "The Return is available online and as a digital edition, published for a general readership on a membership basis. The online edition can be read directly; the digital edition is posted issue by issue. Subscriptions, sharing and submissions are all welcome.",

  "requestPanel.title": "Subscribe to The Return",
  "requestPanel.body": "The Return is a membership publication. Subscriptions, sharing and submissions are all welcome.",
  "requestPanel.buttonLabel": "Subscribe",

  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "The Return website",
  "relatedPanel.links[1].label": "Books and writings",
  "relatedPanel.links[2].label": "Downloads",
  "relatedPanel.links[3].label": "Press and media"
};

/* ── 媒体与记者（/resources/press） ───────────────────────────── */

const RESOURCES_PRESS_EN: Record<string, string | null> = {
  title: "Press and media",
  subtitle:
    "Our profile, how the figures are compiled, licensable photographs and how to reach us — for journalists and researchers.",

  "kitSection.eyebrow": "Press kit",
  "kitSection.title": "Material to download",
  "kitItems[0].title": "One-page profile",
  "kitItems[0].badge": "PDF · Chinese / English",
  "kitItems[0].body": "How we began, what we do, our size and our legal status, in Chinese and English.",
  "kitItems[1].title": "Data and method",
  "kitItems[1].badge": "Explainer",
  "kitItems[1].body": "What counts, how duplicates are removed, and the known limits.",
  "kitItems[2].title": "Licensable photographs",
  "kitItems[2].badge": "Flickr library",
  "kitItems[2].body":
    "Events, service points and certificate presentations over the years, at high resolution, with the photographer credit required.",
  "kitItems[3].title": "Logo and typeface",
  "kitItems[3].badge": "coming soon",
  "kitItems[3].body": "Our logo, colours and how to use them.",

  "faqSection.eyebrow": "Common questions",
  "faqSection.title": "Interviews and citation",
  "faqs[0].question": "Where do your figures come from?",
  "faqs[0].answer[0]":
    "Every figure comes from statements people submitted themselves. The system counts submissions after removing duplicates, and keeps the original text and timestamp.",
  "faqs[0].answer[1]": "What counts and how is set out on the Numbers and method page.",
  "faqs[1].question": "May we use your text and photographs?",
  "faqs[1].answer[0]":
    "Yes. Everything on this site may be quoted, reposted and translated without permission in advance; just credit the source. Please keep the photographer's credit on images.",
  "faqs[2].question": "Can interviews be anonymous?",
  "faqs[2].answer[0]":
    "Yes. Where someone has safety concerns we can arrange an anonymous interview and agree the wording before publication.",
  "faqs[3].question": "Do you take paid partnerships with commercial media?",
  "faqs[3].answer[0]":
    "We do not do advertising partnerships, but we welcome interviews and fact-checking on matters of public interest.",

  "noticePanel.title": "Please do check us",
  "noticePanel.body":
    "The text, images and figures on this site may be quoted and reposted freely, as a rule without permission in advance. Please keep the source and the photographer's credit. For original files or help arranging an interview, write to the editors.",

  "ctaPanel.title": "Interviews, fact-checking and data",
  "ctaPanel.body":
    "We can provide high-resolution originals, the archive, help interpreting the figures, and introductions for interviews.",
  "ctaPanel.primaryLabel": "Contact the editors",
  "ctaPanel.secondaryLabel": "See the method"
};


/* ── 法律页（/legal/*） ───────────────────────────────────────── */

/*
 * 这两页是有法律效力的文本，所以翻译的原则是**贴着中文版走**：不润色、
 * 不补充、不替原文把话说圆 —— 一份法律文本里，译者的「改进」就是在改变
 * 承诺。原文说「不能保证完全安全」，英文也只说这句，不加「但我们会尽力」。
 *
 * 原文里的瑕疵照样留着：条款编号从 10 直接跳到 12，没有第 11 条。那是中文
 * 原文就有的，不是漏译。两版要对得上，翻译不该悄悄把它顺平 —— 真要补，得
 * 先补中文版，两边一起改。
 */
const LEGAL_TERMS_EN: Record<string, string | null> = {
  title: "Terms of Service",
  subtitle:
    "The conditions for using this site and applying for a certificate of withdrawal, the copyright notice and the limits of our liability.",
  "intro.body":
    "## 1. General rules and definitions\n\n" +
    "The Global Service Center for Quitting the Chinese Communist Party provides you with the following websites: *.tuidang.org and endccp.com, referred to together below as the Global Service Center website. You are welcome to browse our site. These terms set out the conditions for entering and using it. Please read them carefully; by entering and using our site you agree to accept these terms and our privacy policy.\n\n" +
    "## 2. Use of the site and its content\n\n" +
    "Except where stated otherwise, the Global Service Center website may modify, suspend or discontinue the site at any time and for any reason, without prior notice and without incurring any cost. The site may be unreachable during maintenance, because of equipment failure, or for other reasons. Apart from documents the Global Service Center website permits you to read, copy, download and print, and audio and video programmes it permits you to view, listen to and download (together, \"downloaded content\"), no part of the site may be copied or transmitted in any form or by any means, including photocopying and recording. When downloading documents and audio-visual material from the Global Service Center website you must observe the following conditions: (a) downloaded content may be used only for personal, non-commercial purposes; (b) downloaded content may not be modified, and downloaded audio-visual material may not be copied; (c) copyright, trademark and other proprietary notices may not be removed from downloaded content.\n\n" +
    "## 3. Applying for a certificate of withdrawal\n\n" +
    "We require that a certificate of withdrawal from the Party, the Youth League or the Young Pioneers be applied for with the consent of, or voluntarily by, the person concerned. Please use your true and legally valid identity, so that the certificate we provide is valid as proof that you have left the organisations of the Chinese Communist Party. You may not apply in someone else's name. The personal information you submit will not be made public by the Global Service Center website, but will be retained as evidence, and may be used where necessary to attest that your withdrawal is genuine and valid. Please check that the information you enter is correct; if it is wrong you may apply to have the certificate amended, and we will provide that service once our staff have reviewed the request.\n\n" +
    "## 4. Copyright and trademarks\n\n" +
    "The Global Service Center website reserves all copyright. The site, its content and its information belong to the Global Service Center website, its affiliated entities and other organisations whose rights it has acquired. Unauthorised copying and distribution violates United States copyright law, trademark law, international conventions and other intellectual property law. Copyright and trademarks in other products belong to their respective owners.\n\n" +
    "## 5. Accuracy and safety of content, and changes to the site\n\n" +
    "The Global Service Center website endeavours to provide timely and accurate information, but we cannot always ensure that accuracy, nor can we ensure that downloading content from the site, directly or indirectly, is always safe. You must decide for yourself whether material you wish to download may contain computer viruses or other possible harm. The Global Service Center website reserves the right to change content, product descriptions and other information, and need not notify anyone before doing so. The Global Service Center website adds to and updates the site's information and downloadable content from time to time.\n\n" +
    "## 6. Personal data policy\n\n" +
    "The document \"Global Service Center website — Privacy Policy\" explains how the Global Service Center website collects and uses users' personal data.\n\n" +
    "## 7. No warranty as to content\n\n" +
    "The Global Service Center website gives no warranty, including as to the following: (i) that all information is correct, accurate, reliable and complete; (ii) that the site will function without interruption or error; (iii) that errors will be corrected; (iv) that the site or its servers are free of viruses or other harmful components.\n\n" +
    "## 8. Links to third-party sites, and third parties and their products\n\n" +
    "For your convenience, the Global Service Center website may contain links to third-party sites. The Global Service Center website is not responsible for the content of those sites. All sites other than the Global Service Center website are independent of the Global Service Center, which has no control over them. Providing a link to a third-party site does not mean the Global Service Center endorses its content, and the Global Service Center is not responsible for your use of those sites or their content.\n\n" +
    "## 9. Governing law\n\n" +
    "These terms are governed by and construed in accordance with the law of the State of New York, United States.\n\n" +
    "## 10. Indemnity\n\n" +
    "By using the Global Service Center website you agree that, where a third party brings a claim because you have breached these terms, you will indemnify the Global Service Center website against its direct and indirect losses, costs and expenses of defence (such as legal fees).\n\n" +
    "## 12. Further information\n\n" +
    "If you have any questions about these terms, please contact the Global Service Center for Quitting the CCP at:  \n" +
    "Telephone: 1-718-888-9552  \n" +
    "Email: office@tuidang.org  \n" +
    "Address: 40-48 Main Street, Suite 201, Flushing, NY 11354"
};

const LEGAL_PRIVACY_EN: Record<string, string | null> = {
  title: "Privacy Policy",
  subtitle:
    "What we collect when you apply for a certificate of withdrawal, how we use it, and how we protect it.",
  "intro.body":
    "## Introduction\n\n" +
    "The Global Service Center for Quitting the Chinese Communist Party (\"we\" or \"our\") respects the privacy of our users (\"user\" or \"you\"). This privacy policy explains how we collect, use, disclose and protect your information once you have agreed to apply for a certificate of withdrawal.\n\n" +
    "## What we collect\n\n" +
    "During the certificate application we collect the following.\n\n" +
    "### a) Personal details\n\n" +
    "Personally identifying information you give us voluntarily during the application, such as your name, age, sex, date of birth and email address. All of it must be true and accurate. This site accepts no responsibility for problems that arise later, in an immigration application or any other matter, because the information was entered incorrectly.\n\n" +
    "### b) Payment information\n\n" +
    "When you pay for an application, the site collects data relating to that payment, namely:\n" +
    "1. the last four digits of the card number;\n" +
    "2. the card issuer, such as Visa or Mastercard.\n\n" +
    "This is used only to reconcile bank payment records, for the use of the site's customer service.\n\n" +
    "## How certificate information is used\n\n" +
    "We do not use your information in any way other than to verify your certificate of withdrawal.\n\n" +
    "## Disclosure of certificate information\n\n" +
    "We do not share your information with anyone else in any way.\n\n" +
    "## Email and communications\n\n" +
    "If you no longer wish to receive letters, emails or other communications from us, please contact us. On hearing from you we will stop sending email in future.\n\n" +
    "## Information security\n\n" +
    "We use administrative, technical and physical safeguards to help protect your personal information. We have taken reasonable steps to secure the personal information you provide to us. Please be aware, however, that despite our efforts no security measure anywhere is perfect or impenetrable, and no method of data transmission can be guaranteed against interception or other kinds of misuse. Any information disclosed over a network is vulnerable to interception and misuse by unauthorised parties. We therefore cannot guarantee complete security if you provide personal information."
};


/* ── 新闻中心首页（/news） ──────────────────────────────────────── */

/*
 * 这一页上的条目全是具体的中文文章 —— 头条、各栏目的卡片、简讯、调查报告 ——
 * 一律清空。栏目名沿用建站时 nav/section-tabs 的那套英文，三处要对得上：
 * 导航、这一页的栏目卡、以及文章分类表。
 */
const NEWS_INDEX_EN: Record<string, string | null> = {
  title: "News and reports",
  subtitle:
    "Announcements, investigation reports, features and commentary, international solidarity and Tuidang news. Everything carries its source and date, and is free to repost and translate.",
  "filters[0]": "Latest",
  "filters[1]": "This week",
  "filters[2]": "This month",
  "filters[3]": "Film only",
  "filters[4]": "Reports and documents only",
  "pager[5]": "Next →",

  "announcementsSection.title": "Announcements and statements",
  "announcementsSection.moreLabel": "All →",
  "investigationsSection.title": "WOIPFG investigation reports",
  "investigationsSection.lede":
    "Published independently by the World Organization to Investigate the Persecution of Falun Gong and reposted here. WOIPFG has been gathering evidence since 2006 and has published 866 investigative recordings and more than 4,000 documents.",
  "investigationsSection.moreLabel": "All investigation reports →",
  "commentarySection.title": "Features and commentary",
  "commentarySection.moreLabel": "All →",
  "solidaritySection.title": "International solidarity",
  "solidaritySection.moreLabel": "All solidarity coverage →",
  "storiesSection.title": "Tuidang news and stories",
  "storiesSection.moreLabel": "All Tuidang news →",
  "notableSection.title": "Notable withdrawals",
  "notableSection.moreLabel": "All testimony →",

  "sectionPanel.title": "Sections",
  "announcementsSection.moreHref": "/news/tuidang-statements",
  "sectionPanel.links[0].href": "/news/tuidang-statements",
  "sectionPanel.links[0].label": "Announcements and statements",
  "sectionPanel.links[1].label": "WOIPFG investigation reports",
  "sectionPanel.links[2].label": "Features and commentary",
  "sectionPanel.links[3].label": "International solidarity",
  "sectionPanel.links[4].label": "Tuidang news and stories",
  "sectionPanel.links[5].label": "Notable withdrawals",

  "yearPanel.title": "By year",
  "yearPanel.links[3].label": "2005–2023 archive",

  "archiveSection.title": "The archive",
  "archiveSection.moreLabel": "Advanced search →",
  "archiveSection.note":
    "Everything on this site may be downloaded, reposted, translated and re-edited without permission in advance; just credit the source. Please keep the photographer's credit on images.",
  "archiveSection.noteLinkLabel": "Press and media",
  "archiveSection.cards[0].title": "By year",
  "archiveSection.cards[0].body": "About 2,800 pieces since 2005. Browse year by year.",
  "archiveSection.cards[1].title": "By section",
  "archiveSection.cards[1].body": "The full list and tags for all six sections.",
  "archiveSection.cards[2].title": "Reports and documents only",
  "archiveSection.cards[2].body": "Investigation reports, annual reports and policy documents.",
  "archiveSection.cards[3].title": "Film and audio only",
  "archiveSection.cards[3].body": "Films, documentaries and audio programmes.",

  "reusePanel.title": "Reposting",
  "reusePanel.body":
    "Everything on this site may be downloaded, reposted and re-edited without permission in advance; just credit the source.",
  "reusePanel.buttonLabel": "Go to Resources",

  /* 证词是名人退党那一页同几句话的摘录版，两处的译文必须一致。 */
  "notableSection.testimonials[0].name": "Chen Yonglin",
  "notableSection.testimonials[0].role": "Former CCP diplomat",
  "notableSection.testimonials[0].quote":
    "As a diplomat I was supposed to serve the national interest, but most of what I did there was not in the national interest \u2014 it was persecuting my own people.",
  "notableSection.testimonials[1].name": "Hao Fengjun",
  "notableSection.testimonials[1].role": "Former official, Tianjin Public Security Bureau",
  "notableSection.testimonials[1].quote":
    "I joined the Chinese Communist Party in 1991 with high expectations of it, but the reality was not what I had imagined.",
  "notableSection.testimonials[2].name": "Qu Jilian",
  "notableSection.testimonials[2].role": "Journalist, Jiamusi Daily, Heilongjiang",
  "notableSection.testimonials[2].quote":
    "I was a journalist for more than twenty years, and for more than twenty years I told lies. Today I will say one true thing: I am leaving the Party."
};

/* ── 名人退党（/news/notable） ─────────────────────────────────── */

/*
 * profiles 是陈用林、郝凤军、韩广生、曲吉莲退党声明的原话。逐句直译，
 * 不概括、不润色 —— 理由同首页 voices 那一段。职务行里的换行照原样留着，
 * 版面靠它分两行。
 */
const NEWS_NOTABLE_EN: Record<string, string | null> = {
  title: "Notable withdrawals",
  subtitle:
    "Public statements by people who once served inside the CCP's institutions — in diplomacy, policing, the courts, the Party and government, the press and academia. Every statement is kept in full and made public.",
  "filters[0]": "All",
  "filters[1]": "Diplomacy and intelligence",
  "filters[2]": "Police and courts",
  "filters[3]": "Party and government",
  "filters[4]": "Press",
  "filters[5]": "Academia",
  "pager[5]": "Next →",
  "yearPanel.title": "By year",
  "yearPanel.links[3].label": "2005–2023 archive",
  "profiles[0].name": "Chen Yonglin",
  "profiles[0].role": "Former CCP diplomat\nFirst Secretary, Chinese Consulate-General in Sydney",
  "profiles[0].quote":
    "As a diplomat I was supposed to serve the national interest, but most of what I did there was not in the national interest \u2014 it was persecuting my own people. That went against my conscience.",
  "profiles[1].name": "Hao Fengjun",
  "profiles[1].role":
    "Former official, 610 Office, Tianjin Public Security Bureau\nPolice Superintendent First Class",
  "profiles[1].quote":
    "I joined the Chinese Communist Party in 1991 with high expectations of it, but the reality was not what I had imagined. I hereby solemnly declare that I withdraw from the Communist Party and all of its organisations.",
  "profiles[2].name": "Han Guangsheng",
  "profiles[2].role":
    "Former Party secretary and director of the Shenyang Justice Bureau\nMember of the municipal Political and Legal Affairs Commission",
  "profiles[2].quote":
    "I joined the Party in 1980 and served it loyally. But fact after fact brought me to the painful realisation that such a party is wholly irreconcilable with my own ideals and convictions.",
  "profiles[3].name": "Qu Jilian",
  "profiles[3].role": "Journalist, Jiamusi Daily, Heilongjiang\nmore than twenty years in the profession",
  "profiles[3].quote":
    "I was a journalist for more than twenty years, and for more than twenty years I told lies. Today I will say one true thing: I am leaving the Party. I declare that I withdraw from the Party, the Youth League and the Young Pioneers.",
  "aboutPanel.title": "About this section",
  "aboutPanel.body":
    "What is collected here are statements the people concerned made publicly themselves. The wording is kept in full and unaltered. Positions held are as described by the person or as reported publicly.",
  "relatedPanel.title": "Related",
  "relatedPanel.links[0].label": "Tuidang news and stories",
  "relatedPanel.links[1].label": "Interview films",
  "relatedPanel.links[2].label": "I want to make a statement"
};


/* ── 新闻各栏目页（/news/*） ───────────────────────────────────── */

/*
 * 五页结构相近：标题、简介、筛选、按年份、一两个侧栏面板，加上一大片
 * 具体的中文文章条目。条目一律清空 —— 英文站一篇都没有。
 *
 * 各页装文章的字段名不一样（items / noticeRows / docRows / profiles），
 * clear 里把几种都列上，setAt 找不到就跳过。
 */
const NEWS_SECTION_PAGES: { path: string; en: Record<string, string | null> }[] = [
  {
    path: "pages/news-announcements.json",
    en: {
      title: "Announcements and statements",
      subtitle:
        "Formal announcements, statements, annual reports and register updates issued by the centre — including the record of threats made against us.",
      "pager[5]": "Next →",
      "yearPanel.title": "By year",
      "yearPanel.links[3].label": "2005–2023 archive",
      "subscribePanel.title": "Subscribe to announcements",
      "subscribePanel.body": "Important announcements can reach you by email, without visiting the site.",
      "subscribePanel.buttonLabel": "Subscribe by email",
      "relatedPanel.title": "Related",
      "relatedPanel.links[0].label": "How we count",
      "relatedPanel.links[1].label": "Security incidents",
      "relatedPanel.links[2].label": "Past annual reports"
    }
  },
  {
    path: "pages/news-investigations.json",
    en: {
      title: "WOIPFG investigation reports",
      subtitle:
        "Evidence reports, witness statements, recorded evidence and lists of those responsible, published by an independent investigative body. Each report states how its evidence was obtained and where it came from.",
      "pager[5]": "Next →",
      "yearPanel.title": "By year",
      "yearPanel.links[3].label": "2005–2023 archive",
      "introNotice.title": "About this section",
      "introNotice.body":
        "The reports below are published independently by the World Organization to Investigate the Persecution of Falun Gong (WOIPFG) and reposted here. WOIPFG has been gathering evidence since 2006 and has published 866 investigative recordings and more than 4,000 documents. Each report states how its evidence was obtained and where it came from.",
      "evidencePanel.title": "Kinds of evidence",
      "evidencePanel.items[0]": "Written reports",
      "evidencePanel.items[1]": "Recorded evidence",
      "evidencePanel.items[2]": "Film and documentary",
      "evidencePanel.items[3]": "Database of those responsible",
      "evidencePanel.items[4]": "Documentary evidence",
      "reusePanel.title": "Free to cite",
      "reusePanel.body":
        "Every report may be downloaded, reposted, translated and re-edited, for the press, for researchers and for judicial bodies.",
      "reusePanel.buttonLabel": "Press and media"
    }
  },
  {
    path: "pages/news-commentary.json",
    en: {
      title: "Features and commentary",
      subtitle:
        "Long features, special reports, commentary on current affairs and columns. On how events unfolded and what in the system produced them. Signed pieces carry their author's own views.",
      "filters[0]": "All",
      "filters[1]": "Features",
      "filters[2]": "Current affairs",
      "filters[3]": "Columns",
      "filters[4]": "Special reports",
      "pager[5]": "Next →",
      "yearPanel.title": "By year",
      "yearPanel.links[3].label": "2005–2023 archive",
      "notePanel.title": "A note",
      "notePanel.body":
        "Signed commentary and columns carry their author's own views and do not represent the position of this centre. Features and special reports are the work of this site's editors.",
      "authorPanel.title": "Columnists",
      "authorPanel.links[0].label": "Wang Youqun",
      "authorPanel.links[1].label": "Li Jun",
      "authorPanel.links[2].label": "More authors"
    }
  },
  {
    path: "pages/news-solidarity.json",
    en: {
      title: "International solidarity",
      subtitle:
        "Parliamentary resolutions, statements by public figures, support from civil-society groups, and a record of rallies and events — sorted by region and by kind.",
      "filters[0]": "All",
      "filters[1]": "Parliaments and resolutions",
      "filters[2]": "Rallies and marches",
      "filters[3]": "Conferences and forums",
      "filters[4]": "North America",
      "filters[5]": "Europe",
      "filters[6]": "Asia-Pacific",
      "pager[5]": "Next →",
      "yearPanel.title": "By year",
      "yearPanel.links[3].label": "2005–2023 archive",
      "docsPanel.title": "Parliamentary documents",
      "docsPanel.links[0].label": "United States House Resolution 444",
      "docsPanel.links[1].label": "Commendation in the Congressional Record",
      "docsPanel.links[2].label": "European Parliament resolution",
      "docsPanel.links[3].label": "Parliamentary documents by year",
      "ctaPanel.title": "Sign the petition",
      "ctaPanel.body":
        "The End CCP petition has 2.48 million signatures, across more than 90 countries and territories.",
      "ctaPanel.buttonLabel": "About the petition"
    }
  },
  {
    path: "pages/news-stories.json",
    en: {
      title: "Tuidang news and stories",
      subtitle:
        "People in their own words, reports from the service points, the Voices of Tuidang audio series and related coverage. Includes everything from the former Tuidang News and Withdrawal Stories sections.",
      "filters[0]": "All",
      "filters[1]": "In their own words",
      "filters[2]": "From the ground",
      "filters[3]": "Voices of Tuidang",
      "filters[4]": "Film",
      "pager[5]": "Next →",
      "yearPanel.title": "By year",
      "yearPanel.links[3].label": "2005–2023 archive",
      "ctaPanel.title": "You can make one too",
      "ctaPanel.body":
        "A statement takes about three minutes, can be entirely anonymous, and is free.",
      "ctaPanel.buttonLabel": "Make a statement",
      "ctaPanel.buttonStamp": "Quit",
      "relatedPanel.title": "Related",
      "relatedPanel.links[0].label": "Volunteer stories",
      "relatedPanel.links[1].label": "Films and programmes",
      "relatedPanel.links[2].label": "Global network"
    }
  }
];


/* ── 文章页版式参考（/news/article） ──────────────────────────── */

/*
 * 这一页是一篇样例文章（国会山那篇），当作文章版式的参考。界面部分照译；
 * 文章本身 —— 标题、导语、正文、署名、配图说明、相关报导 —— 全部清空，
 * 它是一篇具体的中文报导，不是版式的一部分。
 */
const NEWS_ARTICLE_EN: Record<string, string | null> = {
  title: null,
  dek: null,
  tag: "International solidarity",
  "breadcrumb.homeLabel": "Home",
  "breadcrumb.sectionLabel": "News and reports",
  "breadcrumb.current": "International solidarity",
  "actionPills[0].label": "Copy link",
  "actionPills[1].label": "Download PDF",
  "actionPills[2].label": "About reposting",
  "actionPills[3].label": "Print",
  "sectionPanel.title": "This section",
  "sectionPanel.links[0].label": "International solidarity",
  "sectionPanel.links[1].label": "Announcements and statements",
  "sectionPanel.links[2].label": "WOIPFG investigation reports",
  "reusePanel.title": "Reposting",
  "reusePanel.body":
    "This piece may be reposted, translated and re-edited without permission in advance; just credit the source.",
  "relatedSection.eyebrow": "Related coverage",
  "ctaPanel.title": "You can make one too",
  "ctaPanel.body": "A statement takes about three minutes, can be entirely anonymous, and is free.",
  "ctaPanel.buttonLabel": "Make a statement",
  "ctaPanel.buttonStamp": "Quit"
};


/* ── 移民相关政策（/services/immigration） ────────────────────── */

/*
 * 这一页反复强调「不是法律意见、不代办、不与中介合作」—— 那是在防一类真实的
 * 伤害：冒用机构名义收费代办。英文照着这个分寸写，别把话说软。
 */
const SERVICES_IMMIGRATION_EN: Record<string, string | null> = {
  title: "Immigration policy and questions",
  subtitle:
    "A guide to the published policy documents, with parliamentary action and reporting on individual cases. We do not give legal advice and we do not handle immigration applications for anyone.",
  "pager[3]": "Next →",

  "alertPanel.title": "This page is not legal advice",
  "alertPanel.body":
    "Policy changes quickly from country to country and cases differ widely. For an actual application, consult a licensed lawyer.",

  "policySection.eyebrow": "Policy documents",
  "policySection.title": "United States (USCIS) rules",
  "policySection.items[0].tag": "Policy",
  "policySection.items[0].title": "USCIS on immigration and Communist Party membership",
  "policySection.items[0].body": "What it applies to, and the exceptions, set out from the published text.",
  "policySection.items[1].tag": "Policy",
  "policySection.items[1].title":
    "USCIS discretionary considerations for applicants who were Party members",
  "policySection.items[1].body":
    "When a waiver can be argued for, and what an officer weighs in deciding.",
  "policySection.items[2].tag": "Q&A",
  "policySection.items[2].title": "Why to apply for a certificate early",
  "policySection.items[2].body":
    "Why timing matters, and the questions that come up when it is arranged at the last minute.",

  "reportSection.eyebrow": "Related coverage",
  "reportSection.title": "Parliamentary action and case reporting",

  "policySourcePanel.title": "The policy documents",
  "policySourcePanel.note": "Maintained on tuidang.org, which is the authoritative version.",
  "policySourcePanel.links[0].label": "USCIS on immigration and Communist Party membership",
  "policySourcePanel.links[1].label": "USCIS discretionary considerations",
  "policySourcePanel.links[2].label":
    "Former Party members emigrating to the US should provide a certificate of withdrawal",
  "policySourcePanel.links[3].label": "Non-immigrant visas also ask about Party membership",
  "policySourcePanel.links[4].label":
    "Naturalised citizens may also face removal over Party membership",
  "policySourcePanel.links[5].label": "Why to apply for a certificate early",

  "countriesPanel.title": "Other countries",
  "countriesPanel.items[0]": "Canada",
  "countriesPanel.items[1]": "Australia and New Zealand",
  "countriesPanel.items[2]": "Europe",
  "countriesPanel.items[3]": "Japan and South Korea",

  "proofPanel.title": "Need the document itself?",
  "proofPanel.body":
    "A certificate of withdrawal is issued in your real name, in Chinese and English, with a public way to verify it.",
  "proofPanel.buttonLabel": "About applying",

  "reminderPanel.title": "A reminder",
  "reminderPanel.body":
    "We do not handle immigration applications and we work with no immigration agent. A certificate of withdrawal is obtained only through our own official channels. Do not trust anyone — any firm or individual — claiming they can apply on your behalf, speed it up, or guarantee the result."
};

/* ── 页面清单 ─────────────────────────────────────────────────────── */

const PAGES: PagePlan[] = [
  { path: "pages/home.json", en: HOME_EN, clear: HOME_CLEAR, drop: HOME_DROP },
  { path: "pages/services-index.json", en: SERVICES_EN },
  {
    path: "pages/videos-index.json",
    en: VIDEOS_EN,
    drop: ["featured"],
    clear: ["sections[0].items", "sections[1].items", "sections[2].items", "sections[3].items", "sections[4].items"]
  },
  { path: "pages/resources-index.json", en: RESOURCES_EN },
  /* stories 是三篇真实中文报导的摘录，英文站没有对应文章，清空等编辑填。 */
  { path: "pages/involve-index.json", en: INVOLVE_EN, clear: ["stories"] },
  { path: "pages/about-index.json", en: ABOUT_EN },
  { path: "pages/about-team.json", en: ABOUT_TEAM_EN },
  { path: "pages/about-history.json", en: ABOUT_HISTORY_EN },
  { path: "pages/resources-downloads.json", en: RESOURCES_DOWNLOADS_EN },
  { path: "pages/services-faq.json", en: SERVICES_FAQ_EN },
  { path: "pages/involve-volunteer.json", en: INVOLVE_VOLUNTEER_EN },
  { path: "pages/services-cert.json", en: SERVICES_CERT_EN },
  { path: "pages/services-declare.json", en: SERVICES_DECLARE_EN },
  { path: "pages/resources-culture.json", en: RESOURCES_CULTURE_EN, clear: ["items"] },
  { path: "pages/about-numbers.json", en: ABOUT_NUMBERS_EN },
  { path: "pages/about-network.json", en: ABOUT_NETWORK_EN },
  { path: "pages/involve-endccp.json", en: INVOLVE_ENDCCP_EN },
  { path: "pages/involve-stories.json", en: INVOLVE_STORIES_EN },
  { path: "pages/about-accountability.json", en: ABOUT_ACCOUNTABILITY_EN },
  { path: "pages/involve-other-ways.json", en: INVOLVE_OTHER_WAYS_EN },
  { path: "pages/services-privacy.json", en: SERVICES_PRIVACY_EN },
  { path: "pages/services-verify.json", en: SERVICES_VERIFY_EN },
  { path: "pages/services-contact.json", en: SERVICES_CONTACT_EN },
  /*
   * 七页同构，所以用同一份配方生出来。clear 把两种列表都算上 —— gridItems 是
   * 卡片墙，episodes 是分集列表，不是每页都有，setAt 找不到就跳过，不会报错。
   */
  ...VIDEO_SECTION_PAGES.map((v) => ({
    path: v.path,
    en: {
      title: v.title,
      subtitle: v.subtitle,
      ...(v.more ? { moreButtonLabel: v.more } : {}),
      ...VIDEO_REUSE_EN,
      ...(v.extra ?? {})
    } as Record<string, string | null>,
    drop: ["featured"],
    clear: ["gridItems", "episodes"]
  })),
  ...MAGAZINE_ISSUES.map((m) => ({
    path: m.path,
    en: {
      title: m.title,
      subtitle: m.subtitle,
      "sections[0].body": m.summary,
      ...MAGAZINE_SHARED_EN
    } as Record<string, string | null>
  })),
  ...BOOK_PAGES.map((b) => ({
    path: b.path,
    en: {
      title: b.title,
      subtitle: b.subtitle,
      "sections[0].heading": "About the book",
      "sections[0].body": b.about,
      "sections[1].heading": "Reading and sharing",
      "sections[1].body": b.reading,
      "relatedLinks[0].label": b.links[0],
      "relatedLinks[1].label": b.links[1],
      "relatedLinks[2].label": b.links[2]
    } as Record<string, string | null>
  })),
  { path: "pages/resources-tools.json", en: RESOURCES_TOOLS_EN },
  { path: "pages/resources-magazine.json", en: RESOURCES_MAGAZINE_EN },
  { path: "pages/resources-press.json", en: RESOURCES_PRESS_EN },
  { path: "pages/legal-terms.json", en: LEGAL_TERMS_EN },
  { path: "pages/legal-privacy.json", en: LEGAL_PRIVACY_EN },
  {
    path: "pages/news-index.json",
    en: NEWS_INDEX_EN,
    drop: ["frontLead"],
    clear: [
      "items", "briefItems", "frontList",
      "announcementsSection.items", "investigationsSection.items", "commentarySection.items",
      "solidaritySection.items", "storiesSection.items", "notableSection.items"
    ]
  },
  { path: "pages/news-notable.json", en: NEWS_NOTABLE_EN },
  ...NEWS_SECTION_PAGES.map((n) => ({
    path: n.path,
    en: n.en,
    clear: ["items", "noticeRows", "docRows", "pages"]
  })),
  {
    path: "pages/news-article.json",
    en: NEWS_ARTICLE_EN,
    drop: ["heroFigure", "inlineFigure", "bodyLink"],
    clear: ["body", "byline", "relatedSection.items", "pages"]
  },
  { path: "pages/services-immigration.json", en: SERVICES_IMMIGRATION_EN, clear: ["items", "reportSection.items"] }
];

/* ── 机械部分 ─────────────────────────────────────────────────────── */

const HAN = /[一-鿿]/;

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

/** 把 `a.b[0].c` 拆成 ["a","b",0,"c"]。 */
function parsePath(path: string): (string | number)[] {
  const parts: (string | number)[] = [];
  for (const chunk of path.split(".")) {
    const m = chunk.match(/^([^[]+)((\[\d+\])*)$/);
    if (!m) { parts.push(chunk); continue; }
    parts.push(m[1]);
    for (const idx of m[2].matchAll(/\[(\d+)\]/g)) parts.push(Number(idx[1]));
  }
  return parts;
}

function setAt(root: unknown, path: string, value: unknown): boolean {
  const parts = parsePath(path);
  let node: any = root;
  for (const part of parts.slice(0, -1)) {
    if (node == null) return false;
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (node == null || !(last in node)) return false;
  node[last] = value;
  return true;
}

function deleteAt(root: unknown, path: string): boolean {
  const parts = parsePath(path);
  let node: any = root;
  for (const part of parts.slice(0, -1)) {
    if (node == null) return false;
    node = node[part];
  }
  const last = parts[parts.length - 1];
  if (node == null || !(last in node)) return false;
  delete node[last];
  return true;
}

/** 走一遍，把还带汉字的字段连同路径收集出来。 */
function remainingChinese(node: unknown, path: string, out: [string, string][]) {
  if (typeof node === "string") {
    if (HAN.test(node)) out.push([path, node]);
    return;
  }
  if (Array.isArray(node)) {
    node.forEach((v, i) => remainingChinese(v, `${path}[${i}]`, out));
    return;
  }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) remainingChinese(v, path ? `${path}.${k}` : k, out);
  }
}

async function main() {
  loadEnv(resolve(process.cwd(), ".env.local"));
  loadEnv(resolve(process.cwd(), ".env"));

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("需要 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const db = createClient(url, key, { auth: { persistSession: false } });

  /*
   * --dump：把中文站某一页里带汉字的字段连同路径列出来，用来写 EN 表。
   *
   * 这件事要重复十几次（一页一次），所以做进工具本身，不要每次临时写一个
   * 脚本 —— 临时脚本会漏删，也没人记得当初是怎么数的。
   */
  const dump = arg("--dump");
  if (dump) {
    const path = dump.includes("/") ? dump : `pages/${dump}.json`;
    const { data, error } = await db
      .from("cms_content_entries")
      .select("data")
      .eq("locale", "zh")
      .eq("path", path)
      .maybeSingle();
    if (error) throw new Error(`读不到 ${path}：${error.message}`);
    if (!data) throw new Error(`中文站没有 ${path}`);
    const fields: [string, string][] = [];
    remainingChinese(data.data, "", fields);
    console.log(`\n${path}：${fields.length} 个字段带汉字\n`);
    for (const [k, v] of fields) console.log(`${k}\n   ${v}\n`);
    return;
  }

  const locale = (arg("--locale") ?? "").trim().toLowerCase();
  const apply = process.argv.includes("--apply");
  const only = arg("--only");
  if (!locale) throw new Error("要指定 --locale，例如 --locale en");
  if (locale === "zh") throw new Error("拒绝往 zh 写。中文站是生产，编辑每天在用。");
  if (locale !== "en") throw new Error(`目前只有 en 的文案，--locale ${locale} 还没有可播的内容`);

  const todo = only ? PAGES.filter((p) => p.path.includes(only)) : PAGES;
  if (todo.length === 0) throw new Error(`--only ${only} 没匹配到任何页`);

  console.log(`\n========== 给 ${locale} 站播 ${todo.length} 页正文${apply ? "" : "（预演）"} ==========`);

  let failures = 0;
  for (const plan of todo) {
    console.log(`\n── ${plan.path}`);

    /* 模子：中文站那一份。只读，不动它。 */
    const { data: source, error: readError } = await db
      .from("cms_content_entries")
      .select("data")
      .eq("locale", "zh")
      .eq("path", plan.path)
      .maybeSingle();
    if (readError) throw new Error(`读不到中文站的 ${plan.path}：${readError.message}`);
    if (!source) {
      console.log("  ！ 中文站没有这一页，跳过");
      failures += 1;
      continue;
    }

    const page = JSON.parse(JSON.stringify(source.data));

    for (const path of plan.drop ?? []) {
      if (deleteAt(page, path)) console.log(`  － 丢掉 ${path}`);
    }

    for (const path of plan.clear ?? []) {
      if (setAt(page, path, [])) console.log(`  ○ 清空 ${path}`);
    }

    for (const [section, lists] of Object.entries(plan.disable ?? {})) {
      if (!page[section]) continue;
      page[section].enabled = false;
      for (const list of lists) if (Array.isArray(page[section][list])) page[section][list] = [];
      console.log(`  ○ 关掉 ${section}${lists.length ? `（并清空 ${lists.join("、")}）` : ""}`);
    }

    let replaced = 0;
    const missed: string[] = [];
    for (const [path, value] of Object.entries(plan.en)) {
      if (setAt(page, path, value === null ? "" : value)) replaced += 1;
      else missed.push(path);
    }
    console.log(`  换了 ${replaced} 处文案`);
    if (missed.length) {
      console.log(`  ！ ${missed.length} 条写了英文但模子里找不到位置（中文站可能改过结构）：`);
      for (const p of missed) console.log(`      ${p}`);
    }

    /* 硬检查：不该再有汉字。 */
    const left: [string, string][] = [];
    remainingChinese(page, "", left);
    if (left.length) {
      console.log(`  ✗ 还有 ${left.length} 个字段是中文：`);
      for (const [k, v] of left.slice(0, 12)) console.log(`      ${k}  ${v.slice(0, 60)}`);
      if (left.length > 12) console.log(`      …另外 ${left.length - 12} 个`);
      failures += 1;
      continue;
    }
    console.log("  ✓ 没有汉字残留");

    if (!apply) continue;
    page.meta = { ...(page.meta ?? {}), path: plan.path };
    const { error } = await db
      .from("cms_content_entries")
      .upsert({ path: plan.path, locale, data: page }, { onConflict: "locale,path" });
    if (error) throw new Error(`${plan.path} 写失败：${error.message}`);
    console.log("  ✓ 写好了");
  }

  if (failures > 0) {
    console.log(`\n✗ ${failures} 页没过。补进 EN 表，或者把那一块关掉。\n`);
    process.exit(1);
  }
  console.log(apply ? "\n✓ 全部写好。\n" : "\n（预演，一个字都没写。加 --apply 才真跑。）\n");
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}\n`);
  process.exit(1);
});
