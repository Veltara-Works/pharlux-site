---
title: Why we built Pharlux
slug: why-we-built-pharlux
authors: [Ian]
tags: [engineering, observability, self-hosting]
date: 2026-04-18
description: We were tired of operating five components to observe three services, and priced out of the SaaS alternative. So we built a single binary that does metrics and logs on one VPS. Here is the reasoning.
draft: true
---

Most observability tools are built for the company you're hoping to become one day. Pharlux is built for the one you're actually running right now — a handful of services on a VPS or two, no platform team, and an on-call roster that, often, is mostly just you.

<!-- truncate -->

## The problem we kept running into

Somewhere along the line, keeping an eye on a few small services had quietly turned into a second system to look after. To watch three or four services you'd end up running Prometheus for metrics, Loki for logs, Grafana for the dashboards, Alertmanager to route the alerts, and an object store sitting underneath the lot. Five moving parts. Five config files. Five upgrade cycles. Each one's sensible enough on its own. Put them all together and you've got yourself a part-time job that nobody on a small team has the hours for.

I'll be honest — for a long time I defended that stack. We'd built it, we knew its moods, and I could talk anyone out of ripping it up. Then one evening it beat us. A routine upgrade to one piece left another quietly unable to reach it, and not a single alert fired — because the thing that's meant to raise the alarm was part of what had fallen over. No page. No phone call. I found out because I happened to glance at a dashboard and it had gone empty. Then I did the sums: we'd spent more of that quarter nursing the tools that watch our services than watching the services themselves. That's the wrong way round for a team our size, and I finally admitted no amount of YAML was going to set it right.

The other option was to pay someone else to run it for you. But the SaaS bill climbs with every host you add, and every byte of your telemetry walks out the door to sit on somebody else's cloud. If you're watching your costs — and where your data lives — then neither running the whole stack yourself nor handing it to a vendor really fits.

## The insight: scope is a feature

The reason the usual tools are so heavy is that they're built to scale out to enormous deployments. That's a genuine requirement — for the teams that actually have it. Most don't. Most have somewhere between 1 and 10 services, a box or two, and a workload that sits comfortably on ordinary hardware.

So we made a decision that sounds like a limitation and is really the whole point: Pharlux is single-node by design. It scales up on one VPS, not out across a cluster. The moment we gave up on clustering, out went the object store, the coordination service, the metadata database, and four of those five upgrade cycles. What's left is one binary.

## What we decided not to ship

Pharlux is a string of deliberate refusals, and every one of them forced a simpler system:

- **No Docker, no orchestrator.** One statically-linked Rust binary and a single systemd unit. You install it with `sudo pharlux install`, and that's the end of it.
- **No ClickHouse, no Kafka, no Postgres.** Storage is a custom write-ahead log plus per-signal Apache Parquet on local disk, with embedded SQLite for the metadata. Nothing to run alongside the binary.
- **No new query language.** You query metrics and logs with plain SQL through Apache DataFusion — including cross-signal joins on `trace_id` in a single statement. You already know SQL. You shouldn't have to learn PromQL, then LogQL, then a third thing for traces.
- **No OpenSSL.** TLS is `rustls`, top to bottom. The binary is genuinely static `musl`, so it won't surprise you with a glibc mismatch on the target box.

Every "no" on that list is a category of work we decided a small team simply shouldn't have to do.

## What that bought us

On a 4 vCPU / 8 GB VPS, Pharlux holds 350,000 metric points a second with zero errors across 10.5 million points, at around 7 ms average latency. And that's not a number off a slide — it's reproducible with a load generator that ships in the source tree, so you can check it yourself. The Community edition is free under AGPL-3.0; read the source, run it at whatever scale you like.

Truth be told, we came to Rust grumbling. Between us we've written enough C over the years to be suspicious of a compiler that argues with you before it'll even build. But that arguing turned out to be the whole point. The things it made us deal with up front are exactly the things that used to wake me at two in the morning on someone else's stack. We're not chasing segfaults we can't reproduce any more. The binary either compiles or it tells us why, and once it's running it stays running — and at my age, I've well and truly lost my taste for late-night surprises.

## What we're up front about

Pharlux does metrics and logs today. Distributed traces and PromQL are on the roadmap, not in the box yet. It's single-node, so if you're ingesting terabytes a day across a Kubernetes fleet, it isn't the tool for you — and we say exactly that on every comparison page. We'd rather lose the deal we're wrong for than win it and let you down.

## Who it's for

If you're running a small number of services, you want to keep an eye on them without standing up a whole stack to do it, and you want your data on hardware you control — that's who Pharlux is for. It's the tool we went looking for, couldn't find, and ended up building ourselves. And we run it ourselves, on our own production stack.

[Download the latest release](https://github.com/Veltara-Works/pharlux/releases/latest), or read how to [run it on a $20-a-month VPS](/blog/pharlux-on-a-20-dollar-vps).

Pharlux is one of several developer tools built by Veltara Works — alongside email hosting, cloud infrastructure, and software licence management. Have a look at [veltaraworks.com](https://veltaraworks.com) for the rest.
