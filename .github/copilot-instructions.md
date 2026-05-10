# Copilot review guidance

This file tells GitHub Copilot how to review pull requests in this repository. Copy this file verbatim to other repos in the same family; only the **Repo-specific notes** block at the bottom needs per-repo editing.

---

## What we want from a Copilot review

Treat reviews like a senior engineer's — **terse, actionable, opinionated**. A Copilot review should:

- Surface bugs, security issues, and regressions a human reviewer might miss in a long diff.
- Flag architectural drift (mixing concerns, leaking abstractions across layer boundaries).
- Catch hidden state changes — anything that affects shared infrastructure, prod data, billing, auth, or audit trails.
- Note when test coverage is missing for new behavior **that warrants a test**. Don't ask for tests on trivial refactors, doc changes, or lockfile bumps.

What we **do NOT** want:

- Style nits — formatters and linters are wired into CI; don't comment on indentation, whitespace, or operator spacing.
- Trivial naming suggestions ("consider renaming `x` to `xValue`") unless the existing name is genuinely misleading.
- "Consider adding a comment here" suggestions. Comments are deliberately sparse in this codebase; only flag missing comments where a non-obvious WHY would help a future reader.
- Re-explaining what the code does in your review summary. Assume the reviewer can read.
- Speculation about hypothetical future requirements ("you might want to add caching later"). Review what's in the diff, not what isn't.
- Suggestions to add try/catch, defensive nulls, or input validation for code paths that already trust their callers (internal-only services). Only flag missing defenses at system boundaries (HTTP handlers, message queues, external API responses).

---

## Read the PR description first

The PR description is the author's intent — the diff is the implementation. **Always read the PR body before reviewing the diff.**

If the PR is lockfile-only (e.g. `package-lock.json`, `composer.lock`, `yarn.lock`, `Cargo.lock`):

- The diff is auto-generated. Don't try to "review" the lockfile content.
- The meaningful review surface is the **PR description**: what advisories does it close, what versions are bumped, what's the risk justification, what's been verified.
- If the description is missing security/risk justification, that's the comment to make. If the description has it, the review is "looks good — security justification is documented."

If the PR is a doc-only change, skip suggestions about implementation patterns. Review for clarity, accuracy, and outdated cross-references.

---

## Security review focus areas

Treat these as load-bearing. A miss here is an actual incident vector:

1. **Authentication / authorization bypass** — any new endpoint must have an auth middleware (or be explicitly public with a comment saying why). Any new admin-scoped route must reject non-admin actors.
2. **SQL injection / template injection / command injection** — any string concatenated into a query, shell command, or template is suspect unless using parameterized APIs.
3. **Cross-tenant leakage** — in multi-tenant code, every query that reads tenant data must scope by tenant ID. A query without a tenant scope is a bug.
4. **Audit trail gaps** — security-relevant mutations (auth changes, billing, key issuance, admin user edits) must call the audit service. Non-security state changes (UX state, view counters) should NOT pollute the audit log.
5. **Secrets in logs / responses / commit history** — passwords, API keys, tokens, JWTs, signing keys must never appear in logs, error messages, audit metadata, or test fixtures. Hashed passwords are also sensitive (the bcrypt cost prefix `$2y$` is a tell).
6. **Insecure defaults** — config switches that default to insecure (auth off, signature verification disabled, TLS verify off) should fail loudly, not silently.
7. **Webhook / signature verification** — inbound webhooks must verify signatures before any state-affecting work. Outbound webhooks must sign their payloads.

---

## Migration safety

Database migrations land via deploy and aren't trivially revertible. Flag:

- `ALTER TABLE` on a populated table without a chunked / online strategy.
- Adding a `NOT NULL` column without a default or a backfill plan.
- Dropping a column or table without a transitional read-and-drop sequence.
- Migrations that aren't reversible (`down()` empty or non-functional).
- `DROP`, `TRUNCATE`, `DELETE` without a `WHERE` — these should never appear in a migration outside of explicit tear-down for fresh installs.

If the migration is additive and small (new table, new nullable column, new index), no comment needed.

---

## API contracts

If a route, endpoint shape, response envelope, or webhook payload changes:

