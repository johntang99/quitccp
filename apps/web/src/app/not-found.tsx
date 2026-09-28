import Link from "next/link";

export default function NotFound() {
  return (
    <section className="sec">
      <div className="wrap">
        <article className="sectionCard">
          <h1 className="sectionTitle">404 - 页面不存在</h1>
          <p className="muted">可能是旧站链接已迁移。请返回首页或使用搜索。</p>
          <div className="hero-cta">
            <Link className="btn btn--seal" href="/">
              返回首页
            </Link>
            <Link className="btn btn--line" href="/search">
              站内搜索
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
