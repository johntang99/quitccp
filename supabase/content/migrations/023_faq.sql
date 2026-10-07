-- 常见问答 (FAQ): the question-and-answer library, as records.
--
-- The old site runs its FAQ on the BetterDocs WordPress plugin at
-- tuidang.org/faq/ -- 6 categories, 45 answers, each one an ordinary post with
-- a position inside its category. On this site the same content lived as three
-- hand-written entries inside `pages/services-faq.json`, with a sidebar panel
-- of links pointing readers back to the old site for the real answers.
--
-- The FAQ is one of the most-used parts of tuidang.org, and after the cutover
-- there is no old site to point at. So it gets the shape articles, videos and
-- materials already have: a record, a category, a status, an editor form, and
-- an answer written in the same Markdown editor as an article body.
--
-- Mirrors 017_materials deliberately. One difference: a FAQ belongs to exactly
-- one category -- the old site models it that way, the page renders it that
-- way, and a many-to-many map would add a join table nothing would query
-- across.

create table if not exists cms_faq_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  -- Shown under the category heading on the public page.
  summary    text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists cms_faqs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null,
  locale          text not null default 'zh',
  question        text not null,
  -- Same Markdown the article body uses, rendered by the same component.
  answer_markdown text not null default '',

  category_id uuid references cms_faq_categories(id) on delete set null,

  -- Order within the category. Not a global order: the page groups by category,
  -- so "third question under 安全与隐私" is the only ordering that means
  -- anything. Gaps are fine -- the editor's move up/down rewrites the run.
  position integer not null default 0,

  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),

  -- Where it came from, so a re-import updates rather than duplicates and a
  -- reader following an old /docs/694445/ link can be redirected.
  legacy_id  integer,
  legacy_url text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by text not null default '',
  updated_by text not null default ''
);

-- One row per slug per language, the same rule articles use.
create unique index if not exists cms_faqs_slug_locale_key on cms_faqs (slug, locale);
-- Partial, because rows written by hand in the admin have no legacy id and
-- several nulls must be allowed to coexist.
create unique index if not exists cms_faqs_legacy_id_key on cms_faqs (legacy_id) where legacy_id is not null;
-- The public page's only query: published questions of a category, in order.
create index if not exists cms_faqs_category_position_idx on cms_faqs (category_id, position);
create index if not exists cms_faqs_status_idx on cms_faqs (status);

create or replace function cms_faqs_touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists cms_faqs_set_updated_at on cms_faqs;
create trigger cms_faqs_set_updated_at
  before update on cms_faqs
  for each row execute function cms_faqs_touch_updated_at();
