-- The byline's second half.
--
-- The old site's bylines read 文／陈光诚｜著名维权人士 -- a name and what that
-- person is. For the international voices the affiliation carries most of the
-- weight: 维吾尔人权项目 UHRP 执行主任, 前美国助理国务卿, 哈德逊研究所宗教自由中心.
-- Dropping it would keep the name and lose the reason the name matters.
--
-- Nullable with a default, so the author harvest can run before this is applied
-- and be backfilled from artifacts/phase5/authors.log afterwards.

alter table cms_articles
  add column if not exists author_title text not null default '';
