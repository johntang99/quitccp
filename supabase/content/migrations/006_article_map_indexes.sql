create index if not exists idx_cms_article_category_map_category_id
  on cms_article_category_map(category_id);

create index if not exists idx_cms_article_tag_map_tag_id
  on cms_article_tag_map(tag_id);
