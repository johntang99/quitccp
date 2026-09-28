/**
 * Homepage content schema.
 *
 * Every section on the homepage is described here so it can be edited in the
 * CMS rather than living as a constant in the template. Each section carries a
 * `variant` (layout) alongside its content, so editors can change how a section
 * is arranged without a deploy.
 *
 * The defaults below are the current homepage, verbatim. Seeding
 * `pages/home.json` from them is a no-op visually; it just moves the content
 * from code into the database where it can be edited.
 */

export interface HomeSectionMeta {
  /** Hidden sections are skipped entirely. */
  enabled: boolean;
  /** Layout variant; valid values differ per section (see HOME_SECTION_VARIANTS). */
  variant: string;
}

export const HOME_SECTION_ORDER = [
  "hero",
  "registry",
  "services",
  "news",
  "channels",
  "video",
  "voices",
  "network",
  "resources",
  "about",
  "involve"
] as const;

export type HomeSectionKey = (typeof HOME_SECTION_ORDER)[number];

/**
 * Layout variants per section. The first entry is the current design.
 * `registry` is layout-only by design -- its entries come from the declaration
 * feed, not from editors.
 */
export const HOME_SECTION_VARIANTS: Record<HomeSectionKey, { value: string; label: string }[]> = {
  hero: [
    { value: "centered", label: "居中大标题（默认）" },
    { value: "photo-split", label: "左文右图（对半）" },
    { value: "gallery-split", label: "左文右图集（对半）" },
    { value: "video-split", label: "左文右视频（对半）" },
    { value: "full-bleed", label: "通栏大图＋文字卡片（overlay）" }
  ],
  registry: [
    { value: "split", label: "左数字右滚动（默认）" },
    { value: "stacked", label: "上下堆叠" },
    { value: "count-only", label: "仅显示数字" },
    { value: "stream-only", label: "仅显示滚动声明" }
  ],
  services: [
    { value: "cards3", label: "三栏卡片（默认）" },
    { value: "cards2", label: "两栏卡片" },
    { value: "list", label: "列表" }
  ],
  news: [
    { value: "lead-list", label: "左主图右列表（默认）" },
    { value: "feature", label: "大图头条（突出）" },
    { value: "grid", label: "等分网格" }
  ],
  channels: [
    { value: "grid4", label: "四栏（默认）" },
    { value: "grid2", label: "两栏" }
  ],
  video: [
    { value: "grid3", label: "三栏（默认）" },
    { value: "grid4", label: "四栏" },
    { value: "list", label: "列表" }
  ],
  voices: [
    { value: "grid3", label: "三栏引语（默认）" },
    { value: "stacked", label: "纵向排列" }
  ],
  network: [
    { value: "split", label: "左文右城市（默认）" },
    { value: "stacked", label: "上下堆叠" }
  ],
  resources: [
    { value: "grid", label: "网格（默认）" },
    { value: "list", label: "列表" }
  ],
  about: [
    { value: "cells3", label: "三栏（默认）" },
    { value: "stacked", label: "纵向排列" }
  ],
  involve: [
    { value: "grid4", label: "四栏（默认）" },
    { value: "list", label: "列表" }
  ]
};

export interface LinkItem {
  label: string;
  href: string;
}

