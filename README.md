# pharlux-site

Source for the `pharlux.com` holding page. A single static HTML page deployed via **Cloudflare Pages**.

## What this is

This repository contains the Phase 0 marketing placeholder for Pharlux — a one-page "coming soon" site with:

- `index.html` — the holding page with `Organization` + `SoftwareApplication` JSON-LD structured data
- `robots.txt` — explicit AI crawler allow-list per `MARKETING_AND_GEO_POLICY.md` §9
- `llms.txt` — authoritative content manifest for AI crawlers, Jeremy Howard `llms.txt` standard
- `_headers` — Cloudflare Pages security headers (HSTS, CSP, X-Frame-Options, etc.)
- `favicon.svg` — placeholder mark until the Veltara Works brand work ships

No build step. No framework. Cloudflare Pages serves these files as-is.

## Deployment

Cloudflare Pages project: `pharlux-site`
Custom domain: `pharlux.com`, `www.pharlux.com`
Build command: *(none)*
Build output directory: `/`
Production branch: `main`

A push to `main` triggers an automatic deploy.

## Relationship to other Pharlux repositories

This is the **marketing site** only. It is not the product.

- `github.com/Veltara-Works/pharlux` — production source code (Phase 1+, currently design artifacts)
- `github.com/Veltara-Works/pharlux-poc` — Phase 0 DataFusion + WAL proof-of-concept (throwaway)
- `github.com/Veltara-Works/pharlux-site` — this repo, the marketing placeholder

## Upgrade path

When Phase 1 ships real documentation, this repo is replaced by a Docusaurus 3 project with the same custom domain. The static HTML survives until then.

---

**Pharlux** is a product of [Veltara Works](https://veltaraworks.com/). Licensed under AGPL-3.0-only; commercial licenses available at `licensing@pharlux.com`.
