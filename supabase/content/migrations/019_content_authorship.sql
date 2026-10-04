-- Who put this content into the system, and who touched it last.
--
-- cms_articles already has `author`, but that is the public byline -- the person
-- the piece is credited to, often someone outside the organisation. It does not
-- answer the operational question: which of our accounts created this row, and
-- who changed it most recently. With several editors working the same queues,
-- that question comes up whenever something looks wrong, and the audit log can
-- only answer it by scan.
--
-- Both columns are text holding an email, matching cms_admin_users.created_by and
-- the audit trail. Deliberately not foreign keys: deleting an account must not
-- rewrite or block the history of what it published.
--
-- Nullable throughout. Every row that exists today predates this, and inventing
-- an author for it would be worse than admitting we do not know.

alter table cms_articles  add column if not exists created_by text;
alter table cms_articles  add column if not exists updated_by text;

alter table cms_videos    add column if not exists created_by text;
alter table cms_videos    add column if not exists updated_by text;

alter table cms_materials add column if not exists created_by text;
alter table cms_materials add column if not exists updated_by text;

-- The admin lists offer a "mine" filter and sort by these, so they are worth an
-- index on the created side. updated_by is read per row, never filtered on.
create index if not exists idx_cms_articles_created_by  on cms_articles(created_by);
create index if not exists idx_cms_videos_created_by    on cms_videos(created_by);
create index if not exists idx_cms_materials_created_by on cms_materials(created_by);
