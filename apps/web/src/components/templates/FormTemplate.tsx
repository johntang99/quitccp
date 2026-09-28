import { ServiceHandoff } from "@/components/public/ServiceHandoff";
import {
  EXTERNAL_LINK_PROPS,
  EXTERNAL_SERVICES,
  OFFLINE_DECLARE_CHANNELS
} from "@/lib/external-services";
import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";

export function FormTemplate({ title, section, slug, content }: TemplatePageData) {
  const payload = asRecord(content);

  if (section === "services" && slug === "declare") {
    const headingRaw = asString(payload.title, "声明退出中共党、团、队");
    const heading = headingRaw.includes("退出") ? headingRaw : "声明退出中共党、团、队";
    const subtitle = asString(
      payload.subtitle,
      "由你自己填写并提交，我们完整保存原文与提交时间。全程免费，无需注册，可以完全匿名。"
    );
    const safetyNotice = asRecord(payload.safetyNotice);
    const readyPanel = asRecord(payload.readyPanel);
    const readyLinks = asObjectArray(readyPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    const otherWaysPanel = asRecord(payload.otherWaysPanel);
    const otherWaysLinks = asObjectArray(otherWaysPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    const todayPanel = asRecord(payload.todayPanel);
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
          <div className="wrap cols cols--narrow">
            <div>
              <ServiceHandoff
                eyebrow="在线提交"
                heading="到三退网站提交你的声明"
                body="声明由全球退党服务中心的三退网站受理并公开存档。全程免费，无需注册，可以使用化名。"
                destinationNote="链接将在新窗口打开 santui.tuidang.org。这是本中心运营的三退声明网站，界面与本站不同，属于正常情况。"
                actions={[
                  {
                    label: "前往提交三退声明",
                    href: EXTERNAL_SERVICES.declare,
                    primary: true,
                    stamp: "退"
                  },
                  {
                    label: "查询我的声明处理结果",
                    href: EXTERNAL_SERVICES.declareLookup,
                    note: "使用提交时获得的查询密码。此密码与「退党证明编号」不同。"
                  }
                ]}
              >
                <div className="notice" style={{ marginTop: 26 }}>
                  <b>{asString(safetyNotice.title, "关于你的安全")}</b>
                  {asString(
                    safetyNotice.body,
                    "你不需要提供真实姓名、身份证件或联系方式。若身在大陆，建议先阅读安全访问说明。"
                  )}{" "}
                  <a
                    href={asString(safetyNotice.toolsHref, "/resources/tools")}
                    style={{ color: "#8E6A1A", borderBottom: "1px solid rgba(142,106,26,.4)" }}
                  >
                    {asString(safetyNotice.toolsLabel, "免翻墙链接")}
                  </a>
                  {asString(safetyNotice.middleText, "，提交后建议清除浏览痕迹。")}{" "}
                  <a
                    href={asString(safetyNotice.privacyHref, "/services/privacy")}
                    style={{ color: "#8E6A1A", borderBottom: "1px solid rgba(142,106,26,.4)" }}
                  >
                    {asString(safetyNotice.privacyLabel, "阅读完整的安全与隐私说明")}
                  </a>
                </div>

                {/* Listed here rather than only on the far side: someone who
                    cannot reach santui.tuidang.org cannot read its hotline
                    list either. */}
                <div className="notice" style={{ marginTop: 16 }}>
                  <b>如果打不开上面的链接</b>
                  你也可以用这些方式提交声明。电子邮件：{" "}
                  <a
                    href={`mailto:${OFFLINE_DECLARE_CHANNELS.email}`}
                    style={{ color: "#8E6A1A", borderBottom: "1px solid rgba(142,106,26,.4)" }}
                  >
                    {OFFLINE_DECLARE_CHANNELS.email}
                  </a>
                  。电话热线：
                  {OFFLINE_DECLARE_CHANNELS.hotlines.map((row) => (
                    <span key={row.region} style={{ display: "block", marginTop: 6 }}>
                      {row.region}　{row.numbers.join("　")}
                    </span>
                  ))}
                </div>
              </ServiceHandoff>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(readyPanel.title, "还不确定？")}</h4>
                <ul>
                  {(readyLinks.length > 0
                    ? readyLinks
                    : [
                        { label: "什么是三退", href: "/services/faq" },
                        { label: "为什么要三退", href: "/services/faq" },
                        { label: "多年不交党费算自动退党吗", href: "/services/faq" },
                        { label: "用化名声明有效吗", href: "/services/faq" },
                        { label: "安全与隐私说明", href: "/services/privacy" }
                      ]
                  ).map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(otherWaysPanel.title, "其他方式")}</h4>
                <ul>
                  {(otherWaysLinks.length > 0
                    ? otherWaysLinks
                    : [
                        { label: "到服务点当面办理", href: "/about/network" },
                        { label: "电话声明", href: "#" },
                        { label: "邮件声明", href: "#" }
                      ]
                  ).map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(todayPanel.title, "今日")}</h4>
                <p style={{ fontFamily: "var(--mono)", fontSize: 26, color: "var(--gold-lt)", margin: "0 0 6px" }}>
                  {asString(todayPanel.value, "38,403")}
                </p>
                <p style={{ marginBottom: 0 }}>{asString(todayPanel.body, "人在今天提交了声明。")}</p>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "services" && slug === "cert") {
    const heading = asString(payload.title, "退党证书");
    const subtitle = asString(payload.subtitle, "中英文对照的书面凭据，附唯一编号与公开查验入口。实名办理，需完成认证课程与考试。");
    const notice = asRecord(payload.noticePanel);
    const steps = asStringArray(payload.steps, ["1 完成三退声明", "2 申请证明", "3 认证考试", "4 签发领取"]);
    const introSections = asObjectArray(payload.introSections).map((row) => ({
      heading: asString(row.heading),
      body: asString(row.body)
    }));
    const samplePanel = asRecord(payload.samplePanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    const readyPanel = asRecord(payload.readyPanel);
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
                <b>{asString(notice.title, "办理前请先了解")}</b>
                {asString(
                  notice.body,
                  "退党证明由本中心签发，不是政府机关出具的文件，也不构成对移民或身份申请结果的任何保证。是否采信、如何采信，由受理机构自行判断。退党证明为实名办理，须本人申请，需完成认证课程与考试并缴纳办理／管理费用；三退声明本身始终免费。请只通过本中心的官方渠道办理（本网办理或干净世界），任何其他声称可以代办、加急或包过的机构与个人，都与我们无关。"
                )}
              </div>
              <div className="steps" style={{ marginBottom: 40 }}>
                {steps.map((label, index) => (
                  <div key={label} className={index === 0 ? "step done" : index === 1 ? "step on" : "step"}>
                    {label}
                  </div>
                ))}
              </div>
              <div className="prose" style={{ fontSize: 16 }}>
                {(introSections.length > 0
                  ? introSections
                  : [
                      { heading: "什么是退党证明", body: "一份中英文对照的文件，载明声明人姓名、退出组织、声明日期与证明编号，由本中心签发并盖章。" },
                      { heading: "办理条件", body: "你需要先完成一份三退声明。此前已经声明过，也可凭当时信息申请补发。" },
                      { heading: "办理流程与时间", body: "申请人需先观看认证培训视频（约一小时），并通过认证考试。通过后即可获得 PDF 电子证明，可自行打印。" },
                      {
                        heading: "为什么出国人员应尽早办理",
                        body: "多个国家在签证与身份审查中会问及政党成员身份。若已实际退出，尽早留下书面凭据，比临时补办更从容。"
                      }
                    ]
                ).map((sectionRow) => (
                  <div key={`${sectionRow.heading}-${sectionRow.body}`}>
                    <h2>{sectionRow.heading}</h2>
                    <p>{sectionRow.body}</p>
                  </div>
                ))}
                <p>
                  每份证明都有唯一编号，任何机构或个人都可以
                  <a href="/services/verify">在线查验真伪</a>
                  ，不需要联系本中心，也不需要授权。
                </p>
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 36 }}>
                <a className="btn btn--seal" href={EXTERNAL_SERVICES.certApply} {...EXTERNAL_LINK_PROPS}>
                  <span className="stamp">退</span>
                  本网办理
                </a>
                <a className="btn btn--line" href={EXTERNAL_SERVICES.certApplyGanjing} {...EXTERNAL_LINK_PROPS}>
                  干净世界办理
                </a>
                <a className="btn btn--line" href="/services/faq">
                  先看常见问题
                </a>
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 18, lineHeight: 1.7, maxWidth: "52ch" }}>
                办理入口将在新窗口打开 service.tuidang.org 或干净世界，界面与本站不同，属于正常情况。
              </p>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(samplePanel.title, "证明样本")}</h4>
                <img
                  src={asString(samplePanel.image, "https://www.tuidang.org/wp-content/uploads/2026/05/cert-sample.png")}
                  alt={asString(samplePanel.alt, "退党证明样本")}
                  style={{ width: "100%", border: "1px solid var(--rule)", marginBottom: 14, background: "#E4E1D8" }}
                />
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: 1.75, margin: 0 }}>
                  {asString(samplePanel.caption, "中英文对照，含唯一编号与查验方式。")}
                </p>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关问答")}</h4>
                <ul>
                  {(relatedLinks.length > 0
                    ? relatedLinks
                    : [
                        { label: "什么是退党证明", href: "/services/faq" },
                        { label: "如何办理退党证明", href: "/services/faq" },
                        { label: "为什么出国人员应尽早办理", href: "/services/faq" },
                        { label: "如何查验证明真伪", href: "/services/faq" },
                        { label: "三退是否安全", href: "/services/faq" }
                      ]
                  ).map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel panel--seal">
                <h4>{asString(readyPanel.title, "还没有声明？")}</h4>
                <p>{asString(readyPanel.body, "证明以三退声明为前提。登记一份声明约需三分钟，可以完全匿名。")}</p>
                <a className="btn btn--seal btn--sm" href={asString(readyPanel.buttonHref, "/services/declare")}>
                  <span className="stamp">{asString(readyPanel.buttonStamp, "退")}</span>
                  {asString(readyPanel.buttonLabel, "先去声明")}
                </a>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "services" && slug === "verify") {
    const headingRaw = asString(payload.title);
    const heading = !headingRaw || headingRaw === "查询验证" ? "查验一份退党证明" : headingRaw;
    const subtitle = asString(payload.subtitle, "输入证明编号即可查验签发日期与状态。此入口对所有人开放。");
    const institutionNotice = asRecord(payload.institutionNotice);
    const resultMeaning = asObjectArray(payload.resultMeaning).map((row) => ({
      heading: asString(row.heading),
      body: asString(row.body)
    }));
    const scopeSection = asRecord(payload.scopeSection);
    const antiFraudPanel = asRecord(payload.antiFraudPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
    const relatedLinks = asObjectArray(relatedPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
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
              <ServiceHandoff
                eyebrow="在线查验"
                heading="到证明查验系统核实编号"
                body="查验入口对所有人开放，无需注册或授权。结果仅显示该编号是否由本中心签发、签发日期与状态，不显示声明正文或其他个人信息。"
                destinationNote="链接将在新窗口打开 service.tuidang.org。这是本中心的退党证明查验系统，界面与本站不同，属于正常情况。"
                actions={[
                  {
                    label: "查验退党证明",
                    href: EXTERNAL_SERVICES.certVerify,
                    primary: true,
                    stamp: "退",
                    note: "需要证明编号（TD 开头的 16 位数字）、姓名与出生日期。目前仅适用于 2020 年 8 月 18 日之后办理的证明。"
                  },
                  {
                    label: "English verification",
                    href: EXTERNAL_SERVICES.certVerifyEn
                  },
                  {
                    label: "查询三退声明处理结果",
                    href: EXTERNAL_SERVICES.declareLookup,
                    note: "三退声明与退党证明是两套不同的系统。三退查询使用提交时的查询密码，不是证明编号。"
                  }
                ]}
              />
              <div className="notice" style={{ marginTop: 28 }}>
                <b>{asString(institutionNotice.title, "给受理机构的说明")}</b>
                {asString(
                  institutionNotice.body,
                  "本查验入口对所有人开放，无需注册或授权。查验结果仅显示该编号是否由本中心签发、签发日期与状态，不显示声明正文或其他个人信息。"
                )}
              </div>
              <div className="prose" style={{ fontSize: 16, marginTop: 44 }}>
                <h2>{asString(scopeSection.resultHeading, "查验结果代表什么")}</h2>
                {(resultMeaning.length > 0
                  ? resultMeaning
                  : [
                      { heading: "有效。", body: "该编号由本中心签发，登记记录存在，证明未被作废。" },
                      { heading: "查无此编号。", body: "该编号不在签发记录中，可能是输入有误，也可能并非本中心签发。" },
                      { heading: "已作废。", body: "该编号曾经签发，但因信息变更或补发等原因已作废。" }
                    ]
                ).map((row) => (
                  <p key={`${row.heading}-${row.body}`}>
                    <b>{row.heading}</b>
                    {row.body}
                  </p>
                ))}
                <h2>{asString(scopeSection.scopeHeading, "查验的是什么")}</h2>
                <p>{asString(scopeSection.scopeBody, "查验确认的是本中心确实签发过这份证明，而非验证声明人的真实身份。")}</p>
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(antiFraudPanel.title, "防伪要点")}</h4>
                <ul>
                  {asStringArray(antiFraudPanel.items, ["右下角唯一编号", "中英文对照排版", "本中心印章", "可在本页在线查验"]).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(relatedPanel.title, "相关")}</h4>
                <ul>
                  {(relatedLinks.length > 0
                    ? relatedLinks
                    : [
                        { label: "证明办理", href: "/services/cert" },
                        { label: "如何查验证明真伪", href: "/services/faq" },
                        { label: "联系我们核实", href: "/services/contact" },
                        { label: "给受理机构的说明 PDF", href: "#" }
                      ]
                  ).map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href}>{row.label}</a>
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

  if (section === "services" && slug === "contact") {
    const headingRaw = asString(payload.title);
    const heading = !headingRaw || headingRaw === "信息变更" ? "信息变更与联系我们" : headingRaw;
    const subtitle = asString(payload.subtitle, "更正声明信息、补发遗失证明或查询登记记录，由本中心人工核对处理。");
    const processingSections = asObjectArray(payload.processingSections).map((row) => ({ heading: asString(row.heading), body: asString(row.body) }));
    const contactPanel = asRecord(payload.contactPanel);
    const contactLinks = asObjectArray(contactPanel.links).map((row) => ({ label: asString(row.label), href: asString(row.href, "#") }));
    const onsitePanel = asRecord(payload.onsitePanel);
    const reminderPanel = asRecord(payload.reminderPanel);
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <ServiceHandoff
                eyebrow="提交申请"
                heading="通过联系表单办理"
                body="更正声明信息、补发遗失证明或查询登记记录，都通过本中心的联系表单提交，由志愿者人工核对处理。"
                destinationNote="链接将在新窗口打开 www.tuidang.org 的联系页面。"
                actions={[
                  {
                    label: "联系我们",
                    href: EXTERNAL_SERVICES.contact,
                    primary: true,
                    stamp: "退",
                    note: "请提供证明编号；若没有编号，请说明当时使用的署名、大致日期与提交方式（网站／服务点／电话／义工代转），以便志愿者核对。"
                  },
                  {
                    label: "三退声明相关问题",
                    href: EXTERNAL_SERVICES.declareContact,
                    note: "若你要更正的是三退声明而非退党证明，请通过三退网站联系。"
                  }
                ]}
              />
              <div className="prose" style={{ fontSize: 16, marginTop: 48 }}>
                {(processingSections.length > 0
                  ? processingSections
                  : [
                      {
                        heading: "处理方式与时间",
                        body: "所有变更申请由志愿者人工核对处理，通常需要数个工作日。信息更正后会签发新编号的证明，原编号作废，查验时会显示已作废并指向新编号。"
                      },
                      {
                        heading: "关于已公开的声明原文",
                        body: "如果只是姓名或联络信息有误，我们可以更正。但已公开的声明正文不会删除——完整保存每一份声明的原文与提交时间，是这项登记的意义所在。如有特殊情况，请在上方说明，我们会具体处理。"
                      }
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
                <h4>{asString(contactPanel.title, "直接联系")}</h4>
                <ul>
                  <li>
                    {asString(contactPanel.orgName, "全球退党服务中心")}
                    <br />
                    {asString(contactPanel.addressLine1, "40-46 Main Street")}
                    <br />
                    {asString(contactPanel.addressLine2, "Flushing, NY 11354")}
                  </li>
                  {(contactLinks.length > 0
                    ? contactLinks
                    : [
                        { label: "证明办理咨询", href: "#" },
                        { label: "服务点与志愿者事务", href: "#" },
                        { label: "媒体与采访联络", href: "#" }
                      ]
                  ).map((row) => (
                    <li key={`${row.label}-${row.href}`}>
                      <a href={row.href}>{row.label}</a>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(onsitePanel.title, "当面办理")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.85, margin: "0 0 16px" }}>
                  {asString(onsitePanel.body, "全球一百多个服务点均可协助处理变更与补办，无需预约。")}
                </p>
                <a className="btn btn--line btn--sm" href={asString(onsitePanel.buttonHref, "/about/network")}>
                  {asString(onsitePanel.buttonLabel, "查找服务点")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(reminderPanel.title, "提醒")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.85, margin: 0 }}>
                  {asString(reminderPanel.body, "办理退党证明的费用只在本中心的官方办理页面支付。我们不会通过私人账户或中介收款，也不会主动打电话、发短信向你索取银行卡号、验证码或密码。")}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "involve" && slug === "volunteer") {
    const heading = asString(payload.title, "绝大部分工作由志愿者完成");
    const subtitle = asString(
      payload.subtitle,
      "你可以在所在城市协助服务点，也可以在线参与翻译、剪辑与整理。时间多少不限，没有最低承诺。"
    );
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <div className="rgrid" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 40 }}>
                <a className="rcard" href="#">
                  <h4>服务点现场协助</h4>
                  <p>在你所在的城市值守服务点，协助登记与解答问题。</p>
                  <span className="dl">需要当地</span>
                </a>
                <a className="rcard" href="#">
                  <h4>翻译</h4>
                  <p>英、德、韩、日、罗马尼亚语。文章、字幕与资料。</p>
                  <span className="dl">可远程</span>
                </a>
                <a className="rcard" href="#">
                  <h4>影音剪辑与字幕</h4>
                  <p>现场素材剪辑、字幕制作与压制。</p>
                  <span className="dl">可远程</span>
                </a>
                <a className="rcard" href="#">
                  <h4>资料整理与校对</h4>
                  <p>纸本声明录入、档案整理与文字校对。</p>
                  <span className="dl">可远程</span>
                </a>
                <a className="rcard" href="#">
                  <h4>技术与网站维护</h4>
                  <p>前后端、安全防护与系统运维。</p>
                  <span className="dl">可远程</span>
                </a>
                <a className="rcard" href="#">
                  <h4>在你的城市新设服务点</h4>
                  <p>我们提供物料、培训与远程支持。</p>
                  <span className="dl">需要当地</span>
                </a>
              </div>
              <div className="form">
                <p className="eyebrow" style={{ marginBottom: 16 }}>
                  报名
                </p>
                <div className="fgroup">
                  <label>你想参与哪一类</label>
                  <div className="opts">
                    <span className="opt on">现场协助</span>
                    <span className="opt">翻译</span>
                    <span className="opt">影音</span>
                    <span className="opt">文字整理</span>
                    <span className="opt">技术</span>
                    <span className="opt">还不确定</span>
                  </div>
                </div>
                <div className="fgroup">
                  <label>所在城市</label>
                  <input type="text" placeholder="例如：多伦多" />
                </div>
                <div className="fgroup">
                  <label>大致可投入时间</label>
                  <p className="fhint">没有最低要求。每周一小时也可以。</p>
                  <input type="text" placeholder="例如：周末各半天" />
                </div>
                <div className="fgroup">
                  <label>联络方式</label>
                  <p className="fhint">仅用于义工事务联络，不作他用，也不会转给第三方。</p>
                  <input type="text" placeholder="电子邮件或其他方式" />
                </div>
                <a className="btn btn--seal" href="#">
                  <span className="stamp">退</span>提交报名
                </a>
              </div>
            </div>
            <aside className="side">
              <div className="panel panel--seal">
                <h4>义工在做什么</h4>
                <p>读几篇现场纪实，比任何说明都清楚。</p>
                <a className="btn btn--seal btn--sm" href="/involve/stories">
                  义工故事
                </a>
              </div>
              <div className="panel">
                <h4>相关</h4>
                <ul>
                  <li>
                    <a href="/about/network">查找服务点</a>
                  </li>
                  <li>
                    <a href="/resources/downloads">下载展板与传单</a>
                  </li>
                  <li>
                    <a href="/resources/tools">免翻墙链接</a>
                  </li>
                  <li>
                    <a href="/services/contact">联系我们</a>
                  </li>
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
        subtitle={asString(payload.subtitle, "服务类页面：声明、证书、查询、联络、义工报名等。")}
      />
      {section === "services" || section === "resources" ? <InteriorTabs section={section} slug={slug} /> : null}
      <section className="sec">
        <div className="wrap cols">
          <article>
            <div className="steps">
              <div className="step on">填写信息</div>
              <div className="step">确认内容</div>
              <div className="step">完成提交</div>
            </div>
            <form className="form">
              <div className="notice">
                <b>提交前提示</b>
                {asString(payload.notice, "仅填写必要信息，避免上传敏感个人材料。")}
              </div>
              {(asObjectArray(payload.fields).length > 0
                ? asObjectArray(payload.fields).map((row) => ({
                    id: asString(row.id),
                    label: asString(row.label),
                    type: asString(row.type, "text"),
                    placeholder: asString(row.placeholder)
                  }))
                : [
                    { id: "name", label: "署名", type: "text", placeholder: "" },
                    { id: "content", label: "内容", type: "textarea", placeholder: "" }
                  ]
              ).map((field) => (
                <div key={field.id || field.label} className="fgroup">
                  <label>{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea placeholder={field.placeholder} />
                  ) : (
                    <input type="text" placeholder={field.placeholder} />
                  )}
                </div>
              ))}
              <button type="button" className="btn btn--seal">
                提交
              </button>
            </form>
          </article>
          <aside className="side">
            <section className="panel panel--seal">
              <h4>安全建议</h4>
              <p>可优先使用安全访问工具，避免在公共网络重复提交敏感信息。</p>
              <a className="btn btn--line-light btn--sm" href="/resources/tools">
                查看工具
              </a>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
