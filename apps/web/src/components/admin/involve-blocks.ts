import type { RowField, SectionBlockDef } from "./section-fields";

/**
 * Block declarations for the five 参与支持 pages.
 *
 * These pages were edited as raw JSON textareas -- and most of what they show
 * was not in the JSON at all. The donation panel, the volunteer roles, the
 * ENDCCP figures and every sidebar were written into the templates, so an
 * editor opening `involve-index.json` saw four fields, three of which
 * (`cards`, `sidebar`, and a placeholder block) rendered nowhere on the page.
 *
 * Everything the page shows is now stored and declared here, and the long prose
 * is a single Markdown body rather than a field per paragraph.
 *
 * Keyed by content path, which is what ContentExplorer knows.
 */

const LINK_ROW: RowField[] = [
  { key: "label", label: "文字（Label）" },
  { key: "href", label: "链接（Link）" }
];

const STAT_ROW: RowField[] = [
  { key: "value", label: "数字（Value）" },
  { key: "label", label: "说明（Label）" }
];

/** The four "你也可以这样支持" cards, used on two pages. */
const ACT_CARD_ROW: RowField[] = [
  { key: "title", label: "标题（Title）" },
  { key: "body", label: "说明（Body）", kind: "area" },
  { key: "href", label: "链接（Link）" }
];

const MD_HINT = "空行分段。`## 小标题` 是二级标题，`**加粗**`，`[文字](链接)` 是链接。";

/** Sidebar 相关 panel — the same shape on four of the five pages. */
function relatedPanel(label = "相关链接 Related"): SectionBlockDef {
  return {
    key: "relatedPanel",
    label,
    text: [{ key: "title", label: "标题（Title）" }],
    rows: {
      links: { label: "链接（Links）", blank: { label: "", href: "/" }, fields: LINK_ROW }
    }
  };
}

/** Sidebar call-to-action panel: a line of text and one button. */
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

