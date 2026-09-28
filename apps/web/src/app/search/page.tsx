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
          <p className="sub">关键词：{query || "（未输入）"}</p>
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
                      <p className="meta">新闻与报告</p>
                      <h3>{item.title}</h3>
                      <p>{item.excerpt}</p>
                      <Link href={`/news/${item.slug}` as Route}>打开页面</Link>
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
