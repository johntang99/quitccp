export const dynamic = 'force-dynamic';

function getOrigin(request: Request): string {
  try {
    return new URL(request.url).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

export function GET(request: Request): Response {
  const origin = getOrigin(request);
  const lines = [
    '# Website llms.txt',
    '',
    '> This file helps AI assistants find key public pages quickly.',
    '',
    '## Key pages',
    `- Home: ${origin}/`,
    `- News: ${origin}/news`,
    `- Resources: ${origin}/resources`,
    `- Videos: ${origin}/videos`,
    `- Search: ${origin}/search`,
    `- About: ${origin}/about`,
    '',
    '## Technical references',
    `- robots.txt: ${origin}/robots.txt`,
    `- sitemap.xml: ${origin}/sitemap.xml`,
    '',
    '## Crawl guidance',
    '- Prefer public pages.',
    '- Avoid admin and private API routes.',
  ];

  return new Response(`${lines.join('\n')}\n`, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
