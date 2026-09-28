import { InteriorHead, InteriorTabs } from "./InteriorScaffold";
import type { TemplatePageData } from "./types";
import { asObjectArray, asRecord, asString, asStringArray } from "./content-utils";

const VIDEO_TITLE_HREF_MAP: Record<string, string> = {
  "第一部：从怀疑开始": "https://www.ganjingworld.com/embed/1g5436sv0pa2bFQ37G3NOoE6E1kf1c",
  "第二部：走出来的人": "https://www.ganjingworld.com/zh-CN/embed/1g9ercvue645koiFj2n9qpGhS1n91c",
  "第三部：在海外的二十年": "https://www.ganjingworld.com/zh-CN/embed/1gakabgit215P2oIMEZ0CUhQw1eh1c",
  "《九评》二十周年特辑": "https://www.youtube.com/watch?v=j_ffODpchmI",
  "服务点的人：一百个地方，一件事": "https://www.youtube.com/watch?v=Ny-DlQGvKEw",
  "济州岛三退义工面对挑衅，威而不惧": "https://www.youtube.com/watch?v=TZhgjCsLsGU",
  "纽约中领馆前烛光夜悼，十七名华人现场声明三退": "https://www.tuidang.org/2026/07/21/705292/",
  "台北车站前的真相点：十年如一日": "https://www.youtube.com/watch?v=7ggAwtm_J38",
  "国会山现场：31 名华人领取退党证明": "https://www.youtube.com/watch?v=9ctHLbzKups",
  "伦敦中国城：周末的两位义工": "https://www.youtube.com/watch?v=XjyugSv1VPY",
  "巴黎铁塔下：素琴女士的十二年": "https://www.youtube.com/watch?v=2f6bDYFDaTg",
  "把纸本声明一份份录入系统的人": "https://www.youtube.com/watch?v=rUfBBKOoOCg",
  "《铁证如山》：中共活体摘取法轮功学员器官罪恶追查": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_cn_trailer_revised.mp4",
  "济州岛服务点的一天：义工在码头前轮班守候": "https://www.youtube.com/watch?v=TZhgjCsLsGU",
  "第一集：被改造的语言": "https://www.youtube.com/watch?v=5Ls9h0I9TEs",
  "第二集：从课本到思维方式": "https://www.youtube.com/watch?v=-I3xjJGVfMA",
  "第三集：斗争哲学的日常痕迹": "https://www.youtube.com/watch?v=wxYJYCAHuVY",
  "《九评共产党》系列导读 · 第一集": "https://www.tuidang.org/2020/08/04/747/",
  "《魔鬼在统治着我们的世界》 · 第一章": "/videos/jiuping",
  "《共产主义的终极目的》 · 序言": "/videos/jiuping",
  "《铁证如山》完整版": "https://www.zhuichaguoji.org/media_files/tzrs/episode-32-SD-540p.mp4",
  "录音取证片段与说明": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_05_360p.mp4",
  "证人陈述汇编": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_31_540p.mp4",
  "四万人的觉醒": "https://www.tuidang.org/2023/12/27/696470/",
  "调查的缘起与方法": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_cn_trailer_revised.mp4",
  "录音取证：第一批电话": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_05_360p.mp4",
  "军队医院系统的角色": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_26_SD540p.mp4",
  "移植数量与供体来源的矛盾": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_22_SD540p.mp4",
  "当事人证词汇编（一）": "https://www.zhuichaguoji.org/media_files/tzrs/episode-32-SD-540p.mp4",
  "当事人证词汇编（二）": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_31_540p.mp4",
  "责任人调查：公安系统": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_25_SD540p.mp4",
  "责任人调查：司法系统": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_24_SD540p.mp4",
  "国际社会的回应": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_30_HD720p.mp4",
  "独立法庭的裁决": "https://www.zhuichaguoji.org/media_files/tzrs/tzrs_29_HD720p.mp4",
  "评共产党是什么": "https://www.tuidang.org/2020/08/04/747/",
  "评中国共产党是怎样起家的": "https://www.tuidang.org/2020/08/05/790/",
  "评中国共产党的暴政": "https://www.tuidang.org/2020/08/05/814/",
  "评共产党是反宇宙的力量": "https://www.tuidang.org/2020/08/05/827/",
  "评江泽民与中共相互利用迫害法轮功": "https://www.tuidang.org/2020/08/05/837/",
  "评中国共产党破坏民族文化": "https://www.tuidang.org/2020/08/05/861/",
  "评中国共产党的杀人历史": "https://www.tuidang.org/2020/08/05/880/",
  "评中国共产党的邪教本质": "https://www.tuidang.org/2020/08/05/901/",
  "评中国共产党的流氓本性": "https://www.tuidang.org/2020/08/05/919/",
  "九评共产党 · 影音版": "/videos/jiuping",
  "《解体党文化》播报版": "https://www.tuidang.org/2020/08/16/558704/",
  "《魔鬼在统治着我们的世界》": "/videos/jiuping",
  "《共产主义的终极目的》": "/videos/jiuping",
  "巴黎反迫害声援大游行": "https://www.tuidang.org/2024/07/20/699132/",
  "反制中共干预与跨境压制：奥克兰论坛": "https://www.tuidang.org/2023/10/25/695409/",
  "7.20 反迫害：纽约中领馆前集会嘉宾发言": "https://www.tuidang.org/2023/08/23/693751/",
  "【三退洪声】大陆记者：今天说句真话": "https://www.tuidang.org/2024/07/01/698840/",
  "祭仓颉：找回迷失的神性": "https://www.tuidang.org/2026/03/16/703511/",
  "千年微光：从乌台诗案到人性觉醒": "https://www.tuidang.org/2024/06/16/698519/",
  "被改造的语言": "https://www.youtube.com/watch?v=5Ls9h0I9TEs",
  "从课本到思维方式": "https://www.youtube.com/watch?v=-I3xjJGVfMA",
  "斗争哲学的日常痕迹": "https://www.youtube.com/watch?v=wxYJYCAHuVY",
  "集体与个人": "https://www.tuidang.org/2026/08/16/705588/",
  "怀疑一切与相信一切": "https://www.tuidang.org/2026/08/15/705582/",
  "回归传统文化": "https://www.tuidang.org/2020/08/16/558704/",
  "觉醒，从十岁开始——专访实业家胡力任（上）": "https://www.tuidang.org/2024/06/16/698519/",
  "专访胡力任（下）：离开之后的生活": "https://www.tuidang.org/2024/08/11/699427/",
  "前外交官陈用林：我为什么选择留下来": "https://www.youtube.com/watch?v=8aU433_s64Q",
  "前公安人员的自述：那些年我执行的任务": "https://www.youtube.com/watch?v=vJKiNoDYuF4",
  "党媒记者：说了二十多年谎话之后": "https://www.tuidang.org/2024/07/01/698840/",
  "高校教师：从讲台上下来的那一天": "https://www.youtube.com/watch?v=syEjpbPTkX0",
  "企业主：合规与良心之间": "https://www.youtube.com/watch?v=2f6bDYFDaTg"
};

