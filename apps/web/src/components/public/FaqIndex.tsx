import Link from "next/link";
import type { Route } from "next";
import type { PublicFaqGroup } from "@/lib/public-content";

/** How many questions a card shows before it offers 了解更多. */
const PER_CARD = 6;

/** Folder, as on the old site's category headings. */
function FolderIcon() {
  return (
    <svg className="faq-ico" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
    </svg>
  );
}

/** Document, as on each question row. */
function DocIcon() {
  return (
    <svg className="faq-ico faq-ico--doc" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3h8l4 4v14H6V3Z" />
      <path d="M14 3v4h4" />
    </svg>
  );
}

export function FaqSearch({ q, action }: { q: string; action: string }) {
  return (
    <form className="faq-search faq-surface" action={action} method="get">
      <svg className="faq-search-ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="11" cy="11" r="7" />
        <path d="m16.5 16.5 4 4" />
      </svg>
      <input type="search" name="q" defaultValue={q} placeholder="请输入关键字…" aria-label="搜索问答" />
      <button type="submit">搜 索</button>
    </form>
  );
}

export function FaqIndex({ groups, q }: { groups: PublicFaqGroup[]; q: string }) {
  if (groups.length === 0) {
    return (
      <p className="muted" style={{ textAlign: "center", padding: "40px 0" }}>
        {q ? `没有找到包含「${q}」的问题。` : "暂时没有问答。"}
      </p>
    );
  }

  return (
    <div className="faq-grid">
      {groups.map((group) => {
        // Searching shows every hit; browsing shows a card's worth and a link.
        const shown = q ? group.items : group.items.slice(0, PER_CARD);
        const hidden = group.total - shown.length;
        return (
          <section className="faq-card faq-surface" key={group.slug}>
            <header className="faq-card-head">
              <FolderIcon />
              <h2>
                <Link href={`/services/faq/c/${encodeURIComponent(group.slug)}` as Route}>{group.name}</Link>
              </h2>
              <span className="faq-count">{group.total}</span>
            </header>
            {group.summary ? <p className="faq-card-note">{group.summary}</p> : null}
            <ul className="faq-list">
              {shown.map((item) => (
                <li key={item.slug}>
                  <Link href={`/services/faq/${encodeURIComponent(item.slug)}` as Route}>
                    <DocIcon />
                    <span>{item.question}</span>
                  </Link>
                </li>
              ))}
            </ul>
            {hidden > 0 ? (
              <Link className="faq-more" href={`/services/faq/c/${encodeURIComponent(group.slug)}` as Route}>
                了解更多
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
