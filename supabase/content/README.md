# Content Database Migrations

This database stores non-sensitive CMS content:

- pages and page blocks
- articles, categories, tags
- videos and media metadata
- revisions, audit logs, redirects

## Migration Order

1. `001_initial_content_schema.sql`
2. `002_search_functions.sql`
3. `003_editorial_workflow.sql`
