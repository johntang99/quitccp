import Link from "next/link";
import {
  EXTERNAL_DOCS,
  EXTERNAL_LINK_PROPS,
  EXTERNAL_SERVICES,
  externalLinkProps
} from "@/lib/external-services";
import { CmsMarkdown, MarkdownBody } from "@/components/public/MarkdownBody";
import { markdownToBodyRows } from "@/lib/public-content";
import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";
import { resolveNewsArticleHref } from "@/lib/news-linking";
import { involveDefaults } from "@quitccp/content-schema";
import { ActCards, CtaPanel, LinkPanel, blockRows } from "./section-panels";


export function SectionHomeTemplate({ title, section, slug, content, query }: TemplatePageData) {
  const payload = asRecord(content);

  if (section === "services" && slug === "index") {
    /**
     * On this page every link is a service entry point, so all of them go
     * straight to the production service on tuidang.org rather than to a local
     * page that would only hand off again. News/article links are the one
     * exception -- those stay on this site.
     *
     * Label is checked first because several entries share an internal href
     * (four different links all point at /services/faq) but map to different
     * pages upstream. The href map is the fallback for anything the CMS renames.
     */
    const linkByLabel: Record<string, string> = {
      "立即声明三退": EXTERNAL_SERVICES.declare,
      "立即声明": EXTERNAL_SERVICES.declare,
      "什么是三退": EXTERNAL_DOCS.whatIsTuidang,
      "为什么要三退": EXTERNAL_DOCS.whyTuidang,
      "安全与隐私说明": EXTERNAL_DOCS.isTuidangSafe,
      "办理退党证明": EXTERNAL_SERVICES.certApply,
      "申请证明": EXTERNAL_SERVICES.certApply,
      "与移民申请的关系": EXTERNAL_DOCS.mustProvideCert,
      "证明与移民申请": EXTERNAL_DOCS.mustProvideCert,
      "证明常见问题": EXTERNAL_DOCS.whatIsCert,
      "信息变更与补办": EXTERNAL_SERVICES.contact,
      "输入编号查验": EXTERNAL_SERVICES.certVerify,
      "第三方查验入口": EXTERNAL_SERVICES.certVerify,
      "查验": EXTERNAL_SERVICES.certVerify,
      "证明样本与防伪说明": EXTERNAL_SERVICES.certHub,
      "给受理机构的说明": EXTERNAL_SERVICES.certVerify,
      "联系我们核实": EXTERNAL_SERVICES.contact,
      "先看常见问题": EXTERNAL_SERVICES.faqHub,
      "常见问题": EXTERNAL_SERVICES.faqHub,
      "提交变更申请": EXTERNAL_SERVICES.contact,
      "联系服务点": EXTERNAL_SERVICES.contact
    };
    const linkByHref: Record<string, string> = {
      "/services/declare": EXTERNAL_SERVICES.declare,
      "/services/cert": EXTERNAL_SERVICES.certApply,
      "/services/verify": EXTERNAL_SERVICES.certVerify,
      "/services/contact": EXTERNAL_SERVICES.contact,
      "/services/faq": EXTERNAL_SERVICES.faqHub,
      "/services/privacy": EXTERNAL_DOCS.isTuidangSafe,
      "/services/immigration": EXTERNAL_DOCS.mustProvideCert
    };
    const serviceLink = (label: string, href: string): string =>
      linkByLabel[label.trim()] ?? linkByHref[href.trim()] ?? href;

    // Stored title, not patched here. This branch used to discard the stored
    // value whenever it matched one of two older seeds, which meant an editor
    // could change the title and see no change on the page.
    const heading = asString(payload.title, "声明、证明、查验。");
    const subtitle = asString(
      payload.subtitle,
      "我们提供三项服务：登记退出声明、办理退党证明、在线查验证明真伪。三退声明登记与查询验证免费；退党证明为实名办理，需缴纳办理／管理费用。"
    );
    const primaryAction = asRecord(payload.primaryAction);
    const secondaryAction = asRecord(payload.secondaryAction);
    const processCards = asObjectArray(payload.processCards).length
      ? asObjectArray(payload.processCards).map((row) => ({
          tag: asString(row.tag),
          title: asString(row.title),
          body: asString(row.body),
          foot: asString(row.foot),
          links: asObjectArray(row.links).map((link) => ({
            label: asString(link.label),
            href: asString(link.href, "#"),
            meta: asString(link.meta)
          }))
        }))
      : [
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
        ];
    const verifyBand = asRecord(payload.verifyBand);
    const certSection = asRecord(payload.certSection);
    const certParagraphs = asStringArray(certSection.paragraphs, [
      "退党证明是一份由本中心签发的中英文对照文件，载明声明人姓名、退出的组织、声明日期与证明编号。",
      "你需要先完成一份三退声明。若此前已经声明过，也可以凭当时信息申请补发。"
    ]);
    const certActions = asObjectArray(certSection.actions).length
      ? asObjectArray(certSection.actions).map((row) => ({
          label: asString(row.label),
          href: asString(row.href, "#"),
          variant: asString(row.variant, "seal")
        }))
      : [
          { label: "申请证明", href: "/services/cert", variant: "seal" },
          { label: "先看常见问题", href: "/services/faq", variant: "line" }
        ];
    const certSamplePanel = asRecord(certSection.samplePanel);
    const certRelatedPanel = asRecord(certSection.relatedPanel);
    const certRelatedLinks = asObjectArray(certRelatedPanel.links).length
      ? asObjectArray(certRelatedPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "证明与移民申请", href: "/services/immigration" },
          { label: "第三方查验入口", href: "/services/verify" },
          { label: "信息变更与补办", href: "/services/contact" },
          { label: "常见问题", href: "/services/faq" }
        ];
    const immigrationSection = asRecord(payload.immigrationSection);
    const immigrationItems = asObjectArray(immigrationSection.items).length
      ? asObjectArray(immigrationSection.items).map((row) => ({
          href: asString(row.href),
          image: asString(row.image),
          tag: asString(row.tag),
          title: asString(row.title),
          summary: asString(row.summary),
          meta: asString(row.meta)
        }))
      : [];
    const contactSection = asRecord(payload.contactSection);
    const contactPrimaryAction = asRecord(contactSection.primaryAction);
    const contactSecondaryAction = asRecord(contactSection.secondaryAction);

    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={heading}
          subtitle={subtitle}
          slim={false}
          actions={
            <>
              {(() => {
                const label = asString(primaryAction.label, "立即声明三退");
                const href = serviceLink(label, asString(primaryAction.href, "/services/declare"));
                return (
                  <a className="btn btn--seal" href={href} {...externalLinkProps(href)}>
                    <span className="stamp">{asString(primaryAction.stamp, "退")}</span>
                    {label}
                  </a>
                );
              })()}
              {(() => {
                const label = asString(secondaryAction.label, "办理退党证明");
                const href = serviceLink(label, asString(secondaryAction.href, "/services/cert"));
                return (
                  <a className="btn btn--line-light" href={href} {...externalLinkProps(href)}>
                    {label}
                  </a>
                );
              })()}
            </>
          }
        />
        <InteriorTabs section={section} slug={slug} />

        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="cards3">
              {processCards.map((card) => (
                <article key={`${card.tag}-${card.title}`} className="card">
                  <p className="card-tag">{card.tag}</p>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.links.map((row) => {
                      const href = serviceLink(row.label, row.href);
                      return (
                        <li key={`${row.label}-${row.href}-${row.meta}`}>
                          <a href={href} {...externalLinkProps(href)}>
                            {row.label}
                            {row.meta ? <em>{row.meta}</em> : null}
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                  {card.foot ? <p className="card-foot">{card.foot}</p> : null}
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="sec sec--ink" style={{ padding: "64px 0" }}>
          <div className="wrap" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
            <div>
              <p className="eyebrow eyebrow--onink">{asString(verifyBand.eyebrow, "查询验证")}</p>
              <h2 className="h2" style={{ color: "var(--paper)" }}>
                {asString(verifyBand.title, "查验一份退党证明")}
              </h2>
              <p style={{ color: "var(--lav-lt)", fontSize: 15, lineHeight: "var(--lh-body)", margin: "16px 0 0", maxWidth: "44ch" }}>
                {asString(
                  verifyBand.body,
                  "在本中心的查验系统输入证明编号，即可核实签发日期与状态。此入口对所有人开放，受理机构无需与本中心联系即可自行查验。"
                )}
              </p>
            </div>
            <div>
              {/* The input used to live here. Verification happens entirely on
                  service.tuidang.org, and that form needs 编号 + 姓 + 名 +
                  出生日期 -- so a single box here could never have been passed
                  through, and anything typed would have been lost on click. */}
              <a
                className="btn btn--seal"
                href={serviceLink(asString(verifyBand.buttonLabel, "查验"), asString(verifyBand.buttonHref, "/services/verify"))}
                {...externalLinkProps(
                  serviceLink(asString(verifyBand.buttonLabel, "查验"), asString(verifyBand.buttonHref, "/services/verify"))
                )}
              >
                {asString(verifyBand.buttonLabel, "前往查验")}
              </a>
              <p style={{ color: "var(--lav-lt)", fontSize: 13, lineHeight: "var(--lh-body)", margin: "14px 0 0", maxWidth: "36ch" }}>
                {asString(
                  verifyBand.note,
                  "查验需要证明编号（TD 开头的 16 位数字）、姓名与出生日期。仅适用于 2020 年 8 月 18 日之后办理的证明。"
                )}
              </p>
            </div>
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap cols">
            <div>
              <p className="eyebrow">{asString(certSection.eyebrow, "退党证书")}</p>
              <h2 className="h2">{asString(certSection.title, "证明办理")}</h2>
              <div className="prose">
                {certParagraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <div className="notice">
                  <b>{asString(certSection.noticeTitle, "请注意")}</b>
                  {asString(
                    certSection.noticeBody,
                    "退党证明由本中心签发，不是任何政府机关出具的文件，也不构成对移民申请结果的任何保证。是否采信、如何采信，由受理机构自行判断。"
                  )}
                </div>
                <h3>{asString(certSection.subheading, "办理需要什么")}</h3>
                <p>{asString(certSection.subbody, "你需要先完成一份三退声明。若此前已经声明过，也可以凭当时信息申请补发。")}</p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
                {certActions.map((row) => {
                  const href = serviceLink(row.label, row.href);
                  return (
                    <a
                      key={`${row.label}-${row.href}-${row.variant}`}
                      className={row.variant === "line" ? "btn btn--line" : row.variant === "line-light" ? "btn btn--line-light" : "btn btn--seal"}
                      href={href}
                      {...externalLinkProps(href)}
                    >
                      {row.variant === "seal" ? <span className="stamp">{asString(certSection.actionStamp, "退")}</span> : null}
                      {row.label}
                    </a>
                  );
                })}
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(certSamplePanel.title, "证明样本")}</h4>
                <img
                  src={asString(certSamplePanel.image, "https://www.tuidang.org/wp-content/uploads/2026/07/signal-2026-07-22-11-53-42-724.jpg")}
                  alt={asString(certSamplePanel.alt, "退党证明颁发现场")}
                  style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", background: "var(--rule)", marginBottom: 14 }}
                />
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: "var(--lh-body)", margin: 0 }}>
                  {asString(certSamplePanel.caption, "2026 年 7 月，31 名华人在美国国会山领取退党证明。")}
                </p>
              </div>
              <div className="panel">
                <h4>{asString(certRelatedPanel.title, "相关")}</h4>
                <ul>
                  {certRelatedLinks.map((row) => {
                    const href = serviceLink(row.label, row.href);
                    return (
                      <li key={`${row.label}-${row.href}`}>
                        <a href={href} {...externalLinkProps(href)}>
                          {row.label}
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </aside>
          </div>
        </section>
        {immigrationItems.length > 0 ? (
          <section className="sec" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div className="sec-head">
                <div>
                  <p className="eyebrow">{asString(immigrationSection.eyebrow, "移民相关政策与问题")}</p>
                  <h2 className="h2">{asString(immigrationSection.title, "与身份申请有关的说明与报导")}</h2>
                  <p className="lede">
                    {asString(immigrationSection.lede, "以下为公开报导与政策梳理，供参考。本中心不提供法律意见，具体个案请咨询有执照的移民律师。")}
                  </p>
                </div>
                <a className="more" href={asString(immigrationSection.moreHref, "/news")}>
                  {asString(immigrationSection.moreLabel, "全部相关报导 →")}
                </a>
              </div>
              <div className="arch">
                {immigrationItems.map((row) => (
                  <article key={`${row.title}-${row.meta}`} className="arow">
                    <a href={row.href} style={{ display: "contents" }}>
                      {/* Empty src makes the browser re-request the page; the
                          placeholder keeps the .arow grid's first column. */}
                      {row.image ? <img src={row.image} alt="" /> : <span />}
                      <div>
                        <span className="tag">{row.tag}</span>
                        <h3>{row.title}</h3>
                        <p>{row.summary}</p>
                        <p className="meta">{row.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <section className="sec" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="give">
              <div>
                <h3>{asString(contactSection.title, "需要修改信息，或者证明遗失了？")}</h3>
                <p>
                  {asString(
                    contactSection.body,
                    "如果声明中的姓名有误、需要变更，或者证明遗失需要补发，请联系我们。由志愿者人工处理，通常需要数个工作日。请说明原声明的大致时间与内容，以便核对。"
                  )}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <a
                  className="btn btn--seal"
                  href={serviceLink(asString(contactPrimaryAction.label, "提交变更申请"), asString(contactPrimaryAction.href, "/services/contact"))}
                  {...externalLinkProps(
                    serviceLink(asString(contactPrimaryAction.label, "提交变更申请"), asString(contactPrimaryAction.href, "/services/contact"))
                  )}
                >
                  {asString(contactPrimaryAction.label, "提交变更申请")}
                </a>
                <a
                  className="btn btn--line-light"
                  href={serviceLink(asString(contactSecondaryAction.label, "联系服务点"), asString(contactSecondaryAction.href, "/about/network"))}
                  {...externalLinkProps(
                    serviceLink(asString(contactSecondaryAction.label, "联系服务点"), asString(contactSecondaryAction.href, "/about/network"))
                  )}
                >
                  {asString(contactSecondaryAction.label, "联系服务点")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (section === "resources" && slug === "index") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    /**
     * A format pill is only shown when it has somewhere real to go.
     *
     * These books are published elsewhere -- 大纪元 and 新唐人 -- and not every
     * edition exists for every title: 《魔鬼在统治着我们的世界》 has no PDF we can
     * link, 《解体党文化》 has no EPUB. The page used to paper over that by
     * sending every unresolved pill to /resources/downloads, so a reader who
     * clicked PDF landed on a page with no PDF on it. A button that does not go
     * where it says is worse than an absent one.
     */
    const withRealHref = <T extends { href: string }>(rows: T[]) =>
      rows.filter((row) => row.href.trim() && row.href.trim() !== "#");
    const heading = asString(payload.title, "书籍与文集");
    const subtitle = asString(
      payload.subtitle,
      "《九评共产党》及系列著作的全文、音频与多语种译本。全部免费开放阅读与下载，可自由转载与再制作。"
    );
    const featuredBook = asRecord(payload.featuredBook);
    const featuredFormats = asObjectArray(featuredBook.formats).length
      ? withRealHref(asObjectArray(featuredBook.formats).map((row) => ({
          label: asString(row.label),
          href: asString(row.href)
        })))
      : [{ label: "影音版", href: "/videos/jiuping" }];
    const featuredToc = asObjectArray(featuredBook.toc).map((row) => ({
      index: asString(row.index),
      title: asString(row.title),
      href: asString(row.href)
    }));
    const otherWorksSection = asRecord(payload.otherWorksSection);
    const otherWorks = asObjectArray(payload.otherWorks).length
      ? asObjectArray(payload.otherWorks).map((row) => ({
          coverText: asString(row.coverText),
          image: asString(row.image),
          imageAlt: asString(row.imageAlt),
          title: asString(row.title),
          body: asString(row.body),
          href: asString(row.href),
          formats: withRealHref(
            asObjectArray(row.formats).map((fmt) => ({
              label: asString(fmt.label),
              href: asString(fmt.href)
            }))
          )
        }))
      : // No hardcoded stand-ins: the three titles that used to live here linked
        // to /resources/book-* routes that were never built and 404'd.
        [];
    const relatedSection = asRecord(payload.relatedSection);
    const relatedArticles = asObjectArray(payload.relatedArticles).length
      ? asObjectArray(payload.relatedArticles).map((row) => ({
          href: asString(row.href),
          slug: asString(row.slug),
          image: asString(row.image),
          tag: asString(row.tag),
          title: asString(row.title),
          summary: asString(row.summary),
          meta: asString(row.meta)
        }))
      : [];
    const reuseNotice = asRecord(payload.reuseNotice);

    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap">
            <div className="bhero">
              {asString(featuredBook.image) ? (
                <img
                  className="bcover bcover--photo"
                  src={asString(featuredBook.image)}
                  alt={asString(featuredBook.imageAlt)}
                />
              ) : (
                <div className="bcover" style={{ whiteSpace: "pre-line" }}>
                  {asString(featuredBook.coverText, "九评\n共产党")}
                </div>
              )}
              <div>
                <p className="yr">{asString(featuredBook.yearLine, "2004 年首次发表 · 已译为 30 余种语言")}</p>
                <h2>{asString(featuredBook.title, "《九评共产党》")}</h2>
                <p>
                  {asString(
                    featuredBook.body,
                    "此书是近现代历史上第一次系统剖析中共本质的著作。自二〇〇四年出版以来在全球华人间相互传看，并由此引发了「三退」精神觉醒运动——至今已有四亿六千多万人公开声明退出中共党、团、队组织。"
                  )}
                </p>
                <div className="fmt">
                  {featuredFormats.map((item) => (
                    <a key={`${item.label}-${item.href}`} className="pill" href={item.href} {...externalLinkProps(item.href)}>
                      {item.label}
                    </a>
                  ))}
                </div>
                <p className="eyebrow" style={{ marginBottom: 6 }}>
                  {asString(featuredBook.tocHeading, "目录")}
                </p>
                <div className="toc">
                  {featuredToc.map((entry) => (
                    <a
                      key={`${entry.index}-${entry.title}`}
                      href={entry.href}
                      {...externalLinkProps(entry.href)}
                    >
                      <b>{entry.index}</b>
                      <span>{entry.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <p className="eyebrow">{asString(otherWorksSection.eyebrow, "其他著作")}</p>
            <h2 className="h2" style={{ fontSize: 24, marginBottom: 32 }}>
              {asString(otherWorksSection.title, "系列出版物")}
            </h2>
            <div className="blist">
              {otherWorks.map((work) => (
                <article key={work.title} className="bitem">
                  {/* The cover and title link to the book; each format pill is its
                      own link. They cannot be nested -- an <a> inside an <a> is
                      invalid and the inner one stops being clickable. */}
                  <a href={work.href} {...externalLinkProps(work.href)}>
                    {work.image ? (
                      <img className="c c--photo" src={work.image} alt={work.imageAlt} />
                    ) : (
                      <div className="c" style={{ whiteSpace: "pre-line" }}>
                        {work.coverText}
                      </div>
                    )}
                    <h3>{work.title}</h3>
                  </a>
                  <p>{work.body}</p>
                  <div className="fmt">
                    {work.formats.map((fmt) => (
                      <a
                        key={`${work.title}-${fmt.label}`}
                        className="pill"
                        href={fmt.href}
                        {...externalLinkProps(fmt.href)}
                      >
                        {fmt.label}
                      </a>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {relatedArticles.length > 0 ? (
          <section className="sec" style={{ padding: "64px 0 0" }}>
            <div className="wrap">
              <div className="sec-head">
                <div>
                  <p className="eyebrow">{asString(relatedSection.eyebrow, "延伸阅读")}</p>
                  <h2 className="h2" style={{ fontSize: 24 }}>
                    {asString(relatedSection.title, "学者综述与相关报导")}
                  </h2>
                  <p className="lede">{asString(relatedSection.lede, "围绕上述著作的评论、学者分析与新闻关注汇编。")}</p>
                </div>
                <a className="more" href={asString(relatedSection.moreHref, "/news/commentary")}>
                  {asString(relatedSection.moreLabel, "全部相关文章 →")}
                </a>
              </div>
              <div className="arch">
                {relatedArticles.map((row) => (
                  <article key={`${row.title}-${row.meta}`} className="arow">
                    <a
                      href={resolveNewsArticleHref({
                        href: row.href,
                        slug: row.slug,
                        title: row.title
                      })}
                      style={{ display: "contents" }}
                    >
                      <img src={row.image} alt="" />
                      <div>
                        <span className="tag">{row.tag}</span>
                        <h3>{row.title}</h3>
                        <p>{row.summary}</p>
                        <p className="meta">{row.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="sec" style={{ padding: "0 0 88px" }}>
          <div className="wrap">
            <div className="notice">
              <b>{asString(reuseNotice.title, "全部内容免费开放")}</b>
              {asString(
                reuseNotice.body,
                "可自由下载、印制、转载、翻译与再制作，无需事先取得授权，也不需要通知我们。用于商业用途同样不受限制，但请勿以本中心名义收费或代表本中心发言。注明来源即可。"
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  if (section === "resources" && slug === "downloads") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    // Actual download files live on tuidang.org/td_promo/.
    const assetFallbackHref = (title: string) => {
      if (title.includes("图片库")) return "/resources/press";
      if (title.includes("标识")) return "/resources/press";
      if (title.includes("多语")) return "/resources";
      return EXTERNAL_SERVICES.downloads;
    };
    const relatedFallbackHref = (label: string) => {
      if (label.includes("服务点")) return "/about/network";
      if (label.includes("义工")) return "/involve/volunteer";
      if (label.includes("免翻墙")) return "/resources/tools";
      if (label.includes("媒体")) return "/resources/press";
      return "/resources/downloads";
    };
    const heading = asString(payload.title, "真相点资料下载");
    const subtitle = asString(
      payload.subtitle,
      "展板、传单、手举牌、广播音档与图片素材。全部提供可编辑源文件与高分辨率成品，免费开放，无需事先授权。"
    );
    const downloadCards = asObjectArray(payload.downloadCards).length
      ? asObjectArray(payload.downloadCards).map((row) => ({
          title: asString(row.title),
          body: asString(row.body),
          items: asObjectArray(row.items).map((item) => ({
            label: asString(item.label),
            meta: asString(item.meta)
          })),
          foot: asString(row.foot)
        }))
      : [
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
        ];
    const assetsSection = asRecord(payload.assetsSection);
    const assets = asObjectArray(payload.assets).length
      ? asObjectArray(payload.assets).map((row) => ({
          title: asString(row.title),
          body: asString(row.body),
          badge: asString(row.badge),
          href: resolveResourceHref(asString(row.href, "#"), assetFallbackHref(asString(row.title)))
        }))
      : [
          { title: "图片库", body: "历年活动、服务点与证明颁发现场摄影，高分辨率，含摄影署名要求。", badge: "Flickr 相簿", href: "#" },
          { title: "三退登记表", body: "义工现场使用的纸本登记表，供无法在线提交者填写。", badge: "PDF · 义工专用", href: "#" },
          { title: "标准字与标识", body: "机构标识、标准色与使用规范。", badge: "品牌规范", href: "#" },
          { title: "多语种译本", body: "英、德、韩、日、罗马尼亚语素材汇总。", badge: "6 种语言", href: "#" }
        ];
    const introBody = asString(asRecord(payload.intro).body).trim();
    const proseSections = asObjectArray(payload.proseSections).length
      ? asObjectArray(payload.proseSections).map((row) => ({
          heading: asString(row.heading),
          body: asString(row.body)
        }))
      : [
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
        ];
    const assistPanel = asRecord(payload.assistPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).length
      ? asObjectArray(relatedPanel.links).map((row) => ({
          label: asString(row.label),
          href: resolveResourceHref(asString(row.href, "#"), relatedFallbackHref(asString(row.label)))
        }))
      : [
          { label: "查找服务点", href: "/about/network" },
          { label: "成为义工", href: "/involve/volunteer" },
          { label: "免翻墙链接", href: "/resources/tools" },
          { label: "媒体与记者", href: "/resources/press" }
        ];
    const reuseNotice = asRecord(payload.reuseNotice);
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap">
            <div className="dlgrid">
              {downloadCards.map((card) => (
                <article key={card.title} className="dlcard">
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <ul>
                    {card.items.map((item) => (
                      <li key={`${card.title}-${item.label}`}>
                        <span>{item.label}</span>
                        <em>{item.meta}</em>
                      </li>
                    ))}
                  </ul>
                  <p className="f">{card.foot}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{asString(assetsSection.eyebrow, "其他素材")}</p>
                <h2 className="h2" style={{ fontSize: 24 }}>
                  {asString(assetsSection.title, "图片、表单与标识")}
                </h2>
              </div>
            </div>
            <div className="rgrid">
              {assets.map((item) => (
                <a key={item.title} className="rcard" href={item.href} {...externalLinkProps(item.href)}>
                  <h4>{item.title}</h4>
                  <p>{item.body}</p>
                  <span className="dl">{item.badge}</span>
                </a>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap cols">
            <div>
              {/* One markdown body. It was a heading field and a body field
                  per section, which is three controls to write three
                  paragraphs. The old fields are still read when `intro.body`
                  is empty. */}
              <div className="prose" style={{ fontSize: 16 }}>
                {introBody ? (
                  <CmsMarkdown value={introBody} />
                ) : (
                  proseSections.map((entry) => (
                    <div key={entry.heading}>
                      <h2>{entry.heading}</h2>
                      <p>{entry.body}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>{asString(assistPanel.title, "需要协助？")}</h4>
                <p>{asString(assistPanel.body, "服务点可协助批量印制与配送，也可提供本地化建议。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(assistPanel.buttonHref, "/services/contact")}>
                  {asString(assistPanel.buttonLabel, "联系我们")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {relatedLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
        <section className="sec" style={{ padding: "0 0 88px" }}>
          <div className="wrap">
            <div className="notice">
              <b>{asString(reuseNotice.title, "全部内容免费开放")}</b>
              {asString(
                reuseNotice.body,
                "可自由下载、印制、转载、翻译与再制作，无需事先取得授权，也不需要通知我们。用于商业用途同样不受限制，但请勿以本中心名义收费或代表本中心发言。注明来源即可。"
              )}
            </div>
          </div>
        </section>
      </>
    );
  }

  if (section === "resources" && slug === "magazine") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    const issueHrefByTitle: Record<string, string> = {
      "《回归》2026 春季号": "/resources/magazine-2026-spring",
      "《回归》2025 冬季号": "/resources/magazine-2025-winter",
      "《回归》2025 秋季号": "/resources/magazine-2025-autumn",
      "《回归》2025 夏季号": "/resources/magazine-2025-summer",
      "《回归》2025 春季号": "/resources/magazine-2025-spring",
      "《回归》2024 冬季号": "/resources/magazine-2024-winter",
      "《回归》2024 秋季号": "/resources/magazine-2024-autumn",
      历期归档: "/resources/magazine-archive"
    };
    const actionFallbackHref = (label: string) => {
      if (label.includes("在线阅读") || label.includes("最新一期")) return "/resources/magazine-2026-spring";
      if (label.includes("PDF") || label.includes("EPUB")) return "/resources/magazine-2026-spring";
      if (label.includes("音频")) return "/videos";
      if (label.includes("归档")) return "/resources/magazine-archive";
      return "/resources/magazine";
    };
    const issueFallbackHref = (title: string, href: string, index: number) => {
      const mapped = issueHrefByTitle[title];
      if (mapped) return mapped;
      const raw = href.trim();
      if (raw && raw !== "#") return raw;
      return `/resources/magazine?issue=${index + 1}`;
    };
    const relatedFallbackHref = (label: string) => {
      if (label.includes("书籍")) return "/resources";
      if (label.includes("下载")) return "/resources/downloads";
      if (label.includes("媒体")) return "/resources/press";
      return "/resources/magazine";
    };
    const heading = asString(payload.title, "杂志《回归》");
    const subtitle = asString(payload.subtitle, "深度报导、当事人自述与文化专题。历期均可免费下载。");
    const featuredIssue = asRecord(payload.featuredIssue);
    const featuredActions = asObjectArray(featuredIssue.actions).length
      ? asObjectArray(featuredIssue.actions).map((row) => ({
          label: asString(row.label),
          href: resolveResourceHref(asString(row.href, "#"), actionFallbackHref(asString(row.label)))
        }))
      : [
          { label: "在线阅读", href: "#" },
          { label: "PDF 下载", href: "#" },
          { label: "EPUB", href: "#" },
          { label: "音频版", href: "#" }
        ];
    const issuesSection = asRecord(payload.issuesSection);
    const issues = asObjectArray(payload.issues).length
      ? asObjectArray(payload.issues).map((row, index) => ({
          href: issueFallbackHref(asString(row.title), asString(row.href, "#"), index),
          image: asString(row.image),
          title: asString(row.title),
          summary: asString(row.summary),
          archiveText: asString(row.archiveText)
        }))
      : [
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
        ];
    const introBody = asString(asRecord(payload.intro).body).trim();
    const proseSections = asObjectArray(payload.proseSections).length
      ? asObjectArray(payload.proseSections).map((row) => ({
          heading: asString(row.heading),
          body: asString(row.body)
        }))
      : [
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
        ];
    const requestPanel = asRecord(payload.requestPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).length
      ? asObjectArray(relatedPanel.links).map((row) => ({
          label: asString(row.label),
          href: resolveResourceHref(asString(row.href, "#"), relatedFallbackHref(asString(row.label)))
        }))
      : [
          { label: "书籍与文集", href: "/resources" },
          { label: "资料下载", href: "/resources/downloads" },
          { label: "媒体与记者", href: "/resources/press" }
        ];

    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap">
            <div className="bhero">
              {asString(featuredIssue.image) ? (
                <img
                  className="bcover bcover--photo"
                  src={asString(featuredIssue.image)}
                  alt={asString(featuredIssue.imageAlt)}
                />
              ) : (
                <div className="bcover" style={{ whiteSpace: "pre-line" }}>
                  {asString(featuredIssue.coverText, "回归\n创刊号")}
                </div>
              )}
              <div>
                <p className="yr">{asString(featuredIssue.yearLine, "2025 年 10 月创刊 · 月刊")}</p>
                <h2>{asString(featuredIssue.title, "《回归》")}</h2>
                <p>
                  {asString(
                    featuredIssue.body,
                    "《回归》由全球退党服务中心主办，内容以人物故事为主体，兼及时政、经济、历史与文化。"
                  )}
                </p>
                <div className="fmt">
                  {featuredActions.map((action) => (
                    <a
                      key={action.label}
                      className="pill"
                      href={action.href}
                      {...externalLinkProps(action.href)}
                    >
                      {action.label}
                    </a>
                  ))}
                </div>
                <p className="eyebrow" style={{ marginTop: 18, marginBottom: 0 }}>
                  {asString(featuredIssue.note, "本刊所有内容可转载，注明来源即可。")}
                </p>
              </div>
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "56px 0 0" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{asString(issuesSection.eyebrow, "近期刊物")}</p>
                <h2 className="h2" style={{ fontSize: 24 }}>
                  {asString(issuesSection.title, "历期下载")}
                </h2>
              </div>
            </div>
            <div className="isgrid">
              {issues.map((issue) => (
                <a
                  key={issue.title}
                  className="issue"
                  href={issue.href}
                  {...externalLinkProps(issue.href)}
                >
                  {/* No cover, no <img>: a blank src renders as a broken image,
                      which is how this grid looked while the issues were
                      invented and their covers did not exist. */}
                  {issue.image ? (
                    <img src={issue.image} alt="" />
                  ) : (
                    <div className="c" style={{ whiteSpace: "pre-line" }}>
                      {issue.archiveText || issue.title}
                    </div>
                  )}
                  <h3>{issue.title}</h3>
                  <p>{issue.summary}</p>
                </a>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "52px 0 88px" }}>
          <div className="wrap cols">
            <div className="prose">
              {introBody ? (
                <CmsMarkdown value={introBody} />
              ) : (
                proseSections.map((entry) => (
                  <div key={entry.heading}>
                    <h2>{entry.heading}</h2>
                    <p>{entry.body}</p>
                  </div>
                ))
              )}
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>{asString(requestPanel.title, "投稿与索取纸本")}</h4>
                <p>{asString(requestPanel.body, "欢迎投稿，也可来信索取纸本用于服务点发放。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(requestPanel.buttonHref, "/services/contact")}>
                  {asString(requestPanel.buttonLabel, "联系编辑部")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {relatedLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "resources" && slug === "press") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    /*
     * A press card with nothing behind it stays a card, not a link.
     *
     * The previous fallback sent 机构简介, 可授权图片 and 标识与标准字 to
     * /resources/press -- the page the reader is already on -- so clicking them
     * silently reloaded. A journalist cannot tell that from a broken site.
     */
    const heading = asString(payload.title, "媒体与记者");
    const subtitle = asString(payload.subtitle, "机构简介、数据说明、可授权图片与联络方式，供媒体与研究者引用。");
    const noticePanel = asRecord(payload.noticePanel);
    const kitSection = asRecord(payload.kitSection);
    const kitItems = asObjectArray(payload.kitItems).length
      ? asObjectArray(payload.kitItems).map((row) => ({
          title: asString(row.title),
          body: asString(row.body),
          badge: asString(row.badge),
          href: (() => {
            const raw = asString(row.href).trim();
            return raw && raw !== "#" ? raw : "";
          })()
        }))
      : [
          { title: "机构简介（一页）", body: "成立背景、服务内容、规模与法律地位，中英文版本。", badge: "PDF · 中／英", href: "#" },
          { title: "数据与统计方法", body: "数字计入规则、去重方式与已知局限。", badge: "说明页", href: "/about/numbers" },
          { title: "可授权图片", body: "历年活动、服务点与证明颁发现场，高分辨率，含摄影署名要求。", badge: "图片库", href: "#" },
          { title: "标识与标准字", body: "机构标识、标准色与使用规范。", badge: "品牌规范", href: "#" },
          { title: "财务与治理", body: "Form 990、经审计报表、理事会名单。", badge: "问责页", href: "/about/accountability" },
          { title: "安全事件档案", body: "针对本机构的威胁事件、报案与处理经过。", badge: "档案", href: "#" }
        ];
    const faqSection = asRecord(payload.faqSection);
    const faqs = asObjectArray(payload.faqs).length
      ? asObjectArray(payload.faqs).map((row) => ({
          question: asString(row.question),
          answer: asStringArray(row.answer, [])
        }))
      : [
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
        ];
    const ctaPanel = asRecord(payload.ctaPanel);

    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ padding: "52px 0 0" }}>
          <div className="wrap">
            <div className="notice">
              <b>{asString(noticePanel.title, "欢迎查证")}</b>
              {asString(
                noticePanel.body,
                "本站文字、图片与数据可自由引用与转载，原则上无需事先授权。请保留来源与摄影署名；若需原始文件或采访协助，请联系编辑部。"
              )}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "40px 0 0" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{asString(kitSection.eyebrow, "媒体资料包")}</p>
                <h2 className="h2" style={{ fontSize: 24 }}>
                  {asString(kitSection.title, "可下载素材")}
                </h2>
              </div>
            </div>
            <div className="pkit">
              {kitItems.map((item) =>
                item.href ? (
                  <a key={item.title} className="pk" href={item.href} {...externalLinkProps(item.href)}>
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <span className="meta">{item.badge}</span>
                  </a>
                ) : (
                  <div key={item.title} className="pk pk--soon">
                    <h3>{item.title}</h3>
                    <p>{item.body}</p>
                    <span className="meta">{item.badge}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "56px 0 0" }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{asString(faqSection.eyebrow, "常见问题")}</p>
                <h2 className="h2" style={{ fontSize: 24 }}>
                  {asString(faqSection.title, "采访与引用 FAQ")}
                </h2>
              </div>
            </div>
            <div className="faq">
              {faqs.map((faq) => (
                <details key={faq.question}>
                  <summary>{faq.question}</summary>
                  <div className="ans">
                    {faq.answer.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "56px 0 88px" }}>
          <div className="wrap">
            <div className="give">
              <h2>{asString(ctaPanel.title, "采访、查证与数据合作")}</h2>
              <p>{asString(ctaPanel.body, "我们可提供高分辨率原图、历史归档、数据解释与受访联络协助。")}</p>
              <div className="actions">
                <a className="btn btn--ink" href={asString(ctaPanel.primaryHref, "/services/contact")}>
                  {asString(ctaPanel.primaryLabel, "联系编辑部")}
                </a>
                <a className="btn btn--line" href={asString(ctaPanel.secondaryHref, "/about/numbers")}>
                  {asString(ctaPanel.secondaryLabel, "查看统计方法")}
                </a>
              </div>
            </div>
          </div>
        </section>
      </>
    );
  }

  if (section === "about" && slug === "index") {
    const aboutTitleRaw = asString(payload.title);
    const aboutTitle = !aboutTitleRaw || aboutTitleRaw === "我们是谁，以及如何被检验。" ? "我们是谁， 以及如何被检验。" : aboutTitleRaw;
    const intro = asRecord(payload.intro);
    const introParagraphDefaults = [
      "二〇〇四年十一月，《九评共产党》系列社论发表后，陆续有中国民众公开声明退出中共党、团、队组织。为了让这些声明能够被完整登记、保存与查证，全球退党服务中心于二〇〇五年一月在纽约成立。",
      "二十年来，我们登记了四亿六千多万份声明。这些声明由当事人自行提交，可以使用真名、化名或代号；我们不要求提供身份证明，也不核对提交者的真实身份。我们承诺完整保存每一份声明的原文与提交时间，并对外公开可查。"
    ];
    const introBody = asString(intro.body).trim();
    const introParagraphs = asStringArray(intro.paragraphs, introParagraphDefaults);
    const principlesDefault = [
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
    ];
    const principlesRaw = asObjectArray(intro.principles);
    const principles =
      principlesRaw.length > 0
        ? principlesRaw.map((row) => ({
            label: asString(row.label),
            text: asString(row.text),
            linkLabel: asString(row.linkLabel),
            linkHref: asString(row.linkHref),
            linkSuffix: asString(row.linkSuffix)
          }))
        : principlesDefault;

    const sidebarLinksRaw = asObjectArray(intro.sidebarLinks);
    const sidebarLinks =
      sidebarLinksRaw.length > 0
        ? sidebarLinksRaw.map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
        : [
            { label: "数字与统计方法", href: "/about/numbers" },
            { label: "全球服务网络", href: "/about/network" },
            { label: "公开与问责", href: "/about/accountability" },
            { label: "理事会与团队", href: "/about/team" },
            { label: "历史沿革", href: "/about/history" }
          ];

    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={aboutTitle}
          subtitle={asString(
            payload.subtitle,
            "全球退党服务中心成立于二〇〇五年，是在美国注册的 501(c)(3) 非营利组织，总部设于纽约。我们为中国民众提供退出中共党、团、队的声明登记与证明服务，记录并公开侵害人权的证据，并由各地志愿者在全球一百多个服务点提供协助。"
          )}
          slim={false}
        />
        <InteriorTabs section={section} slug={slug} />

        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <p className="eyebrow">{asString(intro.eyebrow, "机构简介")}</p>
              {/*
                The body is one markdown field, written in the same editor as an
                article. It replaced a paragraph list plus a row per principle,
                each principle carrying its own label, text and a three-part
                link -- nine controls to write four sentences of prose. The old
                fields are still read when `body` is empty, so nothing that has
                not been migrated goes blank.
              */}
              <div className="prose">
                {introBody ? (
                  <MarkdownBody rows={markdownToBodyRows(introBody, { keepInline: true })} />
                ) : (
                  <>
                    {introParagraphs.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                    <h2>{asString(intro.principlesHeading, "我们的原则")}</h2>
                    {principles.map((row) => (
                      <p key={`${row.label}-${row.text}`}>
                        <b>{row.label}</b>
                        {row.text}
                        {row.linkLabel ? (
                          <>
                            <a href={row.linkHref || "#"}>{row.linkLabel}</a>
                            {row.linkSuffix}
                          </>
                        ) : null}
                      </p>
                    ))}
                  </>
                )}
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(intro.sidebarTitle, "本页内容")}</h4>
                <ul>
                  {sidebarLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(intro.downloadPanelTitle, "下载")}</h4>
                <p>{asString(intro.downloadPanelBody, "年度工作报告与经审计财务报表，可自由下载与转载。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(intro.downloadPanelButtonHref, "#")}>
                  {asString(intro.downloadPanelButtonLabel, "2025 年度报告 PDF")}
                </a>
              </div>
            </aside>
          </div>
        </section>

      </>
    );
  }

  if (section === "about" && slug === "network") {
    const stats = asObjectArray(payload.stats).length
      ? asObjectArray(payload.stats).map((row) => ({ value: asString(row.value), label: asString(row.label) }))
      : [
          { value: "100+", label: "全球服务点" },
          { value: "20+", label: "覆盖国家与地区" },
          { value: "2,000+", label: "登记在册志愿者" },
          { value: "0", label: "声明登记收费" }
        ];
    const filters = asStringArray(payload.filters, ["全部", "北美", "欧洲", "亚太", "大洋洲"]);
    const mapBlock = asRecord(payload.mapBlock);
    const locations = asObjectArray(payload.locations).length
      ? asObjectArray(payload.locations).map((row) => ({
          tag: asString(row.tag),
          title: asString(row.title),
          body: asString(row.body),
          meta: asString(row.meta)
        }))
      : [
          { tag: "北美", title: "纽约 · 法拉盛", body: "缅街与罗斯福大道一带，每日均有义工值守。可现场声明、办理与领取证明。", meta: "每日 10:00-18:00" },
          { tag: "亚太", title: "台北 · 台北车站", body: "站前广场真相点，开设逾十年。协助现场登记与解答证明相关问题。", meta: "每日 11:00–19:00" },
          { tag: "亚太", title: "韩国 · 济州岛", body: "码头、免税店与主要景点前轮班值守，主要面向邮轮旅客。", meta: "依邮轮班次调整" },
          { tag: "欧洲", title: "伦敦 · 中国城", body: "周末于中国城一带设点，提供中英文咨询。", meta: "周六、周日 12:00–18:00" }
        ];
    /**
     * Region filter and paging, both driven by the query string.
     *
     * These were decorative: five chips and a "1 2 3 下一页" row, every one of
     * them href="#". The pager in particular claimed three pages of service
     * points when the page holds four, so it is now derived from the real
     * count and simply does not render while everything fits on one page.
     */
    const firstValue = (value: string | string[] | undefined) =>
      Array.isArray(value) ? value[0] ?? "" : value ?? "";
    const safeDecode = (value: string) => {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    };

    // Only regions that actually have a service point: a chip that can only
    // ever return "nothing here" is not a filter. 大洋洲 is configured but has
    // no points yet, so it appears as soon as one is added.
    const regionsPresent = [...new Set(locations.map((row) => row.tag).filter(Boolean))];
    const regionChips = [
      "全部",
      ...filters.filter((label) => label !== "全部" && regionsPresent.includes(label)),
      ...regionsPresent.filter((label) => !filters.includes(label))
    ];
    const requestedRegion = safeDecode(firstValue(query?.region)).trim();
    const activeRegion = regionChips.includes(requestedRegion) ? requestedRegion : "全部";
    const matching =
      activeRegion === "全部" ? locations : locations.filter((row) => row.tag === activeRegion);

    const perPage = 10;
    const pageCount = Math.max(1, Math.ceil(matching.length / perPage));
    const requestedPage = Number.parseInt(firstValue(query?.page), 10);
    const activePage = Number.isFinite(requestedPage)
      ? Math.min(Math.max(requestedPage, 1), pageCount)
      : 1;
    const visibleLocations = matching.slice((activePage - 1) * perPage, activePage * perPage);
    const networkHref = (region: string, page: number) => {
      const params = new URLSearchParams();
      if (region !== "全部") params.set("region", region);
      if (page > 1) params.set("page", String(page));
      const qs = params.toString();
      return `/about/network${qs ? `?${qs}` : ""}`;
    };

    const ctaPanel = asRecord(payload.ctaPanel);
    const setupPanel = asRecord(payload.setupPanel);
    const setupLinks = asObjectArray(setupPanel.links).length
      ? asObjectArray(setupPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "成为义工", href: "/involve/volunteer" },
          { label: "下载展板与传单", href: "/resources/downloads" },
          { label: "联系我们", href: "/services/contact" }
        ];
    const offeringsPanel = asRecord(payload.offeringsPanel);
    const offerings = asStringArray(offeringsPanel.items, ["现场声明登记", "证明办理与领取", "证明与移民问题咨询", "纸本声明代转", "资料索取"]);

    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={asString(payload.title, "一百多个服务点，由志愿者维持运转")}
          subtitle={asString(
            payload.subtitle,
            "服务点设在旅游景点、社区与交通枢纽附近。志愿者协助现场登记、解答证明与移民相关问题，并转交纸本声明。"
          )}
        />
        <InteriorTabs section={section} slug={slug} />

        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="stat4">
              {stats.map((row) => (
                <div key={`${row.value}-${row.label}`}>
                  <b>{row.value}</b>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <div className="filters" style={{ marginTop: 40 }}>
                {regionChips.map((label) => (
                  <a
                    key={label}
                    className={label === activeRegion ? "chip on" : "chip"}
                    href={networkHref(label, 1)}
                    aria-current={label === activeRegion ? "true" : undefined}
                  >
                    {label}
                  </a>
                ))}
              </div>
              <div style={{ background: "var(--grad-band)", borderRadius: 3, padding: "56px 34px", textAlign: "center", color: "var(--lav-lt)", marginBottom: 36 }}>
                <p style={{ fontFamily: "var(--mono)", fontSize: 13, letterSpacing: ".14em", margin: "0 0 10px", color: "var(--lav)" }}>
                  {asString(mapBlock.label, "地图")}
                </p>
                <p style={{ margin: "0 auto", fontSize: 14.5, lineHeight: "var(--lh-body)", maxWidth: "44ch" }}>
                  {asString(
                    mapBlock.text,
                    "此处为可交互地图。点选任一服务点可查看地址、开放时间与联络方式。具体到街道的位置信息是否公开，需由安全评估后决定。"
                  )}
                </p>
              </div>
              <div className="arch">
                {visibleLocations.map((row, index) => (
                  <article key={`${row.tag}-${row.title}`} className="arow" style={{ gridTemplateColumns: "1fr", paddingTop: index === 0 ? 0 : undefined }}>
                    <div>
                      <span className="tag">{row.tag}</span>
                      <h3>{row.title}</h3>
                      <p>{row.body}</p>
                      <p className="meta">{row.meta}</p>
                    </div>
                  </article>
                ))}
              </div>
              {visibleLocations.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 15 }}>这个地区还没有列出服务点。</p>
              ) : null}
              {pageCount > 1 ? (
                <nav className="pager" aria-label="分页">
                  {Array.from({ length: pageCount }, (_, index) => index + 1).map((page) => (
                    <a
                      key={page}
                      className={page === activePage ? "on" : undefined}
                      href={networkHref(activeRegion, page)}
                      aria-current={page === activePage ? "page" : undefined}
                    >
                      {page}
                    </a>
                  ))}
                  {activePage < pageCount ? (
                    <a href={networkHref(activeRegion, activePage + 1)} rel="next">
                      下一页 →
                    </a>
                  ) : null}
                </nav>
              ) : null}
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>{asString(ctaPanel.title, "找不到附近的服务点？")}</h4>
                <p>{asString(ctaPanel.body, "你也可以在线声明，或通过电话与邮件提交。全部方式效力相同。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(ctaPanel.buttonHref, "/services/declare")}>
                  <span className="stamp">退</span>
                  {asString(ctaPanel.buttonLabel, "在线声明")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(setupPanel.title, "想在你的城市设点")}</h4>
                <ul>
                  {setupLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(offeringsPanel.title, "服务点提供")}</h4>
                <ul>
                  {offerings.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "about" && slug === "accountability") {
    const summaryCells = asObjectArray(payload.summaryCells).length
      ? asObjectArray(payload.summaryCells).map((row) => ({
          title: asString(row.title),
          value: asString(row.value),
          body: asString(row.body),
          bars: asObjectArray(row.bars).map((bar) => ({
            width: Number(asString(bar.width)) || 0,
            text: asString(bar.text),
            tone: asString(bar.tone)
          }))
        }))
      : [
          // See the note on the other copy of these cells: the funding split
          // was never verified, so it is not asserted here either.
          { title: "注册与法律地位", value: "501(c)(3)", body: "在美国注册的非营利组织，捐款可依法抵税。纳税识别号（EIN）03-0581933。", bars: [] },
          { title: "向谁申报", value: "美国国税局", body: "年度 Form 990 依法向 IRS 申报，并依法成为公开记录。查阅不需要经过我们。", bars: [] },
          { title: "安全与威胁记录", value: "公开档案", body: "本机构多次收到炸弹恐吓等威胁信。相关事件、报案与处理经过记录在案。", bars: [] }
        ];
    const summaryLinks = asObjectArray(payload.summaryLinks).length
      ? asObjectArray(payload.summaryLinks).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "财务报表与 Form 990", href: "#" },
          { label: "年度工作报告", href: "#" },
          { label: "统计方法说明", href: "#" },
          { label: "安全事件档案", href: "#" }
        ];
    const proseSections = asObjectArray(payload.proseSections).length
      ? asObjectArray(payload.proseSections).map((row) => ({ heading: asString(row.heading), paragraphs: asStringArray(row.paragraphs) }))
      : [
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
        ];
    const downloadsPanel = asRecord(payload.downloadsPanel);
    const downloadsLinks = asObjectArray(downloadsPanel.links).length
      ? asObjectArray(downloadsPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "2025 年度工作报告 PDF", href: "#" },
          { label: "经审计财务报表", href: "#" },
          { label: "Form 990（历年）", href: "#" },
          { label: "统计方法说明", href: "/about/numbers" },
          { label: "安全事件档案", href: "#" },
          { label: "隐私与数据保护", href: "/services/privacy" },
          { label: "服务条款", href: "#" }
        ];
    const thirdPartyPanel = asRecord(payload.thirdPartyPanel);
    const thirdPartyLinks = asObjectArray(thirdPartyPanel.links).length
      ? asObjectArray(thirdPartyPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "Candid 透明度认证", href: "#" },
          { label: "Charity Navigator", href: "#" },
          { label: "IRS 免税组织查询", href: "#" }
        ];

    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={asString(payload.title, "我们如何被检验")}
          subtitle={asString(
            payload.subtitle,
            "财务报表经独立会计师事务所审计，Form 990 依法公开。治理结构与统计方法全部公开。针对本机构的威胁与攻击同样公开记录。"
          )}
        />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="acct">
              {summaryCells.map((cell) => (
                <div key={`${cell.title}-${cell.value}`} className="acct-cell">
                  <h4>{cell.title}</h4>
                  {cell.value ? <p className="val">{cell.value}</p> : null}
                  {cell.bars.length > 0 ? (
                    <div className="bars">
                      {cell.bars.map((bar) => (
                        <div key={`${bar.text}-${bar.width}`} className="bar">
                          <i className={bar.tone === "b2" ? "b2" : bar.tone === "b3" ? "b3" : undefined} style={{ width: bar.width }} />
                          {bar.text}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {cell.body ? <p>{cell.body}</p> : null}
                </div>
              ))}
            </div>
            <div className="acct-links">
              {summaryLinks.map((row) => (
                <a key={`${row.label}-${row.href}`} className="pill" href={row.href}>
                  {row.label}
                </a>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ padding: "52px 0 96px" }}>
          <div className="wrap cols">
            <div>
              <div className="prose" style={{ fontSize: 16 }}>
                {proseSections.map((row) => (
                  <div key={row.heading}>
                    <h2>{row.heading}</h2>
                    {row.paragraphs.map((text) => (
                      <p key={`${row.heading}-${text}`}>{text}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(downloadsPanel.title, "下载与查阅")}</h4>
                <ul>
                  {downloadsLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(thirdPartyPanel.title, "第三方认证")}</h4>
                <ul>
                  {thirdPartyLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "about" && slug === "team") {
    const boardPanel = asRecord(payload.boardPanel);
    const boardPeople = asObjectArray(boardPanel.people).length
      ? asObjectArray(boardPanel.people).map((row) => ({
          name: asString(row.name),
          roleLine1: asString(row.roleLine1),
          roleLine2: asString(row.roleLine2),
          image: asString(row.image)
        }))
      : [
          { name: "姓名占位", roleLine1: "理事长", roleLine2: "2005 年起", image: "https://www.tuidang.org/wp-content/uploads/2020/08/cyl.png" },
          { name: "姓名占位", roleLine1: "理事", roleLine2: "法律与合规", image: "https://www.tuidang.org/wp-content/uploads/2020/08/hfj.png" },
          { name: "姓名占位", roleLine1: "理事", roleLine2: "财务", image: "https://www.tuidang.org/wp-content/uploads/2020/08/HGS.png" }
        ];
    const staffPanel = asRecord(payload.staffPanel);
    // No placeholder fallback: the roster is shared with the 团队 block on
    // /about, which supplies one list. An empty staff panel means "there is no
    // second group", so the section is dropped rather than filled with invented
    // people -- see withSharedTeam in public-content.ts.
    const staffPeople = asObjectArray(staffPanel.people).map((row) => ({
      name: asString(row.name),
      roleLine1: asString(row.roleLine1),
      roleLine2: asString(row.roleLine2),
      image: asString(row.image)
    }));
    const notePanel = asRecord(payload.notePanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).length
      ? asObjectArray(relatedPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
      : [
          { label: "公开与问责", href: "/about/accountability" },
          { label: "历史沿革", href: "/about/history" },
          { label: "联系我们", href: "/services/contact" }
        ];
    const joinPanel = asRecord(payload.joinPanel);

    return (
      <>
        <InteriorHead section={section} slug={slug} title={asString(payload.title, "负责的人")} subtitle={asString(payload.subtitle)} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <p className="eyebrow">{asString(boardPanel.eyebrow, "理事会")}</p>
              <h2 className="h2" style={{ fontSize: 24, marginBottom: 30 }}>
                {asString(boardPanel.heading, "Board of Directors")}
              </h2>
              <div className="people" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                {boardPeople.map((row) => (
                  <div key={`${row.name}-${row.roleLine1}-${row.roleLine2}`} className="person">
                    <img src={row.image} alt="" />
                    <b>{row.name}</b>
                    <span>
                      {row.roleLine1}
                      {row.roleLine2 ? (
                        <>
                          <br />
                          {row.roleLine2}
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              {staffPeople.length > 0 ? (
                <>
              <p className="eyebrow" style={{ marginTop: 52 }}>
                {asString(staffPanel.eyebrow, "执行团队")}
              </p>
              <h2 className="h2" style={{ fontSize: 24, marginBottom: 30 }}>
                {asString(staffPanel.heading, "Staff")}
              </h2>
              <div className="people" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
                {staffPeople.map((row) => (
                  <div key={`${row.name}-${row.roleLine1}-${row.roleLine2}`} className="person">
                    <img src={row.image} alt="" />
                    <b>{row.name}</b>
                    <span>
                      {row.roleLine1}
                      {row.roleLine2 ? (
                        <>
                          <br />
                          {row.roleLine2}
                        </>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
                </>
              ) : null}
              <div className="prose" style={{ fontSize: 16, marginTop: 48 }}>
                <h2>{asString(notePanel.heading, "关于姓名与照片")}</h2>
                <p>{asString(notePanel.body, "公开领导层姓名是国际 NGO 的通行做法，也是本站问责承诺的一部分。但部分同事及其在中国大陆的家人可能因此承担风险，因此个别人员以职务代替姓名列出，并在此说明原因。")}</p>
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {relatedLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(joinPanel.title, "加入我们")}</h4>
                <p>{asString(joinPanel.body, "绝大部分工作由志愿者完成。时间多少不限。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(joinPanel.buttonHref, "/involve/volunteer")}>
                  {asString(joinPanel.buttonLabel, "成为义工")}
                </a>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "involve" && slug === "index") {
    const involveTitleRaw = asString(payload.title);
    const fallback = involveDefaults("involve", "index");
    /** The CMS value, or the shared default if this entry predates the move. */
    const block = (key: string) => asRecord(payload[key] ?? fallback[key]);
    const list = (value: unknown, key: string) => blockRows(value, fallback[key]);

    const donate = block("donatePanel");
    const donateHref = asString(donate.buttonHref, EXTERNAL_SERVICES.donation);
    const spend = block("donateStats");
    const spendCells = list(spend.items, "donateStats");
    const funds = block("useOfFunds");
    const fundItems = asStringArray(funds.items, []);
    const otherWays = block("otherDonationWays");
    const band = block("volunteerBand");
    const bandLinks = asObjectArray(band.links);
    const petition = block("endccpBlock");
    const petitionButtons = asObjectArray(petition.buttons);
    const storiesHead = block("storiesHeading");
    const actCards = list(payload.actCards, "actCards");

    /**
     * 义工故事 cards, from the CMS.
     *
     * Each one must carry an href. A card with no link is what this section used
     * to be -- three invented stories a reader could not click, under a heading
     * promising more -- and a card describing one article while linking to
     * another is worse still. Anything without both a title and a destination is
     * dropped rather than rendered as dead text.
     */
    const storyCards = asObjectArray(payload.stories)
      .map((row) => ({
        tag: asString(row.tag),
        title: asString(row.title),
        body: asString(row.body),
        foot: asString(row.foot),
        href: asString(row.href)
      }))
      .filter((row) => row.title && row.href);
    const involveTitle = !involveTitleRaw || involveTitleRaw === "让服务点能一直开着。" ? "让服务点 能一直开着。" : involveTitleRaw;
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={involveTitle}
          subtitle={asString(payload.subtitle)}
          slim={false}
        />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <div className="form">
                <p className="eyebrow" style={{ marginBottom: 14 }}>
                  {asString(donate.eyebrow)}
                </p>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: 30, margin: "0 0 14px" }}>
                  {asString(donate.title)}
                </h2>
                <div
                  className="prose"
                  style={{ lineHeight: "var(--lh-body)", color: "var(--muted)", marginBottom: 26 }}
                >
                  <CmsMarkdown value={donate.body} />
                </div>
                <a className="btn btn--seal" href={donateHref} {...externalLinkProps(donateHref)}>
                  <span className="stamp">退</span>
                  {asString(donate.buttonLabel, "前往捐助")}
                </a>
                {asString(donate.footnote) ? (
                  <p
                    style={{
                      fontSize: 13,
                      color: "var(--muted)",
                      marginTop: 26,
                      paddingTop: 16,
                      borderTop: "1px solid var(--rule)",
                      lineHeight: "var(--lh-body)"
                    }}
                  >
                    {asString(donate.footnote)}
                  </p>
                ) : null}
              </div>
              {spendCells.length > 0 ? (
                <div className="stat4" style={{ marginTop: 34 }}>
                  {spendCells.map((cell, index) => (
                    <div key={asString(cell.label) || index}>
                      <b>{asString(cell.value)}</b>
                      <span>{asString(cell.label)}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              <div
                className="prose"
                style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 16, lineHeight: "var(--lh-body)" }}
              >
                <CmsMarkdown value={spend.note} />
              </div>
            </div>
            <aside className="side">
              {fundItems.length > 0 ? (
                <div className="panel">
                  <h4>{asString(funds.title)}</h4>
                  <ul>
                    {fundItems.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <LinkPanel title={asString(otherWays.title)} links={asObjectArray(otherWays.links)} />
            </aside>
          </div>
        </section>

        <section className="sec sec--ink" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow eyebrow--onink">{asString(band.eyebrow)}</p>
                <h2 className="h2" style={{ color: "var(--paper)" }}>
                  {asString(band.title)}
                </h2>
                {asString(band.lede) ? (
                  <p className="lede" style={{ color: "var(--lav-lt)" }}>
                    {asString(band.lede)}
                  </p>
                ) : null}
              </div>
              {asString(band.moreLabel) ? (
                <a className="more" href={asString(band.moreHref, "/involve/volunteer")} style={{ color: "var(--gold-lt)" }}>
                  {asString(band.moreLabel)}
                </a>
              ) : null}
            </div>
            <div className="cities" style={{ gridTemplateColumns: "repeat(3,1fr)", gap: "0 32px" }}>
              {bandLinks.map((row, index) => (
                <div key={asString(row.label) || index}>
                  <a href={asString(row.href, "/involve/volunteer")} style={{ color: "var(--lav-lt)" }}>
                    {asString(row.label)} →
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <p className="eyebrow">{asString(petition.eyebrow)}</p>
              <h2 className="h2">{asString(petition.title)}</h2>
              <div className="prose" style={{ fontSize: 16 }}>
                <CmsMarkdown value={petition.body} />
              </div>
              {petitionButtons.length > 0 ? (
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 28 }}>
                  {petitionButtons.map((row, index) => (
                    <a
                      key={asString(row.label) || index}
                      className={index === 0 ? "btn btn--seal" : "btn btn--line"}
                      href={asString(row.href, "/")}
                    >
                      {asString(row.label)}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(petition.progressTitle)}</h4>
                <p style={{ fontFamily: "var(--mono)", fontSize: 30, color: "var(--seal)", margin: "0 0 6px", letterSpacing: "-.01em" }}>
                  {asString(petition.progressValue)}
                </p>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", margin: 0, lineHeight: "var(--lh-body)" }}>
                  {asString(petition.progressNote)}
                </p>
              </div>
            </aside>
          </div>
        </section>

        {storyCards.length > 0 ? (
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="sec-head">
              <div>
                <p className="eyebrow">{asString(storiesHead.eyebrow)}</p>
                <h2 className="h2">{asString(storiesHead.title)}</h2>
              </div>
              {asString(storiesHead.moreLabel) ? (
                <a className="more" href={asString(storiesHead.moreHref, "/involve/stories")}>
                  {asString(storiesHead.moreLabel)}
                </a>
              ) : null}
            </div>
            {/* Driven by the CMS. These three cards were written into the
                template -- invented volunteer stories with invented running
                times, and no link on any of them, because there was nothing to
                link to. Editors fill `stories` from 内容管理; each entry points
                at a real article. */}
            <div className="cards3">
              {storyCards.map((card, index) => (
                /* The anchor is the card, not something inside it: with
                   `display: contents` the link has no box of its own, so only
                   the words were clickable and the rest of the card -- most of
                   its area -- did nothing. Same shape as `.act a`. */
                <a className="card card--link" href={card.href} key={card.href || index}>
                  {card.tag ? <p className="card-tag">{card.tag}</p> : null}
                  <h3>{card.title}</h3>
                  {card.body ? <p>{card.body}</p> : null}
                  {card.foot ? <p className="card-foot">{card.foot}</p> : null}
                </a>
              ))}
            </div>
          </div>
        </section>
        ) : null}

        <ActCards rows={actCards} />
      </>
    );
  }

  if (section === "involve" && slug === "endccp") {
    const fallback = involveDefaults("involve", "endccp");
    const block = (key: string) => asRecord(payload[key] ?? fallback[key]);
    const statCells = blockRows(payload.stats, fallback.stats);
    const intro = block("intro");
    // `actionsTitle` + `items` were two loose top-level keys; they are one
    // block now, so the heading and the list it heads are edited together.
    const actions = asRecord(payload.actions ?? fallback.actions);
    const actionRows = asObjectArray(actions.items ?? payload.items).map((row) => ({
      slug: asString(row.slug),
      href: asString(row.href),
      image: asString(row.image),
      title: asString(row.title),
      summary: asString(row.summary),
      date: asString(row.date),
      tag: asString(row.tag)
    }));
    const actionPager = asStringArray(payload.pager, []);
    const sign = block("signPanel");
    const related = block("relatedPanel");
    return (
      <>
        <InteriorHead section={section} slug={slug} title={asString(payload.title, "打倒中共恶魔（End CCP）征签")} subtitle={asString(payload.subtitle)} />
        <InteriorTabs section={section} slug={slug} />
        {statCells.length > 0 ? (
          <section className="sec" style={{ paddingTop: 52 }}>
            <div className="wrap">
              <div className="stat4">
                {statCells.map((cell, index) => (
                  <div key={asString(cell.label) || index}>
                    <b>{asString(cell.value)}</b>
                    <span>{asString(cell.label)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        ) : null}
        <section className="sec" style={{ padding: "52px 0 96px" }}>
          <div className="wrap cols">
            <div>
              <div className="prose" style={{ fontSize: 16, marginTop: 40 }}>
                <CmsMarkdown value={intro.body} />
              </div>
              {actionRows.length > 0 ? (
                <>
                  <div className="prose" style={{ fontSize: 16, marginTop: 40 }}>
                    <h2>{asString(actions.title, "历次行动")}</h2>
                  </div>
                  <div className="arch" style={{ marginTop: 24 }}>
                    {actionRows.map((row, index) => (
                      <article
                        className="arow"
                        key={row.slug || row.title || index}
                        style={index === 0 ? { paddingTop: 0 } : undefined}
                      >
                        <a
                          href={resolveNewsArticleHref({
                            href: row.href,
                            slug: row.slug,
                            title: row.title
                          })}
                          style={{ display: "contents" }}
                        >
                          {row.image ? <img src={row.image} alt="" /> : null}
                          <div>
                            {row.tag ? <span className="tag">{row.tag}</span> : null}
                            <h3>{row.title}</h3>
                            {row.summary ? <p>{row.summary}</p> : null}
                            {row.date ? <p className="meta">{row.date}</p> : null}
                          </div>
                        </a>
                      </article>
                    ))}
                  </div>
                  {actionPager.length > 0 ? (
                    <nav className="pager">
                      {actionPager.map((item, index) => (
                        <a key={item} className={index === 0 ? "on" : ""} href="#">
                          {item}
                        </a>
                      ))}
                    </nav>
                  ) : null}
                </>
              ) : null}
            </div>
            <aside className="side">
              {/* The signing form lives on endccp.com, not here. Editable in
                  the CMS so the address can move without a deploy. */}
              <CtaPanel panel={sign} fallbackHref="https://endccp.com/" />
              <LinkPanel title={asString(related.title, "相关")} links={asObjectArray(related.links)} />
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "involve" && slug === "other-ways") {
    const fallback = involveDefaults("involve", "other-ways");
    const block = (key: string) => asRecord(payload[key] ?? fallback[key]);
    const actCards = blockRows(payload.actCards, fallback.actCards);
    const intro = block("intro");
    const donate = block("donatePanel");
    const related = block("relatedPanel");
    return (
      <>
        <InteriorHead section={section} slug={slug} title={asString(payload.title, "不捐款也能支持")} subtitle={asString(payload.subtitle)} />
        <InteriorTabs section={section} slug={slug} />
        <ActCards rows={actCards} />
        <section className="sec" style={{ padding: "52px 0 96px" }}>
          <div className="wrap cols">
            <div>
              <div className="prose" style={{ fontSize: 16, marginTop: 40 }}>
                <CmsMarkdown value={intro.body} />
              </div>
            </div>
            <aside className="side">
              <CtaPanel panel={donate} fallbackHref="/involve" />
              <LinkPanel title={asString(related.title, "相关")} links={asObjectArray(related.links)} />
            </aside>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <InteriorHead
        section={section}
        slug={slug}
        title={asString(payload.title, title)}
        subtitle={asString(payload.subtitle, "栏目内容采用可配置区块，支持多语言按需重排。")}
        slim={false}
      />
      <section className="sec">
        <div className="wrap cols">
          <article>
            <div className="cards3">
              {(asObjectArray(payload.cards).length > 0
                ? asObjectArray(payload.cards).map((row) => ({
                    tag: asString(row.tag),
                    title: asString(row.title),
                    body: asString(row.body)
                  }))
                : [
                    {
                      tag: "内容",
                      title: "区块可增删排序",
                      body: "模块化内容块支持在 CMS 中按栏目自由组合、调整顺序与开关展示。"
                    },
                    {
                      tag: "流程",
                      title: "可区分草稿与发布状态",
                      body: "每个区块都可按草稿、审校、发布流程管理并保留操作审计记录。"
                    },
                    {
                      tag: "版本",
                      title: "支持审校流程与版本回滚",
                      body: "对关键内容支持修订快照，便于校对、复核与历史版本追溯。"
                    }
                  ]
              ).map((card) => (
                <article key={card.title} className="card">
                  <p className="card-tag">{card.tag}</p>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                </article>
              ))}
            </div>
          </article>
          <aside className="side">
            <section className="panel">
              <h4>栏目操作</h4>
              <ul>
                <li>
                  <Link href="/admin/content">在 CMS 中编辑此页</Link>
                </li>
                <li>
                  <Link href="/admin/content">管理页面目录</Link>
                </li>
                <li>
                  <Link href="/admin/revisions">查看修订历史</Link>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
