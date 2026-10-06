/**
 * Content for the 我们的服务 pages that used to be written into the templates.
 *
 * These pages were already mostly CMS-backed, but three kinds of text were not:
 * the handoff panels that send the reader to the production services on
 * tuidang.org, the sidebar lists of authoritative FAQ and policy documents, and
 * the apply buttons on the certificate page. All of them name hosts, prices and
 * conditions that change -- exactly the text an editor needs to reach without a
 * deploy.
 *
 * Kept here rather than in the templates so a fresh install seeds from the same
 * values the templates fall back to.
 */

/** Addresses duplicated from apps/web/src/lib/external-services.ts.
 *
 * The schema package cannot import from the app, and these are the stored
 * defaults of editable content rather than a second source of truth: once a
 * page is seeded, the CMS value is what renders. */
const SANTUI = "https://santui.tuidang.org";
const SERVICE = "https://service.tuidang.org";
const WWW = "https://www.tuidang.org";

/** Policy documents on tuidang.org, by the title each is stored under. */
export const SERVICES_POLICY_DOC_HREFS: Record<string, string> = {
  "USCIS 关于共产党员的移民态度": `${WWW}/docs/694460/`,
  "美国移民局 USCIS 关于共产党员的移民态度": `${WWW}/docs/694460/`,
  "USCIS 关于共产党员及其组织成员移民申请的酌情考量": `${WWW}/docs/694462/`,
  "USCIS 关于移民申请的酌情考量": `${WWW}/docs/694462/`,
  "共产党员移民美国，需主动提供退党证明": `${WWW}/docs/694467/`,
  "非移民签证也会被问及党组织成员身份": `${WWW}/docs/694476/`,
  "美国非移民签证也会被问及是否加入了共产党组织": `${WWW}/docs/694476/`,
  "已入籍也可能因党员身份被驱逐出境": `${WWW}/docs/694464/`,
  "已经入籍美国也可能因为是共产党成员被驱逐出境": `${WWW}/docs/694464/`,
  "为什么应尽早办理退党证明": `${WWW}/docs/694391/`,
  "为什么出国人员应尽早办理退党证明": `${WWW}/docs/694391/`
};

/**
 * Titles the templates forced regardless of what the CMS held.
 *
 * Each branch carried a line like `title === "安全与隐私" ? "安全与隐私说明" : title`
 * -- a patch over a stale seed value, with the side effect that an editor saw
 * one title in the form and a different one on the page. The right title is
 * stored instead and the override is gone.
 */
export const SERVICES_CORRECTED_TITLES: Record<string, string> = {
  index: "声明、证明、查验。",
  declare: "声明退出中共党、团、队",
  verify: "查验一份退党证明",
  contact: "信息变更与联系我们",
  privacy: "安全与隐私说明",
  immigration: "移民相关政策与问题"
};

