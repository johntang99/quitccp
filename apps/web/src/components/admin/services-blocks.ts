import type { RowField, SectionBlockDef } from "./section-fields";

/**
 * Block declarations for the eight 我们的服务 pages.
 *
 * Unlike the 参与支持 pages, these already stored their content -- but they
 * stored it behind a JSON textarea per key, so changing one sidebar link meant
 * editing a wall of braces without breaking it. The same declarations and the
 * same renderers that serve About and Involve serve these.
 *
 * Long prose is one Markdown body per page rather than a heading field and a
 * body field per section.
 *
 * Keyed by content path, which is what ContentExplorer knows.
 */

const LINK_ROW: RowField[] = [
  { key: "label", label: "文字（Label）" },
  { key: "href", label: "链接（Link）" }
];

const MD_HINT = "空行分段。`## 小标题` 是二级标题，`**加粗**`，`[文字](链接)` 是链接。";

/** The handoff panel: this site stops here and the production service takes over. */
const HANDOFF_BLOCK: SectionBlockDef = {
  key: "handoff",
  label: "跳转面板 Handoff",
  note: "本站到此为止，下面的按钮把读者送到 tuidang.org 的正式服务。目的地说明一定要写清楚，否则读者会以为链接有问题。",
  text: [
    { key: "eyebrow", label: "小标题（Eyebrow）" },
    { key: "heading", label: "标题（Heading）" },
    { key: "body", label: "说明（Body）", area: true },
    { key: "destinationNote", label: "目的地说明（Destination note）", area: true }
  ],
  rows: {
    actions: {
      label: "按钮（Buttons）",
      blank: { label: "", href: "https://", primary: false, stamp: "", note: "" },
      fields: [
        { key: "label", label: "按钮文字（Label）" },
        { key: "href", label: "链接（Link）" },
        { key: "primary", label: "主按钮（红色印章样式）", kind: "flag" },
        { key: "stamp", label: "印章字（Stamp，通常填「退」）" },
        { key: "note", label: "按钮下方说明（Note）", kind: "area" }
      ]
    }
  }
};

/** Sidebar 相关 / 还有问题 panel: a heading and a list of links. */
function linkPanel(key: string, label: string, note?: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [{ key: "title", label: "标题（Title）" }],
    rows: { links: { label: "链接（Links）", blank: { label: "", href: "/" }, fields: LINK_ROW } }
  };
}

/** Sidebar panel with a note line above the links. */
function sourcePanel(key: string, label: string, note: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [
      { key: "title", label: "标题（Title）" },
      { key: "note", label: "说明小字（Note）", area: true }
    ],
    rows: { links: { label: "链接（Links）", blank: { label: "", href: "https://" }, fields: LINK_ROW } }
  };
}

/** Sidebar panel with one button. */
function ctaPanel(key: string, label: string, note?: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [
      { key: "title", label: "标题（Title）" },
      { key: "body", label: "说明（Body）", area: true },
      { key: "buttonLabel", label: "按钮文字（Button label）" },
      { key: "buttonHref", label: "按钮链接（Button link）" },
      { key: "buttonStamp", label: "印章字（Stamp，可留空）" }
    ]
  };
}

/** Sidebar panel that is a heading plus a plain list of lines. */
function listPanel(key: string, label: string, itemsLabel: string): SectionBlockDef {
  return {
    key,
    label,
    text: [{ key: "title", label: "标题（Title）" }],
    lists: [{ key: "items", label: itemsLabel }]
  };
}

/** The notice strip: a bold lead-in and a paragraph. */
function noticeBlock(key: string, label: string, note?: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [
      { key: "title", label: "加粗开头（Title）" },
      { key: "body", label: "正文（Body）", area: true }
    ]
  };
}

/** One page-long Markdown body. */
function markdownBlock(label: string, note?: string): SectionBlockDef {
  return {
    key: "intro",
    label,
    note,
    markdown: [{ key: "body", label: "正文（Markdown）", hint: MD_HINT }]
  };
}

