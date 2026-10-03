import Link from "next/link";

/** The material screens, as one tab bar — the same shape articles and videos use. */
export function MaterialTabs({ active }: { active: "search" | "new" | "categories" }) {
  const tabs = [
    { key: "search", href: "/admin/materials", label: "查找与修改" },
    { key: "new", href: "/admin/materials/new", label: "新建资料" },
    // 分类 sits in the row rather than off to the right: it is one of these
    // screens, and as a tab the bar can show when you are on it.
    { key: "categories", href: "/admin/material-categories", label: "资料分类" }
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