export const servicesPageDefaults: Record<string, Record<string, unknown>> = {
  declare: {
    handoff: {
      eyebrow: "在线提交",
      heading: "到三退网站提交你的声明",
      body: "声明由全球退党服务中心的三退网站受理并公开存档。全程免费，无需注册，可以使用化名。",
      destinationNote: "链接将在新窗口打开 santui.tuidang.org。这是本中心运营的三退声明网站，界面与本站不同，属于正常情况。",
      actions: [
        { label: "前往提交三退声明", href: SANTUI, primary: true, stamp: "退", note: "" },
        {
          label: "查询我的声明处理结果",
          href: `${SANTUI}/index/querybyid`,
          primary: false,
          stamp: "",
          note: "使用提交时获得的查询密码。此密码与「退党证明编号」不同。"
        }
      ]
    },
    // Listed on this side of the link on purpose: someone who cannot reach
    // santui.tuidang.org cannot read its hotline list either.
    offlinePanel: {
      title: "如果打不开上面的链接",
      intro: "你也可以用这些方式提交声明。",
      emailLabel: "电子邮件",
      email: "santui@tuidang.org",
      hotlineLabel: "电话热线",
      hotlines: [
        { region: "美国", numbers: "001-702-873-1734　001-866-697-6570　001-888-892-8757" },
        { region: "加拿大", numbers: "001-416-361-9895　001-514-342-1023　001-604-276-2569" },
        { region: "台湾", numbers: "00886-906073004　00886-937537422　00886-901012397　00886-901012875" },
        { region: "香港", numbers: "+852 65963278　+852 96652626" },
        { region: "日本", numbers: "81368067050" },
        { region: "韩国", numbers: "82-10-53815957" }
      ]
    }
  },

  cert: {
    // Was three buttons and a footnote written into the branch. The two apply
    // channels and what they cost are the most change-prone text on the page.
    applyActions: {
      destinationNote: "办理入口将在新窗口打开 service.tuidang.org 或干净世界，界面与本站不同，属于正常情况。",
      items: [
        { label: "本网办理", href: `${SERVICE}/cert-apply/`, stamp: "退", variant: "seal" },
        { label: "干净世界办理", href: "https://www.ganjingworld.com/lifestyle/tuidang", stamp: "", variant: "line" },
        { label: "先看常见问题", href: "/services/faq", stamp: "", variant: "line" }
      ]
    }
  },

  verify: {
    handoff: {
      eyebrow: "在线查验",
      heading: "到证明查验系统核实编号",
      body: "查验入口对所有人开放，无需注册或授权。结果仅显示该编号是否由本中心签发、签发日期与状态，不显示声明正文或其他个人信息。",
      destinationNote: "链接将在新窗口打开 service.tuidang.org。这是本中心的退党证明查验系统，界面与本站不同，属于正常情况。",
      actions: [
        {
          label: "查验退党证明",
          href: `${SERVICE}/cert-verify/`,
          primary: true,
          stamp: "退",
          note: "需要证明编号（TD 开头的 16 位数字）、姓名与出生日期。目前仅适用于 2020 年 8 月 18 日之后办理的证明。"
        },
        { label: "English verification", href: `${SERVICE}/cert-verify-en/`, primary: false, stamp: "", note: "" },
        {
          label: "查询三退声明处理结果",
          href: `${SANTUI}/index/querybyid`,
          primary: false,
          stamp: "",
          note: "三退声明与退党证明是两套不同的系统。三退查询使用提交时的查询密码，不是证明编号。"
        }
      ]
    }
  },

  contact: {
    handoff: {
      eyebrow: "提交申请",
      heading: "通过联系表单办理",
      body: "更正声明信息、补发遗失证明或查询登记记录，都通过本中心的联系表单提交，由志愿者人工核对处理。",
      destinationNote: "链接将在新窗口打开 www.tuidang.org 的联系页面。",
      actions: [
        {
          label: "联系我们",
          href: `${WWW}/contact-us/`,
          primary: true,
          stamp: "退",
          note: "请提供证明编号；若没有编号，请说明当时使用的署名、大致日期与提交方式（网站／服务点／电话／义工代转），以便志愿者核对。"
        },
        {
          label: "三退声明相关问题",
          href: `${SANTUI}/contactpage/`,
          primary: false,
          stamp: "",
          note: "若你要更正的是三退声明而非退党证明，请通过三退网站联系。"
        }
      ]
    }
  },

  faq: {
    // The authoritative answers live on tuidang.org; this panel is the pointer
    // to them and was unreachable in the template until now.
    fullFaqPanel: {
      title: "完整问答",
      note: "以下解答由 tuidang.org 维护，为准。",
      links: [
        { label: "什么是三退？", href: `${WWW}/docs/694368/` },
        { label: "为什么要三退？", href: `${WWW}/docs/694427/` },
        { label: "如何三退？", href: `${WWW}/docs/698548/` },
        { label: "多年不交党费算自动退党吗？", href: `${WWW}/docs/694378/` },
        { label: "什么是退党证明？", href: `${WWW}/docs/694366/` },
        { label: "如何办理退党证明？", href: `${WWW}/docs/694454/` },
        { label: "如何查验证明真伪？", href: `${WWW}/docs/694449/` },
        { label: "全部常见问题 →", href: `${WWW}/faq/` }
      ]
    }
  },

  immigration: {
    policySourcePanel: {
      title: "政策原文",
      note: "以下说明由 tuidang.org 维护，为准。",
      links: [
        { label: "美国移民局 USCIS 关于共产党员的移民态度", href: `${WWW}/docs/694460/` },
        { label: "USCIS 关于移民申请的酌情考量", href: `${WWW}/docs/694462/` },
        { label: "共产党员移民美国，需主动提供退党证明", href: `${WWW}/docs/694467/` },
        { label: "非移民签证也会被问及党组织成员身份", href: `${WWW}/docs/694476/` },
        { label: "已入籍也可能因党员身份被驱逐出境", href: `${WWW}/docs/694464/` },
        { label: "为什么应尽早办理退党证明", href: `${WWW}/docs/694391/` }
      ]
    }
  },

  privacy: {},
  // No defaults of its own; declared so every services page has an entry.
  done: {}
};

/**
 * Fields missing from inside a stored object, which a top-level fill cannot
 * reach. The verification band's footnote is the only one: the template has
 * always printed it from a fallback, so it has never been editable.
 */
export const SERVICES_NESTED_FILLS: { slug: string; path: string[]; value: string }[] = [
  {
    slug: "index",
    path: ["verifyBand", "note"],
    value: "查验需要证明编号（TD 开头的 16 位数字）、姓名与出生日期。仅适用于 2020 年 8 月 18 日之后办理的证明。"
  }
];

/** The defaults for one 我们的服务 page, empty for anything else. */
export function servicesDefaults(section: string, slug: string): Record<string, unknown> {
  if (section !== "services") return {};
  return servicesPageDefaults[slug] ?? {};
}
