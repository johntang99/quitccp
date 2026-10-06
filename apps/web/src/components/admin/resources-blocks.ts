import type { RowField, SectionBlockDef } from "./section-fields";

/**
 * Block declarations for the 资料与出版 pages.
 *
 * `resources/index` is not here -- the books page has its own editor already,
 * built around the nine-part table of contents. The other five were JSON
 * textareas.
 *
 * Keyed by content path, which is what ContentExplorer knows.
 */

const LINK_ROW: RowField[] = [
  { key: "label", label: "文字（Label）" },
  { key: "href", label: "链接（Link）" }
];

const MD_HINT = "空行分段。`## 小标题` 是二级标题，`**加粗**`，`[文字](链接)` 是链接。";

function linkPanel(key: string, label: string, note?: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [{ key: "title", label: "标题（Title）" }],
    rows: { links: { label: "链接（Links）", blank: { label: "", href: "/" }, fields: LINK_ROW } }
  };
}

function ctaPanel(key: string, label: string, note?: string): SectionBlockDef {
  return {
    key,
    label,
    note,
    text: [
      { key: "title", label: "标题（Title）" },
      { key: "body", label: "说明（Body）", area: true },
      { key: "buttonLabel", label: "按钮文字（Button label）" },
      { key: "buttonHref", label: "按钮链接（Button link）" }
    ]
  };
}

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

function headingBlock(key: string, label: string): SectionBlockDef {
  return {
    key,
    label,
    text: [
      { key: "eyebrow", label: "小标题（Eyebrow）" },
      { key: "title", label: "标题（Title）" }
    ]
  };
}

function markdownBlock(label: string, note?: string): SectionBlockDef {
  return {
    key: "intro",
    label,
    note,
    markdown: [{ key: "body", label: "正文（Markdown）", hint: MD_HINT }]
  };
}

export const RESOURCES_BLOCKS: Record<string, SectionBlockDef[]> = {
  /*
   * /resources/downloads is NOT rendered by the page template. The route hands
   * it to MaterialsIndexPage, which builds the category grid from 资料管理.
   * Only these three keys reach the page; `downloadCards`, `proseSections`,
   * `assistPanel` and `relatedPanel` are stored but render nowhere, so they are
   * deliberately not shown here rather than offered as controls that do
   * nothing.
   */
  "pages/resources-downloads.json": [
    {
      key: "assets",
      label: "其他素材 Assets",
      note: "分类与资料本身在「资料管理」里维护；这里只是页面底部那几块外部素材。没有链接的条目不会显示。",
      rows: {
        __self: {
          label: "素材（Assets）",
          blank: { title: "", body: "", badge: "", href: "https://" },
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "badge", label: "角标（Badge，如「Flickr 相簿」）" },
            { key: "href", label: "链接（Link，留空则不显示）" }
          ]
        }
      }
    },
    noticeBlock("reuseNotice", "免费开放声明 Reuse notice")
  ],

  "pages/resources-tools.json": [
    {
      key: "accessCards",
      label: "访问方式卡片 Access cards",
      note: "每张卡片是一种访问方式。链接留空则按钮不可点。",
      rows: {
        __self: {
          label: "方式（Cards）",
          blank: { kicker: "", title: "", body: "", href: "", buttonLabel: "", buttonVariant: "line" },
          fields: [
            { key: "kicker", label: "序号（Kicker，如「方式一」）" },
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "href", label: "链接（Link）" },
            { key: "buttonLabel", label: "按钮文字（Button label）" },
            { key: "buttonVariant", label: "按钮样式（seal 实心 / line 描边）" }
          ]
        }
      }
    },
    markdownBlock("正文 Body", "原本是四组「小标题 + 若干段落」，现在一个框写完。"),
    noticeBlock("noticePanel", "顶部提示 Notice"),
    ctaPanel("safetyPanel", "侧栏「你的安全」Safety panel"),
    linkPanel("relatedPanel", "侧栏「相关」Related"),
    noticeBlock("reminderPanel", "侧栏「提醒」Reminder")
  ],

  "pages/resources-magazine.json": [
    {
      key: "featuredIssue",
      label: "创刊号 Featured issue",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "正文（Body）", area: true },
        { key: "note", label: "补充说明（Note）", area: true },
        { key: "image", label: "封面图（Cover image）" }
      ],
      rows: {
        actions: { label: "按钮（Buttons）", blank: { label: "", href: "https://" }, fields: LINK_ROW }
      }
    },
    headingBlock("issuesSection", "历期 · 栏目标题 Issues heading"),
    {
      key: "issues",
      label: "历期 Issues",
      rows: {
        __self: {
          label: "期号（Issues）",
          blank: { title: "", summary: "点此在线阅读", href: "https://", archiveText: "" },
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "summary", label: "说明（Summary）" },
            { key: "href", label: "链接（Link）" },
            { key: "archiveText", label: "封面文字（Archive text，可换行）", kind: "area" }
          ]
        }
      }
    },
    markdownBlock("正文 Body"),
    ctaPanel("requestPanel", "侧栏「订阅《回归》」Subscribe panel"),
    linkPanel("relatedPanel", "侧栏「相关」Related")
  ],

  "pages/resources-press.json": [
    headingBlock("kitSection", "媒体资料包 · 栏目标题 Kit heading"),
    {
      key: "kitItems",
      label: "可下载素材 Press kit",
      rows: {
        __self: {
          label: "素材（Items）",
          blank: { title: "", body: "", badge: "", href: "" },
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "badge", label: "角标（Badge，如「PDF · 中／英」）" },
            { key: "href", label: "下载地址（Link）" }
          ]
        }
      }
    },
    headingBlock("faqSection", "采访 FAQ · 栏目标题 FAQ heading"),
    {
      key: "faqs",
      label: "采访与引用 FAQ",
      note: "回答可以写多段，一段一行。",
      rows: {
        __self: {
          label: "问答（Q & A）",
          blank: { question: "", answer: [] },
          fields: [
            { key: "question", label: "问题（Question）" },
            { key: "answer", label: "回答（Answer，每段一行）", kind: "list" }
          ]
        }
      }
    },
    {
      key: "ctaPanel",
      label: "采访合作 CTA",
      text: [
        { key: "title", label: "标题（Title）" },
        { key: "body", label: "说明（Body）", area: true },
        { key: "primaryLabel", label: "主按钮文字（Primary label）" },
        { key: "primaryHref", label: "主按钮链接（Primary link）" },
        { key: "secondaryLabel", label: "次按钮文字（Secondary label）" },
        { key: "secondaryHref", label: "次按钮链接（Secondary link）" }
      ]
    },
    noticeBlock("noticePanel", "欢迎查证 Notice")
  ],

  /*
   * Likewise /resources/culture: the article list, its filters and its pager
   * all come from the database via CulturePage. Only the title, the subtitle
   * and these two panels are read from the stored page.
   */
  "pages/resources-culture.json": [
    ctaPanel("freeUsePanel", "侧栏「可自由使用」Free use"),
    linkPanel("relatedPanel", "侧栏「相关」Related")
  ]
};