export interface HomeContent {
  hero: HomeSectionMeta & {
    eyebrow: string;
    title: string;
    body: string;
    actions: (LinkItem & { variant?: string; stamp?: string })[];
    /** photo-split, and the backdrop for full-bleed. */
    image: string;
    imageAlt: string;
    /** gallery-split. First item is shown first. */
    gallery: { src: string; alt: string }[];
    /**
     * video-split. `src` may be a direct file (.mp4/.webm) or an embed URL.
     * Nothing is requested until the viewer clicks: the poster is shown first,
     * so a third-party embed makes no network call on page load. That matters
     * for readers behind the GFW, where a blocked embed would otherwise stall
     * the homepage.
     */
    video: { src: string; poster: string; caption: string };
  };
  registry: HomeSectionMeta & {
    eyebrow: string;
    count: string;
    countLabel: string;
    noteLabel: string;
    noteHref: string;
    substats: { value: string; label: string }[];
    streamHeading: string;
  };
  services: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    moreLabel: string;
    moreHref: string;
    cards: { tag: string; title: string; body: string; links: LinkItem[] }[];
  };
  news: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    moreLabel: string;
    moreHref: string;
    lead: { tag: string; title: string; body: string; meta: string; href: string; image: string };
    items: { title: string; date: string; href: string; image: string }[];
  };
  channels: HomeSectionMeta & {
    cards: {
      title: string;
      leadTitle: string;
      leadHref: string;
      image: string;
      badge: string;
      footLabel: string;
      footHref: string;
    }[];
  };
  video: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    moreLabel: string;
    moreHref: string;
    items: { title: string; meta: string; href: string; image: string }[];
  };
  voices: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    lede: string;
    moreLabel: string;
    moreHref: string;
    items: { quote: string; name: string; role: string; image: string }[];
  };
  network: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    body: string;
    buttonLabel: string;
    buttonHref: string;
    citiesLabel: string;
    cities: string[];
  };
  resources: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    moreLabel: string;
    moreHref: string;
    items: { label: string; tag: string; href: string }[];
  };
  about: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    lede: string;
    moreLabel: string;
    moreHref: string;
    cells: {
      heading: string;
      value: string;
      body: string;
      bars?: { label: string; percent: number }[];
    }[];
  };
  involve: HomeSectionMeta & {
    eyebrow: string;
    heading: string;
    items: { title: string; body: string; href: string }[];
  };
}

const SANTUI = "https://santui.tuidang.org";
const CERT_APPLY = "https://service.tuidang.org/cert-apply/";
const CERT_VERIFY = "https://service.tuidang.org/cert-verify/";
const DOC_IMMIGRATION = "https://www.tuidang.org/docs/694467/";

