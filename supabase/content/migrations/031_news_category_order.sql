-- Gives `sort_order` a meaning on the public side, without moving anything.
--
-- The news tabs used to follow the order of the `NEWS_CATEGORIES` array in
-- `lib/public-content.ts`; `sort_order` only ordered the admin list. Now that
-- readers get the editors' order, the numbers in the database decide the tab
-- bar -- and the numbers it holds are leftovers from the WordPress import
-- (1, 3, 4, 5, 10, 12, 25, 30), which would have silently reshuffled the tabs
-- the moment that code shipped.
--
-- So the eight public categories are numbered 1..8 in exactly the order the
-- site shows today: a deploy that changes nothing, and an editor who can change
-- everything afterwards.
--
-- The other ten categories have no public page and move to 100+, keeping their
-- relative order. That is not cosmetic: the admin lists all eighteen by this
-- number, and leaving them interleaved would have put categories that readers
-- can never reach in between the eight that matter -- with duplicate numbers,
-- since 0..30 is now spoken for twice.

update cms_article_categories set sort_order = sort_order + 100
  where slug not in (
    'announcement-claims', 'red-regime-collapse', 'withdrawal-news',
    'worldwide-supports', 'worldwide-investigation', 'topics-commentary',
    'withdrawal-stories', 'famous-quitccp'
  );

update cms_article_categories set sort_order = v.ord
  from (values
    ('announcement-claims', 1),
    ('red-regime-collapse', 2),
    ('withdrawal-news', 3),
    ('worldwide-supports', 4),
    ('worldwide-investigation', 5),
    ('topics-commentary', 6),
    ('withdrawal-stories', 7),
    ('famous-quitccp', 8)
  ) as v(slug, ord)
  where cms_article_categories.slug = v.slug;

comment on column cms_article_categories.sort_order is
  '列表顺序。1..8 是新闻页上那八个分类的 tab 顺序，读者看得到；100 以上的分类没有公开页面。';
