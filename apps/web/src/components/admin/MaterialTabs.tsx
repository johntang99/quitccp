import Link from "next/link";
import { t } from "@/lib/i18n";

/** The material screens, as one tab bar — the same shape articles and videos use. */
export function MaterialTabs({ active }: { active: "search" | "new" | "categories" }) {
  const tabs = [
    { key: "search", href: "/admin/materials", label: t("admin.mat.tab.search") },
    { key: "new", href: "/admin/materials/new", label: t("admin.mat.tab.new") },
    // 分类 sits in the row rather than off to the right: it is one of these
    // screens, and as a tab the bar can show when you are on it.
    { key: "categories", href: "/admin/material-categories", label: t("admin.mat.tab.categories") }
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
