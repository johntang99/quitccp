/**
 * 「关于我们」各页的默认内容。
 *
 * 这里是**内容**，不是界面文案。
 *
 * 它有两个用处：页面内容编辑器里「补齐默认内容」那颗按钮，以及
 * cms_content_entries 里这一条还不存在时顶上的那份。真正的来源是数据库 ——
 * 编辑在后台改完，这里的字一个也不会出现在页面上。
 *
 * ## 为什么单独一个文件
 *
 * 它原来和编辑器的界面代码混在 ContentExplorer.tsx 里，三千四百个汉字中有
 * 两千八百个是这些段落，于是「后台还剩多少字要翻」这个数字里一直压着一笔
 * 不该翻的账 —— 英文站不会翻译中文站的机构简介，它会有自己播种的一套。
 *
 * 分开之后 check-i18n 把它归进「CMS 兜底」，数字才是真的。
 */

export const ABOUT_INDEX_PATH = "pages/about-index.json";
export const ABOUT_BLOCK_KEYS = ["intro", "numbersBand", "network", "accountability", "team", "history"] as const;
export const ABOUT_BLOCK_DEFAULTS: Record<(typeof ABOUT_BLOCK_KEYS)[number], unknown> = {
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
      { label: "退党大事记", href: "/about/history" }
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
    eyebrow: "退党大事记",
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

export const ABOUT_PAGE_DEFAULT_CONTENTS: Record<string, Record<string, unknown>> = {
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
        { label: "退党大事记", href: "/about/history" },
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
