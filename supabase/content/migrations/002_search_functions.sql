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
  with ranked as (
    select
      a.id,
      a.slug,
      a.title,
      a.summary,
      (
        similarity(a.title, p_query) * 0.55 +
        similarity(a.body_plain, p_query) * 0.35 +
        similarity(coalesce(string_agg(t.name, ' '), ''), p_query) * 0.10
      )::real as score
    from cms_articles a
    left join cms_article_tag_map atm on atm.article_id = a.id
    left join cms_article_tags t on t.id = atm.tag_id
    where
      a.locale = p_locale
      and a.status = 'published'
      and (
        a.title % p_query
        or a.body_plain % p_query
        or t.name % p_query
      )
    group by a.id
  )
  select id, slug, title, summary, score
  from ranked
  order by score desc
  limit p_limit
  offset p_offset;
$$;
