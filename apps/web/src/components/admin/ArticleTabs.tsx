import Link from "next/link";

/** The four article screens, as one tab bar. */
export function ArticleTabs({ active }: { active: "search" | "latest" | "stats" }) {
  const tabs = [
    { key: "search", href: "/admin/articles", label: "查找与修改" },
    { key: "latest", href: "/admin/articles/latest", label: "最新 100 篇" },
    { key: "stats", href: "/admin/articles/stats", label: "文章统计" }
  ] as const;
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tab.key === active ? "on" : undefined}>
          {tab.label}
        </Link>
      ))}
      <Link className="admin-btn admin-btn-primary" style={{ marginLeft: "auto" }} href="/admin/articles/new">
        ＋ 新建文章
      </Link>
    </nav>
  );
}
