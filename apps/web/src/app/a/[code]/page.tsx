import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateRenderer } from "@/components/templates/TemplateRenderer";
import { articleShareMetadata } from "@/lib/article-share-metadata";
import { getArticleSlugByShortCode, getRenderableArticle } from "@/lib/public-content";
import { looksLikeShortCode } from "@/lib/short-code";

/**
 * `/a/<短码>` —— 一篇文章的短地址。
 *
 * 公开地址是中文标题，编码之后是一堵 %E4%B8：实测一篇 168 个字符，最长的视频
 * 611 个。贴进微信、印在传单上、念给人听都不成立，而且对一个劝人退党的网站
 * 来说还多一层代价 —— 一串百分号看起来像钓鱼链接。这条路由把它压到 34 个字符。
 *
 * ## 为什么是渲染，不是跳转
 *
 * 跳转（301 到长地址）更省事，但它把短地址的好处只给了「链接本身」：读者点
 * 进来，地址栏立刻变回那堵百分号，他再复制一次分享给别人，链条就退化了。直接
 * 渲染的话，从短链进来的人地址栏一直是短的，转发多少手都还是短的。
 *
 * 代价是同一篇内容有两个地址。`canonical` 指向长地址，这是搜索引擎用来合并
 * 二者的标准办法 —— 收录和权重都算在长地址上，短地址只是入口。
 *
 * ## 短码不跟着 slug 走
 *
 * 它认的是数据行，不是地址。所以日后把全站地址改成拼音时，已经发出去的短链
 * 一条都不会断。也正因如此，短码一旦发出就不能改、不能回收重用。
 */

/** 和文章页一样的理由：不设上限就继承 Vercel 的 300 秒，那是 10-13 停机的成因。 */
export const maxDuration = 15;
export const revalidate = 300;

/* 空数组不是占位：动态段没有 generateStaticParams 就一直是 no-store，
   有了它才会「按需生成一次、之后走缓存」。 */
export async function generateStaticParams() {
  return [];
}

/** 解析一次短码。同一次渲染里 metadata 和页面各调一次，Next 会去重。 */
async function resolve(code: string): Promise<string | null> {
  /* 形状不对就不必查库 —— 短码是固定 7 位、固定字母表，乱敲的地址在这里
     就被挡下来，不会变成一次数据库查询。这条路由是公开可枚举的入口，
     10-13 的洪水正是冲着这种地址来的。 */
  if (!looksLikeShortCode(code)) return null;
  return getArticleSlugByShortCode(code);
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const slug = await resolve(code);
  if (!slug) return {};
  const article = await getRenderableArticle(slug);
  if (!article) return {};
  /* 正主是长地址（canonical）。两个地址渲染同一篇内容时，这是唯一告诉搜索引擎
     「别当成两篇」的东西 —— 漏了它就是自己跟自己打架。og:url 则留短地址：
     分享卡片上显示的就是人家转发的那条。 */
  return articleShareMetadata(article, `/a/${code}`, `/news/${encodeURIComponent(slug)}`);
}

export default async function ShortArticlePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const slug = await resolve(code);
  if (!slug) notFound();
  const article = await getRenderableArticle(slug);
  if (!article) notFound();
  return <TemplateRenderer {...article} />;
}
