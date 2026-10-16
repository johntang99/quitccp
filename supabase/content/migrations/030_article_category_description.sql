-- The same column video categories got in 028, for the same reason.
--
-- A news category page shows its name and, under it, `SLUG UPPERCASED · N 篇`
-- -- which is the slug and a count, not a description. There was nowhere for an
-- editor to say what 红朝败相 (8,612 articles) or 退党纪实故事 (310) actually
-- collects, because the table had no column for it.
--
-- Left empty here rather than seeded with invented copy: 18 categories, and a
-- sentence written by whoever ran the migration would read as a description of
-- articles nobody had read. The page falls back to what it shows today until
-- an editor writes something.

alter table cms_article_categories
  add column if not exists description text;

comment on column cms_article_categories.description is
  '分类页标题下面那句话。留空则沿用原来的「SLUG · N 篇」。';

notify pgrst, 'reload schema';
