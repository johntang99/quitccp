import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";

export function ArticleTemplate({ title, content }: TemplatePageData) {
  const payload = asRecord(content);
  const fallbackTitle = "全球退党服务中心在美国国会山为 31 名华人颁发退党证明";
  const rawDek = asString(payload.dek);
  const dek = rawDek
    ? rawDek
    : "在一份表彰退出中共运动的声明被正式载入《国会议事录》的同日，31 名华人在国会山现场领取了退出中共党、团、队的证明。";
  const rawByline = asStringArray(payload.byline, []);
  const bylineRows =
    rawByline.length === 4 && !rawByline.some((row) => row.includes("阅读约"))
      ? rawByline
      : ["2026-07-22", "华盛顿", "本站报导", "约 1,400 字"];
  const bodyRows = asObjectArray(payload.body);
  const shouldUseFallbackBody = bodyRows.length === 0;
  const proseRows: Array<{ type: string; text: string }> = shouldUseFallbackBody
    ? [
          {
            type: "p",
          text: "正文采用单栏阅读版式，宽度限制在约 72 个字符，行高 2.05，使用思源宋体排版。"
          },
          {
            type: "p",
          text: "段落之间留有明显间距，避免中文长段落形成难以进入的文字墙。图片、引文、小标题都有独立的排版规则。"
          },
          {
            type: "h2",
          text: "小标题的样式"
          },
          {
            type: "p",
          text: "二级标题使用思源宋体 900 字重，上方留有较大间距，让读者在长文中能够快速定位。"
        },
        {
          type: "blockquote",
          text: "引文使用金色左边线与略大的字号。这是页面上少数几个使用金色的地方之一。"
        },
        {
          type: "h3",
          text: "关于配图"
        },
        {
          type: "p",
          text: "每张图片下方都有说明与摄影署名。这是纪录性网站与宣传性网站最明显的差别之一。"
          }
      ]
    : bodyRows.map((row) => ({
        type: asString(row.type, "p"),
        text: asString(row.text)
      }));
  const shouldUseFallbackTitle = !title || title.trim().length < 6;
  const displayTitle = shouldUseFallbackTitle ? fallbackTitle : title;
  const breadcrumb = asRecord(payload.breadcrumb);
  const articleTag = asString(payload.tag, "国际声援行动");
  const heroFigure = asRecord(payload.heroFigure);
  const heroFigureImage = asString(heroFigure.image);
  const heroCaptionLines = asStringArray(heroFigure.captionLines, []);
  const bodyLink = asRecord(payload.bodyLink);
  const inlineFigure = asRecord(payload.inlineFigure);
  const inlineFigureImage = asString(inlineFigure.image);
  const inlineFigureCaptionLines = asStringArray(inlineFigure.captionLines, []);
  const actionPills = asObjectArray(payload.actionPills).length
    ? asObjectArray(payload.actionPills).map((row) => ({
        label: asString(row.label),
        href: asString(row.href, "#")
      }))
    : [
        { label: "复制链接", href: "#" },
        { label: "下载 PDF", href: "#" },
        { label: "转载说明", href: "#" },
        { label: "打印", href: "#" }
      ];
  const relatedSection = asRecord(payload.relatedSection);
  const relatedItems = asObjectArray(relatedSection.items).length
    ? asObjectArray(relatedSection.items).map((row) => ({
        href: asString(row.href, "/news/article"),
        image: asString(row.image),
        tag: asString(row.tag),
        title: asString(row.title),
        meta: asString(row.meta)
      }))
    : [
        {
          href: "/news/article",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.29-P.png",
          tag: "国际声援行动",
          title: "欧洲议会通过决议，关注强制器官摘取问题",
          meta: "2026-06-25 · 布鲁塞尔"
        },
        {
          href: "/news/article",
          image: "https://www.tuidang.org/wp-content/uploads/2026/07/2026.07.23-P.png",
          tag: "移民相关",
          title: "美国第 444 号决议与华人身份申请的关系",
          meta: "2026-07-22"
        }
      ];
  const ctaPanel = asRecord(payload.ctaPanel);
  const sectionPanel = asRecord(payload.sectionPanel);
  const sectionLinks = asObjectArray(sectionPanel.links).length
    ? asObjectArray(sectionPanel.links).map((row) => ({
        label: asString(row.label),
        href: asString(row.href, "/news")
      }))
    : [
        { label: "国际声援行动", href: "/news" },
        { label: "机构公告与声明", href: "/news" },
        { label: "追查国际调查报告", href: "/news" }
      ];
  const reusePanel = asRecord(payload.reusePanel);

  return (
    <>
      <section className="sec" style={{ padding: "44px 0 88px" }}>
        <div className="wrap cols cols--narrow">
          <article>
            <p className="crumb" style={{ color: "var(--muted)" }}>
              <a href={asString(breadcrumb.homeHref, "/")} style={{ color: "var(--muted)" }}>
                {asString(breadcrumb.homeLabel, "首页")}
              </a>
              <span>/</span>
              <a href={asString(breadcrumb.sectionHref, "/news")} style={{ color: "var(--muted)" }}>
                {asString(breadcrumb.sectionLabel, "新闻与报告")}
              </a>
              <span>/</span>
              {asString(breadcrumb.current, articleTag)}
            </p>
            <span className="tag">{articleTag}</span>
            <h1 style={{ fontFamily: "var(--serif)", fontWeight: 900, fontSize: "clamp(28px,3.4vw,40px)", lineHeight: 1.45, margin: "12px 0 20px", letterSpacing: ".01em" }}>
              {displayTitle}
            </h1>
            <p className="dek">{dek}</p>
            <div className="byline">
              {bylineRows.map((row) => (
                <span key={row}>{row}</span>
              ))}
            </div>
            {heroFigureImage ? (
              <figure style={{ margin: "0 0 34px" }}>
                <img
                  src={heroFigureImage}
                  alt={asString(heroFigure.alt, "文章主图")}
                  style={{ width: "100%", aspectRatio: "16 / 9", objectFit: "cover", background: "#E4E1D8" }}
                />
                {heroCaptionLines.length > 0 ? (
                  <figcaption style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "var(--muted)", marginTop: 11, lineHeight: 1.7 }}>
                    {heroCaptionLines.map((line, index) => (
                      <span key={line}>
                        {line}
                        {index < heroCaptionLines.length - 1 ? <br /> : null}
                      </span>
                    ))}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}
            <div className="prose">
              {proseRows.map((row, index) => {
                const type = asString(row.type, "p");
                const text = asString(row.text);
                if (!text) return null;
                if (type === "h2") return <h2 key={`${type}-${index}`}>{text}</h2>;
                if (type === "h3") return <h3 key={`${type}-${index}`}>{text}</h3>;
                if (type === "blockquote") return <blockquote key={`${type}-${index}`}>{text}</blockquote>;
                return <p key={`${type}-${index}`}>{text}</p>;
              })}
              <p>
                {asString(bodyLink.prefix, "正文中的")}
                <a href={asString(bodyLink.href, "#")}>{asString(bodyLink.label, "链接使用紫色并带下划线")}</a>
                {asString(bodyLink.suffix, "，在浅色背景上保持足够对比度。")}
              </p>
              {inlineFigureImage ? (
                <figure>
                  <img
                    src={inlineFigureImage}
                    alt={asString(inlineFigure.alt, "文章配图")}
                    style={{ width: "100%", aspectRatio: "3 / 2", objectFit: "cover", background: "#E4E1D8" }}
                  />
                  {inlineFigureCaptionLines.length > 0 ? (
                    <figcaption>
                      {inlineFigureCaptionLines.map((line, index) => (
                        <span key={line}>
                          {line}
                          {index < inlineFigureCaptionLines.length - 1 ? <br /> : null}
                        </span>
                      ))}
                    </figcaption>
                  ) : null}
                </figure>
              ) : null}
            </div>
            <div style={{ marginTop: 44, paddingTop: 26, borderTop: "1px solid var(--rule)", display: "flex", gap: 10, flexWrap: "wrap" }}>
              {actionPills.map((action) => (
                <a key={action.label} className="pill" href={action.href}>
                  {action.label}
                </a>
              ))}
            </div>
            <div style={{ marginTop: 56 }}>
              <p className="eyebrow">{asString(relatedSection.eyebrow, "相关报导")}</p>
              <div className="arch">
                {relatedItems.map((item, index) => (
                  <article key={item.title} className="arow" style={index === 0 ? { paddingTop: 0 } : undefined}>
                    <a href={item.href} style={{ display: "contents" }}>
                      <img src={item.image} alt="" />
                      <div>
                        <span className="tag">{item.tag}</span>
                        <h3>{item.title}</h3>
                        <p className="meta">{item.meta}</p>
                      </div>
                    </a>
                  </article>
                ))}
              </div>
            </div>
          </article>
          <aside className="side">
            <div className="panel panel--seal">
              <h4>{asString(ctaPanel.title, "你也可以声明")}</h4>
              <p>{asString(ctaPanel.body, "登记一份声明约需三分钟，可以完全匿名，全程免费。")}</p>
              <a className="btn btn--seal btn--sm" href={asString(ctaPanel.buttonHref, "/services/declare")}>
                <span className="stamp">{asString(ctaPanel.buttonStamp, "退")}</span>
                {asString(ctaPanel.buttonLabel, "我要三退")}
              </a>
            </div>
            <div className="panel">
              <h4>{asString(sectionPanel.title, "本文栏目")}</h4>
              <ul>
                {sectionLinks.map((link) => (
                  <li key={link.label}>
                    <a href={link.href}>{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
            <div className="panel">
              <h4>{asString(reusePanel.title, "转载条款")}</h4>
              <p style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.85, margin: 0 }}>
                {asString(reusePanel.body, "本文可自由转载、翻译与再制作，无需事先取得授权，注明来源即可。")}
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
