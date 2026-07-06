# Pricing — Pharlux

> Machine-readable pricing for Pharlux, a self-hosted observability binary by Veltara Works.
> Last updated: 2026-06-29. Canonical page: https://pharlux.com/pricing
> All prices in USD. Host and retention figures are generous fair-use ceilings, not a per-host meter — tiers ladder on features, support, and redistribution rights, not on counting hosts.

## Community

- Price: $0 (free, self-hosted)
- License: AGPL-3.0
- Hosts: unlimited (tracked, never rejected)
- Retention: operator-configured
- Features: full community feature set — OpenTelemetry (OTLP) metrics + logs ingest, SQL via Apache DataFusion, embedded dashboards, SQL-based alerting, single static binary
- Audit log: not included (commercial feature)
- Support: community (GitHub Issues and Discussions)
- CTA: download at https://github.com/Veltara-Works/pharlux/releases/latest

## Team

- Price: $49/month
- License: commercial (removes AGPL terms)
- Hosts: 25 (fair-use ceiling)
- Retention: 30 days
- Features: everything in Community, plus a tamper-evident audit log
- Support: email
- CTA: https://pharlux.com/contact?intent=licensing

## Business

- Price: $199/month
- License: commercial
- Hosts: 250 (fair-use ceiling)
- Retention: 90 days
- Features: everything in Team; SSO (SAML / OIDC / LDAP) is on the roadmap
- Support: email
- CTA: https://pharlux.com/contact?intent=licensing

## Scale

- Price: $899/month
- License: commercial
- Hosts: unlimited
- Retention: unlimited
- Features: everything in Business, plus air-gapped / binary-redistribution rights; sized for a single high-capacity VPS (Pharlux is single-node by design)
- Support: email
- CTA: https://pharlux.com/contact?intent=licensing

## Custom / Air-gapped

- Price: from $12,000/month (quote-based)
- License: commercial
- Hosts: unlimited
- Retention: unlimited
- Features: everything in Scale, plus air-gapped deployment support, a white-glove 24×7 SLA, and source escrow
- Support: white-glove, dedicated
- CTA: https://pharlux.com/contact?intent=licensing

## Commercial-License-Only

- Price: $2,400/year (billed yearly)
- License: commercial relicense of the AGPL-3.0 software, without hosting limits or Enterprise features
- Use case: teams that cannot accept AGPL-3.0 terms but self-host and operate the software themselves
- CTA: https://pharlux.com/contact?intent=licensing

## Notes

- Pharlux is self-hosted software distributed as a single statically-linked binary, not a SaaS. Your telemetry data stays on your own infrastructure on every tier.
- The current release is on the v1.2 line. Metrics and logs are generally available; traces and PromQL remain on the roadmap. (V1.0.0 shipped 2026-04-17.)
- Commercial licensing contact: https://pharlux.com/contact?intent=licensing
