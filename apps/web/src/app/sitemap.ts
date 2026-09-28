import type { MetadataRoute } from 'next';

const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.tuidang.org').replace(/\/$/, '');
const ROUTES = ['/', '/about', '/services', '/involve', '/resources', '/news', '/videos', '/search', '/terms'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return ROUTES.map((route) => ({
    url: `${SITE_ORIGIN}${route}`,
    lastModified: now,
    changeFrequency: route === '/' ? 'weekly' : 'daily',
    priority: route === '/' ? 1 : 0.8,
  }));
}
