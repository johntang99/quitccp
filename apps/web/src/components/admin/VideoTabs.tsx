import Link from "next/link";
import { t } from "@/lib/i18n";

/** The four video screens, as one tab bar — the same shape articles use. */
export function VideoTabs({
  active
}: {
  active: "search" | "latest" | "stats" | "new" | "categories";
}) {
  const tabs = [
    { key: "search", href: "/admin/videos", label: t("admin.vid.tab.search") },
    { key: "latest", href: "/admin/videos/latest", label: t("admin.vid.tab.latest") },
    { key: "stats", href: "/admin/videos/stats", label: t("admin.vid.tab.stats") },
    { key: "new", href: "/admin/videos/new", label: t("admin.vid.tab.new") },
    // 分类 sits in the row rather than off to the right: it is one of these
    // screens, and as a tab the bar can show when you are on it.
    { key: "categories", href: "/admin/video-categories", label: t("admin.vid.tab.categories") }
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
