"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ABOUT_BLOCKS, ABOUT_SUBPAGE_BLOCKS, AboutSectionsEditor } from "./AboutSectionsEditor";
import { INVOLVE_BLOCKS } from "./involve-blocks";
import { SERVICES_BLOCKS } from "./services-blocks";
import { RESOURCES_BLOCKS } from "./resources-blocks";
import { LEGAL_BLOCKS } from "./legal-blocks";
import { HomeSectionsEditor } from "@/components/admin/HomeSectionsEditor";
import { BooksEditor } from "@/components/admin/BooksEditor";
import { ImagePickerModal } from "@/components/admin/ImagePickerModal";

interface ContentFileItem {
  path: string;
  label: string;
  locale: string;
  section: string;
  slug: string;
  template: string;
  updatedAt?: string;
  hasRecord: boolean;
}

interface ContentRevisionItem {
  id: string;
  entryId: string;
  locale: string;
  path: string;
  createdBy: string;
  note?: string;
  createdAt: string;
}

interface StructuredFieldTemplate {
  key: string;
  label: string;
  minHeight?: number;
}

type StructuredFieldMode = "text" | "json";

interface StructuredFormFieldDef extends StructuredFieldTemplate {
  mode: StructuredFieldMode;
}

function parseObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toPrettyJson(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function parseJsonValue(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

const HOME_PATH = "pages/home.json";
const BOOKS_PATH = "pages/resources-index.json";

/**
 * Display-only rename of the homepage group. The underlying section stays
 * "root" because `routeSeeds` uses it to build the route catalogue -- renaming
 * it there would move the page off "/".
 */
const SECTION_DISPLAY_NAMES: Record<string, string> = {
  root: "home",
  legal: "法律文件"
};

/**
 * Group order in the sidebar. Anything not listed falls to the end,
 * alphabetically.
 *
 * The homepage leads rather than sitting under "about": it is the page edited
 * most often, and alphabetical order was putting the most-used entry second.
 */
const SECTION_GROUP_ORDER = [
  "root", // shown as "home"
  "about",
  "involve",
  "news",
  "resources",
  "services",
  "videos",
  // Last: the two legal documents are edited rarely and only with approval.
  "legal"
];

function sectionDisplayName(section: string): string {
  return SECTION_DISPLAY_NAMES[section] ?? section;
}

/** Relabels "root/index - 首页" as "home/index - 首页" for the same reason. */
function fileDisplayLabel(file: { label: string; section: string }): string {
  const display = SECTION_DISPLAY_NAMES[file.section];
  if (!display) return file.label;
  return file.label.startsWith(`${file.section}/`)
    ? `${display}/${file.label.slice(file.section.length + 1)}`
    : file.label;
}

const ABOUT_INDEX_PATH = "pages/about-index.json";
const ABOUT_BLOCK_KEYS = ["intro", "numbersBand", "network", "accountability", "team", "history"] as const;
const ABOUT_BLOCK_DEFAULTS: Record<(typeof ABOUT_BLOCK_KEYS)[number], unknown> = {
  intro: {
    eyebrow: "机构简介",
    paragraphs: [
      "二〇〇四年十一月，《九评共产党》系列社论发表后，陆续有中国民众公开声明退出中共党、团、队组织。为了让这些声明能够被完整登记、保存与查证，全球退党服务中心于二〇〇五年一月在纽约成立。",
      "二十年来，我们登记了四亿六千多万份声明。这些声明由当事人自行提交，可以使用真名、化名或代号；我们不要求提供身份证明，也不核对提交者的真实身份。我们承诺完整保存每一份声明的原文与提交时间，并对外公开可查。"
    ],
    principlesHeading: "我们的原则",
    principles: [
      {
        label: "自愿。",
        text: "所有声明均由当事人自行决定并提交。我们不代人声明，不接受第三方代为提交他人的声明。"
      },
      {
        label: "免费。",
        text: "登记、证明办理与查询验证全部免费。我们从不以任何名义向服务对象收取费用。任何以本中心名义收费的行为都与我们无关。"
      },
      {
        label: "保护。",
        text: "提交人可以完全匿名。我们不收集与声明无关的个人信息，服务器设于美国境内，并采取加密与访问控制措施。详见",
        linkLabel: "隐私与数据保护说明",
        linkHref: "/services/privacy",
        linkSuffix: "。"
      },
      {
        label: "公开。",
        text: "统计口径、财务报表、治理结构与年度工作全部公开。针对本机构的威胁与攻击同样公开记录。"
      }
    ],
    sidebarTitle: "本页内容",
    sidebarLinks: [
      { label: "数字与统计方法", href: "/about/numbers" },
      { label: "全球服务网络", href: "/about/network" },
      { label: "公开与问责", href: "/about/accountability" },
      { label: "理事会与团队", href: "/about/team" },
      { label: "历史沿革", href: "/about/history" }
    ],
    downloadPanelTitle: "下载",
    downloadPanelBody: "年度工作报告与经审计财务报表，可自由下载与转载。",
    downloadPanelButtonLabel: "2025 年度报告 PDF",
    downloadPanelButtonHref: "#"
  },
  numbersBand: {
    eyebrow: "数字与统计方法",
    heading: "这个数字是怎么统计的",
    lede: "我们把统计口径完整公开，包括计入规则、去重方式、更新频率与已知局限。任何人都可以据此判断这个数字的意义与边界。",
    stats: [
      { value: "464,375,383", label: "累计声明人数" },
      { value: "38,403", label: "日均新增" },
      { value: "每 10 分钟", label: "数字更新频率" },
      { value: "2005-01", label: "登记起始" }
    ],
    actions: [
      { label: "统计方法完整说明", href: "/about/numbers", variant: "seal" },
      { label: "历年数据与区域分布", href: "/about/numbers", variant: "line-light" }
    ]
  },
  network: {
    eyebrow: "全球网络",
    heading: "一百多个服务点，由志愿者维持运转",
    lede: "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。",
    moreLabel: "查找服务点 →",
    moreHref: "/about/network",
    stats: [
      { value: "100+", label: "全球服务点" },
      { value: "20+", label: "覆盖国家与地区" },
      { value: "2,000+", label: "登记在册志愿者" },
      { value: "0", label: "服务收费" }
    ]
  },
  accountability: {
    eyebrow: "公开与问责",
    heading: "财务、治理与安全",
    lede: "财务报表经独立会计师事务所审计，Form 990 依法公开。我们同时公开记录针对本机构的威胁与攻击事件。",
    moreLabel: "年度报告 →",
    moreHref: "/about/accountability",
    cells: [
      {
        title: "注册与法律地位",
        value: "501(c)(3)",
        body: "在美国注册的非营利组织，捐款可依法抵税。年度 Form 990 公开可查。"
      },
      {
        title: "资金使用（上一财年）",
        value: "",
        bars: [
          { width: 132, text: "项目支出 84%", tone: "b1" },
          { width: 16, text: "行政 10%", tone: "b2" },
          { width: 10, text: "筹款 6%", tone: "b3" }
        ],
        body: "经独立会计师事务所审计，报表全文可下载。"
      },
      {
        title: "安全与威胁记录",
        value: "公开档案",
        body: "本机构多次收到炸弹恐吓等威胁信。相关事件、报案与处理经过全部公开记录。"
      }
    ],
    links: [
      { label: "财务报表与 Form 990", href: "#" },
      { label: "年度工作报告", href: "#" },
      { label: "统计方法说明", href: "#" },
      { label: "安全事件档案", href: "#" },
      { label: "隐私与数据保护", href: "/services/privacy" },
      { label: "Candid 透明度认证", href: "#" }
    ]
  },
  team: {
    eyebrow: "理事会与团队",
    heading: "负责的人",
    lede: "全职人员极少，绝大部分工作由志愿者完成。以下为理事会成员与主要负责人。",
    people: [
      { name: "姓名占位", roleLine1: "理事长", roleLine2: "2005 年起", image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png" },
      { name: "姓名占位", roleLine1: "理事", roleLine2: "法律与合规", image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png" },
      { name: "姓名占位", roleLine1: "理事", roleLine2: "财务", image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png" },
      { name: "姓名占位", roleLine1: "秘书长", roleLine2: "服务点网络", image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png" }
    ]
  },
  history: {
    eyebrow: "历史沿革",
    heading: "二〇〇五年至今",
    timeline: [
      { date: "2004.11", body: "《九评共产党》系列社论发表，开始有民众公开声明退出中共组织。" },
      { date: "2005.01", body: "全球退党服务中心在纽约成立，开始系统登记并保存声明。" },
      { date: "2007", body: "累计声明突破两千万份；海外服务点开始成规模设立。" },
      { date: "2013", body: "推出退党证明办理与第三方在线查询验证服务。" },
      { date: "2020", body: "累计声明突破三亿五千万份；多语种站点上线。" },
      { date: "2024", body: "《九评共产党》发表二十周年；累计声明突破四亿三千万份。" },
      { date: "2026.07", body: "美国国会议员联署声明表彰退出中共运动，载入《国会议事录》。" }
    ],
    contactTitle: "联系我们",
    contactAddressLines: ["40-46 Main Street", "Flushing, NY 11354"],
    contactLinks: [
      { label: "媒体与采访联络", href: "/services/contact" },
      { label: "服务点与志愿者事务", href: "/services/contact" },
      { label: "证明办理咨询", href: "/services/contact" }
    ]
  }
};

const ABOUT_PAGE_DEFAULT_CONTENTS: Record<string, Record<string, unknown>> = {
  "pages/about-network.json": {
    title: "一百多个服务点，由志愿者维持运转",
    subtitle: "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。",
    stats: [
      { value: "100+", label: "全球服务点" },
      { value: "20+", label: "覆盖国家与地区" },
      { value: "2,000+", label: "登记在册志愿者" },
      { value: "0", label: "服务收费" }
    ],
    filters: ["全部", "北美", "欧洲", "亚太", "大洋洲"],
    mapBlock: {
      label: "地图",
      text: "此处为可交互地图。点选任一服务点可查看地址、开放时间与联络方式。具体到街道的位置信息是否公开，需由安全评估后决定。"
    },
    locations: [
      { tag: "北美", title: "纽约 · 法拉盛", body: "缅街与罗斯福大道一带，每日均有义工值守。可现场声明、办理与领取证明。", meta: "每日 10:00-18:00" },
      { tag: "亚太", title: "台北 · 台北车站", body: "站前广场真相点，开设逾十年。协助现场登记与解答证明相关问题。", meta: "每日 11:00–19:00" },
      { tag: "亚太", title: "韩国 · 济州岛", body: "码头、免税店与主要景点前轮班值守，主要面向邮轮旅客。", meta: "依邮轮班次调整" },
      { tag: "欧洲", title: "伦敦 · 中国城", body: "周末于中国城一带设点，提供中英文咨询。", meta: "周六、周日 12:00–18:00" }
    ],
    pager: ["1", "2", "3", "下一页 →"],
    ctaPanel: { title: "找不到附近的服务点？", body: "你也可以在线声明，或通过电话与邮件提交。全部方式效力相同。", buttonLabel: "在线声明", buttonHref: "/services/declare" },
    setupPanel: {
      title: "想在你的城市设点",
      links: [
        { label: "成为义工", href: "/involve/volunteer" },
        { label: "下载展板与传单", href: "/resources/downloads" },
        { label: "联系我们", href: "/services/contact" }
      ]
    },
    offeringsPanel: {
      title: "服务点提供",
      items: ["现场声明登记", "证明办理与领取", "证明与移民问题咨询", "纸本声明代转", "资料索取"]
    }
  },
  "pages/about-accountability.json": {
    title: "我们如何被检验",
    subtitle: "财务报表经独立会计师事务所审计，Form 990 依法公开。治理结构与统计方法全部公开。针对本机构的威胁与攻击同样公开记录。",
    summaryCells: [
      { title: "注册与法律地位", value: "501(c)(3)", body: "在美国注册的非营利组织，捐款可依法抵税。年度 Form 990 公开可查。", bars: [] },
      { title: "资金使用（上一财年）", value: "", body: "", bars: [{ width: 132, text: "项目支出 84%", tone: "b1" }, { width: 16, text: "行政 10%", tone: "b2" }, { width: 10, text: "筹款 6%", tone: "b3" }] },
      { title: "安全与威胁记录", value: "公开档案", body: "本机构多次收到炸弹恐吓等威胁信。事件、报案与处理经过全部公开记录。", bars: [] }
    ],
    summaryLinks: [
      { label: "财务报表与 Form 990", href: "#" },
      { label: "年度工作报告", href: "#" },
      { label: "统计方法说明", href: "#" },
      { label: "安全事件档案", href: "#" }
    ],
    proseSections: [
      { heading: "财务", paragraphs: ["年度财务报表由独立会计师事务所审计，全文可下载。Form 990 依美国法律公开，也可在 Candid 与 ProPublica 等第三方平台查阅。"] },
      { heading: "治理", paragraphs: ["理事会为最高决策机构，成员名单、职责与任期公开。全职人员极少，绝大部分工作由志愿者完成。"] },
      {
        heading: "安全事件",
        paragraphs: [
          "自二〇二五年起，本中心多次收到炸弹恐怖攻击威胁信与勒索信，已向执法机关报案。我们选择把这些事件公开记录，包括威胁信内容、报案经过与处理进展。",
          "一个记录针对自己的攻击的机构，比一个只展示成绩的机构更值得检验。"
        ]
      },
      { heading: "隐私与数据", paragraphs: ["我们不收集与声明无关的个人信息，不要求身份证明，服务器设于美国境内，并采取加密与访问控制措施。详见隐私与数据保护说明。"] }
    ],
    downloadsPanel: {
      title: "下载与查阅",
      links: [
        { label: "2025 年度工作报告 PDF", href: "#" },
        { label: "经审计财务报表", href: "#" },
        { label: "Form 990（历年）", href: "#" },
        { label: "统计方法说明", href: "/about/numbers" },
        { label: "安全事件档案", href: "#" },
        { label: "隐私与数据保护", href: "/services/privacy" },
        { label: "服务条款", href: "#" }
      ]
    },
    thirdPartyPanel: {
      title: "第三方认证",
      links: [
        { label: "Candid 透明度认证", href: "#" },
        { label: "Charity Navigator", href: "#" },
        { label: "IRS 免税组织查询", href: "#" }
      ]
    }
  },
  "pages/about-team.json": {
    title: "负责的人",
    subtitle: "",
    boardPanel: {
      eyebrow: "理事会",
      heading: "Board of Directors",
      people: [
        { name: "姓名占位", roleLine1: "理事长", roleLine2: "2005 年起", image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png" },
        { name: "姓名占位", roleLine1: "理事", roleLine2: "法律与合规", image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png" },
        { name: "姓名占位", roleLine1: "理事", roleLine2: "财务", image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png" }
      ]
    },
    staffPanel: {
      eyebrow: "执行团队",
      heading: "Staff",
      people: [
        { name: "姓名占位", roleLine1: "秘书长", roleLine2: "服务点网络", image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png" },
        { name: "姓名占位", roleLine1: "证明签发", roleLine2: "", image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png" },
        { name: "姓名占位", roleLine1: "编辑部", roleLine2: "", image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png" }
      ]
    },
    notePanel: {
      heading: "关于姓名与照片",
      body: "公开领导层姓名是国际 NGO 的通行做法，也是本站问责承诺的一部分。但部分同事及其在中国大陆的家人可能因此承担风险，因此个别人员以职务代替姓名列出，并在此说明原因。"
    },
    relatedPanel: {
      title: "相关",
      links: [
        { label: "公开与问责", href: "/about/accountability" },
        { label: "历史沿革", href: "/about/history" },
        { label: "联系我们", href: "/services/contact" }
      ]
    },
    joinPanel: { title: "加入我们", body: "绝大部分工作由志愿者完成。时间多少不限。", buttonLabel: "成为义工", buttonHref: "/involve/volunteer" }
  },
  "pages/about-numbers.json": {
    title: "这个数字是怎么统计的",
    subtitle: "",
    stats: [
      { value: "464,375,383", label: "累计声明人数" },
      { value: "38,403", label: "日均新增" },
      { value: "每 10 分钟", label: "更新频率" },
      { value: "2005-01", label: "登记起始" }
    ],
    sections: [
      {
        heading: "计入规则",
        paragraphs: [
          "每一份公开提交的三退声明计为一次登记。一份声明中若同时列出多位声明人（例如家庭成员一同声明），按实际人数计入。",
          "声明可通过网站、服务点、电话、邮件或义工代转提交。所有渠道使用同一套编号，不分别计数。"
        ]
      },
      { heading: "去重方式", paragraphs: ["同一署名在短时间内重复提交的相同内容会被合并为一次。但由于我们不要求身份证明，无法排除同一个人使用不同署名多次声明的情况——这是这项统计已知的局限，我们不回避。"] },
      { heading: "更新频率", paragraphs: ["首页计数器每十分钟同步一次登记数据库。显示的是累计登记总量，不是估算值。"] },
      {
        heading: "这个数字不代表什么",
        paragraphs: [
          "它不是「反对中共的人数」，也不是任何形式的民意调查结果。它只代表一件事：有这么多份声明被提交、被登记、被保存。",
          "我们认为把边界说清楚，比把数字说大更重要。"
        ]
      },
      { heading: "数据可得性", paragraphs: ["历年数据、月度变化与区域分布见年度报告，可自由下载与引用。研究者如需更细的数据，请与我们联系。"] }
    ],
    actions: [
      { label: "下载历年数据（CSV）", href: "#", variant: "seal" },
      { label: "年度报告", href: "/about/accountability", variant: "line" }
    ],
    relatedLinks: [
      { label: "公开与问责", href: "/about/accountability" },
      { label: "全球服务网络", href: "/about/network" },
      { label: "年度报告 PDF", href: "#" },
      { label: "研究合作联络", href: "/services/contact" }
    ],
    citationPanel: { title: "引用", body: "是的，可以自由引用。请注明来源与取数日期，因为数字每天都在变。", label: "媒体资料", href: "/resources/press" }
  },
  "pages/about-history.json": {
    title: "二〇〇五年至今",
    subtitle: "",
    timeline: [
      { date: "2004.11", body: "《九评共产党》系列社论发表，开始有民众公开声明退出中共组织。" },
      { date: "2005.01", body: "全球退党服务中心在纽约成立，开始系统登记并保存声明。" },
      { date: "2007.07", body: "发起「七月全球退党解体中共月」，此后每年举办。" },
      { date: "2007", body: "累计声明突破两千万份；海外服务点开始成规模设立。" },
      { date: "2013", body: "推出退党证明办理与第三方在线查询验证服务。" },
      { date: "2020.11", body: "发起 End CCP 全球公开联署。" },
      { date: "2020", body: "累计声明突破三亿五千万份；多语种站点上线。" },
      { date: "2024.11", body: "End CCP 环美车队走遍美国五十州。" },
      { date: "2024.12", body: "《九评共产党》发表二十周年；累计声明突破四亿三千万份。" },
      { date: "2025.04", body: "本中心多次收到炸弹恐怖攻击威胁信，已报案并公开记录。" },
      { date: "2026.07", body: "美国国会议员联署声明表彰退出中共运动，载入《国会议事录》；31 名华人在国会山领取退党证明。" }
    ],
    relatedLinks: [
      { label: "年度报告", href: "/about/accountability" },
      { label: "历年数据", href: "/about/numbers" },
      { label: "机构公告与声明", href: "/news" },
      { label: "《九评共产党》全文", href: "/resources" }
    ]
  }
};

const ABOUT_STRUCTURED_FORM_FIELDS: Record<string, StructuredFieldTemplate[]> = {
  "pages/about-accountability.json": [
    { key: "summaryCells", label: "摘要卡片（summaryCells）", minHeight: 220 },
    { key: "summaryLinks", label: "摘要链接（summaryLinks）", minHeight: 140 },
    { key: "proseSections", label: "正文分段（proseSections）", minHeight: 240 },
    { key: "downloadsPanel", label: "下载面板（downloadsPanel）", minHeight: 200 },
    { key: "thirdPartyPanel", label: "第三方面板（thirdPartyPanel）", minHeight: 180 }
  ],
  "pages/about-history.json": [
    { key: "timeline", label: "时间线（timeline）", minHeight: 260 },
    { key: "relatedLinks", label: "相关链接（relatedLinks）", minHeight: 140 }
  ],
  "pages/about-network.json": [
    { key: "stats", label: "统计卡片（stats）", minHeight: 170 },
    { key: "filters", label: "筛选标签（filters）", minHeight: 120 },
    { key: "mapBlock", label: "地图说明（mapBlock）", minHeight: 160 },
    { key: "locations", label: "服务点列表（locations）", minHeight: 260 },
    { key: "pager", label: "分页（pager）", minHeight: 120 },
    { key: "ctaPanel", label: "右侧 CTA（ctaPanel）", minHeight: 160 },
    { key: "setupPanel", label: "设点面板（setupPanel）", minHeight: 180 },
    { key: "offeringsPanel", label: "服务内容面板（offeringsPanel）", minHeight: 180 }
  ],
  "pages/about-numbers.json": [
    { key: "stats", label: "顶部统计（stats）", minHeight: 170 },
    { key: "sections", label: "正文章节（sections）", minHeight: 280 },
    { key: "actions", label: "操作按钮（actions）", minHeight: 140 },
    { key: "relatedLinks", label: "相关链接（relatedLinks）", minHeight: 140 },
    { key: "citationPanel", label: "引用面板（citationPanel）", minHeight: 160 }
  ],
  "pages/about-team.json": [
    { key: "boardPanel", label: "理事会面板（boardPanel）", minHeight: 260 },
    { key: "staffPanel", label: "执行团队面板（staffPanel）", minHeight: 260 },
    { key: "notePanel", label: "说明面板（notePanel）", minHeight: 150 },
    { key: "relatedPanel", label: "相关链接面板（relatedPanel）", minHeight: 160 },
    { key: "joinPanel", label: "加入我们面板（joinPanel）", minHeight: 150 }
  ]
};

function shouldUseAboutDefaultBlock(key: (typeof ABOUT_BLOCK_KEYS)[number], value: unknown): boolean {
  if (value === undefined || value === null) return true;
  const raw = JSON.stringify(value);
  return raw.includes("段落 1") || raw.includes("说明文本") || raw.includes("事件描述") || raw.includes("example.com/avatar");
}

function shouldUseAboutPageDefaults(path: string, value: Record<string, unknown>): boolean {
  const raw = JSON.stringify(value);
  if (
    raw.includes("区块可增删排序") ||
    raw.includes("模块化内容块支持在 CMS 中按栏目自由组合。") ||
    raw.includes("长文页面适用于问答") ||
    raw.includes("这是一条可在后台编辑的提示信息。")
  ) {
    return true;
  }
  if (path === "pages/about-network.json") return !Array.isArray(value.locations);
  if (path === "pages/about-accountability.json") return !Array.isArray(value.summaryCells);
  if (path === "pages/about-team.json") return typeof value.boardPanel !== "object" || value.boardPanel === null;
  if (path === "pages/about-numbers.json") return !Array.isArray(value.stats) || !Array.isArray(value.sections);
  if (path === "pages/about-history.json") return !Array.isArray(value.timeline);
  return false;
}

function guessPreviewPath(path: string): string | null {
  if (!path.startsWith("pages/") || !path.endsWith(".json")) return null;
  const name = path.replace("pages/", "").replace(".json", "");
  if (name === "home") return "/";
  if (name === "news-article") return "/news/sample";
  const splitIndex = name.indexOf("-");
  if (splitIndex <= 0) return null;
  const section = name.slice(0, splitIndex);
  const slug = name.slice(splitIndex + 1);
  if (slug === "index") return `/${section}`;
  return `/${section}/${slug}`;
}

function setAtPath(input: Record<string, unknown>, keyPath: string[], value: unknown): Record<string, unknown> {
  const draft = structuredClone(input);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cursor: any = draft;
  for (let i = 0; i < keyPath.length - 1; i += 1) {
    const key = keyPath[i];
    const current = cursor[key];
    // Arrays must survive traversal: writing ["hero","gallery","0","src"] used
    // to replace the gallery array with {} and lose every item.
    if (typeof current !== "object" || current === null) {
      cursor[key] = /^\d+$/.test(keyPath[i + 1] ?? "") ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[keyPath[keyPath.length - 1]] = value;
  return draft;
}

export function ContentExplorer({ initialLocale = "zh", initialPath }: { initialLocale?: string; initialPath?: string }) {
  const [locale, setLocale] = useState(initialLocale);
  const [imagePickerField, setImagePickerField] = useState<string[] | null>(null);
  const [imagePickerLabel, setImagePickerLabel] = useState("");
  const [homeJsonDrafts, setHomeJsonDrafts] = useState<Record<string, string>>({});
  const [homeJsonErrors, setHomeJsonErrors] = useState<Record<string, string>>({});
  const [files, setFiles] = useState<ContentFileItem[]>([]);
  const [activePath, setActivePath] = useState(initialPath || "");
  const [activeData, setActiveData] = useState<Record<string, unknown> | null>(null);
  // Mirrors `activeData` synchronously so successive writes in one tick compose.
  const activeDataRef = useRef<Record<string, unknown> | null>(null);
  const [jsonDraft, setJsonDraft] = useState("{}");
  const [status, setStatus] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"form" | "json">("form");
  const [revisions, setRevisions] = useState<ContentRevisionItem[]>([]);
  const [aboutFormDrafts, setAboutFormDrafts] = useState<Record<string, string>>({});
  const [aboutFormErrors, setAboutFormErrors] = useState<Record<string, string>>({});

/**
 * Entries an editor must not be shown, because editing them changes nothing.
 *
 * Two separate reasons, both verified against the running site on 2026-10-07:
 *
 * 1. The page 404s. The seven old news menu slugs were replaced by the real
 *    categories (`/news/announcements` -> `/news/announcement-claims`), and the
 *    eleven book and magazine detail pages have a seed but no route.
 *
 * 2. The page renders, but never reads this entry. `/news` is built entirely by
 *    `getNewsHome()` from the database, and `/videos` plus every video category
 *    by `getVideoHome()` / `getVideoCategory()`. The article and film lists are
 *    supposed to come from the database -- that is the design -- so the stored
 *    `items`, `frontLead`, `briefItems` and the rest are leftovers that no
 *    template reads.
 *
 * Hiding them is not a loss of capability: none of these controls has ever had
 * an effect. The data stays in the table, so nothing is destroyed, and anything
 * removed from this list reappears immediately.
 */
const UNEDITABLE_PATHS = new Set([
  // 1. route 404s
  "pages/news-announcements.json",
  "pages/news-investigations.json",
  "pages/news-commentary.json",
  "pages/news-stories.json",
  "pages/news-solidarity.json",
  "pages/news-notable.json",
  "pages/news-article.json",
  "pages/resources-book-gongchanzhuyi-zhongji.json",
  "pages/resources-book-jieti-dangwenhua.json",
  "pages/resources-book-mogui-shijie.json",
  "pages/resources-magazine-archive.json",
  "pages/resources-magazine-2024-autumn.json",
  "pages/resources-magazine-2024-winter.json",
  "pages/resources-magazine-2025-spring.json",
  "pages/resources-magazine-2025-summer.json",
  "pages/resources-magazine-2025-autumn.json",
  "pages/resources-magazine-2025-winter.json",
  "pages/resources-magazine-2026-spring.json",
  // 2. page renders, but is driven by the database instead of this entry
  "pages/news-index.json",
  "pages/videos-index.json",
  "pages/videos-jiuping.json",
  "pages/videos-frontline.json",
  "pages/videos-ironclad.json",
  "pages/videos-awakening.json",
  "pages/videos-party-culture.json",
  "pages/videos-step-back.json"
]);

  const groupedFiles = useMemo(() => {
    const groups = new Map<string, ContentFileItem[]>();
    for (const file of files) {
      if (UNEDITABLE_PATHS.has(file.path)) continue;
      const key = file.section || "shared";
      const bucket = groups.get(key) ?? [];
      bucket.push(file);
      groups.set(key, bucket);
    }
    return [...groups.entries()].sort(([a], [b]) => {
      const ia = SECTION_GROUP_ORDER.indexOf(a);
      const ib = SECTION_GROUP_ORDER.indexOf(b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
      return a.localeCompare(b);
    });
  }, [files]);

  const activeDataMetaPath = useMemo(() => {
    if (!activeData) return "";
    const meta = (activeData.meta as Record<string, unknown> | undefined) ?? undefined;
    return typeof meta?.path === "string" ? meta.path : "";
  }, [activeData]);

  const activeDataMatchesPath = Boolean(activeData) && (!activeDataMetaPath || activeDataMetaPath === activePath);

  const structuredFields = useMemo<StructuredFormFieldDef[]>(() => {
    if (!activeData || !activePath.startsWith("pages/")) return [];
    const customFields = ABOUT_STRUCTURED_FORM_FIELDS[activePath];
    if (customFields) {
      return customFields.map((field) => ({ ...field, mode: "json" }));
    }
    return Object.keys(activeData)
      .filter((key) => !["meta", "title", "subtitle"].includes(key))
      .map((key) => {
        const value = activeData[key];
        const mode: StructuredFieldMode = typeof value === "string" ? "text" : "json";
        return {
          key,
          label: mode === "text" ? `${key}（文本）` : `${key}（JSON）`,
          minHeight: mode === "text" ? 110 : 180,
          mode
        };
      });
  }, [activeData, activePath]);

  const loadFiles = async (preferredPath?: string) => {
    setStatus("正在加载文件列表...");
    const response = await fetch(`/api/admin/content/files?locale=${encodeURIComponent(locale)}`);
    const payload = (await response.json()) as { rows?: ContentFileItem[]; error?: string };
    if (!response.ok) throw new Error(payload.error || "加载文件列表失败");
    const rows = payload.rows ?? [];
    setFiles(rows);
    // Falling through to rows[0] opened whatever the API happened to list first
    // -- feeds/santui.json -- so the page landed on a file nobody edits. The
    // homepage is the one opened most, so it is the default.
    const nextPath =
      preferredPath && rows.some((row) => row.path === preferredPath)
        ? preferredPath
        : activePath && rows.some((row) => row.path === activePath)
          ? activePath
          : rows.some((row) => row.path === HOME_PATH)
            ? HOME_PATH
            : rows[0]?.path || "";
    setActivePath(nextPath);
    setStatus("");
  };

  const loadFile = async (path: string) => {
    if (!path) return;
    setStatus("正在加载文件内容...");
    const response = await fetch(
      `/api/admin/content/file?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(path)}`
    );
    const payload = (await response.json()) as { row?: { data: Record<string, unknown> }; error?: string };
    if (!response.ok || !payload.row) throw new Error(payload.error || "加载文件失败");
    setActiveData(payload.row.data);
    setJsonDraft(toPrettyJson(payload.row.data));
    // Drafts are per-file; carrying them across a file switch would show one
    // page's JSON in another page's textarea.
    setHomeJsonDrafts({});
    setHomeJsonErrors({});
    setStatus("");
  };

  const loadRevisions = async (path: string) => {
    if (!path) return;
    const response = await fetch(
      `/api/admin/content/revisions?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(path)}&limit=10`
    );
    const payload = (await response.json()) as { rows?: ContentRevisionItem[] };
    if (!response.ok) {
      setRevisions([]);
      return;
    }
    setRevisions(payload.rows ?? []);
  };

  useEffect(() => {
    void loadFiles(initialPath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    if (!activePath) return;
    void loadFile(activePath);
    void loadRevisions(activePath);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePath, locale]);

  // Fills in any About block that is missing or still a placeholder, so the
  // structured editor always has a shape to render rather than an empty box.
  useEffect(() => {
    if (activePath !== ABOUT_INDEX_PATH || !activeData) return;
    let upgradedData: Record<string, unknown> | null = null;
    for (const key of ABOUT_BLOCK_KEYS) {
      if (!shouldUseAboutDefaultBlock(key, activeData[key])) continue;
      if (!upgradedData) upgradedData = { ...activeData };
      upgradedData[key] = structuredClone(ABOUT_BLOCK_DEFAULTS[key]);
    }
    if (upgradedData) {
      setActiveData(upgradedData);
      setJsonDraft(toPrettyJson(upgradedData));
      setStatus("已自动填充 About 占位区块，请点击保存使其生效。");
    }
  }, [activePath, activeData]);

  useEffect(() => {
    if (!activeData) {
      setAboutFormDrafts({});
      setAboutFormErrors({});
      return;
    }
    if (!activeDataMatchesPath || structuredFields.length === 0) {
      setAboutFormDrafts({});
      setAboutFormErrors({});
      return;
    }
    const nextDrafts: Record<string, string> = {};
    for (const field of structuredFields) {
      const value = activeData[field.key] ?? null;
      nextDrafts[field.key] = field.mode === "text" ? String(value ?? "") : JSON.stringify(value, null, 2);
    }
    setAboutFormDrafts(nextDrafts);
    setAboutFormErrors({});
  }, [activeData, activeDataMatchesPath, structuredFields]);

  useEffect(() => {
    if (!activeData || activePath === ABOUT_INDEX_PATH || !activeDataMatchesPath) return;
    const defaults = ABOUT_PAGE_DEFAULT_CONTENTS[activePath];
    if (!defaults) return;
    if (!shouldUseAboutPageDefaults(activePath, activeData)) return;
    const next = { ...activeData, ...structuredClone(defaults) };
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
    setStatus("已自动填充当前 About 页面完整内容，请点击保存使其生效。");
  }, [activePath, activeData, activeDataMatchesPath]);

  const saveFile = async () => {
    if (!activePath) return;
    const parsed = parseObject(jsonDraft);
    if (!parsed) {
      setStatus("JSON 格式错误：请修复后再保存");
      return;
    }
    setStatus("正在保存...");
    const response = await fetch("/api/admin/content/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        path: activePath,
        content: parsed
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || "保存失败");
      return;
    }
    setStatus("保存成功");
    setActiveData(parsed);
    await loadFiles(activePath);
    await loadRevisions(activePath);
  };

  const importPrototype = async () => {
    setStatus("正在导入原型页面...");
    const response = await fetch("/api/admin/content/import", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locale, mode: "prototype", overwrite: false })
    });
    const payload = (await response.json()) as { imported?: number; skipped?: number; error?: string };
    if (!response.ok) {
      setStatus(payload.error || "导入失败");
      return;
    }
    setStatus(`导入完成：新增 ${payload.imported ?? 0}，跳过 ${payload.skipped ?? 0}`);
    await loadFiles(activePath);
  };

  const exportCurrentLocale = async () => {
    setStatus("正在导出...");
    const response = await fetch(`/api/admin/content/export?locale=${encodeURIComponent(locale)}`);
    const payload = (await response.json()) as { rows?: Array<{ path: string; data: unknown }>; error?: string };
    if (!response.ok || !payload.rows) {
      setStatus(payload.error || "导出失败");
      return;
    }
    const blob = new Blob([JSON.stringify({ locale, rows: payload.rows }, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `quitccp-content-${locale}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setStatus(`已导出 ${payload.rows.length} 个文件`);
  };

  const deleteCurrent = async () => {
    if (!activePath) return;
    const confirmed = window.confirm(`确定删除 ${activePath} 吗？`);
    if (!confirmed) return;
    setStatus("正在删除...");
    const response = await fetch(
      `/api/admin/content/file?locale=${encodeURIComponent(locale)}&path=${encodeURIComponent(activePath)}`,
      { method: "DELETE" }
    );
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || "删除失败");
      return;
    }
    setStatus("已删除");
    await loadFiles();
  };

  const duplicateCurrent = async () => {
    if (!activePath || !activeData) return;
    const newPath = window.prompt("请输入新文件 path（例如 pages/services-extra.json）", activePath);
    if (!newPath || !newPath.trim()) return;
    setStatus("正在复制...");
    const response = await fetch("/api/admin/content/file", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        locale,
        path: newPath.trim(),
        content: activeData,
        note: `duplicate-from:${activePath}`
      })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || "复制失败");
      return;
    }
    setStatus("复制成功");
    await loadFiles(newPath.trim());
  };

  const restoreRevision = async (revisionId: string) => {
    setStatus("正在回滚...");
    const response = await fetch("/api/admin/content/revisions/restore", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ revisionId })
    });
    const payload = (await response.json()) as { error?: string };
    if (!response.ok) {
      setStatus(payload.error || "回滚失败");
      return;
    }
    setStatus("已回滚到所选版本");
    await loadFile(activePath);
    await loadRevisions(activePath);
    await loadFiles(activePath);
  };

  /**
   * Writes one field.
   *
   * Reads through a ref rather than the `activeData` binding: two writes in the
   * same tick both saw the same stale snapshot, so the second silently threw
   * away the first. That is easy to hit -- a control that writes on click while
   * another is mid-edit, or any handler that touches two fields.
   */
  useEffect(() => {
    activeDataRef.current = activeData;
  }, [activeData]);

  const updateField = (keyPath: string[], value: unknown) => {
    const base = activeDataRef.current;
    if (!base) return;
    const next = setAtPath(base, keyPath, value);
    activeDataRef.current = next;
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
  };

  /**
   * Keeps the raw text of each homepage JSON textarea while it is being edited.
   * Without this the textarea would be re-serialised from the parsed value on
   * every keystroke, so a half-typed array would be reformatted underneath the
   * cursor. Invalid JSON is held here and flagged rather than discarded.
   */
  const updateHomeJsonDraft = (sectionKey: string, fieldKey: string, raw: string) => {
    const draftKey = `${sectionKey}.${fieldKey}`;
    setHomeJsonDrafts((prev) => ({ ...prev, [draftKey]: raw }));
    try {
      const parsed = JSON.parse(raw);
      setHomeJsonErrors((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      updateField([sectionKey, fieldKey], parsed);
    } catch {
      setHomeJsonErrors((prev) => ({ ...prev, [draftKey]: "JSON 格式错误，未保存此字段" }));
    }
  };

  const updateStructuredFieldDraft = (field: StructuredFormFieldDef, raw: string) => {
    setAboutFormDrafts((prev) => ({ ...prev, [field.key]: raw }));
    if (field.mode === "text") {
      setAboutFormErrors((prev) => ({ ...prev, [field.key]: "" }));
      updateField([field.key], raw);
      return;
    }
    const parsed = parseJsonValue(raw);
    if (parsed === null) {
      setAboutFormErrors((prev) => ({ ...prev, [field.key]: "JSON 格式错误" }));
      return;
    }
    setAboutFormErrors((prev) => ({ ...prev, [field.key]: "" }));
    updateField([field.key], parsed);
  };

  const fillAboutDefaults = () => {
    if (!activeData) return;
    if (activePath === ABOUT_INDEX_PATH) {
      const next = { ...activeData };
      for (const key of ABOUT_BLOCK_KEYS) {
        next[key] = structuredClone(ABOUT_BLOCK_DEFAULTS[key]);
      }
      setActiveData(next);
      setJsonDraft(toPrettyJson(next));
      setStatus("已填充 About 完整默认内容，请点击保存。");
      return;
    }
    const defaults = ABOUT_PAGE_DEFAULT_CONTENTS[activePath];
    if (!defaults) return;
    const next = { ...activeData, ...structuredClone(defaults) };
    setActiveData(next);
    setJsonDraft(toPrettyJson(next));
    setStatus("已填充当前 About 页面完整内容，请点击保存。");
  };

  const jsonValid = Boolean(parseObject(jsonDraft));
  const previewPath = guessPreviewPath(activePath);
  const isHomeEditor = activePath === HOME_PATH;
  // Pages edited block by block rather than as JSON textareas: About, Involve,
  // Services and Resources. Every set is the same declaration shape and the
  // same renderer. The books page keeps its own purpose-built editor.
  const blockEditorBlocks =
    activePath === ABOUT_INDEX_PATH
      ? ABOUT_BLOCKS
      : ABOUT_SUBPAGE_BLOCKS[activePath] ??
        INVOLVE_BLOCKS[activePath] ??
        SERVICES_BLOCKS[activePath] ??
        RESOURCES_BLOCKS[activePath] ??
        LEGAL_BLOCKS[activePath];
  const isBooksEditor = activePath === BOOKS_PATH;
  const isStructuredEditor =
    !blockEditorBlocks && !isHomeEditor && !isBooksEditor && structuredFields.length > 0;
  const hasAboutDefaults = activePath === ABOUT_INDEX_PATH || Boolean(ABOUT_PAGE_DEFAULT_CONTENTS[activePath]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section className="admin-card">
        <h2 style={{ marginTop: 0 }}>页面内容管理</h2>
        <p>按文件管理原型页面内容，支持结构化字段编辑 + JSON 回退 + 修订回滚。</p>
        <div className="admin-toolbar">
          <label>
            Locale
            <select
              className="admin-select"
              value={locale}
              onChange={(event) => {
                setLocale(event.target.value);
              }}
              style={{ marginLeft: 8 }}
            >
              <option value="zh">zh</option>
              <option value="en">en</option>
            </select>
          </label>
          <button className="admin-btn" type="button" onClick={importPrototype}>
            导入原型页面
          </button>
          <button className="admin-btn" type="button" onClick={exportCurrentLocale}>
            导出当前 locale
          </button>
          {status ? <span>{status}</span> : null}
        </div>
      </section>

      <section className="admin-card" style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 16 }}>
        <aside style={{ borderRight: "1px solid #ececec", paddingRight: 12, maxHeight: 700, overflow: "auto" }}>
          {groupedFiles.map(([group, rows]) => (
            <div key={group} style={{ marginBottom: 14 }}>
              <h4 style={{ margin: "0 0 8px 0" }}>{sectionDisplayName(group)}</h4>
              <div style={{ display: "grid", gap: 4 }}>
                {rows.map((row) => (
                  <button
                    key={row.path}
                    type="button"
                    className="admin-btn"
                    style={{
                      textAlign: "left",
                      justifyContent: "flex-start",
                      borderColor: row.path === activePath ? "#4a3c96" : undefined
                    }}
                    onClick={() => setActivePath(row.path)}
                  >
                    <span style={{ display: "inline-block", maxWidth: 250, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {fileDisplayLabel(row)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </aside>

        <article>
          <div className="admin-toolbar">
            <strong>{activePath || "未选择文件"}</strong>
            <button className="admin-btn" type="button" onClick={duplicateCurrent} disabled={!activePath}>
              复制
            </button>
            <button className="admin-btn" type="button" onClick={deleteCurrent} disabled={!activePath}>
              删除
            </button>
            <button className="admin-btn" type="button" onClick={() => setJsonDraft(toPrettyJson(parseObject(jsonDraft) || {}))}>
              格式化
            </button>
            {previewPath ? (
              <button className="admin-btn" type="button" onClick={() => window.open(previewPath, "_blank")}>
                预览
              </button>
            ) : null}
            {hasAboutDefaults ? (
              <button className="admin-btn" type="button" onClick={fillAboutDefaults}>
                填充当前 About 页面完整内容
              </button>
            ) : null}
            <button className="admin-btn admin-btn-primary" type="button" onClick={saveFile} disabled={!jsonValid}>
              保存
            </button>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <button className="admin-btn" type="button" onClick={() => setActiveTab("form")}>
              结构化
            </button>
            <button className="admin-btn" type="button" onClick={() => setActiveTab("json")}>
              JSON
            </button>
          </div>

          {activeTab === "form" ? (
            <div style={{ display: "grid", gap: 10 }}>
              {!activeData ? (
                <p>请在左侧选择文件。</p>
              ) : !activeDataMatchesPath ? (
                <p>正在加载页面内容...</p>
              ) : isHomeEditor ? (
                <HomeSectionsEditor
                  data={activeData}
                  updateField={updateField}
                  jsonDrafts={homeJsonDrafts}
                  jsonErrors={homeJsonErrors}
                  onJsonDraft={updateHomeJsonDraft}
                  onPickImage={(keyPath, label) => {
                    setImagePickerField(keyPath);
                    setImagePickerLabel(label);
                  }}
                />
              ) : isBooksEditor ? (
                <BooksEditor
                  data={activeData}
                  updateField={updateField}
                  onPickImage={(keyPath, label) => {
                    setImagePickerField(keyPath);
                    setImagePickerLabel(label);
                  }}
                />
              ) : blockEditorBlocks ? (
                <>
                  <label>
                    页面标题
                    <input
                      className="admin-input"
                      value={String((activeData.title as string) ?? "")}
                      onChange={(event) => updateField(["title"], event.target.value)}
                    />
                  </label>
                  <label>
                    页面副标题
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.subtitle as string) ?? "")}
                      onChange={(event) => updateField(["subtitle"], event.target.value)}
                    />
                  </label>
                  <AboutSectionsEditor
                    blocks={blockEditorBlocks}
                    data={activeData}
                    updateField={updateField}
                    jsonDrafts={homeJsonDrafts}
                    jsonErrors={homeJsonErrors}
                    onJsonDraft={updateHomeJsonDraft}
                    onPickImage={(keyPath, label) => {
                      setImagePickerField(keyPath);
                      setImagePickerLabel(label);
                    }}
                  />
                </>
              ) : isStructuredEditor ? (
                <>
                  <label>
                    页面标题
                    <input
                      className="admin-input"
                      value={String((activeData.title as string) ?? "")}
                      onChange={(event) => updateField(["title"], event.target.value)}
                    />
                  </label>
                  <label>
                    页面副标题
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.subtitle as string) ?? "")}
                      onChange={(event) => updateField(["subtitle"], event.target.value)}
                    />
                  </label>
                  <p style={{ margin: "4px 0 0", color: "#666" }}>以下字段与当前 JSON 文件一一对应，支持直接结构化编辑。</p>
                  {structuredFields.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <textarea
                        className="admin-textarea"
                        style={
                          field.mode === "json"
                            ? { minHeight: field.minHeight ?? 180, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }
                            : { minHeight: field.minHeight ?? 110 }
                        }
                        value={aboutFormDrafts[field.key] ?? (field.mode === "text" ? String(activeData[field.key] ?? "") : "null")}
                        onChange={(event) => updateStructuredFieldDraft(field, event.target.value)}
                      />
                      {aboutFormErrors[field.key] ? (
                        <span style={{ color: "#b42318", fontSize: 12 }}>{aboutFormErrors[field.key]}</span>
                      ) : null}
                    </label>
                  ))}
                </>
              ) : (
                <>
                  <label>
                    标题
                    <input
                      className="admin-input"
                      value={String((activeData.title as string) ?? "")}
                      onChange={(event) => updateField(["title"], event.target.value)}
                    />
                  </label>
                  <label>
                    副标题
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.subtitle as string) ?? "")}
                      onChange={(event) => updateField(["subtitle"], event.target.value)}
                    />
                  </label>
                  <label>
                    提示信息（notice）
                    <textarea
                      className="admin-textarea"
                      value={String((activeData.notice as string) ?? "")}
                      onChange={(event) => updateField(["notice"], event.target.value)}
                    />
                  </label>
                  <label>
                    Hero 标题
                    <input
                      className="admin-input"
                      value={String((((activeData.hero as Record<string, unknown>) ?? {}).title as string) ?? "")}
                      onChange={(event) => updateField(["hero", "title"], event.target.value)}
                    />
                  </label>
                  <label>
                    Hero 描述
                    <textarea
                      className="admin-textarea"
                      value={String((((activeData.hero as Record<string, unknown>) ?? {}).body as string) ?? "")}
                      onChange={(event) => updateField(["hero", "body"], event.target.value)}
                    />
                  </label>
                </>
              )}
            </div>
          ) : (
            <textarea
              className="admin-textarea"
              style={{ minHeight: 420, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              value={jsonDraft}
              onChange={(event) => setJsonDraft(event.target.value)}
            />
          )}

          {revisions.length > 0 ? (
            <div style={{ marginTop: 18 }}>
              <h4>最近修订</h4>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>时间</th>
                    <th>操作者</th>
                    <th>备注</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {revisions.map((revision) => (
                    <tr key={revision.id}>
                      <td>{new Date(revision.createdAt).toLocaleString()}</td>
                      <td>{revision.createdBy}</td>
                      <td>{revision.note ?? "-"}</td>
                      <td>
                        <button className="admin-btn" type="button" onClick={() => restoreRevision(revision.id)}>
                          回滚
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>
      </section>

      <ImagePickerModal
        open={imagePickerField !== null}
        fieldLabel={imagePickerLabel}
        onClose={() => setImagePickerField(null)}
        onSelect={(url) => {
          if (imagePickerField) updateField(imagePickerField, url);
          setImagePickerField(null);
        }}
      />
    </div>
  );
}
