/**
 * Default content for the five 参与支持 pages.
 *
 * These words used to live inside the page templates, which meant no editor
 * could reach them: `involve-index.json` held a title, a subtitle, and two keys
 * that rendered nowhere. They are now ordinary content — stored per page,
 * edited block by block, with the long prose as one Markdown body.
 *
 * They stay here, rather than in the template, for two reasons: a fresh install
 * seeds its content entries from this file, and the templates fall back to the
 * same values when an entry predates the change. One copy, both uses.
 */

export const INVOLVE_DONATION_URL = "https://donation.tuidang.org";

export const involvePageDefaults: Record<string, Record<string, unknown>> = {
  index: {
    donatePanel: {
      eyebrow: "捐助我们",
      title: "到捐助页面完成",
      body: "捐助由本中心的捐助页面受理，支持每月定期捐助与单次捐助。本中心为美国注册的 501(c)(3) 非营利组织，捐款可依法抵税。",
      buttonLabel: "前往捐助",
      buttonHref: INVOLVE_DONATION_URL,
      footnote: "链接将在新窗口打开 www.tuidang.org 的捐助页面。"
    },
    donateStats: {
      items: [
        { value: "84%", label: "项目支出" },
        { value: "10%", label: "行政" },
        { value: "6%", label: "筹款" },
        { value: "501(c)(3)", label: "可依法抵税" }
      ],
      note: "财务报表经独立会计师事务所审计，年度 Form 990 公开可查。[查看财务与问责](/about/accountability)"
    },
    useOfFunds: {
      title: "你的捐助用在哪里",
      items: ["服务点场地与物料", "展板、传单与资料印制", "登记系统与证明签发", "网站与安全防护", "多语种翻译"]
    },
    otherDonationWays: {
      title: "其他捐助方式",
      // Four href="#" links until now. Everything they name is explained on
      // /involve/other-ways, so that is where they point.
      links: [
        { label: "支票邮寄", href: "/involve/other-ways" },
        { label: "银行转账", href: "/involve/other-ways" },
        { label: "公司配捐", href: "/involve/other-ways" },
        { label: "遗产捐赠", href: "/involve/other-ways" }
      ]
    },
    volunteerBand: {
      eyebrow: "成为义工",
      title: "绝大部分工作由志愿者完成",
      lede: "你可以在所在城市协助服务点，也可以在线参与翻译、整理与技术工作。时间多少不限。",
      moreLabel: "报名 →",
      moreHref: "/involve/volunteer",
      links: [
        { label: "服务点现场协助", href: "/involve/volunteer" },
        { label: "翻译（英德韩日罗）", href: "/involve/volunteer" },
        { label: "影音剪辑与字幕", href: "/involve/volunteer" },
        { label: "资料整理与校对", href: "/involve/volunteer" },
        { label: "技术与网站维护", href: "/involve/volunteer" },
        { label: "在你的城市新设服务点", href: "/involve/volunteer" }
      ]
    },
    endccpBlock: {
      eyebrow: "ENDCCP 征签行动",
      title: "加入公开联署",
      body:
        "ENDCCP 是一项面向各国公众的公开联署，向政府与国际机构表达对中共侵害人权行为的立场。联署内容公开，签署人可选择是否公开姓名。\n\n" +
        "征签自发起以来已在多国举办活动，包括环美车游、街头征签与国际研讨会。历次行动的纪录与报导可在新闻与报告中查阅。",
      buttons: [
        { label: "参与联署", href: "/involve/endccp" },
        { label: "历次行动纪录", href: "/news" }
      ],
      progressTitle: "征签进度",
      progressValue: "2,481,036",
      progressNote: "人已签署，覆盖 90 多个国家与地区。"
    },
    storiesHeading: {
      eyebrow: "义工故事",
      title: "在服务点的人",
      moreLabel: "全部义工故事 →",
      moreHref: "/involve/stories"
    },
    actCards: [
      { title: "声明三退", body: "最直接的支持方式。可匿名，几分钟完成。", href: "/services/declare" },
      { title: "下载并散发资料", body: "展板、传单与影音素材，可自由使用。", href: "/resources/downloads" },
      { title: "转载我们的报导", body: "无需授权，注明来源即可。", href: "/news" },
      { title: "告诉一个人", body: "把这个网站发给可能需要的人。", href: "/resources/tools" }
    ]
  },

  endccp: {
    stats: [
      { value: "2,481,036", label: "累计签署人数" },
      { value: "90+", label: "覆盖国家与地区" },
      { value: "100 万+", label: "年均新增" },
      { value: "2020.11", label: "发起时间" }
    ],
    intro: {
      body:
        "## 联署内容\n\n" +
        "联署书要求各国政府正视中共对信仰群体、异议人士与少数族群的侵害，并对参与迫害的责任人采取相应措施。全文公开，签署前请先阅读。\n\n" +
        "## 签署方式\n\n" +
        "可在线签署，也可在各地服务点与活动现场纸本签署。签署人可选择是否公开姓名——选择不公开的，我们只计入总数，不显示任何信息。"
    },
    actions: { title: "历次行动", items: [] },
    signPanel: {
      title: "参与联署",
      body: "签署前请先阅读联署全文。可选择匿名。",
      buttonLabel: "前往签署",
      buttonHref: "https://endccp.com/"
    },
    relatedPanel: {
      title: "相关",
      links: [
        // Was href="#". The text of the petition is on endccp.com.
        { label: "联署书全文", href: "https://endccp.com/" },
        { label: "机构公告与声明", href: "/news/announcement-claims" },
        { label: "参与现场征签", href: "/involve/volunteer" },
        { label: "征签物料下载", href: "/resources/downloads" }
      ]
    }
  },

  "other-ways": {
    actCards: [
      { title: "声明三退", body: "最直接的方式。可匿名，几分钟完成。", href: "/services/declare" },
      { title: "下载并散发资料", body: "展板、传单与影音素材，可自由印制使用。", href: "/resources/downloads" },
      { title: "转载我们的报导", body: "无需事先授权，注明来源即可。", href: "/news" },
      { title: "把免翻墙方式转给亲友", body: "身在大陆的人，往往缺的只是一个能打开的地址。", href: "/resources/tools" }
    ],
    intro: {
      body:
        "## 公司配捐\n\n" +
        "许多雇主提供慈善配捐计划，你的捐助可能被等额甚至双倍匹配。我们是在美国注册的 501(c)(3) 组织，符合绝大多数配捐计划的资格要求。\n\n" +
        "## 支票与银行转账\n\n" +
        "若不便使用线上支付，可邮寄支票至纽约办公室，或通过银行转账。请与我们联系取得账户信息——请勿相信任何其他来源提供的账户。\n\n" +
        "## 遗产捐赠\n\n" +
        "若你考虑将本中心列入遗嘱或信托安排，请与我们联系，我们会提供所需的法律信息。\n\n" +
        "## 专业技能\n\n" +
        "法律、会计、安全、翻译与设计方面的专业协助，对我们的价值往往高于同等金额的捐款。"
    },
    donatePanel: {
      title: "捐助",
      body: "每月 20 美元，约可支持一个服务点运转一周。",
      buttonLabel: "捐助我们",
      buttonHref: "/involve"
    },
    relatedPanel: {
      title: "相关",
      links: [
        { label: "财务与问责", href: "/about/accountability" },
        { label: "成为义工", href: "/involve/volunteer" },
        { label: "联系我们", href: "/services/contact" }
      ]
    }
  },

  volunteer: {
    // All six cards were href="#"; the sign-up form is further down the same
    // page, so a blank href leaves them as plain cards rather than dead links.
    roles: [
      { title: "服务点现场协助", body: "在你所在的城市值守服务点，协助登记与解答问题。", tag: "需要当地", href: "" },
      { title: "翻译", body: "英、德、韩、日、罗马尼亚语。文章、字幕与资料。", tag: "可远程", href: "" },
      { title: "影音剪辑与字幕", body: "现场素材剪辑、字幕制作与压制。", tag: "可远程", href: "" },
      { title: "资料整理与校对", body: "纸本声明录入、档案整理与文字校对。", tag: "可远程", href: "" },
      { title: "技术与网站维护", body: "前后端、安全防护与系统运维。", tag: "可远程", href: "" },
      { title: "在你的城市新设服务点", body: "我们提供物料、培训与远程支持。", tag: "需要当地", href: "" }
    ],
    signupForm: {
      eyebrow: "报名",
      categoryLabel: "你想参与哪一类",
      categoryOptions: ["现场协助", "翻译", "影音", "文字整理", "技术", "还不确定"],
      cityLabel: "所在城市",
      cityPlaceholder: "例如：多伦多",
      timeLabel: "大致可投入时间",
      timeHint: "没有最低要求。每周一小时也可以。",
      timePlaceholder: "例如：周末各半天",
      contactLabel: "联络方式",
      contactHint: "仅用于义工事务联络，不作他用，也不会转给第三方。",
      contactPlaceholder: "电子邮件或其他方式",
      submitLabel: "提交报名",
      submitHref: "https://www.tuidang.org/contact/"
    },
    storiesPanel: {
      title: "义工在做什么",
      body: "读几篇现场纪实，比任何说明都清楚。",
      buttonLabel: "义工故事",
      buttonHref: "/involve/stories"
    },
    relatedPanel: {
      title: "相关",
      links: [
        { label: "查找服务点", href: "/about/network" },
        { label: "下载展板与传单", href: "/resources/downloads" },
        { label: "免翻墙链接", href: "/resources/tools" },
        { label: "联系我们", href: "/services/contact" }
      ]
    }
  },

  stories: {
    joinPanel: {
      title: "你也可以参与",
      body: "时间多少不限。在你的城市，或者在线上。",
      buttonLabel: "成为义工",
      buttonHref: "/involve/volunteer"
    },
    relatedPanel: {
      title: "相关",
      links: [
        { label: "全球服务网络", href: "/about/network" },
        { label: "义工纪实影片", href: "/videos" },
        { label: "三退新闻与故事", href: "/news" }
      ]
    }
  }
};

/** The defaults for one 参与支持 page, empty for anything else. */
export function involveDefaults(section: string, slug: string): Record<string, unknown> {
  if (section !== "involve") return {};
  return involvePageDefaults[slug] ?? {};
}
