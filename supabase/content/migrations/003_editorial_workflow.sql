create table if not exists cms_article_reviews (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references cms_articles(id) on delete cascade,
  reviewer_email text not null,
  decision text not null check (decision in ('request_changes','approved','rejected')),
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists cms_bulk_operations (
  id uuid primary key default gen_random_uuid(),
  actor_email text not null,
  operation text not null,
  target_type text not null,
  target_ids text[] not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cms_article_reviews_article on cms_article_reviews(article_id, created_at desc);
