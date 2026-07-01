---
title: Why we built Pharlux
slug: why-we-built-pharlux
authors: [Ian]
tags: [engineering, observability, self-hosting]
date: 2026-04-18
description: We were tired of operating five components to observe three services, and priced out of the SaaS alternative. So we built a single binary that does metrics and logs on one VPS. Here is the reasoning.
draft: true
---

{/* DRAFT for Ian's review and voice. Placeholders marked [IAN: ...] need your
    first-hand detail — the post reads as a founder narrative and should be in
    your voice, not a corporate one. Set draft: false when you're happy with it. */}

# Why we built Pharlux

*Last updated: 2026-06-13 · Pharlux v1.0.0 · By Ian Holt*

Most observability tools are built for the company you hope to become. Pharlux is built for the one you are running right now: a handful of services on a VPS or two, no platform team, and an on-call rotation that is mostly just you.

<!-- truncate -->

## The problem we kept hitting

Observability for a small team had quietly turned into a second system to operate. To watch three or four services you ended up running Prometheus for metrics, Loki for logs, Grafana for dashboards, Alertmanager for routing, and an object store underneath it — five moving parts, five config files, five upgrade cycles. Each one is reasonable on its own. Together they are a part-time job nobody on a small team has time for.

[IAN: the specific moment that tipped you over — the 2 a.m. page, the silent-broken-Loki-upgrade, the afternoon lost to a Grafana-can't-reach-Mimir YAML error, or whatever the real story was. One concrete, first-hand anecdote here is worth more than any amount of argument. Make it specific and true.]

The alternative was to pay someone else to operate it. But the SaaS bill scales with every host you add, and every byte of your telemetry leaves your infrastructure for someone else's cloud. For a team watching its costs and its data residency, neither the operate-it-yourself stack nor the hand-it-to-a-vendor option fit.

## The insight: scope is a feature

The reason the existing tools are heavy is that they are built to scale to enormous deployments. That is a real requirement — for the teams that have it. Most teams do not. They have 1 to 10 services, one or two boxes, and a workload that comfortably fits on commodity hardware.

So we made a decision that sounds like a limitation and is actually the whole point: **Pharlux is single-node by design.** It scales up on one VPS, not out across a cluster. Removing the ability to cluster removed the object store, the coordination service, the metadata database, and four of the five upgrade cycles. What is left is one binary.

## What we refused to ship

Pharlux is a series of deliberate refusals, each of which forced a simpler system:

- **No Docker, no orchestrator.** A single statically-linked Rust binary and one systemd unit. You install it with `sudo pharlux install`.
- **No ClickHouse, no Kafka, no Postgres.** Storage is a custom write-ahead log plus per-signal Apache Parquet on local disk, with embedded SQLite for metadata. Nothing to operate beside the binary.
- **No new query language.** Metrics and logs are queried with SQL through Apache DataFusion — including cross-signal joins on `trace_id` in a single statement. You already know SQL; you do not need to learn PromQL and LogQL and a third thing for traces.
- **No OpenSSL.** TLS is `rustls` throughout. The binary is genuinely static musl, so it does not surprise you with a glibc mismatch on the target box.

Every "no" on that list is a category of operational work we decided a small team should not have to do.

## What that bought

On a 4 vCPU / 8 GB VPS, Pharlux sustains 250,000 metric points per second with zero errors over 7.5 million points and ~11 ms average latency — and that number is [reproducible from a load generator that ships in the source tree](/benchmarks), not a figure from a slide. The Community edition is free under AGPL-3.0; you can read the source and run it at any scale.

[IAN: optional — a sentence on what building it in Rust felt like, or the one design decision you are proudest of. Personal, not marketing.]

## What we are honest about

Pharlux V1 does metrics and logs. Traces and PromQL are coming in V1.1. It is single-node, so if you are ingesting terabytes a day across a Kubernetes fleet, it is not the tool for you — and we say so on every [comparison page](/compare/). We would rather lose the deal we are wrong for than win it and disappoint you.

## Who it is for

If you are running a small number of services, you want to observe them without standing up a stack to do it, and you want your data on hardware you control, that is exactly who Pharlux is for. It is the tool we wanted and could not find, so we built it — and we run it ourselves, on our own production stack.

[Download v1.0.0](https://github.com/Veltara-Works/pharlux/releases/tag/v1.0.0), or read [how to run it on a $20/month VPS](/blog/pharlux-on-a-20-dollar-vps/).

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software license management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