- Flag any breaking change to a documented contract. Documented = appears in OpenAPI, in `docs/`, or in a public SDK.
- Versioning: API versions in URLs (`/v1/...`) should not have their contracts mutated; new behavior goes to `/v2/...` or via opt-in headers.
- Inbound and outbound webhook payloads are public contracts the moment a third party consumes them.

---

## Commit and PR hygiene

Don't comment on these unless something is genuinely off:

- Commit messages should describe the **why**, not the what. The `what` is in the diff.
- PR titles should be short (under 70 chars). Detail goes in the body.
- Branch names: `feat/...`, `fix/...`, `chore/...`, `docs/...` are conventional.
- **Never suggest adding `Co-Authored-By: Claude` (or any other AI-attribution trailer)** to commit messages, PR bodies, or release notes. AI involvement may be mentioned in marketing copy; commit metadata is not the place.

---

## Tone and format of review comments

- One sentence per comment is usually enough. Two if you need to point at a fix.
- Use code-suggestion blocks for concrete one-line fixes.
- Group related findings into one comment rather than scattering five identical suggestions across a file.
- If a finding is severity-relevant, lead with severity: "**Bug:** ...", "**Security:** ...", "**Architecture:** ...". If unprefixed, the reader assumes "nit."
- Prefer "Consider X because Y" over "You should X." We treat reviews as recommendations, not commands.
- Don't apologize, don't hedge with "I might be wrong but..." — say what you think, the author can push back.

---

## Repo-specific notes

> **Edit this section per repo.** Everything above is the same across the Veltara Works family.

- This repo is **`Veltara-Works/pharlux-site`** — the marketing + docs site at `pharlux.com`. **Docusaurus 3.x + TypeScript**, deployed via **Cloudflare Pages auto-build** on push to `main` (no separate deploy step; `git push` is the deploy). The `tier2-docusaurus` branch carries the in-flight IA migration; cutover needs coordinated build-config + merge to avoid a prod outage.
- **Subordinate to `MARKETING_AND_GEO_POLICY.md`** — the binding policy lives in the **main pharlux repo's** `_internal/MARKETING_AND_GEO_POLICY.md`, not in this repo. When in doubt about brand voice, claim accuracy, GEO/SEO concerns, or page hierarchy, cite that file. Don't review brand strategy itself — only that the diff doesn't violate the documented policy.
- **No technical/operational leaks**: this is public-facing marketing. Never let any PR introduce: the production JWKS endpoint URL, revoke webhook payload shape, per-customer secret format, internal infrastructure addresses, or enterprise-only feature names that haven't been announced. Pharlux's `docs/enterprise/index.md` (in the main pharlux repo) is the line for what's safe to surface here.
- **Brand voice — first-person Ian / human, not assistant-machine**: blog posts and feature copy must read like a human founder wrote them. Strip ADR / multi-agent vocabulary ("Round 1 Critic," "Tier-2 IA"). Prefer plain everyday words ("thing" over "trick", "set up" over "provision"). Flag prose that drifts into LLM-flavoured connector phrasing ("furthermore," "additionally," "moreover," "delve into") or unjustified em-dash sentences.
- **Cross-product link discipline**: links from pharlux pages to **other Veltara Works products** (e.g., `veltaraworks.com`, `vectis-mail`, `validonx`, pharlux-enterprise marketing) **open in a new tab** (`target="_blank" rel="noopener noreferrer"`). Tooling links (GitHub, status pages, npm) stay same-tab. Flag any cross-product link missing the new-tab attributes.
- **Cloudflare email obfuscation stays ON** — there is no contact form on this site (Tier-2 IA may eventually wire one via CF Pages Functions, but that's deferred). Don't suggest removing the obfuscation as a "find/fix the email" — the spam-vs-AI-crawler trade-off is binding.
- **Build / accessibility / performance basics**: `npm run build` must pass with zero broken-link warnings (Docusaurus surfaces these). Every image needs alt text. Markdown-link integrity matters more here than in code repos — a broken link is a marketing-surface defect that ships to prod on the next push to `main`. Flag PRs that bundle large unoptimised images (Lighthouse-grade page weight is a real concern).
