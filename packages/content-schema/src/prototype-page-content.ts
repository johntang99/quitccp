import { involveDefaults } from "./involve-content";
import { servicesDefaults } from "./services-content";
import { routeSeeds } from "./seed";
import type { PageSection, TemplateKind } from "./types";

export interface PageContentContractSeed {
  section: PageSection;
  slug: string;
  title: string;
  template: TemplateKind;
  path: string;
  data: Record<string, unknown>;
}

export const sharedContentPaths = [
  "header.json",
  "footer.json",
  "seo.json",
  "theme.json",
  "site.json",
  "navigation.json"
] as const;

export function pageRouteToContentPath(section: string, slug: string): string {
  if (section === "root" && slug === "index") return "pages/home.json";
  if (section === "news" && slug === "article") return "pages/news-article.json";
  return `pages/${section}-${slug}.json`;
}

const routeSubtitleMap: Record<string, string> = {
  "about/index":
    "全球退党服务中心成立于二〇〇五年，是在美国注册的 501(c)(3) 非营利组织，总部设于纽约。我们为中国民众提供退出中共党、团、队的声明登记与证明服务，记录并公开侵害人权的证据，并由各地志愿者在全球一百多个服务点提供协助。",
  "about/numbers":
    "我们把统计口径完整公开，包括计入规则、去重方式、更新频率与已知局限。任何人都可以据此判断这个数字的意义与边界。",
  "about/network":
    "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。",
  "about/accountability":
    "财务报表经独立会计师事务所审计，Form 990 依法公开。治理结构与统计方法全部公开。针对本机构的威胁与攻击同样公开记录。",
  "about/team": "全职人员极少，绝大部分工作由志愿者完成。以下为理事会成员与主要负责人。",
  "about/history": "从《九评共产党》发表引发第一批公开声明，到今天的四亿六千多万份登记。",
  "services/index":
    "我们提供三项服务：登记你的退出声明、为需要的人出具中英文退党证明、并让第三方能够在线查验证明的真伪。三退声明登记与查询验证免费；退党证明为实名办理，需缴纳办理／管理费用。",
  "services/declare":
    "这份声明由你自己填写并提交，我们完整保存原文与提交时间，并公开可查。全程免费，无需注册，可以完全匿名。",
  "services/cert": "中英文对照的书面凭据，由本中心签发，附唯一编号与公开查验入口。实名办理，需完成认证课程与考试，并缴纳办理／管理费用。",
  "services/verify":
    "输入证明编号即可查验签发日期与状态。此入口对所有人开放，受理机构无需与本中心联系即可自行核实。",
  "services/immigration": "公开政策文件的梳理，以及议会行动与个案报导汇编。本中心不提供法律意见，也不代办任何移民手续。",
  "services/faq": "关于声明、证明与安全的常见问题。如果这里没有你要问的，欢迎直接联系我们。",
  "services/contact": "更正声明信息、补发遗失的证明，或查询你的登记记录。由本中心人工核对处理。",
  "services/privacy": "你不需要提供身份证件，也可以完全匿名。这一页说明我们收集什么、不收集什么、数据存在哪里，以及风险究竟在哪。",
  "involve/index":
    "三退声明登记对所有人免费，并将一直免费。维持这项服务的是场地、印制、系统与安全成本，以及一支全职极少、志愿者极多的团队。",
  "involve/volunteer":
    "你可以在所在城市协助服务点，也可以在线参与翻译、剪辑与整理。时间多少不限，没有最低承诺。",
  "involve/endccp": "一项面向各国公众的公开联署，向政府与国际机构表达对中共侵害人权行为的立场。",
  "involve/stories": "现场纪实、义工自述与长期跟踪报导。含原「三退义工」与「义工风采」全部内容。",
  "involve/other-ways": "除了捐助与义工，还有几件事同样有用——其中有些不需要花钱，也不需要花太多时间。",
  "news/index": "机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。",
  "news/announcements": "本中心发布的正式公告、声明、年度报告与登记数据通报。包括针对本机构的威胁事件记录。",
  "news/investigations": "独立调查机构发布的取证报告、证人陈述、录音证据与责任人名单。每份报告均注明取证方式与资料来源。",
  "news/commentary": "长篇专题、特别报导、时政评论与名家专栏。梳理事件脉络与制度成因，署名文章观点属作者本人。",
  "news/solidarity": "各国议会决议、政要表态、民间团体声援与集会活动纪录。按地区与形式分类。",
  "news/stories": "当事人自述、服务点现场纪实、三退洪声音频节目与相关报导。含原「三退要闻」「退党纪实故事」全部内容。",
  "news/notable": "曾在中共体制内任职者的公开声明。包括外交、公安、司法、党政、媒体与学界人士。全部声明原文完整保存并公开。",
  "videos/index": "现场纪录、当事人访谈、调查影像与系列专题。全部节目可自由下载、转载与再制作。",
  "videos/frontline": "服务点现场、义工纪实与当事人访谈。全球一百多个服务点的第一手影像记录，持续更新。",
  "videos/party-culture": "解析党文化如何进入语言、教育、思维方式与日常生活。系列专题，配合《解体党文化》一书。",
  "videos/step-back": "人物访谈系列。请曾在体制内任职、或经历过重大转变的人，讲述他们退出的过程与之后的生活。",
  "videos/jiuping":
    "《九评共产党》《解体党文化》《魔鬼在统治着我们的世界》《共产主义的终极目的》的影音版与播报版。",
  "videos/ironclad": "追查国际系列调查的影像版本。32 集，逐一呈现录音证据，梳理证据之间的逻辑关系与调查背景。",
  "videos/awakening": "长期跟踪拍摄的纪录系列，记录二十年间这场精神觉醒运动的过程与参与其中的人。",
  "videos/others": "集会与游行纪录、国际研讨与论坛、音频节目，以及未归入上述系列的影音内容。",
  "resources/index": "《九评共产党》及系列著作的全文、音频与多语种译本。全部免费开放阅读与下载，可自由转载与再制作。",
  "resources/culture": "传统故事、历史人物、诗词与文化专题。含原「文化频道」「中华文化」「传统故事精选」全部内容，可自由转载与朗读。",
  "resources/downloads":
    "展板、传单、手举牌、广播音档与图片素材。全部提供可编辑源文件与高分辨率成品，免费开放，无需事先授权。",
  "resources/tools": "在受限网络环境下访问本站与三退内容的几种方式。请先评估你所处环境，再决定使用哪一种。",
  "resources/magazine": "深度报导、当事人自述与文化专题。历期均可免费下载。",
  "resources/press": "机构简介、数据说明、可授权图片与联络方式，供媒体与研究者引用。"
};

function routeKey(section: string, slug: string) {
  return `${section}/${slug}`;
}