export const INVOLVE_BLOCKS: Record<string, SectionBlockDef[]> = {
  "pages/involve-index.json": [
    {
      key: "donatePanel",
      label: "捐助我们 Donate",
      note: "页面第一块。按钮指向 tuidang.org 的捐助页面，在新窗口打开。",
      markdown: [{ key: "body", label: "说明正文（Markdown）", hint: MD_HINT }],
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "buttonLabel", label: "按钮文字（Button label）" },
        { key: "buttonHref", label: "按钮链接（Button link）" },
        { key: "footnote", label: "按钮下方小字（Footnote）", area: true }
      ]
    },
    {
      key: "donateStats",
      label: "支出比例 Spending",
      markdown: [{ key: "note", label: "下方说明（Markdown）", hint: MD_HINT }],
      rows: {
        items: { label: "四格数字（Figures）", blank: { value: "", label: "" }, fields: STAT_ROW }
      }
    },
    {
      key: "useOfFunds",
      label: "你的捐助用在哪里 Use of funds",
      text: [{ key: "title", label: "标题（Title）" }],
      lists: [{ key: "items", label: "条目（Items，每行一条）" }]
    },
    {
      key: "otherDonationWays",
      label: "其他捐助方式 Other ways",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: {
        links: { label: "链接（Links）", blank: { label: "", href: "/involve/other-ways" }, fields: LINK_ROW }
      }
    },
    {
      key: "volunteerBand",
      label: "成为义工（深色区块）Volunteer band",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "lede", label: "导语（Lede）", area: true },
        { key: "moreLabel", label: "右上角链接文字（More label）" },
        { key: "moreHref", label: "右上角链接（More link）" }
      ],
      rows: {
        links: { label: "工作类别（Links）", blank: { label: "", href: "/involve/volunteer" }, fields: LINK_ROW }
      }
    },
    {
      key: "endccpBlock",
      label: "ENDCCP 征签 Petition",
      markdown: [{ key: "body", label: "正文（Markdown）", hint: MD_HINT }],
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "progressTitle", label: "侧栏标题（Progress title）" },
        { key: "progressValue", label: "签署人数（Progress value）" },
        { key: "progressNote", label: "侧栏说明（Progress note）", area: true }
      ],
      rows: {
        buttons: { label: "按钮（Buttons）", blank: { label: "", href: "/" }, fields: LINK_ROW }
      }
    },
    {
      key: "storiesHeading",
      label: "义工故事 · 栏目标题 Stories heading",
      note: "下方卡片在「义工故事卡片」里编辑；没有卡片时整块不显示。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "title", label: "标题（Title）" },
        { key: "moreLabel", label: "右上角链接文字（More label）" },
        { key: "moreHref", label: "右上角链接（More link）" }
      ]
    },
    {
      key: "stories",
      label: "义工故事卡片 Story cards",
      note: "每张卡片必须有标题和链接，否则不显示——避免出现点不开的卡片。",
      rows: {
        __self: {
          label: "卡片（Cards）",
          blank: { tag: "", title: "", body: "", foot: "", href: "/news" },
          fields: [
            { key: "tag", label: "角标（Tag）" },
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "摘要（Body）", kind: "area" },
            { key: "foot", label: "脚注（Foot）" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    },
    {
      key: "actCards",
      label: "页尾四个入口 Action cards",
      rows: {
        __self: { label: "入口（Cards）", blank: { title: "", body: "", href: "/" }, fields: ACT_CARD_ROW }
      }
    }
  ],

  "pages/involve-endccp.json": [
    {
      key: "stats",
      label: "顶部四格数字 Figures",
      rows: {
        __self: { label: "数字（Figures）", blank: { value: "", label: "" }, fields: STAT_ROW }
      }
    },
    {
      key: "intro",
      label: "正文 Body",
      markdown: [{ key: "body", label: "正文（Markdown）", hint: MD_HINT }]
    },
    {
      key: "actions",
      label: "历次行动 Past actions",
      note: "留空则整块不显示。",
      text: [{ key: "title", label: "标题（Title）" }],
      rows: {
        items: {
          label: "行动记录（Items）",
          blank: { tag: "", title: "", summary: "", date: "", href: "/news", image: "" },
          fields: [
            { key: "image", label: "配图（Image）", kind: "image" },
            { key: "tag", label: "角标（Tag）" },
            { key: "title", label: "标题（Title）" },
            { key: "summary", label: "摘要（Summary）", kind: "area" },
            { key: "date", label: "日期（Date）" },
            { key: "href", label: "链接（Link）" }
          ]
        }
      }
    },
    ctaPanel("signPanel", "参与联署（侧栏）Sign panel", "签署在 endccp.com 上完成，改地址不需要重新部署。"),
    relatedPanel()
  ],

  "pages/involve-other-ways.json": [
    {
      key: "actCards",
      label: "顶部四个入口 Action cards",
      rows: {
        __self: { label: "入口（Cards）", blank: { title: "", body: "", href: "/" }, fields: ACT_CARD_ROW }
      }
    },
    {
      key: "intro",
      label: "正文 Body",
      markdown: [{ key: "body", label: "正文（Markdown）", hint: MD_HINT }]
    },
    ctaPanel("donatePanel", "捐助（侧栏）Donate panel"),
    relatedPanel()
  ],

  "pages/involve-volunteer.json": [
    {
      key: "roles",
      label: "义工工作类别 Roles",
      rows: {
        __self: {
          label: "类别（Roles）",
          blank: { title: "", body: "", tag: "可远程", href: "" },
          fields: [
            { key: "title", label: "标题（Title）" },
            { key: "body", label: "说明（Body）", kind: "area" },
            { key: "tag", label: "角标（Tag，如「可远程」）" },
            { key: "href", label: "链接（Link，留空则不可点）" }
          ]
        }
      }
    },
    {
      key: "signupForm",
      label: "报名表单 Signup form",
      note: "表单目前只是版式，提交按钮指向下面填的地址。",
      text: [
        { key: "eyebrow", label: "小标题（Eyebrow）" },
        { key: "categoryLabel", label: "类别题目（Category label）" },
        { key: "cityLabel", label: "城市题目（City label）" },
        { key: "cityPlaceholder", label: "城市提示文字（City placeholder）" },
        { key: "timeLabel", label: "时间题目（Time label）" },
        { key: "timeHint", label: "时间说明（Time hint）", area: true },
        { key: "timePlaceholder", label: "时间提示文字（Time placeholder）" },
        { key: "contactLabel", label: "联络题目（Contact label）" },
        { key: "contactHint", label: "联络说明（Contact hint）", area: true },
        { key: "contactPlaceholder", label: "联络提示文字（Contact placeholder）" },
        { key: "submitLabel", label: "提交按钮文字（Submit label）" },
        { key: "submitHref", label: "提交按钮链接（Submit link）" }
      ],
      lists: [{ key: "categoryOptions", label: "可选类别（Options，每行一个）" }]
    },
    ctaPanel("storiesPanel", "义工在做什么（侧栏）Stories panel"),
    relatedPanel()
  ],

  "pages/involve-stories.json": [
    ctaPanel("joinPanel", "你也可以参与（侧栏）Join panel"),
    relatedPanel()
  ]
};
