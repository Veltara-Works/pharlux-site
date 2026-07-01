---
title: What dogfooding Pharlux on our own stack taught us
slug: dogfooding-pharlux-validonx
authors: [Ian]
tags: [engineering, observability, self-hosting, case-study]
date: 2026-06-02
description: Pharlux is the observability layer for our own production services — ValidonX and Vectis Mail. Running it ourselves is the reason we trust the numbers we publish. Here is what it caught and what we learned.
draft: true
---

{/* DRAFT for Ian's review. Placeholders marked [VALIDONX: ...] need REAL
    production numbers from the ValidonX / Vectis Mail Pharlux deployment —
    do not publish with invented figures. Set draft: false once the real
    numbers and the incident story are in. */}

# What dogfooding Pharlux on our own stack taught us

*Last updated: 2026-07-01 · Pharlux v1.2.0 · By Ian Holt*

Every observability vendor says their product is production-grade. We can say something more specific: Pharlux is the observability layer for our own production services. When ValidonX or Vectis Mail has a problem, Pharlux is what we look at first — and if Pharlux is down, we find out the hard way, like anyone else running their own monitoring. That is the strongest reason we trust the numbers we publish.

<!-- truncate -->

## What "dogfooding" means here

Pharlux runs in production as the metrics-and-logs layer for two of Veltara Works' own products:

- **ValidonX** — our software licensing and entitlement service. [IAN/VALIDONX: the shape of its workload as Pharlux sees it — request volume, and how many services/hosts report into Pharlux.]
- **Vectis Mail** — our email-hosting platform. [IAN: the shape of Vectis Mail's workload as Pharlux sees it — messages/day, and which SMTP/IMAP hosts report in.]

This is not a staging deployment or a demo. It is the real thing: an OpenTelemetry Collector runs in front of each service and exports to a single Pharlux instance on its own VPS, and the on-call view we open when something looks off is the Pharlux dashboard.

## The numbers from our own production

The benchmark on the [benchmarks page](/benchmarks) is a controlled load test. This is the other half — what the same software does in steady-state production on our stack:

[VALIDONX/IAN: the real figures — replace with what you can stand behind, this section is the whole credibility of the post:
- sustained ingest rate in production (points/sec or points/day)
- number of hosts / services reporting
- retention window currently configured
- typical query latency on the dashboards the team actually opens
- resident memory under real load
One real datapoint we already have from prod that you could use here: a full-table `count(*)` over ~25 million rows streamed in ~13 seconds at ~44 MB peak memory (the streaming-scan path added in v1.1.1), versus the ~1.8 GB the old buffered path would have needed. Confirm before publishing.]

## What it caught

The point of observability is the incident you catch before your customers do. [IAN: one real, sanitised story — a deploy that spiked error rates, a memory leak the dashboards surfaced, a cross-signal `JOIN` on `trace_id` that pinned down a root cause faster than grepping logs would have. Sanitise anything sensitive, but keep it concrete and true. This is the most valuable section of the post.]

What made that debuggable was the thing Pharlux is built around: metrics and logs in one place, queried with the same SQL, joined on `trace_id` in a single statement. We were not jumping between a metrics tool and a separate log tool and correlating timestamps by eye.

## What we learned — including the rough edges

Dogfooding is also how we find what is missing. Running Pharlux on our own stack is why we know, first-hand:

- [IAN: a genuine limitation you hit and how you worked around it — e.g. wanting distributed traces (on the roadmap), a query pattern that needed tuning, a retention/disk-growth lesson. Naming a real rough edge builds more trust than a flawless story.]
- It is also why the roadmap priorities are what they are: [IAN: tie a roadmap feature — traces, PromQL, auto-compaction — to something you actually wanted while running it in production.]

## Why this matters to you

If you are evaluating an observability tool, "the vendor runs it in their own production" is a stronger signal than any benchmark, because it means the people who wrote it are the people getting paged by it. We feel the rough edges before you do, and we fix the ones that hurt. That is the deal.

[Download the latest release](https://github.com/Veltara-Works/pharlux/releases/latest), see the [reproducible benchmarks](/benchmarks), or read [why we built Pharlux](/blog/why-we-built-pharlux/).

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software license management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