export const SERVICES_BLOCKS: Record<string, SectionBlockDef[]> = {
  "pages/services-index.json": [
    {
      key: "primaryAction",
      label: "顶部主按钮 Primary button",
      text: [
        { key: "label", label: "按钮文字（Label）" },
        { key: "href", label: "链接（Link）" },
        { key: "stamp", label: "印章字（Stamp）" }
      ]
    },
    {
      key: "secondaryAction",
      label: "顶部次按钮 Secondary button",
      text: [
        { key: "label", label: "按钮文字（Label）" },
        { key: "href", label: "链接（Link）" }
      ]
    },
    {
      key: "processCards",
      label: "三步卡片 Process cards",
      rows: {
        __self: {
          label: "卡片（Cards）",
          blank: { tag: "", title: "", body: "", foot: "", links: [] },
          fields: [
            { key: "tag", label: "角标（Tag，如「第一步」）" },
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "foot", label: "脚注（Foot）" },
            { key: "links", label: "卡片内链接（Links）", kind: "links" }
          ]
        }
      }
    },
    {
      key: "verifyBand",
      label: "查验区（深色区块）Verify band",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true },
        { key: "buttonLabel", label: "按钮文字（Button label）" },
        { key: "buttonHref", label: "按钮链接（Button link）" },
        { key: "note", label: "按钮下方小字（Note）", area: true }
      ]
    },
    {
      key: "certSection",
      label: "证明办理区 Certificate section",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "noticeTitle", label: "提示框开头（Notice title）" },
        { key: "noticeBody", label: "提示框正文（Notice body）", area: true },
        { key: "subheading", label: "小节标题（Subheading）" },
        { key: "subbody", label: "小节正文（Sub body）", area: true },
        { key: "actionStamp", label: "主按钮印章字（Stamp）" }
      ],
      lists: [{ key: "paragraphs", label: "正文段落（Paragraphs，每段一行）" }],
      rows: {
        actions: {
          label: "按钮（Buttons）",
          blank: { label: "", href: "/services/cert", variant: "line" },
          fields: [
            { key: "label", label: "按钮文字（Label）" },
            { key: "href", label: "链接（Link）" },
            { key: "variant", label: "样式（seal 实心 / line 描边 / line-light 浅描边）" }
          ]
        }
      },
      // Both sidebar panels are stored inside this block, not beside it.
      objects: {
        samplePanel: {
          label: "侧栏「证明样本」（Sample panel）",
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "image", label: "图片（Image）", kind: "image" },
            { key: "alt", label: "图片说明文字（Alt）" },
            { key: "caption", label: "图注（Caption）", kind: "area" }
          ]
        },
        relatedPanel: {
          label: "侧栏「相关」（Related panel）",
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "links", label: "链接（Links）", kind: "links" }
          ]
        }
      }
    },
    {
      key: "immigrationSection",
      label: "移民相关区 Immigration section",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "lede", label: "导语（Lede）", area: true },
        { key: "moreLabel", label: "更多链接文字（More label）" },
        { key: "moreHref", label: "更多链接（More link）" }
      ],
      rows: {
        items: {
          label: "条目（Items）",
          blank: { tag: "", title: "", summary: "", meta: "", href: "/news" },
          fields: [
            { key: "tag", label: "角标（Tag）" },
            { key: "title", label: "标题（Title）" },
            { key: "summary", label: "摘要（Summary）", kind: "area" },
            { key: "meta", label: "日期与出处（Meta）" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    },
    {
      key: "contactSection",
      label: "信息变更区 Contact section",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true }
      ],
      objects: {
        primaryAction: {
          label: "主按钮（Primary button）",
          fields: [
            { key: "label", label: "按钮文字（Label）" },
            { key: "href", label: "链接（Link）" }
          ]
        },
        secondaryAction: {
          label: "次按钮（Secondary button）",
          fields: [
            { key: "label", label: "按钮文字（Label）" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    }
  ],

  "pages/services-declare.json": [
    HANDOFF_BLOCK,
    noticeBlock("safetyNotice", "安全提示 Safety notice", "正文支持 Markdown 链接写法：`[免翻墙链接](/resources/tools)`。"),
    {
      key: "offlinePanel",
      label: "打不开时的其他方式 Offline channels",
      note: "这一段故意写在本站，而不是只写在三退网站上——打不开那个网站的人，也读不到那边的热线表。",
      text: [
        { key: "title", label: "加粗开头（Title）" },
        { key: "intro", label: "引导语（Intro）", area: true },
        { key: "emailLabel", label: "邮箱标签（Email label）" },
        { key: "email", label: "电子邮件（Email）" },
        { key: "hotlineLabel", label: "热线标签（Hotline label）" }
      ],
      rows: {
        hotlines: {
          label: "电话热线（Hotlines）",
          blank: { region: "", numbers: "" },
          fields: [
            { key: "region", label: "地区（Region）" },
            { key: "numbers", label: "号码（Numbers，多个用全角空格分隔）", kind: "area" }
          ]
        }
      }
    },
    linkPanel("readyPanel", "侧栏「还不确定？」Ready panel"),
    linkPanel("otherWaysPanel", "侧栏「其他方式」Other ways"),
    {
      key: "todayPanel",
      label: "侧栏「今日」Today panel",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "value", label: "数字（Value）" },
        { key: "body", label: "说明（Body）", area: true }
      ]
    }
  ],

  "pages/services-cert.json": [
    noticeBlock("noticePanel", "办理前提示 Notice"),
    {
      key: "steps",
      label: "办理步骤 Steps",
      lists: [{ key: "__self", label: "步骤（Steps，每行一个）" }]
    },
    markdownBlock("正文 Body"),
    {
      key: "applyActions",
      label: "办理按钮 Apply buttons",
      note: "两个办理渠道与费用说明都在这里改，不需要重新部署。",
      text: [{ key: "destinationNote", label: "按钮下方说明（Destination note）", area: true }],
      rows: {
        items: {
          label: "按钮（Buttons）",
          blank: { label: "", href: "https://", stamp: "", variant: "line" },
          fields: [
            { key: "label", label: "按钮文字（Label）" },
            { key: "href", label: "链接（Link）" },
            { key: "stamp", label: "印章字（Stamp，通常填「退」）" },
            { key: "variant", label: "样式（seal 实心 / line 描边）" }
          ]
        }
      }
    },
    {
      key: "samplePanel",
      label: "侧栏「证明样本」Sample panel",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "image", label: "图片（Image）" },
        { key: "alt", label: "图片说明文字（Alt）" },
        { key: "caption", label: "图注（Caption）", area: true }
      ]
    },
    linkPanel("relatedPanel", "侧栏「相关问答」Related"),
    ctaPanel("readyPanel", "侧栏「还没有声明？」Ready panel")
  ],

  "pages/services-verify.json": [
    HANDOFF_BLOCK,
    noticeBlock("institutionNotice", "给受理机构的说明 Institution notice"),
    markdownBlock("正文 Body", "查验结果三种状态写成 `**有效。** 说明文字` 即可。"),
    listPanel("antiFraudPanel", "侧栏「防伪要点」Anti-fraud", "要点（Items，每行一条）"),
    linkPanel("relatedPanel", "侧栏「相关」Related")
  ],

  "pages/services-contact.json": [
    HANDOFF_BLOCK,
    markdownBlock("正文 Body"),
    {
      key: "contactPanel",
      label: "侧栏「直接联系」Contact panel",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "orgName", label: "机构名称（Organisation）" },
        { key: "addressLine1", label: "地址第一行（Address line 1）" },
        { key: "addressLine2", label: "地址第二行（Address line 2）" }
      ],
      rows: { links: { label: "链接（Links）", blank: { label: "", href: "/" }, fields: LINK_ROW } }
    },
    ctaPanel("onsitePanel", "侧栏「当面办理」On-site panel"),
    noticeBlock("reminderPanel", "侧栏「提醒」Reminder")
  ],

  "pages/services-faq.json": [
    {
      key: "faqs",
      label: "问答 Questions",
      note: "「tuidang.org 完整解答」填写后，答案下方会出现一条跳转链接。",
      rows: {
        __self: {
          label: "问答（Q & A）",
          blank: { question: "", answer: "", sourceHref: "" },
          fields: [
            { key: "question", label: "问题（Question）" },
            { key: "answer", label: "回答（Answer）", kind: "area" },
            { key: "sourceHref", label: "tuidang.org 完整解答（可留空）" }
          ]
        }
      }
    },
    {
      key: "filters",
      label: "筛选标签 Filters",
      note: "目前只是版式，点击不筛选；留空则不显示这一排标签。",
      lists: [{ key: "__self", label: "标签（Filters，每行一个）" }]
    },
    ctaPanel("readyPanel", "侧栏「准备好了？」Ready panel"),
    sourcePanel("fullFaqPanel", "侧栏「完整问答」Full FAQ", "指向 tuidang.org 上的权威解答。"),
    linkPanel("linksPanel", "侧栏「还有问题」More questions")
  ],

  "pages/services-privacy.json": [
    noticeBlock("alertPanel", "顶部提示 Alert"),
    markdownBlock("正文 Body"),
    listPanel("highlightsPanel", "侧栏「本页要点」Highlights", "要点（Items，每行一条）"),
    ctaPanel("toolsPanel", "侧栏「受限网络下访问」Tools panel"),
    linkPanel("linksPanel", "侧栏「相关」Related")
  ],

  "pages/services-immigration.json": [
    noticeBlock("alertPanel", "顶部提示 Alert"),
    {
      key: "policySection",
      label: "政策文件 Policy documents",
      note: "每条都应填链接，否则读者看到的是打不开的标题。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" }
      ],
      rows: {
        items: {
          label: "文件（Items）",
          blank: { tag: "政策文件", title: "", body: "", href: "https://" },
          fields: [
            { key: "tag", label: "角标（Tag）" },
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    },
    {
      key: "reportSection",
      label: "议会行动与个案报导 Reports",
      note: "留空则整块不显示。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" }
      ],
      rows: {
        items: {
          label: "报导（Items）",
          blank: { tag: "", title: "", summary: "", meta: "", href: "/news", image: "" },
          fields: [
            { key: "image", label: "配图（Image）", kind: "image" },
            { key: "tag", label: "角标（Tag）" },
            { key: "title", label: "标题（Title）" },
            { key: "summary", label: "摘要（Summary）", kind: "area" },
            { key: "meta", label: "日期与出处（Meta）" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    },
    sourcePanel("policySourcePanel", "侧栏「政策原文」Policy sources", "指向 tuidang.org 上的权威说明。"),
    ctaPanel("proofPanel", "侧栏「需要一份凭据？」Proof panel"),
    listPanel("countriesPanel", "侧栏「其他国家」Countries", "国家或地区（Items，每行一个）"),
    noticeBlock("reminderPanel", "侧栏「提醒」Reminder")
  ]
};
