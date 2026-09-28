import type { PageDocument, TemplateKind } from "./types";

interface RouteSeed {
  section: "root" | "about" | "services" | "involve" | "news" | "videos" | "resources";
  slug: string;
  title: string;
  template: TemplateKind;
}

export const routeSeeds: RouteSeed[] = [
  { section: "root", slug: "index", title: "首页", template: "home" },
  { section: "about", slug: "index", title: "我们是谁，以及如何被检验。", template: "section-home" },
  { section: "about", slug: "numbers", title: "这个数字是怎么统计的", template: "long-form" },
  { section: "about", slug: "network", title: "一百多个服务点，由志愿者维持运转", template: "section-home" },
  { section: "about", slug: "accountability", title: "我们如何被检验", template: "section-home" },
  { section: "about", slug: "team", title: "负责的人", template: "section-home" },
  { section: "about", slug: "history", title: "二〇〇五年至今", template: "long-form" },
  { section: "services", slug: "index", title: "声明、证明、查验，全部免费。", template: "section-home" },
  { section: "services", slug: "declare", title: "声明三退", template: "form" },
  { section: "services", slug: "cert", title: "退党证书", template: "form" },
  { section: "services", slug: "verify", title: "查询验证", template: "form" },
  { section: "services", slug: "immigration", title: "移民相关政策", template: "long-form" },
  { section: "services", slug: "faq", title: "三退问答", template: "long-form" },
  { section: "services", slug: "contact", title: "信息变更", template: "form" },
  { section: "services", slug: "privacy", title: "安全与隐私", template: "long-form" },
  { section: "involve", slug: "index", title: "让服务点能一直开着。", template: "section-home" },
  { section: "involve", slug: "volunteer", title: "绝大部分工作由志愿者完成", template: "form" },
  { section: "involve", slug: "endccp", title: "打倒中共恶魔（End CCP）征签", template: "section-home" },
  { section: "involve", slug: "stories", title: "在服务点的人", template: "list-archive" },
  { section: "involve", slug: "other-ways", title: "不捐款也能支持", template: "section-home" },
  { section: "news", slug: "index", title: "新闻与报告", template: "list-archive" },
  { section: "news", slug: "announcements", title: "机构公告与声明", template: "list-archive" },
  { section: "news", slug: "investigations", title: "追查国际调查报告", template: "list-archive" },
  { section: "news", slug: "commentary", title: "专题报导与时政评论", template: "list-archive" },
  { section: "news", slug: "solidarity", title: "国际声援行动", template: "list-archive" },
  { section: "news", slug: "stories", title: "三退新闻与故事", template: "list-archive" },
  { section: "news", slug: "notable", title: "名人退党", template: "list-archive" },
  { section: "news", slug: "article", title: "全球退党服务中心在美国国会山为 31 名华人颁发退党证明", template: "article" },
  { section: "videos", slug: "index", title: "影音节目", template: "video-library" },
  { section: "videos", slug: "frontline", title: "三退前线", template: "video-library" },
  { section: "videos", slug: "party-culture", title: "破除党文化", template: "video-library" },
  { section: "videos", slug: "step-back", title: "退一步海阔天空", template: "video-library" },
  { section: "videos", slug: "jiuping", title: "九评系列", template: "video-library" },
  { section: "videos", slug: "ironclad", title: "铁证如山", template: "video-library" },
  { section: "videos", slug: "awakening", title: "亿万人的觉醒之旅", template: "video-library" },
  { section: "videos", slug: "others", title: "其它系列", template: "video-library" },
  { section: "resources", slug: "index", title: "书籍与文集", template: "section-home" },
  { section: "resources", slug: "culture", title: "中华传统文化", template: "list-archive" },
  { section: "resources", slug: "downloads", title: "真相点资料下载", template: "section-home" },
  { section: "resources", slug: "tools", title: "免翻墙链接", template: "long-form" },
  { section: "resources", slug: "magazine", title: "杂志《回归》", template: "section-home" },
  { section: "resources", slug: "press", title: "媒体与记者", template: "section-home" },
  { section: "resources", slug: "book-jieti-dangwenhua", title: "《解体党文化》", template: "long-form" },
  { section: "resources", slug: "book-mogui-shijie", title: "《魔鬼在统治着我们的世界》", template: "long-form" },
  { section: "resources", slug: "book-gongchanzhuyi-zhongji", title: "《共产主义的终极目的》", template: "long-form" },
  { section: "resources", slug: "magazine-2026-spring", title: "《回归》2026 春季号", template: "long-form" },
  { section: "resources", slug: "magazine-2025-winter", title: "《回归》2025 冬季号", template: "long-form" },
  { section: "resources", slug: "magazine-2025-autumn", title: "《回归》2025 秋季号", template: "long-form" },
  { section: "resources", slug: "magazine-2025-summer", title: "《回归》2025 夏季号", template: "long-form" },
  { section: "resources", slug: "magazine-2025-spring", title: "《回归》2025 春季号", template: "long-form" },
  { section: "resources", slug: "magazine-2024-winter", title: "《回归》2024 冬季号", template: "long-form" },
  { section: "resources", slug: "magazine-2024-autumn", title: "《回归》2024 秋季号", template: "long-form" },
  { section: "resources", slug: "magazine-archive", title: "《回归》历期归档", template: "long-form" }
];

export const samplePage: PageDocument = {
  id: "root-index-zh",
  slug: "index",
  section: "root",
  title: "全球退党服务中心",
  template: "home",
  status: "published",
  locale: "zh",
  blocks: [
    {
      id: "hero",
      type: "hero",
      title: "让每一个想离开的人，都能留下记录。",
      body: "服务、记录、传播，是网站的三条核心内容线。"
    },
    {
      id: "registry",
      type: "live_registry",
      data: {
        counter: 464375383,
        unit: "人"
      }
    }
  ],
  updatedAt: new Date().toISOString()
};
