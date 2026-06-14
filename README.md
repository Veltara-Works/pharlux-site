# pharlux-site

Source for `pharlux.com`. Currently mid-migration from a single-page static site
to **Docusaurus 3** (Tier-2 IA, started 2026-05-04). The legacy single page is
preserved at [`_pre-docusaurus/index.html`](_pre-docusaurus/index.html) as the
content source for the IA-2 homepage migration.

## What this is

- `docusaurus.config.ts` — Docusaurus 3 site config (title, navbar, footer, theme, sitemap)
- `src/pages/index.tsx` — homepage React component (currently a placeholder; IA-2 migrates the full marketing content)
- `src/css/custom.css` — Pharlux palette overrides for Infima
- `docs/` — Docusaurus docs section (placeholder; IA-4 mirrors `pharlux/docs/user/*.md` here)
- `static/` — files copied verbatim into the build output:
  - `_headers` — Cloudflare Pages security headers
  - `robots.txt` — explicit AI-crawler allow-list per Policy §3 Principle 9
  - `llms.txt` — AI-crawler content manifest
  - `og-image.png` / `og-image.svg` — social-card image
  - `quickstart.svg` — animated terminal of the install (QW-7)
  - `favicon.svg` — site icon
  - `404.html` — branded 404 page (B)
- `_pre-docusaurus/index.html` — frozen snapshot of the pre-migration single-page site

`sitemap.xml` is **auto-generated** by the Docusaurus classic preset's sitemap plugin (no longer hand-maintained).

## Syncing docs from the source repo

`docs/` is a **curated mirror** of `pharlux/docs/` in the private source repo — it is *not* a live feed, so it drifts whenever the source advances. **Re-sync it every time a release is cut** (this is a release checklist step, not an ad-hoc task — skipping it is how the docs silently fall behind the shipped product).

```bash
scripts/sync-docs.sh ../pharlux v1.1.0   # <path-to-pharlux-source> <release-tag>
npm run build                            # verifies internal links + MDX
```

The script applies the site's one systematic adaptation (rewriting repo-tree relative links like `../../adr/…` to absolute GitHub blob URLs **pinned to the release tag**) and enforces the publish decisions (all `docs/user/*`; `docs/dev/architecture.md` only — `crate-map`/`testing` are contributor-only and excluded; `docs/enterprise/*` never published). See the header of [`scripts/sync-docs.sh`](scripts/sync-docs.sh) for the full decision list.

If the source added a **new** user doc, the script prints a `⚠ NEW:` warning — add that doc to [`sidebars.ts`](sidebars.ts) and [`docs/index.mdx`](docs/index.mdx) by hand (those two are bespoke and not auto-generated), then rebuild.

## Local development

Requires Node ≥ 20.

```bash
npm install
npm run start    # dev server at http://localhost:3000
npm run build    # production build → ./build/
npm run serve    # serve the production build locally
```

## Deployment

Cloudflare Pages project: `pharlux-site`. Custom domain: `pharlux.com`, `www.pharlux.com`.

**Cloudflare Pages config — needs updating before this branch merges to `main`:**

| Setting | Current (legacy single-page) | After Docusaurus migration |
|---|---|---|
| Build command | *(none)* | `npm run build` |
| Build output directory | `/` | `build` |
| Production branch | `main` | `main` |
| Node version | *(default)* | `20` or higher |

A push to `main` triggers an automatic deploy. The `tier2-docusaurus` feature branch deploys to a Cloudflare Pages preview URL while the migration is in progress; **the production site stays on the legacy single page until IA-2 lands and the build config is updated.**

## Migration tracker

The Tier-2 IA migration is tracked in [`pharlux/_internal/WOW_FACTORS_ANALYSIS.md`](https://github.com/Veltara-Works/pharlux) §6 (private to the main Pharlux repo). Status as of 2026-05-04: IA-1 done (this commit), IA-2 through IA-9 pending.

## Relationship to other Pharlux repositories

This is the **marketing site** only. It is not the product.

- `github.com/Veltara-Works/pharlux` — production source code (V1.0.0 shipped 2026-04-17)
- `github.com/Veltara-Works/pharlux-site` — this repo

---

**Pharlux** is a product of [Veltara Works](https://veltaraworks.com/). Licensed under AGPL-3.0-only; commercial licenses available at `licensing@pharlux.com`.
