-- Replacing an article's categories and tags without a window where it has none.
--
-- The admin replaces them as a delete followed by an insert, with nothing
-- around the pair. Both halves retry now, which narrows the window, but it
-- does not close it: if the insert still fails -- a statement timeout is
-- enough -- the article is left with no categories at all, and the editor is
-- told 保存失败, so they assume nothing happened and never go back to look.
--
-- That state is worse than a failed save. Categories are how an article is
-- reached from the site, so the article stays published and becomes
-- unreachable from every index that would have listed it. Nothing reports it;
-- somebody has to notice the article missing from a category page.
--
-- A plpgsql function body runs inside one transaction. Either the article ends
-- with exactly the categories it was given, or it ends with the ones it had.
-- There is no third outcome, and no amount of load or latency can produce one.
--
-- The functions also fold two round-trips into one, which matters more in
-- production than it did on a laptop: the admin runs in iad1 and every call to
-- the database crosses a network that a local dev server does not.

-- `security definer` so the function runs with the owner's rights: the admin
-- already reaches these tables with the service-role key, and this keeps that
-- unchanged if row-level security is ever turned on for them.
-- `search_path` is pinned because a definer function that resolves table names
-- through the caller's path is how a definer function becomes a back door.

create or replace function set_article_categories(
  p_article_id uuid,
  p_category_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from cms_article_category_map where article_id = p_article_id;

  if p_category_ids is null or array_length(p_category_ids, 1) is null then
    return;
  end if;

  -- position 0 is the primary category; see 011_category_map_position.sql.
  --
  -- Duplicates are dropped rather than rejected: the editor's form can hand
  -- the same category in twice (once as primary, once as a secondary), and the
  -- composite primary key would make that collision fail the whole save. The
  -- first occurrence wins, and the positions are renumbered afterwards so the
  -- surviving rows stay 0..n-1 with no gap.
  insert into cms_article_category_map (article_id, category_id, position)
  select p_article_id, d.id, (row_number() over (order by d.ord)) - 1
  from (
    select distinct on (t.id) t.id, t.ord
    from unnest(p_category_ids) with ordinality as t(id, ord)
    order by t.id, t.ord
  ) d;
end;
$$;

create or replace function set_article_tags(
  p_article_id uuid,
  p_tag_ids uuid[]
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from cms_article_tag_map where article_id = p_article_id;

  if p_tag_ids is null or array_length(p_tag_ids, 1) is null then
    return;
  end if;

  insert into cms_article_tag_map (article_id, tag_id)
  select distinct p_article_id, t.id
  from unnest(p_tag_ids) as t(id);
end;
$$;
