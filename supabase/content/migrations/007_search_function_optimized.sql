create or replace function search_articles_trgm(
  p_query text,
  p_locale text default 'zh',
  p_limit integer default 20,
  p_offset integer default 0
)
returns table(
  id uuid,
  slug text,
  title text,
  summary text,
  score real
)
language sql
stable
as $$
  with title_hits as (
    select
      a.id,
      a.slug,
      a.title,
      a.summary,
      similarity(a.title, p_query) as title_sim,
      similarity(a.body_plain, p_query) as body_sim
    from cms_articles a
    where
      a.locale = p_locale
      and a.status = 'published'
      and a.title % p_query
    order by similarity(a.title, p_query) desc
    limit greatest(p_limit * 8, 80)
  ),
  body_hits as (
    select
      a.id,
      a.slug,
      a.title,
      a.summary,
      similarity(a.title, p_query) as title_sim,
      similarity(a.body_plain, p_query) as body_sim
    from cms_articles a
    where
      a.locale = p_locale
      and a.status = 'published'
      and a.body_plain % p_query
    order by similarity(a.body_plain, p_query) desc
    limit greatest(p_limit * 8, 80)
  ),
  unioned as (
    select * from title_hits
    union
    select * from body_hits
  )
  select
    id,
    slug,
    title,
    summary,
    (title_sim * 0.65 + body_sim * 0.35)::real as score
  from unioned
  order by score desc
  limit p_limit
  offset p_offset;
$$;
