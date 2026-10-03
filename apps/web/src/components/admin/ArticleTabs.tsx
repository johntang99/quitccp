import Link from "next/link";

/** The article screens, as one tab bar. */
export function ArticleTabs({
  active
}: {
  active: "search" | "latest" | "stats" | "new" | "categories";
}) {
  const tabs = [
    { key: "search", href: "/admin/articles", label: "查找与修改" },
    { key: "latest", href: "/admin/articles/latest", label: "最新 100 篇" },
    { key: "stats", href: "/admin/articles/stats", label: "文章统计" },
    // 新建文章 is a tab rather than a button off to the right: it is one of the
    // four screens, and putting it in the row means the bar shows where you are
    // while writing instead of going blank.
    { key: "new", href: "/admin/articles/new", label: "新建文章" },
    // 分类 belongs with the articles it organises, not in the sidebar: an editor
    // reaches for it while filing a piece, not as a separate errand.
    { key: "categories", href: "/admin/categories", label: "文章分类" }
  ] as const;
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tab.key === active ? "on" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
