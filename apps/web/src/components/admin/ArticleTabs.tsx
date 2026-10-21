import Link from "next/link";
import { t } from "@/lib/i18n";

/** The article screens, as one tab bar. */
export function ArticleTabs({
  active
}: {
  active: "search" | "latest" | "stats" | "new" | "categories";
}) {
  const tabs = [
    { key: "search", href: "/admin/articles", label: t("admin.art.tab.search") },
    { key: "latest", href: "/admin/articles/latest", label: t("admin.art.tab.latest") },
    { key: "stats", href: "/admin/articles/stats", label: t("admin.art.tab.stats") },
    // 新建文章 is a tab rather than a button off to the right: it is one of the
    // four screens, and putting it in the row means the bar shows where you are
    // while writing instead of going blank.
    { key: "new", href: "/admin/articles/new", label: t("admin.art.tab.new") },
    // 分类 belongs with the articles it organises, not in the sidebar: an editor
    // reaches for it while filing a piece, not as a separate errand.
    { key: "categories", href: "/admin/categories", label: t("admin.art.tab.categories") }
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
