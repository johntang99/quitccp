import Link from "next/link";
import { InteriorHead, InteriorTabs } from "@/components/templates/InteriorScaffold";
import { externalLinkProps } from "@/lib/external-services";
import type { PublicMaterial, PublicMaterialCategory } from "@/lib/public-content";

/**
 * 真相点资料 — the category listing and the single-material page.
 *
 * These read from `cms_materials`. The download page used to be a hand-written
 * JSON document whose per-category counts ("216 项", "86 项") were typed rather
 * than counted and whose every link was "#"; materials arrive a few at a time,
 * forever, so that shape guaranteed drift.
 */

/** One download button. A file with no address never reaches here. */
function FileLinks({ files }: { files: PublicMaterial["files"] }) {
  if (files.length === 0) return null;
  return (
    <div className="fmt">
      {files.map((file) => (
        <a key={`${file.label}-${file.url}`} className="pill" href={file.url} {...externalLinkProps(file.url)}>
          {file.label || `下载${file.kind ? `（${file.kind}）` : ""}`}
        </a>
      ))}
    </div>
  );
}

export function MaterialCategoryPage({
  category,
  materials
}: {
  category: PublicMaterialCategory;
  materials: PublicMaterial[];
}) {
  return (
    <>
      <InteriorHead section="resources" slug="downloads" title={category.name} subtitle={category.summary} />
      <InteriorTabs section="resources" slug="downloads" />
      <section className="sec" style={{ padding: "52px 0 88px" }}>
        <div className="wrap">
          <p className="eyebrow" style={{ marginBottom: 8 }}>
            共 {materials.length} 项
          </p>
          <p style={{ margin: "0 0 32px" }}>
            <Link className="more" href="/resources/downloads">
              ← 返回全部资料
            </Link>
          </p>
          {materials.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>这个分类下还没有资料。</p>
          ) : (
            <div className="arch">
              {materials.map((material) => (
                <article key={material.slug} className="arow">
                  {/* `display: contents` so the image and the text stay direct
                      children of the .arow grid; wrapping them in the link
                      otherwise collapses both into the first column. */}
                  <Link
                    href={`/resources/downloads/${category.slug}/${material.slug}`}
                    style={{ display: "contents" }}
                  >
                    {material.coverImage ? (
                      <img src={material.coverImage} alt={material.coverImageAlt} />
                    ) : (
                      <span />
                    )}
                    <div>
                      <h3>{material.title}</h3>
                      <p>{material.summary}</p>
                      <p className="meta">
                        {material.files.length} 个文件
                        {material.publishedAt ? ` · ${material.publishedAt.slice(0, 10)}` : ""}
                      </p>
                    </div>
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function MaterialDetailPage({ material }: { material: PublicMaterial }) {
  return (
    <>
      <InteriorHead
        section="resources"
        slug="downloads"
        title={material.title}
        subtitle={material.summary}
      />
      <InteriorTabs section="resources" slug="downloads" />
      <section className="sec" style={{ padding: "52px 0 88px" }}>
        <div className="wrap cols">
          <div>
            {material.categorySlug ? (
              <p style={{ margin: "0 0 24px" }}>
                <Link className="more" href={`/resources/downloads/${material.categorySlug}`}>
                  ← {material.categoryName}
                </Link>
              </p>
            ) : null}

            {/* The preview image is the material: on the old site each of these
                was a post whose body was one large picture of the board or
                leaflet. It is shown whole rather than cropped. */}
            {material.coverImage ? (
              <img
                src={material.coverImage}
                alt={material.coverImageAlt}
                style={{ width: "100%", height: "auto", background: "var(--paper)", marginBottom: 28 }}
              />
            ) : null}

            <FileLinks files={material.files} />

            {/* Plain paragraphs rather than the article Markdown pipeline: a
                material's body is a few lines of explanation, and anything
                richer belongs in the files. */}
            {material.bodyMarkdown ? (
              <div className="prose" style={{ marginTop: 32 }}>
                {material.bodyMarkdown
                  .split(/\n{2,}/)
                  .map((para) => para.trim())
                  .filter(Boolean)
                  .map((para, index) => (
                    <p key={index}>{para}</p>
                  ))}
              </div>
            ) : null}
          </div>

          <aside className="side">
            <div className="panel">
              <h4>下载</h4>
              <ul>
                {material.files.map((file) => (
                  <li key={`${file.label}-${file.url}`}>
                    <a href={file.url} {...externalLinkProps(file.url)}>
                      {file.label || "下载"}
                      {file.kind ? <em style={{ fontStyle: "normal", color: "var(--muted)" }}> · {file.kind}</em> : null}
                    </a>
                  </li>
                ))}
                {material.files.length === 0 ? <li style={{ color: "var(--muted)" }}>暂无文件。</li> : null}
              </ul>
            </div>
            <div className="panel">
              <h4>使用说明</h4>
              <p style={{ fontSize: 13.5, lineHeight: "var(--lh-body)", margin: 0, color: "var(--ink-soft)" }}>
                可自由下载、印制、转载、翻译与再制作，无需事先取得授权，也不需要通知我们。注明来源即可。
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}

/**
 * /resources/downloads — one card per category, with a real count.
 *
 * Its own component rather than a branch of SectionHomeTemplate, which is a
 * synchronous function and so cannot read the database. The surrounding copy
 * (heading, 使用说明) still comes from the CMS page; only the cards are live.
 */
export function MaterialsIndexPage({
  title,
  subtitle,
  categories,
  links,
  notice
}: {
  title: string;
  subtitle: string;
  categories: PublicMaterialCategory[];
  /** Collections we point at rather than host, shown after the categories. */
  links: { title: string; body: string; badge: string; href: string }[];
  notice?: { title: string; body: string };
}) {
  return (
    <>
      <InteriorHead section="resources" slug="downloads" title={title} subtitle={subtitle} />
      <InteriorTabs section="resources" slug="downloads" />
      <section className="sec" style={{ padding: "52px 0 0" }}>
        <div className="wrap">
          <div className="dlgrid">
            {categories.map((category) => (
              <article key={category.slug} className="dlcard">
                <h3>
                  <Link href={`/resources/downloads/${category.slug}`}>{category.name}</Link>
                </h3>
                <p>{category.summary}</p>
                {/* Counted, not typed. The page this replaces claimed 216 项 for
                    a category whose every link was "#". */}
                <p className="f">
                  {category.count > 0 ? (
                    <Link href={`/resources/downloads/${category.slug}`}>{category.count} 项 · 查看全部 →</Link>
                  ) : (
                    "暂无资料"
                  )}
                </p>
              </article>
            ))}
            {/* Material we do not hold ourselves -- the photo archive lives on
                Flickr. Shown in the same grid so it reads as one shelf, with the
                host named on the card so a reader knows they are leaving. */}
            {links.map((link) => (
              <article key={link.href} className="dlcard">
                <h3>
                  <a href={link.href} {...externalLinkProps(link.href)}>
                    {link.title}
                  </a>
                </h3>
                <p>{link.body}</p>
                <p className="f">
                  <a href={link.href} {...externalLinkProps(link.href)}>
                    {link.badge ? `${link.badge} · ` : ""}前往 →
                  </a>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>
      {notice ? (
        <section className="sec" style={{ padding: "52px 0 88px" }}>
          <div className="wrap">
            <div className="notice">
              <b>{notice.title}</b>
              {notice.body}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
