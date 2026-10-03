import Link from "next/link";

/** The four video screens, as one tab bar — the same shape articles use. */
export function VideoTabs({
  active
}: {
  active: "search" | "latest" | "stats" | "new" | "categories";
}) {
  const tabs = [
    { key: "search", href: "/admin/videos", label: "查找与修改" },
    { key: "latest", href: "/admin/videos/latest", label: "最新 100 个" },
    { key: "stats", href: "/admin/videos/stats", label: "视频统计" },
    { key: "new", href: "/admin/videos/new", label: "新建视频" },
    // 分类 sits in the row rather than off to the right: it is one of these
    // screens, and as a tab the bar can show when you are on it.
    { key: "categories", href: "/admin/video-categories", label: "视频分类" }
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
