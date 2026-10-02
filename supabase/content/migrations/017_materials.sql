-- 真相点资料: the downloadable materials, as records rather than page JSON.
--
-- /resources/downloads was a hand-written JSON document: four cards, each with
-- a typed list of sub-headings and typed counts ("216 项 · 源文件 ＋ 成品",
-- "86 项"). None of those numbers were counted from anything and every link was
-- "#". Materials arrive a few at a time, forever, so an editor adding one had to
-- find the right nested array, add a row, and hand-update two counts.
--
-- This gives them the same shape articles and videos already have: a record, a
-- category, a status, an editor form. The counts on the page become a count.
--
-- Mirrors 012_video_categories deliberately -- table + many-to-many map with
-- `position` 0 marking the primary category -- so the third content type in
-- this CMS behaves like the first two rather than inventing its own rules.

create table if not exists cms_material_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  -- Shown as the card's paragraph on /resources/downloads, so it belongs to the
  -- category rather than to the page that happens to list it.
  summary    text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cms_materials (
  id           uuid primary key default gen_random_uuid(),
  slug         text not null unique,
  locale       text not null default 'zh',
  title        text not null,
  summary      text not null default '',
  body_markdown text not null default '',

  -- The large preview image. On the old site this *is* the material: a post
  -- whose body is one big picture of the board or leaflet.
  cover_image     text not null default '',
  cover_image_alt text not null default '',

  /*
   * The downloadable files, as [{label, url, kind, note}].
   *
   * A child table was the alternative. Rejected because a material's files are
   * only ever read, written and ordered as one set -- the same 展板 in AI, PDF
   * and 转曲 form -- and nothing needs to query across them. The editor sees
   * add/remove rows in a form, not JSON; `files` being jsonb is an
   * implementation detail of one record, not a document an editor maintains.
   *
   * If per-file download counts are ever wanted, this becomes a child table.
   */
  files        jsonb not null default '[]'::jsonb,

  status       text not null default 'draft',
  featured     boolean not null default false,
  published_at timestamptz,

  -- Where it came from on the old site, so a re-import can recognise it.
  legacy_url   text not null default '',
  legacy_id    bigint,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists cms_material_category_map (
  material_id uuid not null references cms_materials(id) on delete cascade,
  category_id uuid not null references cms_material_categories(id) on delete cascade,
  position    smallint not null default 0,
  primary key (material_id, category_id)
);

create index if not exists idx_cms_materials_published_at
  on cms_materials (published_at desc nulls last);
create index if not exists idx_cms_materials_status
  on cms_materials (status, locale);
create index if not exists idx_cms_materials_featured
  on cms_materials (published_at desc nulls last) where featured;
create index if not exists idx_cms_material_category_map_material_position
  on cms_material_category_map (material_id, position);
create index if not exists idx_cms_material_category_map_category
  on cms_material_category_map (category_id);
create index if not exists idx_cms_material_categories_sort
  on cms_material_categories (sort_order, name);

-- The four groups the download page already shows, plus 良言善语, which the old
-- site has and the new page dropped. Names and order are editable; these exist
-- so the first import has somewhere to land.
--
-- 展板横幅 / 传单小册子 / 真相广播 / 良言善语 are the old site's own categories
-- (/category/zxdzl/...). 手举牌与贴纸 is not -- the prototype invented it -- so
-- it starts empty rather than pretending to hold anything.
insert into cms_material_categories (slug, name, summary, sort_order) values
  ('boards',    '展板与横幅',   '服务点与集会现场使用的大尺寸物料，提供可编辑源文件与高分辨率成品。', 10),
  ('leaflets',  '传单与小册子', 'A4、A5 与三折页，适合服务点现场发放与邮寄。',                     20),
  ('placards',  '手举牌与贴纸', '集会、游行与征签现场使用的套件，含空白模板。',                     30),
  ('broadcast', '真相广播与音频', '音频节目与播报文稿，可用于电台、线上传播与现场播放。',            40),
  ('kind-words','良言善语',     '劝善短语与对联，适合印制与现场发放。',                            50)
on conflict (slug) do nothing;
