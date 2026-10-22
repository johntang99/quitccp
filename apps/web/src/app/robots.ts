import type { MetadataRoute } from 'next';

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tuidang.org').replace(/\/$/, '');

/**
 * 还没有自己域名的站不让收录。
 *
 * 多语言站是一个语言一个 Vercel 项目，新开的那个在拿到域名之前只有一个
 * xxx.vercel.app 地址。英文站现在就是这个状态：它要公开给英文编辑用，所以
 * 不能挡在 Vercel 的登录墙后面 —— 而一公开，搜索引擎就会来。
 *
 * 那个站上放的是机构的真内容，被收录的后果不是「多一个地址」而是：读者搜到
 * 的是一个临时地址，正式域名上线后这些内容会被判成互相抄袭的重复内容，而
 * 那个 .vercel.app 已经先被收进去了。
 *
 * 判据是地址本身，不是另加一个开关 —— 开关会忘记关，而「域名还是
 * vercel.app」这件事本身就说明这个站还没上线。等接上正式域名，
 * NEXT_PUBLIC_SITE_URL 一换，这里自动恢复允许收录，不用再改代码。
 */
const IS_TEMPORARY_HOST = /\.vercel\.app$/i.test(new URL(SITE_ORIGIN).hostname);

export default function robots(): MetadataRoute.Robots {
  if (IS_TEMPORARY_HOST) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
      host: SITE_ORIGIN,
    };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/admin/'],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
