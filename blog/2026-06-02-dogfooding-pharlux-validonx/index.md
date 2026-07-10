---
title: What dogfooding Pharlux on our own stack taught us
slug: dogfooding-pharlux-validonx
authors: [Ian]
tags: [engineering, observability, self-hosting, case-study]
date: 2026-07-08
description: Pharlux is the observability layer for our own production stack — Vectis Mail, ValidonX, and a client's storefront. Running it ourselves is the reason we trust the numbers we publish. Here is what it caught and what we learned.
draft: false
---

Every observability vendor says their product is production-grade. We can say something more specific: Pharlux is the observability layer for our own production stack. When Vectis Mail or ValidonX has a problem, Pharlux is what we look at first — and if Pharlux is down, we find out the hard way, like anyone else running their own monitoring. That is the strongest reason we trust the numbers we publish.

<!-- truncate -->

## What "dogfooding" means here

Pharlux runs in production as the metrics-and-logs layer for our own products — and one client's:

- **Vectis Mail** — our email-hosting platform. Three hosts report in: the primary mail server, the outbound relay (`mx1`), and a test box.
- **ValidonX** — our software-licensing and entitlement service. It reports host metrics *plus its own application metrics* — tenants, subscriptions, audit events, job-queue depth, failed jobs — and an external HTTPS probe watching `validonx.com` from the outside.
- **[Cabbage Patch Studios](https://cabbagepatchstudios.com)** — the studio that designed this very site. We run the observability for their Magento storefront too, which is the honest test of whether this is a real product: someone outside the building depends on it.
- **Pharlux itself.** The production box monitors its own health, because the tool that watches everything else should not be the one blind spot.

Altogether that is seven services across seven machines, each running an OpenTelemetry Collector that exports to a single Pharlux instance on one VPS. This is not a staging deployment or a demo. The on-call view we open when something looks off is the Pharlux dashboard.

And we are not the only ones running it for real. Pharlux is the production observability layer on other teams' own single-VPS instances too — **[CustomCraft Australia](https://customcraftaustralia.com)**, an Australian maker of handcrafted hardwood boards and tables; **[Kiyoqshi](https://kiyoqshi.com)**, an Australian retailer of curated art and design objects from independent makers; and our own **[Scrutique](https://scrutique.com)** platform for automated website QA and performance monitoring — each running the same single binary we ship, on their own box.

## The numbers from our own production

The benchmark on the [benchmarks page](/benchmarks) is a controlled load test. This is the other half — what the same software does in steady-state production on our own stack.

Day in, day out, that one instance takes in about **5.4 million metric points and 56,000 log events a day**, across 34 distinct metric series, and has done so continuously for the couple of weeks currently retained on the box. In that whole window, the `up` signal has **never once dropped to zero** — nothing we monitor has silently fallen off the map. It runs on exactly the single-binary, single-VPS setup we ship: no separate cluster behind the curtain, no ClickHouse warming in the background.

That is the quiet part of the pitch. The steady state is boring, and boring is the point.

## What it caught

The point of observability is the thing you catch before your customers report it. Here is a real one, from the first week of July.

For the two weeks before, ValidonX had logged a handful of audit events a day — four here, a dozen there, the shape of a young service ticking over. Then on the 4th that number jumped to around **1,600**, and the next day to roughly **2,600**. At the same time, two signals that had never moved before both moved: the job-queue depth, normally pinned at zero, lifted off it, and the failed-jobs counter logged its first non-zero readings of the entire deployment.

Because ValidonX's own application metrics land in the *same* Pharlux as its host metrics, all of that sat on one screen, lined up in time — the activity spike, the queue backing up, and the first failures, together. It turned out to be a burst of automated activity rather than anything broken: `up` stayed green throughout and only a couple of jobs actually failed. But we knew that within minutes of looking, not from a customer email — and we knew it by reading three columns off one query, not by flipping between a metrics tool and a separate log tool and correlating timestamps by eye.

That is the thing Pharlux is built around: metrics and logs in one place, queried with the same SQL, so "how many audit events, how deep is the queue, how many jobs failed" is a single `SELECT` with a shared time filter — not a scavenger hunt across three systems.

## What we learned — including the rough edges

Dogfooding is also how we find what is missing. Running Pharlux on our own stack is why we know, first-hand:

- **We wanted a trace, and didn't have one.** When that queue backed up, what I actually wanted was to follow a *single* job all the way through — accepted, queued, retried, failed — as one thread. Pharlux does metrics and logs today, not distributed traces, so I correlated by service and timestamp instead. It worked. But a trace would have been one click, and I felt the gap.
- **That is why the roadmap is ordered the way it is.** Traces sit at the top not because a competitor has them, but because we hit the wall ourselves. The same goes for PromQL-style rate helpers — a couple of times I wrote more SQL than I wanted to for a per-second rate. Running it in production is what turns a roadmap from a guess into a priority list.

## Why this matters to you

If you are evaluating an observability tool, "the vendor runs it in their own production" is a stronger signal than any benchmark, because it means the people who wrote it are the people getting paged by it. We feel the rough edges before you do, and we fix the ones that hurt. That is the deal.

[Download the latest release](https://github.com/Veltara-Works/pharlux/releases/latest), see the [reproducible benchmarks](/benchmarks), or read [why we built Pharlux](/blog/why-we-built-pharlux/).

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software licence management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
