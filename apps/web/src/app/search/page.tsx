import Link from "next/link";
import type { Route } from "next";
import { searchPublishedArticles } from "@/lib/search-repository";

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolved = await searchParams;
  const query = resolved.q?.trim() ?? "";
  const results = await searchPublishedArticles(query, { locale: "zh", limit: 30 });

  return (
    <>
      <section className="phead phead--slim">
        <div className="wrap">
          <p className="crumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>搜索</span>
          </p>
          <h1>搜索结果</h1>
          <p className="sub">
            关键词：{query || "（未输入）"}
            {query ? `　共 ${results.length} 条` : ""}
          </p>
        </div>
      </section>
      <section className="sec">
        <div className="wrap cols">
          <article>
            {results.length === 0 ? (
              <p>没有匹配结果。</p>
            ) : (
              <div className="arch">
                {results.map((item) => (
                  <article key={item.id} className="arow">
                    <div className="athumb">
                      <div className="sectionCard" />
                    </div>
                    <div>
                      {/* The label and the link both come from the backend: a
                          video and a material do not live under /news, and this
                          page used to call every result 新闻与报告 and send it
                          there regardless. */}
                      <p className="meta">{item.typeLabel}</p>
                      <h3>
                        <Link href={item.href as Route}>{item.title}</Link>
                      </h3>
                      {item.excerpt ? <p>{item.excerpt}</p> : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
          <aside className="side">
            <section className="panel">
              <h4>搜索建议</h4>
              <ul>
                <li>尝试更短关键词</li>
                <li>优先使用标题词</li>
                <li>可切换到分类页浏览</li>
              </ul>
            </section>
          </aside>
        </div>
      </section>
    </>
  );
}
