/**
 * Canonical URLs for the production services on tuidang.org.
 *
 * This site does not implement service transactions -- declarations,
 * certificates and verification all live on the existing production systems and
 * we link out to them. See docs/implementation/services-link-out-map.md.
 *
 * Note these are three separate hosts with separate deployments and separate
 * uptime, which is why the link-out pages also surface the offline fallback
 * channels below.
 */

export const EXTERNAL_SERVICES = {
  /** 三退声明 submission + the public declaration archive. */
  declare: "https://santui.tuidang.org",
  /** Look up the result of a 三退 submission using its query password. */
  declareLookup: "https://santui.tuidang.org/index/querybyid",
  /** 查询审核/处理结果 entry with all lookup options. */
  declareLookupOptions: "https://santui.tuidang.org/searchoptions",
  /** Contact the declaration site directly. */
  declareContact: "https://santui.tuidang.org/contactpage/",
  /** Declaration statistics dashboard. */
  declareStats: "https://santui.tuidang.org/stat",
  /** XML feed behind the running declaration counter. */
  declareStatsXml: "https://santui.tuidang.org/stat/statics",
  /** Latest published declarations. */
  declareLatest: "https://santui.tuidang.org/index/showpage/type/1",

  /** 退党证明 application (primary channel). */
  certApply: "https://service.tuidang.org/cert-apply/",
  /** 退党证明 application via Ganjing World (alternate channel). */
  certApplyGanjing: "https://www.ganjingworld.com/lifestyle/tuidang",
  /** 退党证明 verification, for the holder or a receiving institution. */
  certVerify: "https://service.tuidang.org/cert-verify/",
  certVerifyEn: "https://service.tuidang.org/cert-verify-en/",
  /** Hub page describing the whole certificate service. */
  certHub: "https://www.tuidang.org/cert/",
  /** Reports on certificates presented publicly at rallies. */
  certPublicAwards: "https://www.tuidang.org/category/gkbftdzm/",

  contact: "https://www.tuidang.org/contact-us/",
  /* Moved to its own subdomain 2026-10-07, ahead of the main-domain cutover:
     the donation site stays on the old server while tuidang.org moves to the
     new site. Verified serving the donation page before the switch. */
  donation: "https://donation.tuidang.org",
  aboutUs: "https://www.tuidang.org/about-us/",
  termsOfService: "https://www.tuidang.org/terms-of-service/",
  privacyPolicy: "https://www.tuidang.org/privacy-policy/",
  faqHub: "https://www.tuidang.org/faq/",
  downloads: "https://www.tuidang.org/td_promo/",
  circumventionTools: "https://www.tuidang.org/2022/09/14/686434/",
  nineCommentaries: "https://www.tuidang.org/9ping/"
} as const;

/** Individual FAQ articles, by the doc id used on tuidang.org. */
export const EXTERNAL_DOCS = {
  // 三退 basics
  whatIsTuidang: "https://www.tuidang.org/docs/694368/",
  whyTuidang: "https://www.tuidang.org/docs/694427/",
  howToTuidang: "https://www.tuidang.org/docs/698548/",
  unpaidDuesNotAutoQuit: "https://www.tuidang.org/docs/694378/",

  // 退党证明
  whatIsCert: "https://www.tuidang.org/docs/694366/",
  howToApplyCert: "https://www.tuidang.org/docs/694454/",
  applyEarlyIfEmigrating: "https://www.tuidang.org/docs/694391/",
  priorEpochTimesDeclaration: "https://www.tuidang.org/docs/694408/",
  fixCertMistake: "https://www.tuidang.org/docs/694447/",
  howToVerifyCert: "https://www.tuidang.org/docs/694449/",

  // 移民相关政策
  uscisAttitude: "https://www.tuidang.org/docs/694460/",
  uscisDiscretion: "https://www.tuidang.org/docs/694462/",
  mustProvideCert: "https://www.tuidang.org/docs/694467/",
  nonImmigrantVisas: "https://www.tuidang.org/docs/694476/",
  denaturalizationRisk: "https://www.tuidang.org/docs/694464/",

  // 安全与隐私
  isTuidangSafe: "https://www.tuidang.org/docs/694445/",
  isCertSafe: "https://www.tuidang.org/docs/694393/"
} as const;

/**
 * Channels that work when the web services are unreachable. Worth showing
 * inline rather than only on the far side of a link: a reader who cannot load
 * santui.tuidang.org cannot read its hotline list either.
 */
export const OFFLINE_DECLARE_CHANNELS = {
  email: "santui@tuidang.org",
  hotlines: [
    { region: "美国", numbers: ["001-702-873-1734", "001-866-697-6570", "001-888-892-8757"] },
    { region: "加拿大", numbers: ["001-416-361-9895", "001-514-342-1023", "001-604-276-2569"] },
    {
      region: "台湾",
      numbers: ["00886-906073004", "00886-937537422", "00886-901012397", "00886-901012875"]
    },
    { region: "香港", numbers: ["+852 65963278", "+852 96652626"] },
    { region: "日本", numbers: ["81368067050"] },
    { region: "韩国", numbers: ["82-10-53815957"] }
  ]
} as const;

/**
 * Props every outbound link needs. `noopener`/`noreferrer` matter here: these
 * are separate origins and must never receive a `window.opener` handle.
 */
export const EXTERNAL_LINK_PROPS = {
  target: "_blank",
  rel: "noopener noreferrer"
} as const;

/**
 * Props for a href that may be internal or external (e.g. one resolved from CMS
 * content). Returns the outbound props only when the link actually leaves this
 * origin, so internal links keep normal same-tab behaviour.
 */
export function externalLinkProps(href: string) {
  return /^https?:\/\//i.test(href.trim()) ? EXTERNAL_LINK_PROPS : {};
}
