-- Fields the import needs and 012 does not carry.
--
-- The big one is `body_markdown`. 233 of the 745 videos being imported have no
-- player at all -- the old site published the episode's transcript or summary as
-- text, and 九评共产党 is the original essay at 7,000-16,000 characters each.
-- Truncating those into `description` would destroy them, so a video carries a
-- body the same way an article does, and the page renders it when there is no
-- player to show instead.
--
-- `backup_url` is for a 干净世界 address alongside a YouTube one, since YouTube
-- is unreachable from mainland China. Almost none exist on the old site yet;
-- the column is here so editors can fill them in as they go.

alter table cms_videos
  add column if not exists body_markdown   text not null default '',
  add column if not exists episode         text not null default '',
  add column if not exists speaker         text not null default '',
  add column if not exists source_credit   text not null default '',
  add column if not exists backup_url      text not null default '',
  add column if not exists cover_image_alt text not null default '',
  add column if not exists legacy_url      text not null default '';

-- The import matches on legacy_id so it can be re-run without duplicating.
create unique index if not exists idx_cms_videos_legacy_id
  on cms_videos (legacy_id) where legacy_id is not null;

create index if not exists idx_cms_videos_legacy_url
  on cms_videos (legacy_url) where legacy_url <> '';
