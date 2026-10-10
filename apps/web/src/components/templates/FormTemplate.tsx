import { ServiceHandoff } from "@/components/public/ServiceHandoff";
import { externalLinkProps } from "@/lib/external-services";
import { involveDefaults, servicesDefaults } from "@quitccp/content-schema";
import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";
import { CtaPanel, LinkPanel, ListPanel, handoffProps } from "./section-panels";
import { CmsMarkdown } from "@/components/public/MarkdownBody";

export function FormTemplate({ title, section, slug, content }: TemplatePageData) {
  const payload = asRecord(content);

  if (section === "services" && slug === "declare") {
    // The title is stored, not patched here. This branch used to force
    // "声明退出中共党、团、队" whenever the stored value looked stale, so an
    // editor saw one title in the form and a different one on the page.
    const heading = asString(payload.title, "声明退出中共党、团、队");
    const subtitle = asString(
      payload.subtitle,
      "由你自己填写并提交，我们完整保存原文与提交时间。全程免费，无需注册，可以完全匿名。"
    );
    const fallback = servicesDefaults("services", "declare");
    const safetyNotice = asRecord(payload.safetyNotice);
    const readyPanel = asRecord(payload.readyPanel);
    const otherWaysPanel = asRecord(payload.otherWaysPanel);
    const todayPanel = asRecord(payload.todayPanel);
    const offline = asRecord(payload.offlinePanel ?? fallback.offlinePanel);
    const hotlines = asObjectArray(offline.hotlines);
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
              <ServiceHandoff {...handoffProps(asRecord(payload.handoff), asRecord(fallback.handoff))}>
                <div className="notice notice--prose" style={{ marginTop: 26 }}>
                  <b>{asString(safetyNotice.title, "关于你的安全")}</b>
                  {/* One markdown sentence. It used to be five fields --
                      body, two link labels, two addresses and the text
                      between them -- assembled into a single line of prose. */}
                  <CmsMarkdown value={safetyNotice.body} />
                </div>

                {/* Listed here rather than only on the far side: someone who
                    cannot reach santui.tuidang.org cannot read its hotline
                    list either. */}
                {asString(offline.title) ? (
                  <div className="notice" style={{ marginTop: 16 }}>
                    <b>{asString(offline.title)}</b>
                    {asString(offline.intro)}
                    {asString(offline.email) ? (
                      <>
                        {asString(offline.emailLabel, "电子邮件")}：{" "}
                        <a
                          href={`mailto:${asString(offline.email)}`}
                          style={{ color: "var(--gold-ink)", borderBottom: "1px solid rgba(142,106,26,.4)" }}
                        >
                          {asString(offline.email)}
                        </a>
                        。
                      </>
                    ) : null}
                    {hotlines.length > 0 ? (
                      <>
                        {asString(offline.hotlineLabel, "电话热线")}：
                        {hotlines.map((row, index) => (
                          <span key={asString(row.region) || index} style={{ display: "block", marginTop: 6 }}>
                            {asString(row.region)}　{asString(row.numbers)}
                          </span>
                        ))}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </ServiceHandoff>
            </div>
            <aside className="side">
              <LinkPanel
                title={asString(readyPanel.title, "还不确定？")}
                links={asObjectArray(readyPanel.links)}
              />
              <LinkPanel
                title={asString(otherWaysPanel.title, "其他方式")}
                links={asObjectArray(otherWaysPanel.links)}
              />
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
    const fallback = servicesDefaults("services", "cert");
    const notice = asRecord(payload.noticePanel);
    const steps = asStringArray(payload.steps, ["1 完成三退声明", "2 申请证明", "3 认证考试", "4 签发领取"]);
    // Four heading+body pairs and a closing paragraph, now one markdown body.
    const intro = asRecord(payload.intro);
    const apply = asRecord(payload.applyActions ?? fallback.applyActions);
    const applyItems = asObjectArray(apply.items);
    const samplePanel = asRecord(payload.samplePanel);
    const relatedPanel = asRecord(payload.relatedPanel);
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
                {asString(notice.body)}
              </div>
              {steps.length > 0 ? (
                <div className="steps" style={{ marginBottom: 40 }}>
                  {steps.map((label, index) => (
                    <div key={label} className={index === 0 ? "step done" : index === 1 ? "step on" : "step"}>
                      {label}
                    </div>
                  ))}
                </div>
              ) : null}
              <div className="prose" style={{ fontSize: 16 }}>
                <CmsMarkdown value={intro.body} />
              </div>
              {applyItems.length > 0 ? (
                <>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 36 }}>
                    {applyItems.map((row, index) => {
                      const href = asString(row.href, "/");
                      const stamp = asString(row.stamp);
                      return (
                        <a
                          key={asString(row.label) || index}
                          className={asString(row.variant) === "seal" ? "btn btn--seal" : "btn btn--line"}
                          href={href}
                          {...externalLinkProps(href)}
                        >
                          {stamp ? <span className="stamp">{stamp}</span> : null}
                          {asString(row.label)}
                        </a>
                      );
                    })}
                  </div>
                  {asString(apply.destinationNote) ? (
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 18, lineHeight: "var(--lh-body)", maxWidth: "52ch" }}>
                      {asString(apply.destinationNote)}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(samplePanel.title, "证明样本")}</h4>
                <img
                  src={asString(samplePanel.image)}
                  alt={asString(samplePanel.alt, "退党证明样本")}
                  style={{ width: "100%", border: "1px solid var(--rule)", marginBottom: 14, background: "var(--rule)" }}
                />
                <p style={{ fontSize: 13, color: "var(--muted)", lineHeight: "var(--lh-body)", margin: 0 }}>
                  {asString(samplePanel.caption)}
                </p>
              </div>
              <LinkPanel
                title={asString(relatedPanel.title, "相关问答")}
                links={asObjectArray(relatedPanel.links)}
              />
              <div className="panel panel--seal">
                <h4>{asString(readyPanel.title, "还没有声明？")}</h4>
                <p>{asString(readyPanel.body)}</p>
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
    const heading = asString(payload.title, "查验一份退党证明");
    const subtitle = asString(payload.subtitle, "输入证明编号即可查验签发日期与状态。此入口对所有人开放。");
    const fallback = servicesDefaults("services", "verify");
    const institutionNotice = asRecord(payload.institutionNotice);
    const intro = asRecord(payload.intro);
    const antiFraudPanel = asRecord(payload.antiFraudPanel);
    const relatedPanel = asRecord(payload.relatedPanel);
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
              <ServiceHandoff {...handoffProps(asRecord(payload.handoff), asRecord(fallback.handoff))} />
              <div className="notice" style={{ marginTop: 28 }}>
                <b>{asString(institutionNotice.title, "给受理机构的说明")}</b>
                {asString(institutionNotice.body)}
              </div>
              <div className="prose" style={{ fontSize: 16, marginTop: 44 }}>
                <CmsMarkdown value={intro.body} />
              </div>
            </div>
            <aside className="side">
              <ListPanel
                title={asString(antiFraudPanel.title, "防伪要点")}
                items={asStringArray(antiFraudPanel.items, [])}
              />
              <LinkPanel
                title={asString(relatedPanel.title, "相关")}
                links={asObjectArray(relatedPanel.links)}
              />
            </aside>
          </div>
        </section>
      </>
    );
  }

  if (section === "services" && slug === "contact") {
    const heading = asString(payload.title, "信息变更与联系我们");
    const subtitle = asString(payload.subtitle, "更正声明信息、补发遗失证明或查询登记记录，由本中心人工核对处理。");
    const fallback = servicesDefaults("services", "contact");
    const intro = asRecord(payload.intro);
    const contactPanel = asRecord(payload.contactPanel);
    const onsitePanel = asRecord(payload.onsitePanel);
    const reminderPanel = asRecord(payload.reminderPanel);
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              <ServiceHandoff {...handoffProps(asRecord(payload.handoff), asRecord(fallback.handoff))} />
              <div className="prose" style={{ fontSize: 16, marginTop: 48 }}>
                <CmsMarkdown value={intro.body} />
              </div>
            </div>
            <aside className="side">
              <div className="panel">
                <h4>{asString(contactPanel.title, "直接联系")}</h4>
                <ul>
                  <li>
                    {asString(contactPanel.orgName, "全球退党服务中心")}
                    <br />
                    {asString(contactPanel.addressLine1)}
                    <br />
                    {asString(contactPanel.addressLine2)}
                  </li>
                  {asObjectArray(contactPanel.links).map((row, index) => {
                    const href = asString(row.href).trim();
                    const label = asString(row.label);
                    return (
                      <li key={label || index}>
                        {href && href !== "#" ? (
                          <a href={href} {...externalLinkProps(href)}>
                            {label}
                          </a>
                        ) : (
                          label
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div className="panel">
                <h4>{asString(onsitePanel.title, "当面办理")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: "0 0 16px" }}>
                  {asString(onsitePanel.body)}
                </p>
                <a className="btn btn--line btn--sm" href={asString(onsitePanel.buttonHref, "/about/network")}>
                  {asString(onsitePanel.buttonLabel, "查找服务点")}
                </a>
              </div>
              <div className="panel">
                <h4>{asString(reminderPanel.title, "提醒")}</h4>
                <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: "var(--lh-body)", margin: 0 }}>
                  {asString(reminderPanel.body)}
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
    // Everything below used to be written into this branch -- six role cards,
    // every form label and hint, both sidebar panels. It is page content, so it
    // is stored and edited as page content; the defaults keep an entry that
    // predates the move looking the same.
    const fallback = involveDefaults("involve", "volunteer");
    const block = (key: string) => asRecord(payload[key] ?? fallback[key]);
    const roles = (() => {
      const rows = asObjectArray(payload.roles);
      return rows.length > 0 ? rows : asObjectArray(fallback.roles);
    })();
    const form = block("signupForm");
    const options = asStringArray(form.categoryOptions, []);
    const stories = block("storiesPanel");
    const related = block("relatedPanel");
    const submitHref = asString(form.submitHref, "#");
    return (
      <>
        <InteriorHead section={section} slug={slug} title={heading} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <section className="sec" style={{ paddingTop: 52 }}>
          <div className="wrap cols">
            <div>
              {roles.length > 0 ? (
                <div className="rgrid rgrid--two" style={{ marginBottom: 40 }}>
                  {roles.map((row, index) => {
                    const href = asString(row.href);
                    const inner = (
                      <>
                        <h4>{asString(row.title)}</h4>
                        <p>{asString(row.body)}</p>
                        {asString(row.tag) ? <span className="dl">{asString(row.tag)}</span> : null}
                      </>
                    );
                    /* These six cards were all href="#". A card that looks
                       clickable and goes nowhere is worse than one that does
                       not: with no address they render as plain cards, and the
                       sign-up form they described is directly below. */
                    return href ? (
                      <a className="rcard" href={href} key={asString(row.title) || index}>
                        {inner}
                      </a>
                    ) : (
                      <div className="rcard" key={asString(row.title) || index}>
                        {inner}
                      </div>
                    );
                  })}
                </div>
              ) : null}
              <div className="form">
                <p className="eyebrow" style={{ marginBottom: 16 }}>
                  {asString(form.eyebrow, "报名")}
                </p>
                {options.length > 0 ? (
                  <div className="fgroup">
                    <label>{asString(form.categoryLabel)}</label>
                    <div className="opts">
                      {options.map((option, index) => (
                        <span className={index === 0 ? "opt on" : "opt"} key={option}>
                          {option}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="fgroup">
                  <label>{asString(form.cityLabel)}</label>
                  <input type="text" placeholder={asString(form.cityPlaceholder)} />
                </div>
                <div className="fgroup">
                  <label>{asString(form.timeLabel)}</label>
                  {asString(form.timeHint) ? <p className="fhint">{asString(form.timeHint)}</p> : null}
                  <input type="text" placeholder={asString(form.timePlaceholder)} />
                </div>
                <div className="fgroup">
                  <label>{asString(form.contactLabel)}</label>
                  {asString(form.contactHint) ? <p className="fhint">{asString(form.contactHint)}</p> : null}
                  <input type="text" placeholder={asString(form.contactPlaceholder)} />
                </div>
                <a className="btn btn--seal" href={submitHref} {...externalLinkProps(submitHref)}>
                  <span className="stamp">退</span>
                  {asString(form.submitLabel, "提交报名")}
                </a>
              </div>
            </div>
            <aside className="side">
              <CtaPanel panel={stories} fallbackHref="/involve/stories" />
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
