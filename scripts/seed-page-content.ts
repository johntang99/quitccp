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
  "voices.eyebrow": "In their own words",
  "voices.heading": "Why they chose to say it publicly",
  "voices.moreLabel": "More testimony →",
  "channels.heading": "Series"
};

/**
 * 整块关掉的区块：enabled 设为 false，并且把列表清空。
 *
 * 只关开关不清列表是不够的 —— 中文的标题、人名、引语还留在数据里，编辑哪天
 * 打开开关，中文就回来了，而且没人会想到去看。
 */
const HOME_DISABLE: Record<string, string[]> = {
  news: ["items"],
  video: ["items", "series"],
  voices: ["items"],
  channels: ["cards"]
};

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

/* ── 页面清单 ─────────────────────────────────────────────────────── */

const PAGES: PagePlan[] = [
  { path: "pages/home.json", en: HOME_EN, disable: HOME_DISABLE, drop: HOME_DROP },
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
  { path: "pages/resources-culture.json", en: RESOURCES_CULTURE_EN, clear: ["items"] }
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