function defaultTemplateData(template: TemplateKind, title: string, section: string, slug: string) {
  const subtitle = routeSubtitleMap[routeKey(section, slug)];

  if (template === "home") {
    return {
      title,
      subtitle: "成立于 2005 · 总部纽约 · 全球 100+ 服务点",
      hero: {
        title: "让每一个想离开的人，都能留下记录。",
        body: "全球退党服务中心为中国民众提供退出中共党、团、队的声明登记与证明服务，记录并公开侵害人权的证据，并由各地志愿者在全球一百多个服务点提供协助。二十年来，我们登记了四亿六千多万份声明。"
      },
      streamEntries: [
        {
          region: "No. 464,375,381",
          name: "伍万＊ · 中国大陆",
          text: "在中国大陆从小被动加入了少先队及共青团。在认清中共的本质后，特此郑重声明退出，彻底与其组织决裂。",
          at: "2026-08-08"
        }
      ]
    };
  }

  if (template === "section-home") {
    if (section === "about" && slug === "index") {
      return {
        title,
        subtitle:
          subtitle ??
          "全球退党服务中心成立于二〇〇五年，是在美国注册的 501(c)(3) 非营利组织，总部设于纽约。我们为中国民众提供退出中共党、团、队的声明登记与证明服务，记录并公开侵害人权的证据，并由各地志愿者在全球一百多个服务点提供协助。",
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
              label: "收费与免费。",
              text: "三退声明登记与查询验证免费。退党证明为实名办理，需缴纳办理／管理费用，仅通过官方渠道收取。我们不会通过私人账户或中介收款。"
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
            { value: "0", label: "声明登记收费" }
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
    }

    if (section === "about" && slug === "network") {
      return {
        title,
        subtitle: subtitle ?? "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。",
        stats: [
          { value: "100+", label: "全球服务点" },
          { value: "20+", label: "覆盖国家与地区" },
          { value: "2,000+", label: "登记在册志愿者" },
          { value: "0", label: "声明登记收费" }
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
        ctaPanel: {
          title: "找不到附近的服务点？",
          body: "你也可以在线声明，或通过电话与邮件提交。全部方式效力相同。",
          buttonLabel: "在线声明",
          buttonHref: "/services/declare"
        },
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
      };
    }

    if (section === "about" && slug === "accountability") {
      return {
        title,
        subtitle:
          subtitle ??
          "财务报表经独立会计师事务所审计，Form 990 依法公开。治理结构与统计方法全部公开。针对本机构的威胁与攻击同样公开记录。",
        summaryCells: [
          { title: "注册与法律地位", value: "501(c)(3)", body: "在美国注册的非营利组织，捐款可依法抵税。年度 Form 990 公开可查。", bars: [] },
          {
            title: "资金使用（上一财年）",
            value: "",
            body: "",
            bars: [
              { width: 132, text: "项目支出 84%", tone: "b1" },
              { width: 16, text: "行政 10%", tone: "b2" },
              { width: 10, text: "筹款 6%", tone: "b3" }
            ]
          },
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
      };
    }

    if (section === "about" && slug === "team") {
      return {
        title,
        subtitle: subtitle ?? "",
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
        joinPanel: {
          title: "加入我们",
          body: "绝大部分工作由志愿者完成。时间多少不限。",
          buttonLabel: "成为义工",
          buttonHref: "/involve/volunteer"
        }
      };
    }

    if (section === "services" && slug === "index") {
      return {
        title,
        subtitle:
          subtitle ??
          "我们提供三项服务：登记你的退出声明、为需要的人出具中英文退党证明、并让第三方能够在线查验证明的真伪。三退声明登记与查询验证免费；退党证明为实名办理，需缴纳办理／管理费用。",
        primaryAction: {
          label: "立即声明三退",
          href: "/services/declare",
          stamp: "退"
        },
        secondaryAction: {
          label: "办理退党证明",
          href: "/services/cert"
        },
        processCards: [
          {
            tag: "第一步",
            title: "声明退出",
            body: "填写一份简短的声明，说明你要退出的组织。可以使用真名、化名或代号，无需提供任何身份证明。",
            foot: "可完全匿名 · 无需注册账号",
            links: [
              { label: "立即声明", href: "/services/declare", meta: "约 3 分钟" },
              { label: "什么是三退", href: "/services/faq", meta: "问答" },
              { label: "为什么要三退", href: "/services/faq", meta: "问答" },
              { label: "安全与隐私说明", href: "/services/privacy", meta: "必读" }
            ]
          },
          {
            tag: "第二步（可选）",
            title: "办理退党证明",
            body: "如果你在移民、身份申请或其他场合需要书面凭据，可以申请一份中英文对照的退党证明。",
            foot: "实名办理 · PDF 电子证明",
            links: [
              { label: "申请证明", href: "/services/cert", meta: "在线" },
              { label: "与移民申请的关系", href: "/services/immigration", meta: "说明" },
              { label: "证明常见问题", href: "/services/faq", meta: "FAQ" },
              { label: "信息变更与补办", href: "/services/contact", meta: "服务" }
            ]
          },
          {
            tag: "第三方",
            title: "查询与验证",
            body: "任何机构或个人都可以凭证明编号在线查验真伪，无需联系本中心，也无需登录。",
            foot: "公开查验 · 不需要授权",
            links: [
              { label: "输入编号查验", href: "/services/verify", meta: "公开" },
              { label: "证明样本与防伪说明", href: "/services/cert", meta: "说明" },
              { label: "给受理机构的说明", href: "#", meta: "PDF" },
              { label: "联系我们核实", href: "/services/contact", meta: "联络" }
            ]
          }
        ],
        verifyBand: {
          eyebrow: "查询验证",
          title: "查验一份退党证明",
          body: "在本中心的查验系统输入证明编号，即可核实签发日期与状态。此入口对所有人开放，受理机构无需与本中心联系即可自行查验。",
          inputLabel: "证明编号",
          inputPlaceholder: "例如 TD-2026-0071824",
          buttonLabel: "查验",
          buttonHref: "/services/verify"
        },
        certSection: {
          eyebrow: "退党证书",
          title: "证明办理",
          paragraphs: [
            "退党证明是一份由本中心签发的中英文对照文件，载明声明人姓名、退出的组织、声明日期与证明编号。",
            "你需要先完成一份三退声明。若此前已经声明过，也可以凭当时信息申请补发。"
          ],
          noticeTitle: "请注意",
          noticeBody:
            "退党证明由本中心签发，不是任何政府机关出具的文件，也不构成对移民申请结果的任何保证。是否采信、如何采信，由受理机构自行判断。",
          subheading: "办理需要什么",
          subbody: "你需要先完成一份三退声明。若此前已经声明过，也可以凭当时信息申请补发。",
          actionStamp: "退",
          actions: [
            { label: "申请证明", href: "/services/cert", variant: "seal" },
            { label: "先看常见问题", href: "/services/faq", variant: "line" }
          ],
          samplePanel: {
            title: "证明样本",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            alt: "退党证明颁发现场",
            caption: "2026 年 7 月，31 名华人在美国国会山领取退党证明。"
          },
          relatedPanel: {
            title: "相关",
            links: [
              { label: "证明与移民申请", href: "/services/immigration" },
              { label: "第三方查验入口", href: "/services/verify" },
              { label: "信息变更与补办", href: "/services/contact" },
              { label: "常见问题", href: "/services/faq" }
            ]
          }
        },
        immigrationSection: {
          eyebrow: "移民相关政策与问题",
          title: "与身份申请有关的说明与报导",
          lede: "以下为公开报导与政策梳理，供参考。本中心不提供法律意见，具体个案请咨询有执照的移民律师。",
          moreLabel: "全部相关报导 →",
          moreHref: "/news",
          items: [
            {
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
              tag: "政策梳理",
              title: "美国第 444 号决议与华人身份申请的关系",
              summary: "决议原文、通过经过，以及它在实务上意味着什么、不意味着什么。",
              meta: "2026-07-22 · 华盛顿"
            },
            {
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
              tag: "相关报导",
              title: "在美国办绿卡被卡，党员退党要抓紧",
              summary: "近年身份申请中与党籍相关的审查趋势，以及当事人的处理经过。",
              meta: "2026-06-18"
            },
            {
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
              tag: "相关报导",
              title: "华人海外要站稳脚跟，「退党证明」已不是选择题",
              summary: "受理机构如何看待退党证明，以及提交时应注意什么。",
              meta: "2026-05-30"
            }
          ]
        },
        contactSection: {
          title: "需要修改信息，或者证明遗失了？",
          body: "如果声明中的姓名有误、需要变更，或者证明遗失需要补发，请联系我们。由志愿者人工处理，通常需要数个工作日。请说明原声明的大致时间与内容，以便核对。",
          primaryAction: { label: "提交变更申请", href: "/services/contact" },
          secondaryAction: { label: "联系服务点", href: "/about/network" }
        }
      };
    }

    if (section === "resources" && slug === "index") {
      return {
        title,
        subtitle: subtitle ?? "《九评共产党》及系列著作的全文、音频与多语种译本。全部免费开放阅读与下载，可自由转载与再制作。",
        featuredBook: {
          coverText: "九评\n共产党",
          yearLine: "2004 年首次发表 · 已译为 30 余种语言",
          title: "《九评共产党》",
          body: "此书是近现代历史上第一次系统剖析中共本质的著作。自二〇〇四年出版以来在全球华人间相互传看，并由此引发了「三退」精神觉醒运动——至今已有四亿六千多万人公开声明退出中共党、团、队组织。",
          formats: [
            { label: "在线阅读", href: "#" },
            { label: "PDF", href: "#" },
            { label: "EPUB", href: "#" },
            { label: "音频版", href: "#" },
            { label: "影音版", href: "/videos/jiuping" },
            { label: "多语种译本", href: "#" }
          ],
          tocHeading: "目录",
          toc: [
            { index: "一", title: "评共产党是什么", href: "#" },
            { index: "二", title: "评中国共产党是怎样起家的", href: "#" },
            { index: "三", title: "评中国共产党的暴政", href: "#" },
            { index: "四", title: "评共产党是反宇宙的力量", href: "#" },
            { index: "五", title: "评江泽民与中共相互利用迫害法轮功", href: "#" },
            { index: "六", title: "评中国共产党破坏民族文化", href: "#" },
            { index: "七", title: "评中国共产党的杀人历史", href: "#" },
            { index: "八", title: "评中国共产党的邪教本质", href: "#" },
            { index: "九", title: "评中国共产党的流氓本性", href: "#" }
          ]
        },
        otherWorksSection: {
          eyebrow: "其他著作",
          title: "系列出版物"
        },
        otherWorks: [
          {
            coverText: "解体\n党文化",
            title: "《解体党文化》",
            body: "分析党文化如何进入语言、教育、思维方式与日常生活。「要做中华儿女，不做马列子孙」——对党文化的清醒反思与抛弃。",
            href: "#",
            formats: [
              { label: "在线阅读", href: "#" },
              { label: "PDF", href: "#" },
              { label: "音频", href: "#" }
            ]
          },
          {
            coverText: "魔鬼在\n统治着\n我们的\n世界",
            title: "《魔鬼在统治着我们的世界》",
            body: "共产主义的本质到底是什么？它为什么似乎处处与人类为敌？含全书文字版、系列报导与学者综述。",
            href: "#",
            formats: [
              { label: "在线阅读", href: "#" },
              { label: "PDF", href: "#" },
              { label: "音频", href: "#" }
            ]
          },
          {
            coverText: "共产主义的\n终极目的",
            title: "《共产主义的终极目的》",
            body: "共产主义的终极目的是什么？人类的出路在哪里？全书文字版与播报版。",
            href: "#",
            formats: [
              { label: "在线阅读", href: "#" },
              { label: "PDF", href: "#" },
              { label: "音频", href: "#" }
            ]
          }
        ],
        relatedSection: {
          eyebrow: "延伸阅读",
          title: "学者综述与相关报导",
          lede: "围绕上述著作的评论、学者分析与新闻关注汇编。",
          moreLabel: "全部相关文章 →",
          moreHref: "/news/commentary"
        },
        relatedArticles: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            tag: "学者综述",
            title: "《九评》发表二十周年：一场没有武力的觉醒运动",
            summary: "回顾二十年间三退人数的变化，以及这场运动与以往政治运动的根本差别。",
            meta: "2024-12-08"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            tag: "名家专栏",
            title: "党文化如何塑造日常语言",
            summary: "从常用词汇的来源谈起，讨论语言与思维方式的关系。",
            meta: "2026-07-11"
          }
        ],
        reuseNotice: {
          title: "全部内容免费开放",
          body: "可自由下载、印制、转载、翻译与再制作，无需事先取得授权，也不需要通知我们。用于商业用途同样不受限制，但请勿以本中心名义收费或代表本中心发言。注明来源即可。"
        }
      };
    }

    if (section === "resources" && slug === "downloads") {
      return {
        title,
        subtitle: subtitle ?? "展板、传单、手举牌、广播音档与图片素材。全部提供可编辑源文件与高分辨率成品，免费开放，无需事先授权。",
        downloadCards: [
          {
            title: "展板与横幅",
            body: "服务点与集会现场使用的大尺寸物料。提供 AI／PSD 可编辑源文件与高分辨率成品，CMYK 输出，字体已内嵌并附转曲版本。",
            items: [
              { label: "三退主题展板", meta: "86 项" },
              { label: "迫害真相展板", meta: "64 项" },
              { label: "横幅与背板", meta: "42 项" },
              { label: "End CCP 征签物料", meta: "24 项" }
            ],
            foot: "216 项 · 源文件 ＋ 成品"
          },
          {
            title: "传单与小册子",
            body: "A4、A5 与三折页，适合服务点现场发放与邮寄。多数已有英、德、韩、日、罗马尼亚语版本。",
            items: [
              { label: "三退介绍传单", meta: "38 项" },
              { label: "退党证明说明", meta: "16 项" },
              { label: "《九评》导读小册", meta: "22 项" },
              { label: "多语种版本", meta: "108 项" }
            ],
            foot: "184 项 · PDF ＋ 源文件"
          },
          {
            title: "手举牌与贴纸",
            body: "集会、游行与征签现场使用的套件。含中英对照版本与空白模板，可自行填写当地信息。",
            items: [
              { label: "集会手举牌", meta: "34 项" },
              { label: "征签台面物料", meta: "18 项" },
              { label: "贴纸与徽章", meta: "10 项" }
            ],
            foot: "62 项 · 可印制"
          },
          {
            title: "真相广播与音频",
            body: "音频节目与播报文稿，可用于电台、线上传播与现场播放。含《九评》播报版与三退洪声系列。",
            items: [
              { label: "三退洪声系列", meta: "MP3" },
              { label: "《九评》播报版", meta: "MP3" },
              { label: "播报文稿", meta: "可编辑" }
            ],
            foot: "音频 ＋ 文稿"
          }
        ],
        assetsSection: {
          eyebrow: "其他素材",
          title: "图片、表单与标识"
        },
        assets: [
          { title: "图片库", body: "历年活动、服务点与证明颁发现场摄影，高分辨率，含摄影署名要求。", badge: "Flickr 相簿", href: "#" },
          { title: "三退登记表", body: "义工现场使用的纸本登记表，供无法在线提交者填写。", badge: "PDF · 义工专用", href: "#" },
          { title: "标准字与标识", body: "机构标识、标准色与使用规范。", badge: "品牌规范", href: "#" },
          { title: "多语种译本", body: "英、德、韩、日、罗马尼亚语素材汇总。", badge: "6 种语言", href: "#" }
        ],
        proseSections: [
          {
            heading: "印制建议",
            body: "展板类素材以 CMYK 输出为准，源文件已内嵌字体。若你所在地区无法取得思源字体，请使用文件中提供的转曲版本，避免开启时字体替换导致排版跑位。"
          },
          {
            heading: "如果你在当地印制并散发",
            body: "欢迎把照片寄给我们。我们会收进图片库，也让其他服务点看到——很多好的做法就是这样互相学来的。"
          },
          {
            heading: "需要批量印制",
            body: "服务点可协助批量印制与配送。请与我们联系并说明数量、语种与用途。"
          }
        ],
        relatedPanel: {
          title: "相关",
          links: [
            { label: "查找服务点", href: "/about/network" },
            { label: "成为义工", href: "/involve/volunteer" },
            { label: "免翻墙链接", href: "/resources/tools" },
            { label: "媒体与记者", href: "/resources/press" }
          ]
        },
        assistPanel: {
          title: "需要协助？",
          body: "服务点可协助批量印制与配送，也可提供本地化建议。",
          buttonLabel: "联系我们",
          buttonHref: "/services/contact"
        },
        reuseNotice: {
          title: "全部内容免费开放",
          body: "可自由下载、印制、转载、翻译与再制作，无需事先取得授权，也不需要通知我们。用于商业用途同样不受限制，但请勿以本中心名义收费或代表本中心发言。注明来源即可。"
        }
      };
    }

    if (section === "resources" && slug === "magazine") {
      return {
        title,
        subtitle: subtitle ?? "深度报导、当事人自述与文化专题。历期均可免费下载。",
        featuredIssue: {
          coverText: "回归\n2026\n春季号",
          yearLine: "2015 年创刊 · 季刊 · 纸本与电子版同步发行",
          title: "《回归》：二十年，四亿六千万份声明",
          body: "本期封面专题回顾退党大潮的二十年轨迹，并收录服务点纪实、学者综述与当事人自述。",
          actions: [
            { label: "在线阅读", href: "#" },
            { label: "PDF 下载", href: "#" },
            { label: "EPUB", href: "#" },
            { label: "音频版", href: "#" }
          ],
          note: "本刊所有内容可转载，注明来源即可。"
        },
        issuesSection: {
          eyebrow: "近期刊物",
          title: "历期下载"
        },
        issues: [
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/return-magazine-spring-2026.jpg",
            title: "《回归》2026 春季号",
            summary: "封面专题：二十年，四亿六千万份声明。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2025/12/return-magazine-winter-2025.jpg",
            title: "《回归》2025 冬季号",
            summary: "封面专题：服务点的人。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2025/09/return-magazine-autumn-2025.jpg",
            title: "《回归》2025 秋季号",
            summary: "专题：我为什么公开三退。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2025/06/return-magazine-summer-2025.jpg",
            title: "《回归》2025 夏季号",
            summary: "专题：党文化与日常语言。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2025/03/return-magazine-spring-2025.jpg",
            title: "《回归》2025 春季号",
            summary: "专题：海外三退服务点纪实。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2024/12/return-magazine-winter-2024.jpg",
            title: "《回归》2024 冬季号",
            summary: "专题：青年一代与选择。"
          },
          {
            href: "#",
            image: "https://www.tuidang.org/wp-content/uploads/2024/09/return-magazine-autumn-2024.jpg",
            title: "《回归》2024 秋季号",
            summary: "专题：文化与信仰。"
          },
          {
            href: "#",
            archiveText: "归档\n2015—至今",
            title: "历期归档",
            summary: "按年份浏览全部期数与专题。"
          }
        ],
        proseSections: [
          {
            heading: "关于《回归》",
            body: "《回归》是面向大众读者的综合性刊物，围绕三退运动、文化反思与人物见证。每期都可免费下载、转载与再制作。"
          },
          {
            heading: "如何投稿",
            body: "欢迎投稿当事人自述、服务点故事与相关评论。来稿请附作者署名方式与联系方式。"
          },
          {
            heading: "纸本与电子版",
            body: "纸本供服务点现场发放；电子版提供 PDF／EPUB／音频，便于线上传播。"
          }
        ],
        requestPanel: {
          title: "投稿与索取纸本",
          body: "欢迎投稿，也可来信索取纸本用于服务点发放。",
          buttonLabel: "联系编辑部",
          buttonHref: "/services/contact"
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "书籍与文集", href: "/resources" },
            { label: "资料下载", href: "/resources/downloads" },
            { label: "媒体与记者", href: "/resources/press" }
          ]
        }
      };
    }

    if (section === "resources" && slug === "press") {
      return {
        title,
        subtitle: subtitle ?? "机构简介、数据说明、可授权图片与联络方式，供媒体与研究者引用。",
        noticePanel: {
          title: "欢迎查证",
          body: "本站文字、图片与数据可自由引用与转载，原则上无需事先授权。请保留来源与摄影署名；若需原始文件或采访协助，请联系编辑部。"
        },
        kitSection: {
          eyebrow: "媒体资料包",
          title: "可下载素材"
        },
        kitItems: [
          { title: "机构简介（一页）", body: "成立背景、服务内容、规模与法律地位，中英文版本。", badge: "PDF · 中／英", href: "#" },
          { title: "数据与统计方法", body: "数字计入规则、去重方式与已知局限。", badge: "说明页", href: "/about/numbers" },
          { title: "可授权图片", body: "历年活动、服务点与证明颁发现场，高分辨率，含摄影署名要求。", badge: "图片库", href: "#" },
          { title: "标识与标准字", body: "机构标识、标准色与使用规范。", badge: "品牌规范", href: "#" },
          { title: "财务与治理", body: "Form 990、经审计报表、理事会名单。", badge: "问责页", href: "/about/accountability" },
          { title: "安全事件档案", body: "针对本机构的威胁事件、报案与处理经过。", badge: "档案", href: "#" }
        ],
        faqSection: {
          eyebrow: "常见问题",
          title: "采访与引用 FAQ"
        },
        faqs: [
          {
            question: "你们的数据是怎么来的？",
            answer: [
              "所有数字来自当事人主动提交的三退声明。系统按提交记录去重统计，并保留原文与时间戳。",
              "统计口径与方法见「数字与统计方法」页面。"
            ]
          },
          {
            question: "是否可以引用你们的图片和文字？",
            answer: ["可以。本站内容可自由引用、转载与翻译，无需预先授权，注明来源即可。图片请保留摄影署名。"]
          },
          {
            question: "可以匿名采访吗？",
            answer: ["可以。若受访者有安全顾虑，我们可协调匿名受访，并在发布前确认表述方式。"]
          },
          {
            question: "是否接受商业媒体付费合作？",
            answer: ["我们不提供广告性质合作，但欢迎媒体就公共议题进行采访与资料查证。"]
          }
        ],
        ctaPanel: {
          title: "采访、查证与数据合作",
          body: "我们可提供高分辨率原图、历史归档、数据解释与受访联络协助。",
          primaryLabel: "联系编辑部",
          primaryHref: "/services/contact",
          secondaryLabel: "查看统计方法",
          secondaryHref: "/about/numbers"
        }
      };
    }

    return {
      title,
      subtitle: subtitle ?? `${title} 的栏目首页内容`,
      cards: [
        { tag: "内容", title: "区块可增删排序", body: "模块化内容块支持在 CMS 中按栏目自由组合。" }
      ],
      sidebar: {
        title: "栏目操作",
        links: [
          { label: "在 CMS 中编辑此页", href: "/admin/content" },
          { label: "查看修订历史", href: "/admin/revisions" }
        ]
      }
    };
  }

  if (template === "list-archive") {
    if (section === "news" && slug === "index") {
      return {
        title,
        subtitle: subtitle ?? "机构公告、调查报告、专题评论、国际声援与三退新闻。全部内容注明来源与日期，可自由转载与翻译。",
        frontLead: {
          slug: "international-support-action",
          href: "/news/article",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
          tag: "国际声援行动",
          title: "美议员在国会表彰退党运动，31 名华人现场领取退党证明",
          summary:
            "田纳西州联邦众议员安迪·奥格尔斯发出表彰公告，声明正式载入《国会议事录》。同日，31 名华人在国会访客中心的论坛上领取了退出中共党、团、队的证明。",
          meta: "2026-07-21 · 华盛顿 · 本站报导"
        },
        frontList: [
          {
            slug: "bomb-threat-statement",
            href: "/news/article",
            tag: "机构公告与声明",
            title: "严正声明：本中心多次收到炸弹恐怖攻击等威胁信",
            meta: "2026-06-10 · 纽约"
          },
          {
            slug: "investigation-report-361",
            href: "/news/article",
            tag: "追查国际调查报告",
            title: "361 名法轮功学员炼钢炉虐杀惨案调查报告",
            meta: "2026-02 · 录音取证"
          },
          {
            slug: "feature-rewritten-70-years",
            href: "/news/article",
            tag: "专题报导",
            title: "专题：被改写的七十年——从大饥荒到今天的官方叙事",
            meta: "2026-07-29 · 上下篇"
          },
          {
            slug: "jejudo-volunteer-story",
            href: "/news/article",
            tag: "三退新闻与故事",
            title: "济州岛三退义工面对挑衅，威而不惧",
            meta: "2026-06-10 · 影片 11 分"
          }
        ],
        briefItems: [
          { slug: "daily-1", href: "/news/article", date: "08-12", title: "全球服务点单周新增声明逾二十六万份" },
          { slug: "daily-2", href: "/news/article", date: "08-08", title: "欧洲议会通过决议，关注强制器官摘取问题" },
          { slug: "daily-3", href: "/news/article", date: "08-11", title: "地方财政困局之下，基层治理正在发生什么" },
          { slug: "daily-4", href: "/news/article", date: "08-06", title: "隐瞒军旅身份，入境美国被捕承认是中校及党员" },
          { slug: "daily-5", href: "/news/article", date: "08-09", title: "留学生在海外读到不同的报道后，选择声明退出" },
          { slug: "daily-6", href: "/news/article", date: "08-05", title: "广西洪涝十余日，救助物资迟迟未至，灾民逃荒自救" }
        ],
        solidaritySection: {
          title: "国际声援行动",
          moreLabel: "全部声援行动 →",
          moreHref: "/news/solidarity",
          items: [
            {
              slug: "us-resolution-444",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
              title: "美国国会通过第 444 号决议",
              summary: "决议指出中共对全球稳定与和平构成严重威胁，从事系统性欺骗与反人类罪行。",
              meta: "2026-06 · 华盛顿"
            },
            {
              slug: "eu-resolution",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
              title: "欧洲议会通过决议，关注强制器官摘取问题",
              summary: "要求成员国审视与中国的器官移植相关合作，并对责任人采取措施。",
              meta: "2026-06-25 · 布鲁塞尔"
            },
            {
              slug: "auckland-voices",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
              title: "反制中共干预与跨境压制，纽澳台嘉宾奥克兰同场发声",
              summary: "来自新西兰、澳洲与台湾的学者与议员讨论跨境压制的形式与应对。",
              meta: "2026-02-23 · 奥克兰"
            }
          ]
        },
        investigationsSection: {
          title: "追查国际调查报告",
          moreLabel: "全部调查报告 →",
          moreHref: "/news/investigations",
          lede: "由追查迫害法轮功国际组织独立发布，本中心转载。该组织自 2006 年起持续取证，已公开 866 段调查录音与逾 4,000 份文献证据。",
          items: [
            {
              slug: "investigation-361",
              href: "/news/article",
              title: "361 名法轮功学员炼钢炉虐杀惨案调查报告",
              facts: ["调查报告", "录音取证", "2026-02"],
              actions: ["在线阅读", "PDF"]
            },
            {
              slug: "iron-evidence",
              href: "/news/article",
              title: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
              facts: ["系列调查片", "32 集", "含电子书"],
              actions: ["▶ 观看", "电子书"]
            },
            {
              slug: "tiananmen-incident",
              href: "/news/article",
              title: "「天安门自焚」伪案追查报告",
              facts: ["调查报告", "影像分析", "2026-05-18"],
              actions: ["在线阅读", "PDF"]
            },
            {
              slug: "accountability-list",
              href: "/news/article",
              title: "参与迫害的公安、检察与司法人员责任调查名单",
              facts: ["责任人名单", "可检索", "2026-04-02"],
              actions: ["查询数据库", "PDF"]
            }
          ]
        },
        commentarySection: {
          title: "专题报导与时政评论",
          moreLabel: "全部 →",
          moreHref: "/news/commentary",
          items: [
            {
              slug: "feature-70-years",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
              tag: "专题报导",
              title: "专题：被改写的七十年——从大饥荒到今天的官方叙事",
              summary: "分上下两篇，梳理官方叙事的形成过程与几次关键改写。",
              meta: "2026-07-29 · 上下篇"
            },
            {
              slug: "flood-special",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
              tag: "特别报导",
              title: "广西洪涝十余日，救助物资迟迟未至，灾民逃荒自救",
              summary: "多位当地居民描述灾后处境，与官方通报存在明显出入。",
              meta: "2026-07-23"
            },
            {
              slug: "language-column",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
              tag: "名家专栏",
              title: "党文化如何塑造日常语言",
              summary: "从常用词汇的来源谈起，讨论语言与思维方式的关系。",
              meta: "2026-07-11 · 专栏"
            }
          ]
        },
        announcementsSection: {
          title: "机构公告与声明",
          moreLabel: "全部 →",
          moreHref: "/news/announcement-claims",
          items: [
            {
              slug: "announce-1",
              href: "/news/article",
              date: "2026-06-10",
              badge: "机构声明",
              title: "严正声明：本中心多次收到炸弹恐怖攻击等威胁信"
            },
            {
              slug: "announce-2",
              href: "/news/article",
              date: "2026-07-15",
              badge: "年度报告",
              title: "二〇二五年度工作报告与三退登记数据"
            },
            {
              slug: "announce-3",
              href: "/news/article",
              date: "2026-03-18",
              badge: "登记数据",
              title: "二〇二六年前两月，二百一十五万中国人声明三退"
            },
            {
              slug: "announce-4",
              href: "/news/article",
              date: "2026-02-04",
              badge: "机构声明",
              title: "关于冒用本中心名义收费办理证明的声明"
            }
          ]
        },
        storiesSection: {
          title: "三退新闻与故事",
          moreLabel: "全部三退新闻 →",
          moreHref: "/news/stories",
          items: [
            {
              slug: "story-1",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
              title: "济州岛三退义工面对挑衅，威而不惧",
              summary: "今年五月有九万中国人搭邮轮抵达济州岛。义工们轮班在码头与免税店前守候。",
              meta: "2026-06-10 · 11 分",
              isVideo: true
            },
            {
              slug: "story-2",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
              title: "【三退洪声】大陆记者：我在党媒说了太多假话，今天说句真话",
              summary: "黑龙江某报记者、前国安人员、高校教师等人的声明与自述。含音频节目。",
              meta: "2026-05-22 · 音频"
            },
            {
              slug: "story-3",
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
              title: "留学生在海外读到不同的报道后，选择声明退出",
              summary: "几位在日本与欧洲的中国留学生，讲述从怀疑到查证的过程。",
              meta: "2026-07-29"
            }
          ]
        },
        notableSection: {
          title: "名人退党",
          moreLabel: "全部证词 →",
          moreHref: "/news/notable",
          testimonials: [
            {
              quote: "作为外交官，按理应该为国家利益服务，但我在那里做的事大多不是为了国家利益，而是在迫害自己的人民。",
              name: "陈用林",
              role: "中共前外交官\n驻悉尼总领事馆一等秘书",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png"
            },
            {
              quote: "我 1991 年加入中国共产党，当时对它抱有很高的期望，但事实并不像我想像的那样。",
              name: "郝凤军",
              role: "原天津市公安局\n「六一〇」办公室官员",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png"
            },
            {
              quote: "我当记者二十多年，说了二十多年谎话。今天，我说一句真话：我退党。",
              name: "曲吉莲",
              role: "黑龙江佳木斯日报记者\n从业二十余年",
              image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png"
            }
          ]
        },
        archiveSection: {
          title: "查阅归档",
          moreLabel: "高级检索 →",
          moreHref: "#",
          cards: [
            { title: "按年份", body: "2005 年至今，约 2,800 篇。逐年浏览。", href: "#" },
            { title: "按栏目", body: "六个栏目的完整列表与标签。", href: "#" },
            { title: "仅报告与文件", body: "调查报告、年度报告与政策文件。", href: "#" },
            { title: "仅影音", body: "影片、纪录片与音频节目。", href: "#" }
          ],
          note: "本站全部内容可自由下载、转载、翻译与再制作，无需事先取得授权，注明来源即可。图片请一并保留摄影署名。",
          noteLinkLabel: "媒体与记者资料",
          noteLinkHref: "/resources/press"
        }
      };
    }

    if (section === "news" && slug === "announcements") {
      return {
        title,
        subtitle: subtitle ?? "本中心发布的正式公告、声明、年度报告与登记数据通报。包括针对本机构的威胁事件记录。",
        noticeRows: [
          {
            href: "/news/article",
            date: "2026-06-10",
            badge: "机构声明",
            title: "严正声明：本中心多次收到炸弹恐怖攻击等威胁信",
            summary: "本中心已就相关威胁向执法机关报案。现将事件经过、威胁信内容与处理进展一并公开记录。"
          },
          {
            href: "/news/article",
            date: "2026-07-15",
            badge: "年度报告",
            title: "二〇二五年度工作报告与三退登记数据",
            summary: "全年登记总量、月度变化、区域分布与服务点运作情况，附统计方法说明与经审计财务报表。"
          },
          {
            href: "/news/article",
            date: "2026-03-18",
            badge: "登记数据",
            title: "二〇二六年前两月，二百一十五万中国人声明三退",
            summary: "截至二月底，三退总人数突破四亿五千万。同期 End CCP 联署达五百一十七万人。"
          },
          {
            href: "/news/article",
            date: "2026-02-04",
            badge: "机构声明",
            title: "关于冒用本中心名义收费办理证明的声明",
            summary: "本中心的退党证明只通过官方渠道办理，不与任何中介机构合作，也不会通过私人账户收款。"
          },
          {
            href: "/news/article",
            date: "2025-12-20",
            badge: "机构声明",
            title: "关于本站部分镜像地址失效的说明与替代访问方式",
            summary: "近期部分镜像地址遭到封锁。现公布当前可用的访问方式，并说明后续更新渠道。"
          },
          {
            href: "/news/article",
            date: "2024-12-08",
            badge: "机构公告",
            title: "《九评共产党》发表二十周年公告",
            summary: "二十年来累计登记声明四亿三千万份。本公告一并说明二十周年系列活动安排。"
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        subscribePanel: {
          title: "订阅公告",
          body: "重要公告可通过邮件接收，不需要访问网站。",
          buttonLabel: "邮件订阅",
          buttonHref: "#"
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "公开与问责", href: "/about/accountability" },
            { label: "统计方法说明", href: "/about/numbers" },
            { label: "安全事件档案", href: "#" },
            { label: "历年年度报告", href: "#" }
          ]
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "news" && slug === "investigations") {
      return {
        title,
        subtitle: subtitle ?? "独立调查机构发布的取证报告、证人陈述、录音证据与责任人名单。每份报告均注明取证方式与资料来源。",
        introNotice: {
          title: "关于本栏目",
          body: "以下报告由「追查迫害法轮功国际组织」（追查国际）独立发布，本中心转载。该组织自 2006 年起持续取证，已公开发布 866 段调查录音与逾 4,000 份文献证据。每份报告均注明取证方式与资料来源。"
        },
        docRows: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            title: "361 名法轮功学员炼钢炉虐杀惨案调查报告",
            summary: "系统披露 1999 年底发生于北京石景山某钢铁企业的案件。报告主要内容由一名亲身参与迫害的武警亲口披露。",
            facts: ["调查报告", "录音取证", "2026-02"],
            actions: [{ label: "在线阅读", href: "#" }, { label: "PDF", href: "#" }]
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            isVideo: true,
            title: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
            summary: "32 集大型系列，汇集追查国际十余年调查精华，逐一呈现录音证据，梳理证据之间的逻辑关系与调查背景。",
            facts: ["系列调查片", "32 集", "含电子书"],
            actions: [{ label: "▶ 观看", href: "#" }, { label: "电子书", href: "#" }]
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            title: "「天安门自焚」伪案追查报告",
            summary: "对 2001 年天安门自焚事件的疑点逐项查证，含现场影像分析、医学质疑与相关人员背景调查。",
            facts: ["调查报告", "影像分析", "2026-05-18"],
            actions: [{ label: "在线阅读", href: "#" }, { label: "PDF", href: "#" }]
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            title: "参与迫害的公安、检察与司法人员责任调查名单",
            summary: "含五位中共中央政治局常务委员及多位高级官员的证词，按机构与地区分类整理。",
            facts: ["责任人名单", "可检索", "2026-04-02"],
            actions: [{ label: "查询数据库", href: "#" }, { label: "PDF", href: "#" }]
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            isVideo: true,
            title: "《活摘：十年调查》",
            summary: "史料纪录片，由汪志远主持串联，呈现追查国际十年调查的完整结果与方法。",
            facts: ["纪录片", "中英字幕", "可下载"],
            actions: [{ label: "▶ 观看", href: "#" }, { label: "下载", href: "#" }]
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        evidencePanel: {
          title: "证据类型",
          items: ["调查报告（文字）", "录音取证", "影像与纪录片", "责任人名单数据库", "文献证据汇编"]
        },
        reusePanel: {
          title: "可自由引用",
          body: "全部报告可自由下载、转载、翻译与再制作，供媒体、研究者与司法机构使用。",
          buttonLabel: "媒体与记者",
          buttonHref: "/resources/press"
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "news" && slug === "commentary") {
      return {
        title,
        subtitle: subtitle ?? "长篇专题、特别报导、时政评论与名家专栏。梳理事件脉络与制度成因，署名文章观点属作者本人。",
        filters: ["全部", "专题报导", "时政评论", "名家专栏", "特别报导"],
        items: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            tag: "专题报导",
            title: "专题：被改写的七十年——从大饥荒到今天的官方叙事",
            summary: "分上下两篇，梳理官方叙事的形成过程与几次关键改写。",
            meta: "2026-07-29 · 上下篇"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            tag: "特别报导",
            title: "广西洪涝十余日，救助物资迟迟未至，灾民逃荒自救",
            summary: "多位当地居民描述灾后十余天的处境，与官方通报内容存在明显出入。",
            meta: "2026-07-23"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            tag: "时政评论",
            title: "地方财政困局之下，基层治理正在发生什么",
            summary: "从多地公开预算文件出发，分析基层运作的实际变化。",
            meta: "2026-07-30 · 评论"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            tag: "名家专栏",
            title: "名家专栏：党文化如何塑造日常语言",
            summary: "从常用词汇的来源谈起，讨论语言与思维方式的关系。",
            meta: "2026-07-11 · 专栏"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            tag: "时政评论",
            title: "王友群：在美国办绿卡被卡，党员退党要抓紧",
            summary: "近年身份申请中与党籍相关的审查趋势，以及当事人的处理经过。",
            meta: "2026-06-18 · 评论"
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        authorPanel: {
          title: "专栏作者",
          links: [{ label: "王友群", href: "#" }, { label: "李军", href: "#" }, { label: "更多作者", href: "#" }]
        },
        notePanel: {
          title: "说明",
          body: "署名评论与专栏文章的观点属作者本人，不代表本中心立场。专题报导与特别报导为本站编辑部作品。"
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "news" && slug === "solidarity") {
      return {
        title,
        subtitle: subtitle ?? "各国议会决议、政要表态、民间团体声援与集会活动纪录。按地区与形式分类。",
        filters: ["全部", "议会与决议", "集会与游行", "研讨与论坛", "北美", "欧洲", "亚太"],
        items: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            tag: "华盛顿 · 议会",
            title: "美议员在国会表彰退党运动，声明载入《国会议事录》",
            summary: "田纳西州联邦众议员安迪·奥格尔斯发出表彰公告，同日 31 名华人在国会山领取退党证明。",
            meta: "2026-07-21 · 华盛顿"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            tag: "华盛顿 · 决议",
            title: "美国国会通过第 444 号决议",
            summary: "决议指出中国共产党对全球稳定与和平构成严重威胁，从事系统性欺骗与反人类罪行。",
            meta: "2026-06 · 华盛顿"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            tag: "布鲁塞尔 · 议会",
            title: "欧洲议会通过决议，关注强制器官摘取问题",
            summary: "决议要求成员国审视与中国的器官移植相关合作，并对责任人采取措施。",
            meta: "2026-06-25 · 布鲁塞尔"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            tag: "奥克兰 · 论坛",
            title: "反制中共干预与跨境压制，纽澳台嘉宾奥克兰同场发声",
            summary: "来自新西兰、澳洲与台湾的学者与议员讨论跨境压制的形式与应对。",
            meta: "2026-02-23 · 奥克兰"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            tag: "纽约 · 集会",
            title: "纽约中领馆前烛光夜悼，十七名华人现场声明三退",
            summary: "法轮功学员在中领馆前举行集会与烛光夜悼，现场有旅客驻足并当场声明。",
            meta: "2026-07-20 · 纽约",
            isVideo: true
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        docsPanel: {
          title: "议会文件",
          links: [
            { label: "美国第 444 号决议", href: "#" },
            { label: "《国会议事录》表彰声明", href: "#" },
            { label: "欧洲议会决议", href: "#" },
            { label: "历年议会文件汇编", href: "#" }
          ]
        },
        ctaPanel: {
          title: "参与联署",
          body: "End CCP 公开联署已有二百四十八万人签署，覆盖 90 多个国家与地区。",
          buttonLabel: "了解联署",
          buttonHref: "/involve/endccp"
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "news" && slug === "stories") {
      return {
        title,
        subtitle: subtitle ?? "当事人自述、服务点现场纪实、三退洪声音频节目与相关报导。含原「三退要闻」「退党纪实故事」全部内容。",
        filters: ["全部", "当事人自述", "现场纪实", "三退洪声", "影片"],
        items: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            tag: "当事人自述",
            title: "留学生在海外读到不同的报道后，选择声明退出",
            summary: "几位在日本与欧洲的中国留学生，讲述他们从怀疑到查证、最终提交声明的过程。",
            meta: "2026-07-29"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            tag: "现场纪实",
            title: "济州岛三退义工面对挑衅，威而不惧",
            summary: "今年五月有九万中国人搭邮轮抵达济州岛。义工们轮班在码头、免税店与景点前守候。",
            meta: "2026-06-10 · 11 分",
            isVideo: true
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            tag: "三退洪声",
            title: "【三退洪声】大陆记者：我在党媒说了太多假话，今天说句真话",
            summary: "黑龙江某报记者、前中共国安人员、高校教师等人的声明与自述。含音频节目。",
            meta: "2026-05-22 · 音频"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            tag: "现场纪实",
            title: "真相改变人心——纽约真相点三退故事",
            summary: "两位纽约华人在真相点了解事实后，最终选择三退的经过。",
            meta: "2026-05-30 · 纽约"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            tag: "当事人自述",
            title: "邵玉华：半生悲苦成智慧，春风化雨劝三退",
            summary: "从大饥荒、文革到九〇年代下岗，再到成为义工。",
            meta: "2026-05-10"
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        ctaPanel: {
          title: "你也可以声明",
          body: "登记一份声明约需三分钟，可以完全匿名，全程免费。",
          buttonLabel: "我要三退",
          buttonHref: "/services/declare",
          buttonStamp: "退"
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "义工故事", href: "/involve/stories" },
            { label: "影音节目", href: "/videos" },
            { label: "全球服务网络", href: "/about/network" }
          ]
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "news" && slug === "notable") {
      return {
        title,
        subtitle: subtitle ?? "曾在中共体制内任职者的公开声明。包括外交、公安、司法、党政、媒体与学界人士。全部声明原文完整保存并公开。",
        filters: ["全部", "外交与情报", "公安与司法", "党政干部", "媒体", "学界"],
        profiles: [
          {
            quote: "作为外交官，按理应该为国家利益服务，但我在那里做的事大多不是为了国家利益，而是在迫害自己的人民。这违背我的良心。",
            name: "陈用林",
            role: "中共前外交官\n中国驻悉尼总领事馆一等秘书",
            image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png"
          },
          {
            quote: "我 1991 年加入中国共产党，当时对它抱有很高的期望，但事实并不像我想像的那样。我在此郑重声明退出共产党及其所有组织。",
            name: "郝凤军",
            role: "原天津市公安局「六一〇」办公室官员\n一级警司",
            image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png"
          },
          {
            quote: "我于 1980 年入党，曾经忠心耿耿地效力。但越来越多的事实使我痛苦地认识到，这样一个党已经与我的理想和信念水火不容。",
            name: "韩广生",
            role: "原中共沈阳市司法局党委书记、局长\n市委政法委员会委员",
            image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png"
          },
          {
            quote: "我当记者二十多年，说了二十多年谎话。今天，我说一句真话：我退党。声明退出中共党、团、队组织。",
            name: "曲吉莲",
            role: "黑龙江佳木斯日报记者\n从业二十余年",
            image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png"
          }
        ],
        pager: ["1", "2", "3", "…", "42", "下一页 →"],
        aboutPanel: {
          title: "关于本栏目",
          body: "本栏目收录的是当事人本人公开作出的声明。声明原文完整保存，不作删改。职务信息以当事人自述或公开报导为准。"
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "三退新闻与故事", href: "/news/stories" },
            { label: "当事人访谈影片", href: "/videos" },
            { label: "我也要声明", href: "/services/declare" }
          ]
        },
        yearPanel: {
          title: "按年份",
          links: [
            { label: "2026　418", href: "#" },
            { label: "2025　1,203", href: "#" },
            { label: "2024　1,187", href: "#" },
            { label: "2005–2023 归档", href: "#" }
          ]
        }
      };
    }

    if (section === "resources" && slug === "culture") {
      return {
        title,
        subtitle: subtitle ?? "传统故事、历史人物、诗词与文化专题。含原「文化频道」「中华文化」「传统故事精选」全部内容，可自由转载与朗读。",
        filters: ["全部", "传统故事", "历史人物", "诗词", "节气与民俗", "良言善语"],
        items: [
          {
            slug: "祭仓颉-找回迷失的神性",
            href: `/news/${encodeURIComponent("祭仓颉-找回迷失的神性")}`,
            tag: "传统故事",
            title: "祭仓颉　找回迷失的神性",
            summary: "从造字传说说起，谈汉字与敬天信神的关系，以及文字被简化之后失去的东西。",
            date: "2026-05-07",
            image: "https://www.tuidang.org/wp-content/uploads/2026/05/4e2d68dad2b84dccbdd4a1cb748e6f33-600x321.jpeg"
          },
          {
            slug: "一只蒸羊照见天理帐本",
            href: `/news/${encodeURIComponent("一只蒸羊照见天理帐本")}`,
            tag: "传统故事",
            title: "一只蒸羊照见天理帐本",
            summary: "一则古代故事，与「举头三尺有神明」这句话在传统社会中的实际分量。",
            date: "2026-04-10",
            image: "https://www.tuidang.org/wp-content/uploads/2026/04/2026-04-10-下午1.43.53-768x447.png"
          },
          {
            slug: "千年微光：从乌台诗案到人性觉醒的文明回响",
            href: `/news/${encodeURIComponent("千年微光：从乌台诗案到人性觉醒的文明回响")}`,
            tag: "文化专题",
            title: "千年微光：从乌台诗案到人性觉醒的文明回响",
            summary: "从宋代文字狱谈起，看知识人在压力之下的选择，以及这些选择如何被后世记住。",
            date: "2026-06-22",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/截圖-2026-06-22-上午10.25.04-768x447.png"
          },
          {
            slug: "诗词-静中奇景",
            href: `/news/${encodeURIComponent("诗词-静中奇景")}`,
            tag: "诗词",
            title: "诗词：静中奇景",
            summary: "作者：宇清。静思中见天地之阔，诗意勾勒心神回归的宁静体验。",
            date: "2026-02-19",
            image: "https://www.tuidang.org/wp-content/uploads/2024/05/pexels-jacub-gomez-447561-1142950-768x513.jpg"
          },
          {
            slug: "诗词-春夜",
            href: `/news/${encodeURIComponent("诗词-春夜")}`,
            tag: "诗词",
            title: "诗词：春夜",
            summary: "作者：有德。以春夜景象寄托劝善之意，篇幅短小而立意明晰。",
            date: "2026-02-08",
            image: "https://www.tuidang.org/wp-content/uploads/2023/12/istockphoto-505622417-2048x2048-1-768x512.jpg"
          },
          {
            slug: "诗词-清静",
            href: `/news/${encodeURIComponent("诗词-清静")}`,
            tag: "诗词",
            title: "诗词：清静",
            summary: "作者：澄明。以简练语句呈现心境澄明与正念修持。",
            date: "2025-04-27",
            image: "https://www.tuidang.org/wp-content/uploads/2025/03/1200px-Atlantic_near_Faroe_Islands-768x508.jpg"
          },
          {
            slug: "诗词-七绝-春山行",
            href: `/news/${encodeURIComponent("诗词-七绝-春山行")}`,
            tag: "诗词",
            title: "诗词：七绝 春山行",
            summary: "春山行旅与救度苍生并置，呈现传统格律诗的节奏与志向。",
            date: "2025-04-20",
            image: "https://www.tuidang.org/wp-content/uploads/2025/04/tXr5UjKDsDBrYBQM9znb2c-1200-80-768x433.jpg"
          },
          {
            slug: "诗词-甘霖",
            href: `/news/${encodeURIComponent("诗词-甘霖")}`,
            tag: "诗词",
            title: "诗词：甘霖",
            summary: "作者：修明。借春雨意象写天地更新与万物苏生。",
            date: "2025-04-06",
            image: "https://www.tuidang.org/wp-content/uploads/2025/04/what-is-rain-768x512.jpg"
          },
          {
            slug: "诗词-青松-2",
            href: `/news/${encodeURIComponent("诗词-青松-2")}`,
            tag: "诗词",
            title: "诗词：青松",
            summary: "借青松喻志，强调坚韧品格与无我精神。",
            date: "2025-03-29",
            image: "https://www.tuidang.org/wp-content/uploads/2025/03/b7de663bf0b56ecb2d04b11e7988017f-610x649.jpg"
          },
          {
            slug: "诗词-观海",
            href: `/news/${encodeURIComponent("诗词-观海")}`,
            tag: "诗词",
            title: "诗词：观海",
            summary: "以观海所见引申天体运行与人生归向。",
            date: "2025-03-10",
            image: "https://www.tuidang.org/wp-content/uploads/2025/03/1200px-Atlantic_near_Faroe_Islands-768x508.jpg"
          }
        ],
        pager: ["1", "2", "3", "…", "68", "下一页 →"],
        categoryPanel: {
          title: "分类",
          links: [
            { label: "传统故事精选", count: "412", href: "#" },
            { label: "中华文化", count: "168", href: "#" },
            { label: "历史人物", count: "94", href: "#" },
            { label: "诗词", count: "76", href: "#" },
            { label: "良言善语", count: "", href: "#" }
          ]
        },
        freeUsePanel: {
          title: "可自由使用",
          body: "全部文章可下载、转载、翻译与朗读，适合制作卡片、广播稿与展板。",
          buttonLabel: "资料下载",
          buttonHref: "/resources/downloads"
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "《解体党文化》", href: "/resources" },
            { label: "文化专题影片", href: "/videos/others" },
            { label: "杂志《回归》", href: "/resources/magazine" }
          ]
        }
      };
    }

    return {
      title,
      subtitle: subtitle ?? "列表归档页",
      filters: ["全部", "最新发布", "热门阅读"],
      items: [
        {
          slug: "international-support-action",
          tag: "国际声援行动",
          title: "美国国会议员联署声明，表彰退出中共运动并载入《国会议事录》",
          summary: "在一份表彰退出中共运动的声明被正式载入《国会议事录》的同日，31 名华人在现场领取了退党证明。",
          date: "2026-07-22"
        },
        {
          slug: "service-point-weekend-hours",
          tag: "机构公告",
          title: "北美服务点新增周末值班时段公告",
          summary: "为方便旅客与社区民众，纽约、多伦多等地服务点新增周末值班时段。",
          date: "2026-07-24"
        },
        {
          slug: "annual-registration-report",
          tag: "年度报告",
          title: "公开声明年度统计：新增登记持续增长",
          summary: "年度统计与区域分布说明发布，更新计入规则、去重方式与已知局限。",
          date: "2026-08-01"
        }
      ],
      pager: ["1", "2", "3"]
    };
  }

  if (template === "article") {
    if (section === "news" && slug === "article") {
      return {
        title,
        tag: "国际声援行动",
        dek: "在一份表彰退出中共运动的声明被正式载入《国会议事录》的同日，31 名华人在国会山现场领取了退出中共党、团、队的证明。",
        byline: ["2026-07-22", "华盛顿", "本站报导", "约 1,400 字"],
        breadcrumb: {
          homeLabel: "首页",
          homeHref: "/",
          sectionLabel: "新闻与报告",
          sectionHref: "/news",
          current: "国际声援行动"
        },
        heroFigure: {
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
          alt: "国会山颁发退党证明现场",
          captionLines: ["华盛顿 2026 年 7 月 22 日 · 31 名华人在国会山领取退党证明", "摄影：本站"]
        },
        body: [
          { type: "p", text: "正文采用单栏阅读版式，宽度限制在约 72 个字符，行高 2.05，使用思源宋体排版。" },
          { type: "p", text: "段落之间留有明显间距，避免中文长段落形成难以进入的文字墙。图片、引文、小标题都有独立的排版规则。" },
          { type: "h2", text: "小标题的样式" },
          { type: "p", text: "二级标题使用思源宋体 900 字重，上方留有较大间距，让读者在长文中能够快速定位。" },
          { type: "blockquote", text: "引文使用金色左边线与略大的字号。这是页面上少数几个使用金色的地方之一。" },
          { type: "h3", text: "关于配图" },
          { type: "p", text: "每张图片下方都有说明与摄影署名。这是纪录性网站与宣传性网站最明显的差别之一。" }
        ],
        bodyLink: {
          prefix: "正文中的",
          label: "链接使用紫色并带下划线",
          href: "#",
          suffix: "，在浅色背景上保持足够对比度。"
        },
        inlineFigure: {
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
          alt: "纽约中领馆前集会",
          captionLines: ["纽约 2026 · 法轮功学员在中领馆前举行集会与烛光夜悼", "摄影：戴兵 / 大纪元"]
        },
        actionPills: [
          { label: "复制链接", href: "#" },
          { label: "下载 PDF", href: "#" },
          { label: "转载说明", href: "#" },
          { label: "打印", href: "#" }
        ],
        relatedSection: {
          eyebrow: "相关报导",
          items: [
            {
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
              tag: "国际声援行动",
              title: "欧洲议会通过决议，关注强制器官摘取问题",
              meta: "2026-06-25 · 布鲁塞尔"
            },
            {
              href: "/news/article",
              image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
              tag: "移民相关",
              title: "美国第 444 号决议与华人身份申请的关系",
              meta: "2026-07-22"
            }
          ]
        },
        ctaPanel: {
          title: "你也可以声明",
          body: "登记一份声明约需三分钟，可以完全匿名，全程免费。",
          buttonLabel: "我要三退",
          buttonHref: "/services/declare",
          buttonStamp: "退"
        },
        sectionPanel: {
          title: "本文栏目",
          links: [
            { label: "国际声援行动", href: "/news" },
            { label: "机构公告与声明", href: "/news" },
            { label: "追查国际调查报告", href: "/news" }
          ]
        },
        reusePanel: {
          title: "转载条款",
          body: "本文可自由转载、翻译与再制作，无需事先取得授权，注明来源即可。"
        }
      };
    }

    return {
      title,
      dek: "在一份表彰退出中共运动的声明被正式载入《国会议事录》的同日，31 名华人在国会山现场领取了退出中共党、团、队的证明。",
      byline: ["2026-07-22", "华盛顿", "本站报导", "约 1,400 字"],
      body: [
        { type: "p", text: "正文采用单栏阅读版式，宽度限制在约 72 个字符，行高 2.05，使用思源宋体排版。" },
        { type: "p", text: "段落之间留有明显间距，避免中文长段落形成难以进入的文字墙。图片、引文、小标题都有独立的排版规则。" },
        { type: "h2", text: "小标题的样式" },
        { type: "p", text: "二级标题使用思源宋体 900 字重，上方留有较大间距，让读者在长文中能够快速定位。" }
      ]
    };
  }

  if (template === "form") {
    if (section === "services" && slug === "declare") {
      return {
        title,
        subtitle: subtitle ?? "由你自己填写并提交，我们完整保存原文与提交时间。全程免费，无需注册，可以完全匿名。",
        steps: ["1 填写声明", "2 确认", "3 完成"],
        safetyNotice: {
          title: "关于你的安全",
          body: "你不需要提供真实姓名、身份证件或联系方式。若身在大陆，建议先阅读安全访问说明。",
          toolsLabel: "免翻墙链接",
          toolsHref: "/resources/tools",
          middleText: "，提交后建议清除浏览痕迹。",
          privacyLabel: "阅读完整的安全与隐私说明",
          privacyHref: "/services/privacy"
        },
        organizations: ["中国共产党", "共青团", "少先队"],
        regionOptions: ["请选择（可不选）", "中国大陆", "香港 / 澳门", "台湾", "美国", "加拿大", "欧洲", "日本 / 韩国", "东南亚", "其他"],
        certificateOptions: ["需要", "暂时不需要"],
        submitPanel: {
          label: "提交声明",
          href: "https://santui.tuidang.org",
          stamp: "退",
          note: "提交即表示这份声明由你本人自愿作出。"
        },
        readyPanel: {
          title: "还不确定？",
          links: [
            { label: "什么是三退", href: "/services/faq" },
            { label: "为什么要三退", href: "/services/faq" },
            { label: "多年不交党费算自动退党吗", href: "/services/faq" },
            { label: "用化名声明有效吗", href: "/services/faq" },
            { label: "安全与隐私说明", href: "/services/privacy" }
          ]
        },
        otherWaysPanel: {
          title: "其他方式",
          links: [
            { label: "到服务点当面办理", href: "/about/network" },
            { label: "电话声明", href: "#" },
            { label: "邮件声明", href: "#" }
          ]
        },
        todayPanel: {
          title: "今日",
          value: "38,403",
          body: "人在今天提交了声明。"
        }
      };
    }

    if (section === "services" && slug === "cert") {
      return {
        title,
        subtitle: subtitle ?? "中英文对照的书面凭据，附唯一编号与公开查验入口。实名办理，需完成认证课程与考试。",
        noticePanel: {
          title: "办理前请先了解",
          body: "退党证明由本中心签发，不是政府机关出具的文件，也不构成对移民或身份申请结果的任何保证。是否采信、如何采信，由受理机构自行判断。退党证明为实名办理，须本人申请，需完成认证课程与考试并缴纳办理／管理费用；三退声明本身始终免费。请只通过本中心的官方渠道办理（本网办理或干净世界），任何其他声称可以代办、加急或包过的机构与个人，都与我们无关。"
        },
        steps: ["1 完成三退声明", "2 申请证明", "3 认证考试", "4 签发领取"],
        introSections: [
          { heading: "什么是退党证明", body: "一份中英文对照的文件，载明声明人姓名、退出组织、声明日期与证明编号，由本中心签发并盖章。" },
          { heading: "办理条件", body: "你需要先完成一份三退声明。此前已经声明过，也可凭当时信息申请补发。" },
          { heading: "办理流程与时间", body: "申请人需先观看认证培训视频（约一小时），并通过认证考试。通过后即可获得 PDF 电子证明，可自行打印。" },
          { heading: "为什么出国人员应尽早办理", body: "多个国家在签证与身份审查中会问及政党成员身份。若已实际退出，尽早留下书面凭据，比临时补办更从容。" }
        ],
        ctaActions: [
          { label: "申请退党证明", href: "/services/declare", variant: "seal", stamp: "退" },
          { label: "先看常见问题", href: "/services/faq", variant: "line", stamp: "" }
        ],
        samplePanel: {
          title: "证明样本",
          image: "https://www.tuidang.org/wp-content/uploads/2026/05/cert-sample.png",
          alt: "退党证明样本",
          caption: "中英文对照，含唯一编号与查验方式。"
        },
        relatedPanel: {
          title: "相关问答",
          links: [
            { label: "什么是退党证明", href: "/services/faq" },
            { label: "如何办理退党证明", href: "/services/faq" },
            { label: "为什么出国人员应尽早办理", href: "/services/faq" },
            { label: "如何查验证明真伪", href: "/services/faq" },
            { label: "三退是否安全", href: "/services/faq" }
          ]
        },
        readyPanel: {
          title: "还没有声明？",
          body: "证明以三退声明为前提。登记一份声明约需三分钟，可以完全匿名。",
          buttonLabel: "先去声明",
          buttonHref: "/services/declare",
          buttonStamp: "退"
        }
      };
    }

    if (section === "services" && slug === "verify") {
      return {
        title,
        subtitle: subtitle ?? "输入证明编号即可查验签发日期与状态。此入口对所有人开放。",
        verifyForm: {
          eyebrow: "在线查验",
          numberLabel: "证明编号",
          numberHint: "形如 TD-2026-0071824，请完整输入。",
          numberPlaceholder: "TD-2026-0071824",
          nameLabel: "证明上的姓名",
          nameHint: "用于交叉核对，请与证明上印刷的姓名完全一致。",
          namePlaceholder: "请输入姓名",
          buttonLabel: "查验",
          buttonStamp: "退"
        },
        institutionNotice: {
          title: "给受理机构的说明",
          body: "本查验入口对所有人开放，无需注册或授权。查验结果仅显示该编号是否由本中心签发、签发日期与状态，不显示声明正文或其他个人信息。"
        },
        resultMeaning: [
          { heading: "有效。", body: "该编号由本中心签发，登记记录存在，证明未被作废。" },
          { heading: "查无此编号。", body: "该编号不在签发记录中，可能是输入有误，也可能并非本中心签发。" },
          { heading: "已作废。", body: "该编号曾经签发，但因信息变更或补发等原因已作废。" }
        ],
        scopeSection: {
          resultHeading: "查验结果代表什么",
          scopeHeading: "查验的是什么",
          scopeBody: "查验确认的是本中心确实签发过这份证明，而非验证声明人的真实身份。"
        },
        antiFraudPanel: {
          title: "防伪要点",
          items: ["右下角唯一编号", "中英文对照排版", "本中心印章", "可在本页在线查验"]
        },
        relatedPanel: {
          title: "相关",
          links: [
            { label: "证明办理", href: "/services/cert" },
            { label: "如何查验证明真伪", href: "/services/faq" },
            { label: "联系我们核实", href: "/services/contact" },
            { label: "给受理机构的说明 PDF", href: "#" }
          ]
        }
      };
    }

    if (section === "services" && slug === "contact") {
      return {
        title,
        subtitle: subtitle ?? "更正声明信息、补发遗失证明或查询登记记录，由本中心人工核对处理。",
        requestOptions: ["更正姓名或信息", "证明遗失补发", "查询我的声明记录", "其他问题"],
        formHints: {
          originalHint: "请提供证明编号；若没有编号，请说明当时使用的署名、大致日期与提交方式（网站／服务点／电话／义工代转），以便志愿者核对。",
          originalPlaceholder: "提供证明编号；或署名 + 大致日期 + 提交方式。",
          correctPlaceholder: "请填写正确的信息",
          replyHint: "电子邮件或其他你方便接收的方式。此项仅用于本次联络，处理完成后不做他用。",
          replyPlaceholder: "电子邮件地址"
        },
        processingSections: [
          {
            heading: "处理方式与时间",
            body: "所有变更申请由志愿者人工核对处理，通常需要数个工作日。信息更正后会签发新编号的证明，原编号作废，查验时会显示已作废并指向新编号。"
          },
          {
            heading: "关于已公开的声明原文",
            body: "如果只是姓名或联络信息有误，我们可以更正。但已公开的声明正文不会删除——完整保存每一份声明的原文与提交时间，是这项登记的意义所在。如有特殊情况，请在上方说明，我们会具体处理。"
          }
        ],
        contactPanel: {
          title: "直接联系",
          orgName: "全球退党服务中心",
          addressLine1: "40-46 Main Street",
          addressLine2: "Flushing, NY 11354",
          links: [
            { label: "证明办理咨询", href: "#" },
            { label: "服务点与志愿者事务", href: "#" },
            { label: "媒体与采访联络", href: "#" }
          ]
        },
        onsitePanel: {
          title: "当面办理",
          body: "全球一百多个服务点均可协助处理变更与补办，无需预约。",
          buttonLabel: "查找服务点",
          buttonHref: "/about/network"
        },
        reminderPanel: {
          title: "提醒",
          body: "办理退党证明的费用只在本中心的官方办理页面支付。我们不会通过私人账户或中介收款，也不会主动打电话、发短信向你索取银行卡号、验证码或密码。"
        }
      };
    }

    return {
      title,
      subtitle: subtitle ?? "服务流程页面",
      steps: ["填写信息", "确认内容", "完成提交"],
      notice: "仅填写必要信息，避免提交不必要的个人敏感资料。",
      fields: [
        { id: "name", label: "署名", type: "text", placeholder: "请输入署名" },
        { id: "content", label: "内容", type: "textarea", placeholder: "请输入内容" }
      ],
      sidebar: {
        title: "提示",
        links: [{ label: "安全访问工具", href: "/resources/tools" }]
      }
    };
  }

  if (template === "video-library") {
    const platformLinks = [
      { label: "干净世界", href: "https://www.ganjingworld.com/zh-CN/channel/1f21v2vaiio6Uptly0JD6LFcE1ql0c" },
      { label: "YouTube", href: "https://www.youtube.com/watch?v=v5GiswtvnCw" },
      { label: "网门（大陆可访问）", href: "/resources/tools" },
      { label: "下载 MP4", href: "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_cn_trailer_revised.mp4" }
    ];
    const reuseNote = {
      title: "全部影片可自由下载、转载与再制作",
      body: "无需事先取得授权，注明来源即可。若嵌入播放器无法载入（网络受限地区常见），请改用下方其他平台链接或直接下载 MP4。",
      linkLabel: "访问方式说明",
      linkHref: "/resources/tools"
    };

    if (section === "videos" && slug === "index") {
      return {
        title,
        subtitle: subtitle ?? "现场纪录、当事人访谈、调查影像与系列专题。全部节目可自由下载、转载与再制作。",
        featured: {
          tag: "本期推荐",
          title: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
          summary: "追查迫害法轮功国际组织公布的系列调查，含录音取证、证人陈述与责任人名单。附完整文字版报告。",
          meta: "调查片 · 58 分 · 中英文字幕",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
          href: "#"
        },
        sections: [
          {
            eyebrow: "三退前线",
            title: "三退前线",
            lede: "服务点现场、义工纪实与当事人访谈。",
            moreLabel: "全部影片 →",
            moreHref: "/videos/frontline",
            items: [
              {
                title: "济州岛服务点的一天：义工在码头前轮班守候",
                meta: "义工纪实 · 11 分 05 秒",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
                href: "#"
              },
              {
                title: "纽约中领馆前烛光夜悼，十七名华人现场声明三退",
                meta: "现场纪录 · 4 分 12 秒",
                image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
                href: "#"
              },
              {
                title: "台北车站前的真相点：十年如一日",
                meta: "义工纪实 · 18 分 30 秒",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
                href: "#"
              }
            ]
          },
          {
            eyebrow: "破除党文化",
            title: "破除党文化",
            lede: "解析党文化如何进入语言、教育与日常生活。",
            moreLabel: "全部影片 →",
            moreHref: "/videos/party-culture",
            items: [
              {
                title: "第一集：被改造的语言",
                meta: "系列专题 · 24 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
                href: "#"
              },
              {
                title: "第二集：从课本到思维方式",
                meta: "系列专题 · 27 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
                href: "#"
              },
              {
                title: "第三集：斗争哲学的日常痕迹",
                meta: "系列专题 · 22 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
                href: "#"
              }
            ]
          },
          {
            eyebrow: "九评共产党系列",
            title: "九评共产党系列",
            lede: "含《九评共产党》《魔鬼在统治着我们的世界》《共产主义的终极目的》视频版与播报版。",
            moreLabel: "全部影片 →",
            moreHref: "/videos/jiuping",
            items: [
              {
                title: "《九评共产党》系列导读 · 第一集",
                meta: "视频版 · 26 分 40 秒",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
                href: "#"
              },
              {
                title: "《魔鬼在统治着我们的世界》 · 第一章",
                meta: "播报版 · 41 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
                href: "#"
              },
              {
                title: "《共产主义的终极目的》 · 序言",
                meta: "播报版 · 33 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
                href: "#"
              }
            ]
          },
          {
            eyebrow: "铁证如山",
            title: "铁证如山",
            lede: "追查国际系列调查的影像版本。",
            moreLabel: "全部影片 →",
            moreHref: "/videos/ironclad",
            items: [
              {
                title: "《铁证如山》完整版",
                meta: "调查片 · 58 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
                href: "#"
              },
              {
                title: "录音取证片段与说明",
                meta: "调查片 · 16 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
                href: "#"
              },
              {
                title: "证人陈述汇编",
                meta: "调查片 · 29 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
                href: "#"
              }
            ]
          },
          {
            eyebrow: "亿万人的觉醒之旅",
            title: "亿万人的觉醒之旅",
            lede: "长期跟踪拍摄的纪录系列。",
            moreLabel: "全部影片 →",
            moreHref: "/videos/awakening",
            items: [
              {
                title: "第一部：从怀疑开始",
                meta: "纪录片 · 47 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
                href: "#"
              },
              {
                title: "第二部：走出来的人",
                meta: "纪录片 · 52 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
                href: "#"
              },
              {
                title: "四万人的觉醒",
                meta: "纪录片 · 38 分",
                image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
                href: "#"
              }
            ]
          }
        ],
        moreButtonLabel: "载入更多影片",
        moreButtonHref: "#"
      };
    }

    if (section === "videos" && slug === "frontline") {
      return {
        title,
        subtitle: subtitle ?? "服务点现场、义工纪实与当事人访谈。全球一百多个服务点的第一手影像记录，持续更新。",
        featured: {
          tag: "最新一集",
          title: "济州岛三退义工面对挑衅，威而不惧",
          summary: "今年五月有九万中国人搭邮轮抵达济州岛。义工们轮班在码头、免税店与主要景点前守候，也遇到过有组织的干扰。这一集跟拍了完整的一天。",
          meta: "2026-06-10 · 11 分 05 秒 · 中英文字幕",
          image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
          href: "#"
        },
        gridItems: [
          {
            title: "纽约中领馆前烛光夜悼，十七名华人现场声明三退",
            meta: "2026-07-20 · 4 分 12 秒",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            href: "#"
          },
          {
            title: "台北车站前的真相点：十年如一日",
            meta: "2026-05-18 · 18 分 30 秒",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            href: "#"
          },
          {
            title: "国会山现场：31 名华人领取退党证明",
            meta: "2026-07-22 · 6 分 40 秒",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            href: "#"
          },
          {
            title: "伦敦中国城：周末的两位义工",
            meta: "2026-04-27 · 9 分 15 秒",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            href: "#"
          },
          {
            title: "巴黎铁塔下：素琴女士的十二年",
            meta: "2026-03-30 · 14 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            href: "#"
          },
          {
            title: "把纸本声明一份份录入系统的人",
            meta: "2026-02-14 · 7 分 50 秒",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            href: "#"
          }
        ],
        moreButtonLabel: "载入更多",
        moreButtonHref: "#",
        reuseNote
      };
    }

    if (section === "videos" && slug === "party-culture") {
      return {
        title,
        subtitle: subtitle ?? "解析党文化如何进入语言、教育、思维方式与日常生活。系列专题，配合《解体党文化》一书。",
        featured: {
          tag: "第一集",
          title: "被改造的语言",
          summary: "从「同志」「斗争」「路线」这些日常词汇的来源讲起，看语言如何塑造思维方式，以及为什么离开体制多年的人仍会不自觉地使用这套词汇。",
          meta: "系列专题 · 24 分 · 中英文字幕",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
          href: "#"
        },
        episodesTitle: "全部剧集",
        episodes: [
          { index: "01", title: "被改造的语言", meta: "24 分", href: "#" },
          { index: "02", title: "从课本到思维方式", meta: "27 分", href: "#" },
          { index: "03", title: "斗争哲学的日常痕迹", meta: "22 分", href: "#" },
          { index: "04", title: "集体与个人", meta: "25 分", href: "#" },
          { index: "05", title: "怀疑一切与相信一切", meta: "23 分", href: "#" },
          { index: "06", title: "回归传统文化", meta: "29 分", href: "#" }
        ],
        platformLinks,
        reuseNote
      };
    }

    if (section === "videos" && slug === "step-back") {
      return {
        title,
        subtitle: subtitle ?? "人物访谈系列。请曾在体制内任职、或经历过重大转变的人，讲述他们退出的过程与之后的生活。",
        featured: {
          tag: "最新访谈",
          title: "觉醒，从十岁开始——专访实业家胡力任（上）",
          summary: "从少年时期的疑问，到经商多年后的抉择。访谈分上下两集，完整呈现他二十余年的思考过程。",
          meta: "人物访谈 · 上集 32 分 · 中英文字幕",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
          href: "#"
        },
        gridItems: [
          {
            title: "专访胡力任（下）：离开之后的生活",
            meta: "访谈 · 28 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            href: "#"
          },
          {
            title: "前外交官陈用林：我为什么选择留下来",
            meta: "访谈 · 41 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            href: "#"
          },
          {
            title: "前公安人员的自述：那些年我执行的任务",
            meta: "访谈 · 36 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            href: "#"
          },
          {
            title: "党媒记者：说了二十多年谎话之后",
            meta: "访谈 · 25 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            href: "#"
          },
          {
            title: "高校教师：从讲台上下来的那一天",
            meta: "访谈 · 30 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            href: "#"
          },
          {
            title: "企业主：合规与良心之间",
            meta: "访谈 · 22 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            href: "#"
          }
        ],
        moreButtonLabel: "载入更多访谈",
        moreButtonHref: "#",
        reuseNote
      };
    }

    if (section === "videos" && slug === "jiuping") {
      return {
        title,
        subtitle:
          subtitle ??
          "《九评共产党》《解体党文化》《魔鬼在统治着我们的世界》《共产主义的终极目的》的影音版与播报版。",
        featured: {
          tag: "《九评共产党》",
          title: "九评共产党 · 影音版",
          summary: "二〇〇四年发表的系列社论，引发了持续二十年的三退运动。影音版共九集，另有播报版与多语种配音。全文可在资源馆免费阅读与下载。",
          meta: "九集 · 每集 26–48 分 · 多语种",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
          href: "#"
        },
        episodesTitle: "《九评共产党》九集",
        episodes: [
          { index: "一", title: "评共产党是什么", meta: "32 分", href: "#" },
          { index: "二", title: "评中国共产党是怎样起家的", meta: "38 分", href: "#" },
          { index: "三", title: "评中国共产党的暴政", meta: "41 分", href: "#" },
          { index: "四", title: "评共产党是反宇宙的力量", meta: "29 分", href: "#" },
          { index: "五", title: "评江泽民与中共相互利用迫害法轮功", meta: "46 分", href: "#" },
          { index: "六", title: "评中国共产党破坏民族文化", meta: "35 分", href: "#" },
          { index: "七", title: "评中国共产党的杀人历史", meta: "48 分", href: "#" },
          { index: "八", title: "评中国共产党的邪教本质", meta: "33 分", href: "#" },
          { index: "九", title: "评中国共产党的流氓本性", meta: "37 分", href: "#" }
        ],
        secondaryGridTitle: "其他系列",
        gridItems: [
          {
            title: "《解体党文化》播报版",
            meta: "全书 · 多集",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            href: "#"
          },
          {
            title: "《魔鬼在统治着我们的世界》",
            meta: "全书 · 多集",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            href: "#"
          },
          {
            title: "《共产主义的终极目的》",
            meta: "全书 · 多集",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            href: "#"
          }
        ],
        platformLinks,
        reuseNote
      };
    }

    if (section === "videos" && slug === "ironclad") {
      return {
        title,
        subtitle: subtitle ?? "追查国际系列调查的影像版本。32 集，逐一呈现录音证据，梳理证据之间的逻辑关系与调查背景。",
        introNote: {
          title: "关于本系列",
          body: "本系列由「追查迫害法轮功国际组织」（追查国际）制作，本中心转载。该组织自 2006 年起持续取证，已公开 866 段调查录音与逾 4,000 份文献证据。每集均注明取证时间、方式与相关文献编号。",
          linkLabel: "追查国际调查报告",
          linkHref: "/news/investigations"
        },
        featured: {
          tag: "完整版",
          title: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
          summary: "汇集追查国际十余年调查精华的 32 集系列。另有《活摘：十年调查》史料纪录片，由汪志远主持串联，呈现完整调查方法与结果。",
          meta: "32 集 · 含电子书 · 中英文字幕",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
          href: "#"
        },
        episodesTitle: "剧集列表（节选）",
        episodes: [
          { index: "01", title: "调查的缘起与方法", meta: "42 分", href: "#" },
          { index: "02", title: "录音取证：第一批电话", meta: "38 分", href: "#" },
          { index: "03", title: "军队医院系统的角色", meta: "45 分", href: "#" },
          { index: "04", title: "移植数量与供体来源的矛盾", meta: "40 分", href: "#" },
          { index: "05", title: "当事人证词汇编（一）", meta: "36 分", href: "#" },
          { index: "06", title: "当事人证词汇编（二）", meta: "39 分", href: "#" },
          { index: "07", title: "责任人调查：公安系统", meta: "44 分", href: "#" },
          { index: "08", title: "责任人调查：司法系统", meta: "41 分", href: "#" },
          { index: "09", title: "国际社会的回应", meta: "33 分", href: "#" },
          { index: "10", title: "独立法庭的裁决", meta: "47 分", href: "#" }
        ],
        moreButtonLabel: "查看全部 32 集",
        moreButtonHref: "#",
        platformLinks,
        reuseNote
      };
    }

    if (section === "videos" && slug === "awakening") {
      return {
        title,
        subtitle: subtitle ?? "长期跟踪拍摄的纪录系列，记录二十年间这场精神觉醒运动的过程与参与其中的人。",
        featured: {
          tag: "纪录片",
          title: "《四亿人的觉醒》",
          summary: "记录三退人数突破四亿的这一时刻，以及走到这里的二十年。在干净世界独家首映。",
          meta: "纪录片 · 中英文字幕 · 可下载",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
          href: "#"
        },
        gridItems: [
          {
            title: "第一部：从怀疑开始",
            meta: "纪录片 · 47 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            href: "#"
          },
          {
            title: "第二部：走出来的人",
            meta: "纪录片 · 52 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            href: "#"
          },
          {
            title: "第三部：在海外的二十年",
            meta: "纪录片 · 44 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            href: "#"
          },
          {
            title: "《九评》二十周年特辑",
            meta: "特辑 · 58 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            href: "#"
          },
          {
            title: "End CCP 环美车游：走遍五十州",
            meta: "纪实 · 36 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            href: "#"
          },
          {
            title: "服务点的人：一百个地方，一件事",
            meta: "纪实 · 41 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            href: "#"
          }
        ],
        platformLinks,
        reuseNote
      };
    }

    if (section === "videos" && slug === "others") {
      return {
        title,
        subtitle: subtitle ?? "集会与游行纪录、国际研讨与论坛、音频节目，以及未归入上述系列的影音内容。",
        filters: ["全部", "集会与游行", "研讨与论坛", "三退洪声（音频）", "文化专题"],
        gridItems: [
          {
            title: "巴黎反迫害声援大游行",
            meta: "集会 · 12 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            href: "#"
          },
          {
            title: "反制中共干预与跨境压制：奥克兰论坛",
            meta: "论坛 · 1 小时 24 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/06/2026.06.10-J.jpg",
            href: "#"
          },
          {
            title: "7.20 反迫害：纽约中领馆前集会嘉宾发言",
            meta: "集会 · 38 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14814223-LD109739-scaled.jpg",
            href: "#"
          },
          {
            title: "【三退洪声】大陆记者：今天说句真话",
            meta: "音频 · 18 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
            href: "#"
          },
          {
            title: "祭仓颉：找回迷失的神性",
            meta: "文化专题 · 21 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
            href: "#"
          },
          {
            title: "千年微光：从乌台诗案到人性觉醒",
            meta: "文化专题 · 26 分",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            href: "#"
          }
        ],
        moreButtonLabel: "载入更多",
        moreButtonHref: "#",
        reuseNote
      };
    }

    return {
      title,
      subtitle: subtitle ?? "现场纪录、当事人访谈、调查影像与系列专题。",
      featured: {
        tag: "本期推荐",
        title: "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查",
        summary: "追查迫害法轮功国际组织公布的系列调查，含录音取证、证人陈述与责任人名单。",
        meta: "调查片 · 58 分 · 中英文字幕",
        image: "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg",
        href: "#"
      },
      sections: [],
      moreButtonLabel: "载入更多影片",
      moreButtonHref: "#"
    };
  }

  if (template === "long-form" && section === "services" && slug === "faq") {
    return {
      title,
      subtitle: subtitle ?? "关于声明、证明与安全的常见问题。",
      filters: ["全部", "关于声明", "关于证明", "安全与隐私", "移民相关"],
      faqs: [
        { question: "什么是三退？", answer: "三退指公开声明退出中共的党、团、队三个组织。" },
        { question: "用化名或代号声明，有效吗？", answer: "有效。声明的意义在于当事人的公开表态。" },
        { question: "办理证明要收费吗？", answer: "三退声明免费。退党证明为实名办理，需缴纳办理／管理费用，具体金额与流程以官方办理页面说明为准。" }
      ],
      readyPanel: {
        title: "准备好了？",
        body: "登记一份声明约需三分钟，可以完全匿名，全程免费。",
        buttonLabel: "我要三退",
        buttonHref: "/services/declare",
        buttonStamp: "退"
      },
      linksPanel: {
        title: "还有问题",
        links: [
          { label: "安全与隐私说明", href: "/services/privacy" },
          { label: "移民相关政策", href: "/services" },
          { label: "查找服务点", href: "/about/network" },
          { label: "联系我们", href: "/services/contact" }
        ]
      }
    };
  }

  if (template === "long-form" && section === "services" && slug === "privacy") {
    return {
      title,
      subtitle: subtitle ?? "说明我们收集什么、不收集什么，以及风险主要在哪里。",
      alertPanel: {
        title: "先说最重要的一句",
        body: "没有任何网站或工具能保证绝对安全。我们会把做法与边界完整说明，由你自己判断。"
      },
      sections: [
        { heading: "我们不收集什么", body: "不需要真实姓名、身份证件、住址或其他可对应个人的敏感信息。" },
        { heading: "我们收集什么", body: "仅收集署名、选填地区、声明正文与提交时间。" },
        { heading: "真正风险在哪里", body: "风险常在网络连接与本地设备痕迹，而不是声明表单本身。" }
      ],
      highlightsPanel: {
        title: "本页要点",
        items: ["不需要身份证件", "可以完全匿名", "数据不出售不转让", "无广告追踪"]
      },
      toolsPanel: {
        title: "受限网络下访问",
        body: "若你身在网络受管控的地区，请先看访问方式说明，再决定如何访问本站。",
        buttonLabel: "免翻墙链接",
        buttonHref: "/resources/tools"
      },
      linksPanel: {
        title: "相关",
        links: [
          { label: "三退是否安全", href: "/services/faq" },
          { label: "在线声明", href: "/services/declare" },
          { label: "信息变更", href: "/services/contact" },
          { label: "公开与问责", href: "/about/accountability" }
        ]
      }
    };
  }

  if (template === "long-form" && section === "services" && slug === "immigration") {
    return {
      title,
      subtitle: subtitle ?? "公开政策文件梳理与个案报导汇编，仅供了解背景。",
      alertPanel: {
        title: "本页不是法律意见",
        body: "各国政策变化快，个案差异大；涉及具体申请请咨询有执照律师。"
      },
      policySection: {
        eyebrow: "政策文件",
        title: "美国移民局（USCIS）相关规定",
        items: [
          { tag: "政策文件", title: "USCIS 关于共产党员的移民态度", body: "适用范围与例外情形的公开梳理。" },
          { tag: "政策文件", title: "USCIS 关于共产党员及其组织成员移民申请的酌情考量", body: "在什么情况下可以主张豁免，审查官会考量哪些因素。" },
          { tag: "问答", title: "为什么应尽早办理退党证明", body: "时间点的重要性与临时补办常见问题。" }
        ]
      },
      reportSection: {
        eyebrow: "相关报导",
        title: "议会行动与个案报导",
        items: [
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg",
            tag: "国际声援",
            title: "美议员在国会表彰退党运动及全球退党中心",
            summary: "田纳西州联邦众议员表彰退党运动，声明载入《国会议事录》。",
            meta: "2026-07-21 · 华盛顿"
          },
          {
            href: "/news/article",
            image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
            tag: "政策梳理",
            title: "美国第 444 号决议：天意已决，华人关键时刻",
            summary: "决议原文、通过经过，以及它在实务上意味着什么、不意味着什么。",
            meta: "2026-07-15"
          }
        ]
      },
      pager: ["1", "2", "3", "下一页 →"],
      proofPanel: {
        title: "需要一份凭据？",
        body: "退党证明为实名办理的中英文对照文件，附公开查验入口。",
        buttonLabel: "了解证明办理",
        buttonHref: "/services/cert"
      },
      countriesPanel: {
        title: "其他国家",
        items: ["加拿大", "澳大利亚与新西兰", "欧洲各国", "日本与韩国"]
      },
      reminderPanel: {
        title: "提醒",
        body: "本中心不代办移民手续，也不与任何移民中介合作。退党证明只通过本中心的官方渠道办理，请勿相信任何自称可以代办、加急或包过的机构与个人。"
      }
    };
  }

  if (template === "long-form" && section === "resources" && slug === "tools") {
    return {
      title,
      subtitle: subtitle ?? "在受限网络环境下访问本站与三退内容的几种方式。请先评估你所处环境，再决定使用哪一种。",
      noticePanel: {
        title: "使用前请先评估处境",
        body: "没有任何工具能保证绝对安全。若不确定设备安全性，请避免留下可识别痕迹。"
      },
      accessCards: [
        {
          kicker: "方式一",
          title: "镜像地址",
          body: "备用访问地址，通常不需要安装任何软件。建议记下一到两个，并定期更新。",
          buttonLabel: "查看镜像列表",
          href: "#",
          buttonVariant: "line"
        },
        {
          kicker: "方式二",
          title: "网门与免翻墙 App",
          body: "安装后可直接访问本站与相关内容，适合长期稳定访问。",
          buttonLabel: "下载 App",
          href: "#",
          buttonVariant: "seal"
        },
        {
          kicker: "方式三",
          title: "邮件订阅",
          body: "不访问网站，直接在邮箱接收新内容摘要与链接。",
          buttonLabel: "提交邮箱",
          href: "#",
          buttonVariant: "line"
        },
        {
          kicker: "方式四",
          title: "纯文字版",
          body: "低流量页面，适合网速慢或临时网络环境。",
          buttonLabel: "进入纯文字版",
          href: "#",
          buttonVariant: "line"
        }
      ],
      guideSections: [
        {
          heading: "该选哪一种",
          paragraphs: [
            "只是想看内容 - 用镜像地址最简单，不需要安装任何东西，也不会在设备上留下软件。",
            "需要长期稳定访问 - 用 App。镜像地址会失效，App 会自动更新可用线路，但它会留在你的设备上。",
            "不方便访问任何网站 - 用邮件订阅。内容会寄到你的信箱，你从未直接连接本站。"
          ]
        },
        {
          heading: "使用后清除痕迹",
          paragraphs: ["浏览历史、下载记录与缓存都可能留下痕迹。若设备可能被他人查看，使用后请清除浏览数据。", "如果你下载了 App，也请想清楚它留在设备上是否安全。"]
        },
        {
          heading: "把这些方式转给别人",
          paragraphs: ["你可以把镜像地址抄下来、写进短信、或在见面时口头告知，让对方自己决定是否使用。"]
        },
        {
          heading: "如果所有地址都打不开",
          paragraphs: ["地址会被封锁是常态。请通过下方任一方式联系我们，我们会提供当前可用入口。"]
        }
      ],
      safetyPanel: {
        title: "你的安全",
        body: "我们不要求身份证件，也不记录可识别你身份的信息。完整说明见安全与隐私页。",
        buttonLabel: "安全与隐私说明",
        buttonHref: "/services/privacy"
      },
      relatedPanel: {
        title: "相关",
        links: [
          { label: "镜像地址更新频道", href: "#" },
          { label: "在线声明三退", href: "/services/declare" },
          { label: "三退是否安全", href: "/services/faq" },
          { label: "资料下载", href: "/resources/downloads" },
          { label: "联系我们", href: "/services/contact" }
        ]
      },
      reminderPanel: {
        title: "提醒",
        body: "本中心从不通过任何工具索取你的身份证件、银行信息或密码。若有页面向你索取这些，那不是我们的站点。"
      }
    };
  }

  if (template === "long-form" && section === "resources") {
    const bookDetails: Record<
      string,
      { subtitle: string; sections: { heading: string; body: string }[]; related: { label: string; href: string }[] }
    > = {
      "book-jieti-dangwenhua": {
        subtitle: "从语言、教育与行为方式层面识别党文化的形成与影响。",
        sections: [
          {
            heading: "内容简介",
            body: "本书系统梳理党文化在日常表达、社会心理和价值判断中的渗透方式，帮助读者识别并摆脱相关叙事框架。"
          },
          {
            heading: "阅读与传播",
            body: "本页为书籍详情入口，可继续在资源页获取下载版本，或在服务点用于线下阅读与讨论。"
          }
        ],
        related: [
          { label: "返回书籍与文集", href: "/resources" },
          { label: "真相点资料下载", href: "/resources/downloads" },
          { label: "中华传统文化", href: "/resources/culture" }
        ]
      },
      "book-mogui-shijie": {
        subtitle: "聚焦共产主义意识形态的历史影响与现实机制。",
        sections: [
          {
            heading: "内容简介",
            body: "本书围绕共产主义在政治、文化与社会层面的扩散路径展开，结合案例解释其对现代社会秩序的影响。"
          },
          {
            heading: "阅读与传播",
            body: "适合与相关专题报导配合阅读；可在资源下载页获取适合线上与线下传播的版本。"
          }
        ],
        related: [
          { label: "返回书籍与文集", href: "/resources" },
          { label: "专题报导与时政评论", href: "/news/commentary" },
          { label: "资料下载", href: "/resources/downloads" }
        ]
      },
      "book-gongchanzhuyi-zhongji": {
        subtitle: "从思想脉络与历史实践讨论共产主义终极目标及其后果。",
        sections: [
          {
            heading: "内容简介",
            body: "本书以历史演变与现实观察为线索，解释共产主义终极目标的逻辑，并讨论个人与社会层面的应对选择。"
          },
          {
            heading: "阅读与传播",
            body: "本页提供集中阅读入口；完整素材可在下载专区获取，便于二次传播与教学使用。"
          }
        ],
        related: [
          { label: "返回书籍与文集", href: "/resources" },
          { label: "新闻与报告", href: "/news" },
          { label: "资料下载", href: "/resources/downloads" }
        ]
      }
    };
    if (bookDetails[slug]) {
      const detail = bookDetails[slug];
      return {
        title,
        subtitle: detail.subtitle,
        sections: detail.sections,
        relatedLinks: detail.related
      };
    }

    const issueDetails: Record<
      string,
      { subtitle: string; note: string }
    > = {
      "magazine-2026-spring": {
        subtitle: "封面专题：二十年，四亿六千万份声明。",
        note: "本期聚焦退党运动二十年关键节点、服务点纪实与国际声援动态。"
      },
      "magazine-2025-winter": {
        subtitle: "封面专题：服务点的人。",
        note: "围绕一线义工与服务点运营，呈现长期支持体系的真实经验。"
      },
      "magazine-2025-autumn": {
        subtitle: "专题：我为什么公开三退。",
        note: "收录当事人公开声明与背景访谈，呈现不同社会身份下的抉择路径。"
      },
      "magazine-2025-summer": {
        subtitle: "专题：党文化与日常语言。",
        note: "从词汇、叙事和思维习惯切入，观察党文化在生活层面的持续影响。"
      },
      "magazine-2025-spring": {
        subtitle: "专题：海外三退服务点纪实。",
        note: "纪录各地服务点的组织方式、风险处置和公共沟通实践。"
      },
      "magazine-2024-winter": {
        subtitle: "专题：青年一代与选择。",
        note: "聚焦年轻群体在信息环境变化下的认知转变与行动路径。"
      },
      "magazine-2024-autumn": {
        subtitle: "专题：文化与信仰。",
        note: "探讨传统文化资源与现代价值冲突中的恢复与重建。"
      },
      "magazine-archive": {
        subtitle: "按年份查阅《回归》全部历史期数。",
        note: "该归档入口用于快速定位往期专题，便于研究与长期引用。"
      }
    };
    if (issueDetails[slug]) {
      const detail = issueDetails[slug];
      return {
        title,
        subtitle: detail.subtitle,
        sections: [
          {
            heading: "本期概要",
            body: detail.note
          },
          {
            heading: "阅读方式",
            body: "你可以返回杂志主页阅读当前期数，并通过下载区获取 PDF、EPUB 与可传播素材。"
          }
        ],
        relatedLinks: [
          { label: "返回杂志首页", href: "/resources/magazine" },
          { label: "资料下载", href: "/resources/downloads" },
          { label: "媒体与记者", href: "/resources/press" }
        ]
      };
    }
  }

  if (template === "long-form" && section === "about" && slug === "numbers") {
    return {
      title,
      subtitle: subtitle ?? "",
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
        {
          heading: "去重方式",
          paragraphs: ["同一署名在短时间内重复提交的相同内容会被合并为一次。但由于我们不要求身份证明，无法排除同一个人使用不同署名多次声明的情况——这是这项统计已知的局限，我们不回避。"]
        },
        {
          heading: "更新频率",
          paragraphs: ["首页计数器每十分钟同步一次登记数据库。显示的是累计登记总量，不是估算值。"]
        },
        {
          heading: "这个数字不代表什么",
          paragraphs: [
            "它不是「反对中共的人数」，也不是任何形式的民意调查结果。它只代表一件事：有这么多份声明被提交、被登记、被保存。",
            "我们认为把边界说清楚，比把数字说大更重要。"
          ]
        },
        {
          heading: "数据可得性",
          paragraphs: ["历年数据、月度变化与区域分布见年度报告，可自由下载与引用。研究者如需更细的数据，请与我们联系。"]
        }
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
      citationPanel: {
        title: "引用",
        body: "是的，可以自由引用。请注明来源与取数日期，因为数字每天都在变。",
        label: "媒体资料",
        href: "/resources/press"
      }
    };
  }

  if (template === "long-form" && section === "about" && slug === "history") {
    return {
      title,
      subtitle: subtitle ?? "",
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
    };
  }

  return {
    title,
    subtitle: subtitle ?? `${title} 长文内容页`,
    notice: "这是一条可在后台编辑的提示信息。",
    sections: [
      { heading: "背景与范围", body: "用于说明页面背景、范围和边界。" },
      { heading: "流程说明", body: "用于说明流程、条件和执行步骤。" }
    ],
    sidebar: {
      title: "目录",
      links: [{ label: "背景与范围", href: "#" }, { label: "流程说明", href: "#" }]
    }
  };
}

export const prototypePageContentSeeds: PageContentContractSeed[] = routeSeeds.map((seed) => {
  const path = pageRouteToContentPath(seed.section, seed.slug);
  return {
    section: seed.section,
    slug: seed.slug,
    title: seed.title,
    template: seed.template,
    path,
    data: {
      meta: {
        section: seed.section,
        slug: seed.slug,
        template: seed.template,
        path
      },
      ...defaultTemplateData(seed.template, seed.title, seed.section, seed.slug),
      // The 参与支持 pages carry their whole content, not a template default:
      // everything they show used to be written into the template itself.
      ...involveDefaults(seed.section, seed.slug),
      // Handoff panels and authoritative-source lists, likewise lifted out of
      // the 我们的服务 templates.
      ...servicesDefaults(seed.section, seed.slug)
    }
  };
});
