-- Categories for videos.
--
-- `cms_videos` had no taxonomy of its own: videos could be listed but not filed.
-- This mirrors what articles already have -- a category table and a many-to-many
-- map with `position` 0 marking the primary one -- so the two admins behave the
-- same way rather than each inventing their own rules.

create table if not exists cms_video_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cms_video_category_map (
  video_id uuid not null references cms_videos(id) on delete cascade,
  category_id uuid not null references cms_video_categories(id) on delete cascade,
  position smallint not null default 0,
  primary key (video_id, category_id)
);

create index if not exists idx_cms_video_category_map_video_position
  on cms_video_category_map (video_id, position);

create index if not exists idx_cms_video_categories_sort
  on cms_video_categories (sort_order, name);

-- Fields the video admin needs and the table does not carry yet. `source_url`
-- is the player link -- almost every migrated video is a YouTube embed.
alter table cms_videos
  add column if not exists source_url   text not null default '',
  add column if not exists cover_image  text not null default '',
  add column if not exists published_at timestamptz,
  add column if not exists legacy_id    bigint;

create index if not exists idx_cms_videos_published_at
  on cms_videos (published_at desc nulls last);

-- The eight series you named. Editors can rename or
-- reorder these; they exist so the first import has somewhere to land.
insert into cms_video_categories (slug, name, sort_order) values
  ('frontline',     '三退前线',       10),
  ('party-culture', '破除党文化',     20),
  ('step-back',     '退一步海阔天空', 30),
  ('jiuping',       '九评系列',       40),
  ('ironclad',      '铁证如山',       50),
  ('awakening',     '觉醒之旅',       60),
  ('hope-road',     '希望的路',       70),
  ('others',        '其它系列',       80)
on conflict (slug) do nothing;