export const homeContentDefaults: HomeContent = {
  hero: {
    enabled: true,
    variant: "centered",
    eyebrow: "成立于 2005 · 总部纽约 · 全球 100+ 服务点",
    title: "让每一个想离开的人， 都能留下记录。",
    body: "全球退党服务中心为中国民众提供退出中共党、团、队的声明登记与证明服务，记录并公开侵害人权的证据，并由各地志愿者在全球一百多个服务点提供协助。二十年来，我们登记了四亿六千多万份声明。",
    actions: [
      { label: "提交声明", href: SANTUI, variant: "seal", stamp: "" },
      { label: "了解服务", href: "/services", variant: "line-light" }
    ],
    image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
    imageAlt: "美国国会山退党证明颁发现场",
    gallery: [
      {
        src: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
        alt: "美国国会山退党证明颁发现场"
      },
      {
        src: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
        alt: "《铁证如山》追查报告"
      },
      {
        src: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
        alt: "专题报导"
      },
      {
        src: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
        alt: "济州岛服务点"
      }
    ],
    video: {
      // Left empty on purpose -- an editor sets the real video. The poster is
      // shown until then, and the play control is hidden while src is blank.
      src: "",
      poster: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
      caption: ""
    }
  },
  registry: {
    enabled: true,
    variant: "split",
    eyebrow: "实时登记册",
    count: "4.64 亿",
    countLabel: "人已公开声明退出中共党、团、队组织。",
    noteLabel: "这个数字是怎么统计的 →",
    noteHref: "/about/numbers",
    substats: [
      { value: "24 / 7", label: "在线提交流程" },
      { value: "100%", label: "审计留痕覆盖" },
      { value: "10k+", label: "历史内容可检索" }
    ],
    streamHeading: "Latest Updates"
  },
  services: {
    enabled: true,
    variant: "cards3",
    eyebrow: "我们的服务",
    heading: "服务、媒体与协作支持一体化",
    moreLabel: "查看全部服务",
    moreHref: "/services",
    cards: [
      {
        tag: "登记",
        title: "三退登记与证明",
        body: "声明可以匿名提交，也可以申请一份中英文退党证明，并由第三方在线查验真伪。",
        links: [
          { label: "声明退出党、团、队", href: SANTUI },
          { label: "办理退党证明", href: CERT_APPLY },
          { label: "查询与验证证明", href: CERT_VERIFY },
          { label: "证明与移民申请问答", href: DOC_IMMIGRATION }
        ]
      },
      {
        tag: "传播",
        title: "调查、存档与见证",
        body: "收集并核实侵害人权的案例，保存当事人的第一手陈述，向各国议会、机构与媒体提交。",
        links: [
          { label: "迫害案例档案", href: "/news/investigations" },
          { label: "调查报告", href: "/news/investigations" },
          { label: "当事人口述", href: "/involve/stories" },
          { label: "国际议会与机构关注", href: "/news/solidarity" }
        ]
      },
      {
        tag: "支持",
        title: "出版、影音与工具",
        body: "出版与整理公开读物，制作影音节目，并提供可在受限网络环境下使用的访问工具。",
        links: [
          { label: "《九评共产党》", href: "https://www.tuidang.org/9ping/" },
          { label: "视频与音频节目", href: "/videos" },
          { label: "展板、传单与素材下载", href: "https://www.tuidang.org/td_promo/" },
          { label: "安全访问与免翻墙工具", href: "/resources/tools" }
        ]
      }
    ]
  },
  news: {
    enabled: true,
    variant: "lead-list",
    eyebrow: "新闻与报告",
    heading: "公开更新与重点议题",
    moreLabel: "进入新闻中心",
    moreHref: "/news",
    lead: {
      tag: "Feature",
      title: "系统升级：迁移、检索与 CMS 管理能力同步完成",
      body: "完成内容迁移、搜索双读策略和统一后台整合，支撑后续规模化运营。",
      meta: "2026-08-12",
      href: "/news",
      image: ""
    },
    items: [
      { title: "公开声明年度统计：新增登记持续增长", date: "2026-08-01", href: "/news", image: "" },
      { title: "北美服务点新增周末值班时段公告", date: "2026-07-24", href: "/news", image: "" },
      { title: "证书核验系统升级说明与兼容策略", date: "2026-07-14", href: "/news", image: "" }
    ]
  },
  channels: {
    enabled: true,
    variant: "grid4",
    cards: [
      {
        title: "追查国际调查报告",
        leadTitle: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
        leadHref: "/news/investigations",
        image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
        badge: "▶",
        footLabel: "全部调查报告 →",
        footHref: "/news/investigations"
      },
      {
        title: "专题报导与时政评论",
        leadTitle: "专题：被改写的七十年——从大饥荒到今天的官方叙事",
        leadHref: "/news/commentary",
        image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
        badge: "",
        footLabel: "全部专题与评论 →",
        footHref: "/news/commentary"
      },
      {
        title: "国际声援行动",
        leadTitle: "美国国会议员联署声明，表彰退出中共运动并载入《国会议事录》",
        leadHref: "/news/solidarity",
        image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
        badge: "",
        footLabel: "全部声援行动 →",
        footHref: "/news/solidarity"
      },
      {
        title: "三退新闻",
        leadTitle: "济州岛服务点重启，义工在码头与免税店前轮班守候",
        leadHref: "/news/stories",
        image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
        badge: "▶",
        footLabel: "全部三退新闻 →",
        footHref: "/news/stories"
      }
    ]
  },
  video: {
    enabled: true,
    variant: "grid3",
    eyebrow: "视频资源",
    heading: "多平台分发，统一元数据管理",
    moreLabel: "查看视频库",
    moreHref: "/videos",
    items: [
      { title: "视频专题 1", meta: "YouTube / GanJingWorld", href: "/videos", image: "" },
      { title: "视频专题 2", meta: "YouTube / GanJingWorld", href: "/videos", image: "" },
      { title: "视频专题 3", meta: "YouTube / GanJingWorld", href: "/videos", image: "" }
    ]
  },
  voices: {
    enabled: true,
    variant: "grid3",
    eyebrow: "见证者",
    heading: "他们为什么选择公开声明",
    lede: "数亿份声明中，有一部分来自曾经身处体制之内的人。他们的陈述被完整保存并公开。",
    moreLabel: "更多见证 →",
    moreHref: "/involve/stories",
    items: [
      {
        quote: "作为外交官，按理应该为国家利益服务，但我在那里做的事大多不是为了国家利益，而是在迫害自己的人民。",
        name: "陈用林",
        role: "中共前外交官\n中国驻悉尼总领事馆一等秘书",
        image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png"
      },
      {
        quote: "我 1991 年加入中国共产党，当时对它抱有很高的期望，但事实并不像我想像的那样。",
        name: "郝凤军",
        role: "原天津市公安局「六一〇」办公室官员\n一级警司",
        image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png"
      },
      {
        quote: "我于 1980 年入党，曾经忠心耿耿地效力。但越来越多的事实使我痛苦地认识到，这样一个党已经与我的理想和信念水火不容。",
        name: "韩广生",
        role: "原中共沈阳市司法局党委书记、局长\n市委政法委员会委员",
        image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png"
      }
    ]
  },
  network: {
    enabled: true,
    variant: "split",
    eyebrow: "全球网络",
    heading: "一百多个服务点，\n由志愿者维持运转。",
    body: "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。",
    buttonLabel: "查找离你最近的服务点",
    buttonHref: "/about/network",
    citiesLabel: "代表性服务点",
    cities: [
      "纽约", "洛杉矶", "旧金山", "多伦多", "温哥华", "华盛顿",
      "伦敦", "柏林", "巴黎", "台北", "东京", "首尔",
      "香港", "曼谷", "济州岛", "悉尼", "墨尔本", "奥克兰"
    ]
  },
  resources: {
    enabled: true,
    variant: "grid",
    eyebrow: "资源馆",
    heading: "工具、指南与公开文档",
    moreLabel: "浏览全部资源",
    moreHref: "/resources",
    items: [
      { label: "安全访问工具", tag: "Guide", href: "/resources/tools" },
      { label: "声明提交流程说明", tag: "Manual", href: "/services/faq" },
      { label: "证书核验操作手册", tag: "Manual", href: CERT_VERIFY },
      { label: "公开报告下载", tag: "PDF", href: "https://www.tuidang.org/td_promo/" },
      { label: "媒体协作规范", tag: "Policy", href: "/resources/press" },
      { label: "站点使用条款", tag: "Terms", href: "https://www.tuidang.org/terms-of-service/" }
    ]
  },
  about: {
    enabled: true,
    variant: "cells3",
    eyebrow: "关于我们",
    heading: "我们是谁，以及如何被检验",
    lede: "全球退党服务中心成立于二〇〇五年，是在美国注册的非营利组织，总部设于纽约。财务报表、治理结构与统计方法全部公开。",
    moreLabel: "年度报告 →",
    moreHref: "/about/accountability",
    cells: [
      {
        heading: "注册与法律地位",
        value: "501(c)(3)",
        body: "在美国注册的非营利组织，捐款可依法抵税。年度 Form 990 公开可查。"
      },
      {
        heading: "资金使用（上一财年）",
        value: "",
        body: "经独立会计师事务所审计，报表全文可下载。",
        bars: [
          { label: "项目支出 84%", percent: 84 },
          { label: "行政 10%", percent: 10 },
          { label: "筹款 6%", percent: 6 }
        ]
      },
      {
        heading: "统计与安全",
        value: "公开方法",
        body: "声明数字的统计口径、去重规则与更新频率全部说明；针对本机构的威胁事件另设公开档案。"
      }
    ]
  },
  involve: {
    enabled: true,
    variant: "grid4",
    eyebrow: "参与我们",
    heading: "四种参与方式",
    items: [
      { title: "声明三退", body: "可匿名提交，几分钟完成，随后可申请证明。", href: SANTUI },
      { title: "成为义工", body: "在你所在的城市协助服务点，或参与线上翻译与整理。", href: "/involve/volunteer" },
      { title: "参与联署", body: "加入 End CCP 公开联署，向各国政府表达立场。", href: "/involve/endccp" },
      { title: "下载资料", body: "展板、传单、手举牌与影音素材，可自由使用。", href: "https://www.tuidang.org/td_promo/" }
    ]
  }
};
