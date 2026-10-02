import {
  EXTERNAL_DOCS,
  EXTERNAL_LINK_PROPS,
  EXTERNAL_SERVICES,
  externalLinkProps
} from "@/lib/external-services";
import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";

export function LongFormTemplate({ title, section, slug, content }: TemplatePageData) {
  const payload = asRecord(content);

  if (section === "services" && slug === "faq") {
    const heading = asString(payload.title, "三退问答");
    const subtitle = asString(payload.subtitle, "关于声明、证明与安全的常见问题。");
    const filters = asStringArray(payload.filters, ["全部", "关于声明", "关于证明", "安全与隐私", "移民相关"]);
    const faqs = asObjectArray(payload.faqs).map((row) => ({
      question: asString(row.question),
      answer: asString(row.answer),
      // Optional pointer to the authoritative answer on tuidang.org.
      sourceHref: asString(row.sourceHref)
    }));
    const readyPanel = asRecord(payload.readyPanel);
    const linksPanel = asRecord(payload.linksPanel);
    const links = asObjectArray(linksPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols cols--narrow">
            <div>
              <div className="filters">
                {filters.map((label, index) => (
                  <a key={label} className={index === 0 ? "chip on" : "chip"} href="#">
                    {label}
                  </a>
                ))}
              </div>
              <div className="faq">
                {(faqs.length > 0
                  ? faqs
                  : [
                      {
                        question: "什么是三退？",
                        answer: "三退指公开声明退出中共的党、团、队三个组织。",
                        sourceHref: EXTERNAL_DOCS.whatIsTuidang
                      },
                      {
                        question: "三退声明要收费吗？",
                        answer: "三退声明完全免费，可以使用化名，无需注册。",
                        sourceHref: EXTERNAL_DOCS.howToTuidang
                      },
                      {
                        question: "退党证明要收费吗？",
                        answer:
                          "退党证明与三退声明不同，办理需缴纳办理／管理费用，且为实名办理，需本人申请。具体收费标准与流程以办理页面说明为准。",
                        sourceHref: EXTERNAL_DOCS.howToApplyCert
                      }
                    ]
                ).map((item) => (
                  <details key={item.question}>
                    <summary>{item.question}</summary>
                    <div className="ans">
                      <p>{item.answer}</p>
                      {item.sourceHref ? (
                        <p style={{ marginBottom: 0 }}>
                          <a href={item.sourceHref} {...EXTERNAL_LINK_PROPS}>
                            在 tuidang.org 阅读完整解答 →
                          </a>
                        </p>
                      ) : null}
                    </div>
                  </details>
                ))}
              </div>
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>{asString(readyPanel.title, "准备好了？")}</h4>
                <p>{asString(readyPanel.body, "登记一份声明约需三分钟，可以完全匿名，全程免费。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(readyPanel.buttonHref, "/services/declare")}>
                  <span className="stamp">{asString(readyPanel.buttonStamp, "退")}</span>
                  {asString(readyPanel.buttonLabel, "我要三退")}
                </a>
              </div>
              <div className="panel">
                <h4>完整问答</h4>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: "var(--lh-body)", marginTop: 0 }}>
                  以下解答由 tuidang.org 维护，为准。
                </p>
                <ul>
                  {[
                    { label: "什么是三退？", href: EXTERNAL_DOCS.whatIsTuidang },
                    { label: "为什么要三退？", href: EXTERNAL_DOCS.whyTuidang },
                    { label: "如何三退？", href: EXTERNAL_DOCS.howToTuidang },
                    { label: "多年不交党费算自动退党吗？", href: EXTERNAL_DOCS.unpaidDuesNotAutoQuit },
                    { label: "什么是退党证明？", href: EXTERNAL_DOCS.whatIsCert },
                    { label: "如何办理退党证明？", href: EXTERNAL_DOCS.howToApplyCert },
                    { label: "如何查验证明真伪？", href: EXTERNAL_DOCS.howToVerifyCert },
                    { label: "全部常见问题 →", href: EXTERNAL_SERVICES.faqHub }
                  ].map((row) => (
                    <li key={row.href}>
                      <a href={row.href} {...EXTERNAL_LINK_PROPS}>
                        {row.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(linksPanel.title, "还有问题")}</h4>
                <ul>
                  {(links.length > 0
                    ? links
                    : [
                        { label: "安全与隐私说明", href: "/services/privacy" },
                        { label: "移民相关政策", href: "/services" },
                        { label: "查找服务点", href: "/about/network" },
                        { label: "联系我们", href: "/services/contact" }
                      ]
                  ).map((row) => (
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

  if (section === "services" && slug === "privacy") {
    const headingRaw = asString(payload.title);
    const heading = !headingRaw || headingRaw === "安全与隐私" ? "安全与隐私说明" : headingRaw;
    const subtitle = asString(payload.subtitle, "说明我们收集什么、不收集什么，以及风险主要在哪里。");
    const alertPanel = asRecord(payload.alertPanel);
    const sections = asObjectArray(payload.sections).map((row) => ({ heading: asString(row.heading), body: asString(row.body) }));
    const highlightsPanel = asRecord(payload.highlightsPanel);
    const linksPanel = asRecord(payload.linksPanel);
    const links = asObjectArray(linksPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    const toolsPanel = asRecord(payload.toolsPanel);
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={heading}
          subtitle={subtitle}
        />
        <section className="sec" style={{ padding: "52px 0 96px" }}>
          <div className="wrap cols cols--narrow">
            <div>
              <div className="notice">
                <b>{asString(alertPanel.title, "先说最重要的一句")}</b>
                {asString(alertPanel.body, "没有任何网站或工具能保证绝对安全。我们会把做法与边界完整说明，由你自己判断。")}
              </div>
              <div className="prose" style={{ fontSize: 16 }}>
                {(sections.length > 0
                  ? sections
                  : [
                      { heading: "我们不收集什么", body: "不需要真实姓名、身份证件、住址或其他可对应个人的敏感信息。" },
                      { heading: "我们收集什么", body: "仅收集署名、选填地区、声明正文与提交时间。" },
                      { heading: "真正风险在哪里", body: "风险常在网络连接与本地设备痕迹，而不是声明表单本身。" }
                    ]
                ).map((row) => (
                  <div key={`${row.heading}-${row.body}`}>
                    <h2>{row.heading}</h2>
                    <p>{row.body}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(highlightsPanel.title, "本页要点")}</h4>
                <ul>
                  {asStringArray(highlightsPanel.items, ["不需要身份证件", "可以完全匿名", "数据不出售不转让", "无广告追踪"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(toolsPanel.title, "受限网络下访问")}</h4>
                <p>{asString(toolsPanel.body, "若你身在网络受管控的地区，请先看访问方式说明，再决定如何访问本站。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(toolsPanel.buttonHref, "/resources/tools")}>
                  {asString(toolsPanel.buttonLabel, "免翻墙链接")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(linksPanel.title, "相关")}</h4>
                <ul>
                  {(links.length > 0
                    ? links
                    : [
                        { label: "三退是否安全", href: "/services/faq" },
                        { label: "在线声明", href: "/services/declare" },
                        { label: "信息变更", href: "/services/contact" },
                        { label: "公开与问责", href: "/about/accountability" }
                      ]
                  ).map((row) => (
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

  if (section === "services" && slug === "immigration") {
    const headingRaw = asString(payload.title);
    const heading = !headingRaw || headingRaw === "移民相关政策" ? "移民相关政策与问题" : headingRaw;
    const subtitle = asString(payload.subtitle, "公开政策文件梳理与个案报导汇编，仅供了解背景。");
    const alertPanel = asRecord(payload.alertPanel);
    const policySection = asRecord(payload.policySection);
    const policyItems = asObjectArray(policySection.items).map((row) => ({
      tag: asString(row.tag),
      title: asString(row.title),
      body: asString(row.body),
      // Authoritative copy of the policy summary on tuidang.org.
      href: asString(row.href)
    }));
    const reportSection = asRecord(payload.reportSection);
    const reportItems = asObjectArray(reportSection.items).map((row) => ({
      href: asString(row.href, "/news/article"),
      image: asString(row.image),
      tag: asString(row.tag),
      title: asString(row.title),
      summary: asString(row.summary),
      meta: asString(row.meta)
    }));
    const pager = asStringArray(payload.pager, ["1", "2", "3", "下一页 →"]);
    const proofPanel = asRecord(payload.proofPanel);
    const countriesPanel = asRecord(payload.countriesPanel);
    const reminderPanel = asRecord(payload.reminderPanel);
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={heading}
          subtitle={subtitle}
        />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <div className="notice">
                <b>{asString(alertPanel.title, "本页不是法律意见")}</b>
                {asString(alertPanel.body, "各国政策变化快，个案差异大；涉及具体申请请咨询有执照律师。")}
              </div>
              <p className="eyebrow" style={{ marginTop: 40 }}>
                {asString(policySection.eyebrow, "政策文件")}
              </p>
              <h2 className="h2" style={{ marginBottom: 26, fontSize: 26 }}>
                {asString(policySection.title, "美国移民局（USCIS）相关规定")}
              </h2>
              <div className="arch">
                {(policyItems.length > 0
                  ? policyItems
                  : [
                      {
                        tag: "政策文件",
                        title: "美国移民局 USCIS 关于共产党员的移民态度",
                        body: "适用范围与例外情形的公开梳理。",
                        href: EXTERNAL_DOCS.uscisAttitude
                      },
                      {
                        tag: "政策文件",
                        title: "USCIS 关于共产党员及其组织成员移民申请的酌情考量",
                        body: "在什么情况下可以主张豁免，审查官会考量哪些因素。",
                        href: EXTERNAL_DOCS.uscisDiscretion
                      },
                      {
                        tag: "政策文件",
                        title: "共产党员移民美国，需主动提供退党证明",
                        body: "申请时应主动提交的材料说明。",
                        href: EXTERNAL_DOCS.mustProvideCert
                      },
                      {
                        tag: "政策文件",
                        title: "美国非移民签证也会被问及是否加入了共产党组织",
                        body: "非移民签证面谈中的相关问题。",
                        href: EXTERNAL_DOCS.nonImmigrantVisas
                      },
                      {
                        tag: "政策文件",
                        title: "已经入籍美国也可能因为是共产党成员被驱逐出境",
                        body: "入籍后仍存在的风险说明。",
                        href: EXTERNAL_DOCS.denaturalizationRisk
                      },
                      {
                        tag: "问答",
                        title: "为什么出国人员应尽早办理退党证明",
                        body: "时间点的重要性与临时补办常见问题。",
                        href: EXTERNAL_DOCS.applyEarlyIfEmigrating
                      }
                    ]
                ).map((item, index) => (
                  <article key={`${item.tag}-${item.title}`} className="arow" style={{ gridTemplateColumns: "1fr", paddingTop: index === 0 ? 0 : undefined }}>
                    <div>
                      <span className="tag">{item.tag}</span>
                      <h3>
                        {item.href ? (
                          <a href={item.href} {...EXTERNAL_LINK_PROPS}>
                            {item.title}
                          </a>
                        ) : (
                          item.title
                        )}
                      </h3>
                      <p>{item.body}</p>
                    </div>
                  </article>
                ))}
              </div>
              <p className="eyebrow" style={{ marginTop: 56 }}>
                {asString(reportSection.eyebrow, "相关报导")}
              </p>
              <h2 className="h2" style={{ marginBottom: 26, fontSize: 26 }}>
                {asString(reportSection.title, "议会行动与个案报导")}
              </h2>
              <div className="arch">
                {(reportItems.length > 0
                  ? reportItems
                  : [
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
                ).map((item, index) => (
                  <article key={`${item.title}-${item.meta}`} className="arow" style={index === 0 ? { paddingTop: 0 } : undefined}>
                    <a href={item.href} style={{ display: "contents" }}>
                      {/* Empty src makes the browser re-request the page; the
                          placeholder keeps the .arow grid's first column. */}
                      {item.image ? <img src={item.image} alt="" /> : <span />}
                      <div>
                        <span className="tag">{item.tag}</span>
                        <h3>{item.title}</h3>
                        <p>{item.summary}</p>
                        <p className="meta">{item.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
              <nav className="pager">
                {pager.map((label, index) => (
                  <a key={`${label}-${index}`} className={index === 0 ? "on" : undefined} href="#">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
            <aside className="side">
              {/* Always rendered, independent of CMS content, so the
                  authoritative policy sources are reachable even when the
                  stored items carry no links of their own. */}
              <div className="panel">
                <h4>政策原文</h4>
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: "var(--lh-body)", marginTop: 0 }}>
                  以下说明由 tuidang.org 维护，为准。
                </p>
                <ul>
                  {[
                    { label: "美国移民局 USCIS 关于共产党员的移民态度", href: EXTERNAL_DOCS.uscisAttitude },
                    { label: "USCIS 关于移民申请的酌情考量", href: EXTERNAL_DOCS.uscisDiscretion },
                    { label: "共产党员移民美国，需主动提供退党证明", href: EXTERNAL_DOCS.mustProvideCert },
                    { label: "非移民签证也会被问及党组织成员身份", href: EXTERNAL_DOCS.nonImmigrantVisas },
                    { label: "已入籍也可能因党员身份被驱逐出境", href: EXTERNAL_DOCS.denaturalizationRisk },
                    { label: "为什么应尽早办理退党证明", href: EXTERNAL_DOCS.applyEarlyIfEmigrating }
                  ].map((row) => (
                    <li key={row.href}>
                      <a href={row.href} {...EXTERNAL_LINK_PROPS}>
                        {row.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(proofPanel.title, "需要一份凭据？")}</h4>
                <p>{asString(proofPanel.body, "退党证明为实名办理的中英文对照文件，附公开查验入口。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(proofPanel.buttonHref, "/services/cert")}>
                  {asString(proofPanel.buttonLabel, "了解证明办理")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(countriesPanel.title, "其他国家")}</h4>
                <ul>
                  {asStringArray(countriesPanel.items, ["加拿大", "澳大利亚与新西兰", "欧洲各国", "日本与韩国"]).map((item) => (
                    <li key={item}>
                      <a href="#">{item}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(reminderPanel.title, "提醒")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: 0 }}>
                  {asString(
                    reminderPanel.body,
                    "本中心不代办移民手续，也不与任何移民中介合作。退党证明只通过本中心的官方渠道办理，请勿相信任何自称可以代办、加急或包过的机构与个人。"
                  )}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "resources" && slug === "tools") {
    const resolveResourceHref = (href: string, fallback: string) => {
      const raw = href.trim();
      return raw && raw !== "#" ? raw : fallback;
    };
    // The canonical circumvention-tool list is maintained on tuidang.org, so
    // anything without its own href points there rather than circling back to
    // this page.
    const accessFallbackHref = (title: string) => {
      if (title.includes("邮件")) return "/services/contact?topic=subscribe";
      return EXTERNAL_SERVICES.circumventionTools;
    };
    const relatedFallbackHref = (label: string) => {
      if (label.includes("声明")) return "/services/declare";
      if (label.includes("安全")) return "/services/faq";
      if (label.includes("下载")) return "/resources/downloads";
      if (label.includes("联系")) return "/services/contact";
      return EXTERNAL_SERVICES.circumventionTools;
    };
    const heading = asString(payload.title, "免翻墙链接");
    const subtitle = asString(payload.subtitle, "在受限网络环境下访问本站与三退内容的几种方式。请先评估你所处环境，再决定使用哪一种。");
    const noticePanel = asRecord(payload.noticePanel);
    const accessCards = asObjectArray(payload.accessCards).length
      ? asObjectArray(payload.accessCards).map((row) => ({
          kicker: asString(row.kicker),
          title: asString(row.title),
          body: asString(row.body),
          buttonLabel: asString(row.buttonLabel),
          href: resolveResourceHref(asString(row.href, "#"), accessFallbackHref(asString(row.title))),
          buttonVariant: asString(row.buttonVariant, "line")
        }))
      : [
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
        ];
    const guideSections = asObjectArray(payload.guideSections).length
      ? asObjectArray(payload.guideSections).map((row) => ({
          heading: asString(row.heading),
          paragraphs: asStringArray(row.paragraphs)
        }))
      : [
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
        ];
    const safetyPanel = asRecord(payload.safetyPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).length
      ? asObjectArray(relatedPanel.links).map((row) => ({
          label: asString(row.label),
          href: resolveResourceHref(asString(row.href, "#"), relatedFallbackHref(asString(row.label)))
        }))
      : [
          { label: "在线声明三退", href: "/services/declare" },
          { label: "三退是否安全", href: "/services/faq" },
          { label: "资料下载", href: "/resources/downloads" },
          { label: "联系我们", href: "/services/contact" }
        ];
    const reminderPanel = asRecord(payload.reminderPanel);
    return (
      <>
        <InteriorHead
          section={section}
          slug={slug}
          title={heading}
          subtitle={subtitle}
        />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap">
            <div className="notice">
              <b>{asString(noticePanel.title, "使用前请先评估处境")}</b>
              {asString(noticePanel.body, "没有任何工具能保证绝对安全。若不确定设备安全性，请避免留下可识别痕迹。")}
            </div>
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 40 }}>
          <div className="wrap">
            <div className="acc">
              {accessCards.map((card) => (
                <article key={card.title} className="acard">
                  <p className="k">{card.kicker}</p>
                  <h3>{card.title}</h3>
                  <p>{card.body}</p>
                  <a
                    className={`btn btn--sm go ${card.buttonVariant === "seal" ? "btn--seal" : "btn--line"}`}
                    href={card.href}
                    {...externalLinkProps(card.href)}
                  >
                    {card.buttonLabel}
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <div className="prose" style={{ fontSize: 16 }}>
                {guideSections.map((entry) => (
                  <div key={entry.heading}>
                    <h2>{entry.heading}</h2>
                    {entry.paragraphs.map((paragraph) => (
                      <p key={`${entry.heading}-${paragraph}`}>{paragraph}</p>
                    ))}
                  </div>
                ))}
              </div>
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>{asString(safetyPanel.title, "你的安全")}</h4>
                <p>{asString(safetyPanel.body, "我们不要求身份证件，也不记录可识别你身份的信息。完整说明见安全与隐私页。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(safetyPanel.buttonHref, "/services/privacy")}>
                  {asString(safetyPanel.buttonLabel, "安全与隐私说明")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {relatedLinks.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} {...externalLinkProps(link.href)}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(reminderPanel.title, "提醒")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: 0 }}>
                  {asString(
                    reminderPanel.body,
                    "本中心从不通过任何工具索取你的身份证件、银行信息或密码。若有页面向你索取这些，那不是我们的站点。"
                  )}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "about" && slug === "numbers") {
    const statsRaw = asObjectArray(payload.stats);
    const stats =
      statsRaw.length > 0
        ? statsRaw.map((row) => ({ value: asString(row.value), label: asString(row.label) }))
        : [
            { value: "464,375,383", label: "累计声明人数" },
            { value: "38,403", label: "日均新增" },
            { value: "每 10 分钟", label: "更新频率" },
            { value: "2005-01", label: "登记起始" }
          ];

    const sectionsRaw = asObjectArray(payload.sections);
    const sections =
      sectionsRaw.length > 0
        ? sectionsRaw.map((row) => ({
            heading: asString(row.heading),
            paragraphs: asObjectArray(row.paragraphs).length > 0 ? asObjectArray(row.paragraphs).map((p) => asString(p.text)) : asStringArray(row.paragraphs)
          }))
        : [
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
          ];

    const actionsRaw = asObjectArray(payload.actions);
    const actions =
      actionsRaw.length > 0
        ? actionsRaw.map((row) => ({
            label: asString(row.label),
            href: asString(row.href, "#"),
            variant: asString(row.variant, "seal")
          }))
        : [
            { label: "下载历年数据（CSV）", href: "#", variant: "seal" },
            { label: "年度报告", href: "/about/accountability", variant: "line" }
          ];

    const relatedLinksRaw = asObjectArray(payload.relatedLinks);
    const relatedLinks =
      relatedLinksRaw.length > 0
        ? relatedLinksRaw.map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
        : [
            { label: "公开与问责", href: "/about/accountability" },
            { label: "全球服务网络", href: "/about/network" },
            { label: "年度报告 PDF", href: "#" },
            { label: "研究合作联络", href: "/services/contact" }
          ];

    const citationPanel = asRecord(payload.citationPanel);
    return (
      <>
        <InteriorHead section={section} slug={slug} title={asString(payload.title, "这个数字是怎么统计的")} subtitle={asString(payload.subtitle)} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec sec--ink" style={{ padding: "56px 0" }}>
          <div className="wrap">
            <div className="substats" style={{ borderTop: 0, paddingTop: 0, marginTop: 0, gap: 56 }}>
              {stats.map((row) => (
                <div key={`${row.value}-${row.label}`} className="substat">
                  <b>{row.value}</b>
                  <span>{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div className="prose" style={{ fontSize: 16 }}>
              {sections.map((block) => (
                <div key={block.heading}>
                  <h2>{block.heading}</h2>
                  {block.paragraphs.map((text) => (
                    <p key={`${block.heading}-${text}`}>{text}</p>
                  ))}
                </div>
              ))}
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 32 }}>
                {actions.map((row) => (
                  <a key={`${row.label}-${row.href}`} className={row.variant === "line" ? "btn btn--line" : "btn btn--seal"} href={row.href} {...externalLinkProps(row.href)}>
                    {row.label}
                  </a>
                ))}
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>相关</h4>
                <ul>
                  {relatedLinks.map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href} {...externalLinkProps(row.href)}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(citationPanel.title, "引用")}</h4>
                <p>{asString(citationPanel.body, "是的，可以自由引用。请注明来源与取数日期，因为数字每天都在变。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(citationPanel.href, "/resources/press")}>
                  {asString(citationPanel.label, "媒体资料")}
                </a>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "about" && slug === "history") {
    const timelineRaw = asObjectArray(payload.timeline);
    const timeline =
      timelineRaw.length > 0
        ? timelineRaw.map((row) => ({ date: asString(row.date), body: asString(row.body) }))
        : [
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
          ];

    const relatedLinksRaw = asObjectArray(payload.relatedLinks);
    const relatedLinks =
      relatedLinksRaw.length > 0
        ? relatedLinksRaw.map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }))
        : [
            { label: "年度报告", href: "/about/accountability" },
            { label: "历年数据", href: "/about/numbers" },
            { label: "机构公告与声明", href: "/news" },
            { label: "《九评共产党》全文", href: "/resources" }
          ];
    return (
      <>
        <InteriorHead section={section} slug={slug} title={asString(payload.title, "二〇〇五年至今")} subtitle={asString(payload.subtitle)} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div className="tl">
              {timeline.map((row) => (
                <div key={`${row.date}-${row.body}`} className="tl-item">
                  <b>{row.date}</b>
                  <p>{row.body}</p>
                </div>
              ))}
            </div>
            <aside className="side">
              <div className="panel">
                <h4>相关</h4>
                <ul>
                  {relatedLinks.map((row) => (
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

  return (
    <>
      <InteriorHead
        section={section}
        slug={slug}
        title={asString(payload.title, title)}
        subtitle={asString(payload.subtitle)}
      />
      {section === "services" || section === "resources" ? <InteriorTabs section={section} slug={slug} /> : null}
      <section className="sec">
        <div className="wrap cols cols--narrow">
          <article className="prose">
            {(asObjectArray(payload.sections).length > 0
              ? asObjectArray(payload.sections).map((row) => ({
                  heading: asString(row.heading),
                  body: asString(row.body)
                }))
              : [
                  {
                    heading: "",
                    body: "长文页面适用于问答、政策说明与安全指南，支持结构化章节和修订追踪。"
                  },
                  { heading: "常见段落结构", body: "背景与范围；流程说明；风险提示；公开声明与边界。" }
                ]
            ).map((sectionRow, index) => (
              <div key={`${sectionRow.heading}-${index}`}>
                {sectionRow.heading ? <h2>{sectionRow.heading}</h2> : null}
                <p>{sectionRow.body}</p>
              </div>
            ))}
          </article>
          <aside className="side">
            <section className="panel">
              <h4>目录</h4>
              <ul>
                <li>
                  <a href="#">背景与范围</a>
                </li>
                <li>
                  <a href="#">流程说明</a>
                </li>
                <li>
                  <a href="#">风险提示</a>
                </li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
