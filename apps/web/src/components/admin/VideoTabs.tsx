import Link from "next/link";

/** The four video screens, as one tab bar — the same shape articles use. */
export function VideoTabs({ active }: { active: "search" | "latest" | "stats" | "new" }) {
  const tabs = [
    { key: "search", href: "/admin/videos", label: "查找与修改" },
    { key: "latest", href: "/admin/videos/latest", label: "最新 100 个" },
    { key: "stats", href: "/admin/videos/stats", label: "视频统计" },
    { key: "new", href: "/admin/videos/new", label: "新建视频" }
  ] as const;
  return (
    <nav className="admin-tabs">
      {tabs.map((tab) => (
        <Link key={tab.key} href={tab.href} className={tab.key === active ? "on" : undefined}>
          {tab.label}
        </Link>
      ))}
      <Link className="admin-btn" style={{ marginLeft: "auto" }} href="/admin/video-categories">
        视频分类
      </Link>
    </nav>
  );
}
