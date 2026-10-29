import { notFound } from "next/navigation";
import { getPublicFaq, getRenderablePage } from "@/lib/public-content";
import { getRegistryTotal } from "@/lib/santui";
import { TemplateRenderer } from "./templates/TemplateRenderer";

interface PageFromRouteProps {
  section: string;
  slug?: string;
  query?: Record<string, string | string[] | undefined>;
}

/**
 * /about/numbers 顶上的「累计声明人数」取登记册的实时值，和首页同一个来源。
 *
 * 后台里那个数是编辑手敲的，敲完就不会再变；页面写着「这个数字是怎么统计的」，
 * 底下挂一个停在某天的数，正好说反了。认的是标签里的「累计」，编辑改了顺序
 * 也找得到；登记册读不到时保留后台的数。
 */
async function withLiveTotal(content: Record<string, unknown> | undefined) {
  const stats = content?.stats;
  if (!Array.isArray(stats)) return content;
  const live = await getRegistryTotal();
  if (!live) return content;
  return {
    ...content,
    stats: stats.map((row) =>
      row && typeof row === "object" && /累计/.test(String((row as Record<string, unknown>).label ?? ""))
        ? { ...row, value: live.total.toLocaleString("en-US") }
        : row
    )
  };
}

export async function PageFromRoute({ section, slug, query }: PageFromRouteProps) {
  const page = await getRenderablePage(section, slug ?? "index");
  // The FAQ is the one page whose body is a content type of its own rather than
  // fields on the page. Fetched here so the template stays a pure renderer.
  const faqGroups =
    section === "services" && (slug ?? "index") === "faq" ? await getPublicFaq() : undefined;
  // Render the real 404 rather than a "not found" body under a 200. A removed
  // page returning 200 keeps it in search indexes and hides it from the
  // redirect-coverage checks.
  if (!page) notFound();

  const content = section === "about" && slug === "numbers" ? await withLiveTotal(page.content) : page.content;

  return <TemplateRenderer {...page} content={content} query={query} faqGroups={faqGroups} />;
}
