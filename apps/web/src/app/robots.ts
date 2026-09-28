import type { MetadataRoute } from 'next';

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tuidang.org').replace(/\/$/, '');

export default function robots(): MetadataRoute.Robots {
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