function resolveVideoHref(rawHref: string, title: string, seed: number): string {
  void seed;
  const href = rawHref.trim();
  if (href && href !== "#") return href;
  const mapped = VIDEO_TITLE_HREF_MAP[title.trim()];
  if (mapped) return mapped;
  return "/videos";
}

function externalAttrs(href: string): { target?: string; rel?: string } {
  return /^https?:\/\//i.test(href) ? { target: "_blank", rel: "noopener noreferrer" } : {};
}

export function VideoLibraryTemplate({ title, section, slug, content }: TemplatePageData) {
  const payload = asRecord(content);
  const subtitle = asString(payload.subtitle, "现场纪录、当事人访谈、调查影像与系列专题。");

  const featured = asRecord(payload.featured);
  const featuredTitle = asString(featured.title);
  const featuredHref = resolveVideoHref(asString(featured.href), featuredTitle, 0);
  const featuredTag = asString(featured.tag, "本期推荐");
  const featuredSummary = asString(featured.summary);
  const featuredMeta = asString(featured.meta);
  const featuredImage = asString(
    featured.image,
    "https://www.tuidang.org/wp-content/uploads/2026/07/id14813875-LD108599-1-scaled.jpg"
  );

  const sections = asObjectArray(payload.sections);
  const gridItems = asObjectArray(payload.gridItems);
  const episodes = asObjectArray(payload.episodes);
  const platformLinks = asObjectArray(payload.platformLinks);
  const introNote = asRecord(payload.introNote);
  const reuseNote = asRecord(payload.reuseNote);

  const filtersRaw = asObjectArray(payload.filters);
  const filters =
    filtersRaw.length > 0
      ? filtersRaw.map((row, index) => ({
          label: asString(row.label, asString(row.title, `筛选 ${index + 1}`)),
          href: asString(row.href, "/videos/others"),
          active: asString(row.active) === "true" || (!("active" in row) && index === 0)
        }))
      : asStringArray(payload.filters, []).map((label, index) => ({ label, href: "/videos/others", active: index === 0 }));

  const moreButtonLabel = asString(payload.moreButtonLabel);
  const moreButtonHref = asString(payload.moreButtonHref, "#");
  const resolvedMoreButtonHref = moreButtonHref && moreButtonHref !== "#" ? moreButtonHref : slug === "index" ? "/videos" : `/videos/${slug}`;
  const episodesTitle = asString(payload.episodesTitle);
  const secondaryGridTitle = asString(payload.secondaryGridTitle);

  if (slug === "index") {
    return (
      <>
        <InteriorHead section={section} slug={slug} title={title} subtitle={subtitle} />
        <InteriorTabs section={section} slug={slug} />
        <div style={{ background: "var(--grad-band2)", color: "#EDEBE4" }}>
          <section className="sec" style={{ padding: "56px 0 0" }}>
            <div className="wrap">
              <article className="vhero">
                <a href={featuredHref} {...externalAttrs(featuredHref)}>
                  <div className="thumb" style={{ position: "relative" }}>
                    <img src={featuredImage} alt={featuredTitle} />
                    <span className="play" style={{ fontSize: 22 }}>
                      ▶
                    </span>
                  </div>
                </a>
                <div>
                  <span className="tag" style={{ color: "var(--gold-lt)" }}>
                    {featuredTag}
                  </span>
                  <h3 style={{ color: "#F2F0E9" }}>
                    <a href={featuredHref} {...externalAttrs(featuredHref)}>
                      {featuredTitle}
                    </a>
                  </h3>
                  <p style={{ color: "var(--lav-lt)", fontSize: 14.5, lineHeight: 1.9, margin: "0 0 20px" }}>{featuredSummary}</p>
                  <p className="meta" style={{ color: "var(--lav)" }}>
                    {featuredMeta}
                  </p>
                </div>
              </article>
            </div>
          </section>

          {sections.map((group, groupIndex) => {
            const items = asObjectArray(group.items);
            return (
              <section className="sec" style={{ padding: "56px 0" }} key={`${asString(group.title)}-${groupIndex}`}>
                <div className="wrap">
                  <div className="sec-head">
                    <div>
                      <p className="eyebrow">{asString(group.eyebrow, asString(group.title))}</p>
                      <h2 className="h2" style={{ color: "#F2F0E9", fontSize: 26 }}>
                        {asString(group.title)}
                      </h2>
                      <p className="lede" style={{ color: "var(--lav-lt)", fontSize: 14.5 }}>
                        {asString(group.lede)}
                      </p>
                    </div>
                    <a className="more" href={asString(group.moreHref, "#")} style={{ color: "var(--gold-lt)" }}>
                      {asString(group.moreLabel, "全部影片 →")}
                    </a>
                  </div>
                  <div className="vgrid">
                    {items.map((row, itemIndex) => {
                      const rowTitle = asString(row.title);
                      const href = resolveVideoHref(asString(row.href), rowTitle, groupIndex * 20 + itemIndex + 1);
                      return (
                        <article key={`${rowTitle}-${itemIndex}`} className="vid">
                          <a href={href} {...externalAttrs(href)}>
                            <div className="thumb">
                              <img src={asString(row.image)} alt={rowTitle} />
                              <span className="play">▶</span>
                            </div>
                            <h4>{rowTitle}</h4>
                            <p className="meta">{asString(row.meta)}</p>
                          </a>
                        </article>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}

          {moreButtonLabel ? (
            <section className="sec" style={{ padding: "40px 0 76px" }}>
              <div className="wrap" style={{ textAlign: "center" }}>
                <a className="btn btn--line-light" href={resolvedMoreButtonHref}>
                  {moreButtonLabel}
                </a>
              </div>
            </section>
          ) : null}
        </div>
      </>
    );
  }

  return (
    <>
      <InteriorHead section={section} slug={slug} title={title} subtitle={subtitle} />
      <InteriorTabs section={section} slug={slug} />
      <div className="vwrap">
        <section className="sec" style={{ padding: "56px 0 0" }}>
          <div className="wrap">
            {filters.length > 0 ? (
              <div className="filters" style={{ marginBottom: 36 }}>
                {filters.map((row, index) => (
                  <a
                    key={`${row.label}-${index}`}
                    className={row.active ? "chip on" : "chip"}
                    href={row.href}
                    style={
                      row.active
                        ? { background: "var(--gold-lt)", borderColor: "var(--gold-lt)", color: "var(--pl-deep)" }
                        : { background: "rgba(255,255,255,.08)", borderColor: "rgba(255,255,255,.2)", color: "var(--lav-lt)" }
                    }
                  >
                    {row.label}
                  </a>
                ))}
              </div>
            ) : null}

            {asString(introNote.body) ? (
              <div className="vnote" style={{ marginBottom: 40 }}>
                <b>{asString(introNote.title, "说明")}</b>
                {asString(introNote.body)}{" "}
                {asString(introNote.linkLabel) ? (
                  <a href={asString(introNote.linkHref, "#")}>{asString(introNote.linkLabel)}</a>
                ) : null}
              </div>
            ) : null}

            {featuredTitle ? (
              <article className="vfeat">
                <a href={featuredHref} style={{ display: "contents" }} {...externalAttrs(featuredHref)}>
                  <div className="thumb">
                    <img src={featuredImage} alt={featuredTitle} />
                    <span className="vplay">▶</span>
                  </div>
                  <div>
                    <span className="tag" style={{ color: "var(--gold-lt)" }}>
                      {featuredTag}
                    </span>
                    <h2>{featuredTitle}</h2>
                    <p>{featuredSummary}</p>
                    <p className="meta">{featuredMeta}</p>
                  </div>
                </a>
              </article>
            ) : null}

            {episodes.length > 0 ? (
              <>
                <p className="eyebrow" style={{ marginBottom: 20 }}>
                  {episodesTitle || "剧集列表"}
                </p>
                <div className="eplist">
                  {episodes.map((row, index) => {
                    const rowTitle = asString(row.title);
                    const href = resolveVideoHref(asString(row.href), rowTitle, index + 40);
                    return (
                      <a key={`${rowTitle}-${index}`} className="ep" href={href} {...externalAttrs(href)}>
                        <b>{asString(row.index, String(index + 1).padStart(2, "0"))}</b>
                        <h4>{rowTitle}</h4>
                        <span>{asString(row.meta)}</span>
                      </a>
                    );
                  })}
                </div>
              </>
            ) : null}

            {gridItems.length > 0 ? (
              <>
                {secondaryGridTitle ? (
                  <p className="eyebrow" style={{ margin: "52px 0 20px" }}>
                    {secondaryGridTitle}
                  </p>
                ) : null}
                <div className="vg">
                  {gridItems.map((row, index) => {
                    const rowTitle = asString(row.title);
                    const href = resolveVideoHref(asString(row.href), rowTitle, index + 80);
                    return (
                      <article key={`${rowTitle}-${index}`}>
                        <a href={href} {...externalAttrs(href)}>
                          <div className="thumb">
                            <img src={asString(row.image)} alt={rowTitle} />
                            <span className="play">▶</span>
                          </div>
                          <h3>{rowTitle}</h3>
                          <p className="meta">{asString(row.meta)}</p>
                        </a>
                      </article>
                    );
                  })}
                </div>
              </>
            ) : null}

            {moreButtonLabel ? (
              <div style={{ textAlign: "center", marginTop: 44 }}>
                <a className="btn btn--line-light" href={resolvedMoreButtonHref}>
                  {moreButtonLabel}
                </a>
              </div>
            ) : null}

            {platformLinks.length > 0 ? (
              <div className="plats" style={{ marginTop: 26 }}>
                {platformLinks.map((row, index) => {
                  const href = resolveVideoHref(asString(row.href), asString(row.label), index + 120);
                  return (
                    <a key={`${asString(row.label)}-${index}`} className="plat" href={href} {...externalAttrs(href)}>
                      {asString(row.label, `平台 ${index + 1}`)}
                    </a>
                  );
                })}
              </div>
            ) : null}
          </div>
        </section>

        {asString(reuseNote.body) ? (
          <section className="sec" style={{ padding: "0 0 76px" }}>
            <div className="wrap">
              <div className="vnote">
                <b>{asString(reuseNote.title, "全部影片可自由下载、转载与再制作")}</b>
                {asString(reuseNote.body)}{" "}
                {asString(reuseNote.linkLabel) ? (
                  <a href={asString(reuseNote.linkHref, "#")}>{asString(reuseNote.linkLabel)}</a>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
