import Link from "next/link";

/** The material screens, as one tab bar — the same shape articles and videos use. */
export function MaterialTabs({ active }: { active: "search" | "new" }) {
  const tabs = [
    { key: "search", href: "/admin/materials", label: "查找与修改" },
    { key: "new", href: "/admin/materials/new", label: "新建资料" }
  ] as const;
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tab.key === active ? "on" : undefined}>
          {tab.label}
        </Link>
      ))}
      <Link className="admin-btn" style={{ marginLeft: "auto" }} href="/admin/material-categories">
        资料分类
      </Link>
    </nav>
  );
}
