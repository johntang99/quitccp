# Implementation docs

Working notes for the quitccp build. Grouped by what you came here to do.

## Start here

| doc | what it covers |
|---|---|
| [open-issues.md](./open-issues.md) | 问题清单 — what was broken, what is fixed, **what still needs you**. Read this first |
| [architecture.md](./architecture.md) | how the pieces fit: Next app, Supabase, the CMS tables |
| [implementation-phases.md](./implementation-phases.md) | the plan the build followed, phase by phase |

## Running the site

| doc | what it covers |
|---|---|
| [homepage-cms.md](./homepage-cms.md) | every homepage section, its layout variants, and which fields an editor controls |
| [santui-registry-sync.md](./santui-registry-sync.md) | how the 实时登记册 count and declarations are pulled from santui.tuidang.org, hourly, via GitHub Actions |
| [media-uploads.md](./media-uploads.md) | Storage holds the bytes, a table holds the index, content JSON holds a URL |
| [article-categories.md](./article-categories.md) | the news categories and how articles are assigned |
| [user-management-plan.md](./user-management-plan.md) | 用户与权限 — roles, who may add whom, password reset, and the MFA hole that must be closed first |
| [theme-system-plan.md](./theme-system-plan.md) | 排版与主题 — the plan for one editable theme controlling colours, fonts, sizes and spacing, and why it is not just a JSON file |
| [public-service-intake.md](./public-service-intake.md) | what the public forms accept and where it goes |
| [services-link-out-map.md](./services-link-out-map.md) | every link that leaves for santui / service / www.tuidang.org, and the two data feeds |

## Content migration from the old site

| doc | what it covers |
|---|---|
| [article-migration-plan.md](./article-migration-plan.md) | 文章迁移计划 — the plan for the 15k WordPress posts |
| [phase4-migration-verification.md](./phase4-migration-verification.md) | the dry-run / apply loop and what was checked |
| [wp-taxonomy-live.md](./wp-taxonomy-live.md) | the old site's real category tree, as scraped |
| [video-categories-old-site.md](./video-categories-old-site.md) | 旧站视频 → 新站八个分类 |
| [video-hosting-decision.md](./video-hosting-decision.md) | where the video files should live, with the bandwidth numbers. **Not Supabase** |

## Search

| doc | what it covers |
|---|---|
| [search-baseline.md](./search-baseline.md) | Chinese search on `pg_trgm` — why, and its limits |
| [phase5-search-benchmark.md](./phase5-search-benchmark.md) | the measured baseline |

## Launch and operations

| doc | what it covers |
|---|---|
| [launch-hardening-checklist.md](./launch-hardening-checklist.md) | what must be true before going live |
| [rollback-drill.md](./rollback-drill.md) | how to get back to a known-good state |
| [weekly-checklist.md](./weekly-checklist.md) | the recurring operational pass |
| [phase6-7-parity-qa.md](./phase6-7-parity-qa.md) | prototype-parity and QA execution log |
| [drhuang-content-cms-rollout.md](./drhuang-content-cms-rollout.md) | the DrHuang-style page CMS rollout checklist |

---

## Adding a document

Put it here, in this folder, and add a row above. Two conventions worth keeping:

- **Say why, not just what.** The useful half of these notes is the reasoning —
  why santui is scraped by a browser, why video must not live in Supabase, why
  the registry count is truncated rather than rounded. Code shows the what.
- **Record what is still wrong.** `open-issues.md` is the one file someone
  reads under pressure; a finding that is not written there is a finding that
  will be rediscovered.

Other documentation lives in [`docs/prototypes/`](../prototypes/) — the HTML
mockups the templates were built from, plus 设计说明书 and 文件清单.

## 本地 431（请求头过大）

`localhost` 的 cookie 不区分端口 —— 这台机器上每一个跑在 localhost 的项目，
它的 cookie 都会跟着发到 :4020。Supabase 的登录 token 一个就 2.7KB，几个项目
叠起来就超过 Node 默认的 16KB 请求头上限，dev server 直接回 431，看起来像
服务器挂了，其实请求根本没进到页面代码。

`apps/web` 的 `dev` 脚本因此带上 `--max-http-header-size=65536`。只影响本地：
线上 cookie 绑在真实域名上，不会互相叠加。

临时解法：在浏览器里清掉 localhost 的 cookie。
