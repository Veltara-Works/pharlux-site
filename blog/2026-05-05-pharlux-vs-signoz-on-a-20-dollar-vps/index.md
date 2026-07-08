---
title: Pharlux vs SigNoz on a $20 VPS — a fair, reproducible test
slug: pharlux-vs-signoz-on-a-20-dollar-vps
authors: [Ian]
tags: [comparison, self-hosting, observability, signoz, otel]
date: 2026-07-01
description: We put Pharlux and SigNoz on two identical $20/month VPSes and measured install time, time-to-first-metric, ingest throughput, and footprint. The throughput is close. The operational story is not.
draft: true
---

{/* DRAFT for Ian's voice/tone review. This post is now backed by a REAL run
    performed 2026-07-01 on two matched BinaryLane std-2vcpu VPSes — every number,
    log line, and error here is from that run. Raw logs + RESULTS.md live in
    pharlux/_internal/benchmarks-signoz-2026-07-01/. This supersedes the earlier
    unverified draft (which used SigNoz v0.121.1 and an unmeasured "2h 38m"); the
    core finding — OTLP ingestion is blocked until first-user onboarding — was
    re-tested and reproduced on current v0.131.0. Editorial call is yours: it is a
    competitor comparison, kept honest and Pharlux-forward per house style. Remove
    `draft: true` to publish. */}

# Pharlux vs SigNoz on a $20 VPS — a fair, reproducible test

*Last updated: 2026-07-01 · Pharlux v1.2.0 · SigNoz v0.131.0 · By Ian Holt*

We put Pharlux and SigNoz on two identical $20/month VPSes in the same region and measured the things a small team actually feels: how long until it installs, how long until the first metric lands, how much it ingests, and how much of the box it eats.

The honest headline first, because it is not the one you might expect from a vendor's own comparison: **on ingest throughput, the two are close.** Both sustained around 100,000 metric points per second with zero errors on a 2 vCPU / 4 GB box. This is not a "we're an order of magnitude faster" post, and we are not going to pretend it is.

Where they diverge is everything *around* the throughput number — time-to-first-metric, moving parts, and what "the install is finished" actually means. That is the story worth telling.

<!-- truncate -->

## The setup

Two BinaryLane VPSes in Perth, identical specs, same size, same OS:

| Box | Role | Specs | Cost |
|---|---|---|---|
| `pharlux-bench` | Pharlux v1.2.0 | std-2vcpu — 2 vCPU / 4 GB / 60 GB / Ubuntu 24.04 | $19.60/mo |
| `signoz-bench` | SigNoz v0.131.0 | std-2vcpu — 2 vCPU / 4 GB / 60 GB / Ubuntu 24.04 | $19.60/mo |

Both fresh Ubuntu 24.04.4. The load generator is Pharlux's own `pharlux-loadtest` — OTLP metric points over HTTP/protobuf — run on each box's localhost, so the network is out of the comparison. Load runs were sequential per box, not simultaneous.

(Disclosure: Veltara Works dogfoods on BinaryLane. Equivalent 2 vCPU / 4 GB boxes from Hetzner, OVH, or DigitalOcean would produce the same shape of result — the constraint is the hardware class, not the brand.)

## The Pharlux side

Three commands, then it is ingesting:

```bash
curl -L https://github.com/Veltara-Works/pharlux/releases/download/v1.2.0/pharlux-v1.2.0-x86_64-unknown-linux-musl \
  -o /usr/local/bin/pharlux && chmod +x /usr/local/bin/pharlux
sudo pharlux install          # writes systemd unit, generates JWT secret, prepares data dir
sudo systemctl enable --now pharlux
```

From the third command to OTLP traffic being accepted on port 4318: **about ten seconds.** Ports 3100 (API), 4317 and 4318 (OTLP) bound immediately. No sign-up, no onboarding wizard, no first-user step — the OTLP endpoint accepts data from the moment the service is active.

The numbers on this $20 box:

| Test | Result |
|---|---|
| Sustained ingest, 30 s @ 100k rate | 100,058 points/sec, **0 errors** |
| Sustained ingest, **5 min** @ 100k rate | **99,989 points/sec, 0 errors** over 30,016,000 points, 31 ms avg latency |
| Saturation point | ~170,000 points/sec (above this it sheds load via HTTP 429 backpressure) |
| Disk after 30 M points | 213 MB (157 MB Parquet + 56 MB write-ahead log) |
| Idle memory | ~62 MB resident |

For context: sustained ingest is single-core-bound (the WAL fsync path runs on one core), which is why this 2 vCPU box lands near 100k where our [4 vCPU / 8 GB benchmark](/benchmarks) reaches 350k. A team running 1–10 services generates a few *thousand* points per second, so even the small box has one to two orders of magnitude of headroom.

## The SigNoz side

This is where it gets interesting, and where we found something worth writing down.

**First: the install path changed.** The old `docker-compose` files and `install.sh` that most SigNoz blog posts reference are, as of v0.130.0, deprecated in the repository. The current canonical install is their own installer, Foundry:

```bash
curl -fsSL https://signoz.io/foundry.sh | bash   # SigNoz's current installer
# write casting.yaml (flavor: compose, mode: docker)
foundryctl cast -f casting.yaml
```

That worked cleanly. Six containers — a Postgres metastore, ClickHouse, a ClickHouse-keeper, the SigNoz UI, an ingester, and a schema migrator — came up **healthy in about 40 seconds**. Idle memory across all of them was ~775 MiB. So far, better than expected on a small box (SigNoz's docs state a 4 GB minimum for Docker; our box has exactly 4 GB total).

**Then we tried to send it data, and got nothing.** Every OTLP request returned an error; a raw `curl` to the ingest port got `Connection reset by peer`. Zero points landed. The install said it was finished, the containers were healthy, and yet the front door was shut.

The reason is in the logs, and it is a real, reproducible gotcha. SigNoz's ingester runs an **OpAMP-managed** OpenTelemetry collector: its runtime pipeline — including which OTLP receivers actually bind — is pushed from the SigNoz server, not read from a static file. Until an *organisation* exists, the server refuses to hand the collector its config. The server log repeats, every 30 seconds:

```
ERROR  failed to find or create agent
       exception.message="cannot create agent without orgId"
```

and the collector never binds its OTLP receivers. On a healthy-looking, "finished" install, no metric can land — and nothing in the install output tells you why.

**The fix is onboarding.** Registering the first user creates the first organisation, which gives the OpAMP server an `orgId`:

```bash
curl -X POST http://127.0.0.1:8080/api/v1/register \
  -H 'Content-Type: application/json' \
  -d '{"name":"Admin","orgName":"acme","email":"you@example.com","password":"..."}'
```

About fifteen seconds after that call, the collector log flipped to `Starting HTTP server … endpoint [::]:4318` and OTLP requests started returning `200`. This step is not called out in the install docs as a prerequisite for ingestion — but it is one. If you follow only the install instructions and then point your OpenTelemetry Collector at the box, you will stare at connection-reset errors until you happen to open the UI and create an account.

**Once onboarded, SigNoz ingested well.** Same box, same load generator:

| Rate | Throughput | Errors |
|---|---|---|
| 20k | 20,123 points/sec | 0 |
| 50k | 49,661 points/sec | 0 |
| 100k | 95,859 points/sec | 0 |

We confirmed the data actually persisted, not just got accepted: the `signoz_metrics` samples table in ClickHouse went from 0 to 5,009,000 rows. Memory under load was ~1.1 GB across the containers. So once it is running, it ingests — the obstacle is getting to that point, not the throughput after it.

## What actually separates them

Not throughput. Both sustain ~100k points/sec at zero errors on a $20 box — comfortably beyond a small team's real workload. The differences a small team feels are these:

| | Pharlux v1.2.0 | SigNoz v0.131.0 |
|---|---|---|
| Time to first metric | **~10 seconds**, 3 commands | ~40 s install **plus** a first-user onboarding step before *any* OTLP is accepted |
| Moving parts | 1 static binary + 1 systemd unit | 6 containers (Postgres, ClickHouse, keeper, UI, ingester, migrator) |
| Idle footprint | ~62 MB | ~775 MiB |
| Sustained ingest (this box) | ~100k pts/s, 0 err | ~96k pts/s, 0 err |
| "Install finished" means | ingesting | containers up — *not yet* ingesting |

The gap that matters is the last row. On Pharlux, "the service is running" and "it is accepting telemetry" are the same moment. On SigNoz, they are not — and the space between them is a place a small-team operator can lose an afternoon, because everything reports healthy while nothing ingests.

## Where Pharlux fits

In fairness to scope, SigNoz covers ground Pharlux does not — distributed traces and APM, a broader dashboard library, and a hosted option. If full APM with traces is what you need today, that is a different tool for a different job, and Pharlux is not trying to be it.

Pharlux is built for the opposite of what this test measured on the other box: **metrics and logs on one cheap VPS, ingesting in seconds, one binary to operate, nothing to onboard.** For a small team on a $20 box, that is the whole design — the ten-second install and the single 62 MB process are not a rounding error, they are the product.

## Reproduce it yourself

Everything above is from one run on 2026-07-01, and none of it requires taking our word for it:

- **Pharlux:** `pharlux-loadtest` ships in the [source tree](https://github.com/Veltara-Works/pharlux) under AGPL-3.0. Install Pharlux, point it at localhost, run the harness. Full methodology on the [benchmarks page](/benchmarks).
- **SigNoz:** the Foundry install, the `cannot create agent without orgId` server log, and the connection-reset-until-onboarding behaviour reproduce on a fresh `foundryctl cast` of v0.131.0 on a 4 GB box. Register the first user and the OTLP receivers bind.

## Frequently asked questions

### Is Pharlux faster than SigNoz?

Not meaningfully, in this test. Both sustained about 100,000 points/sec with zero errors on a 2 vCPU / 4 GB box. Pharlux saturates around 170k and we did not push SigNoz past 100k, so we make no throughput-superiority claim. The advantage we do claim is operational: time-to-first-metric and footprint, not speed.

### Is the SigNoz onboarding issue a bug?

We would call it a documentation gap rather than a bug — the system is working as designed (the collector is OpAMP-managed and needs an org), but the install path does not flag first-user onboarding as a prerequisite for ingestion. It is worth a docs issue upstream, and if a SigNoz maintainer reads this, that is the constructive outcome.

### Did you give SigNoz a fair shot?

We used SigNoz's *current* canonical install (Foundry), not a deprecated one, on a box at their stated 4 GB minimum, and we did the onboarding step and measured real ingest afterward. Every claim here has a log line behind it. A more experienced SigNoz operator would have known to register the first user immediately — which is exactly the point: it is knowledge you need and the docs do not front-load.

### Why does Pharlux use so little memory at idle?

Because there is one process and no database engine sitting resident. Storage is a write-ahead log plus Parquet files on local disk with embedded SQLite for metadata — nothing to keep a ClickHouse and a Postgres warm for. Under sustained maximum load Pharlux does use a large ingest buffer; the ~62 MB figure is the always-on idle cost, which is the number that runs 24/7 on your bill.

### Does Pharlux have traces, and will you compare them?

Not yet — Pharlux v1.2.0 does metrics and logs; distributed traces are on the roadmap, not shipped. When they land, a traces-inclusive comparison on hardware SigNoz officially recommends is the fair next test. The result will look different from this one, and that is fine — what each system needs to run well is part of the comparison.

## Get Pharlux

- **Download the latest release** — [github.com/Veltara-Works/pharlux/releases/latest](https://github.com/Veltara-Works/pharlux/releases/latest)
- **Benchmarks & methodology** — [pharlux.com/benchmarks](/benchmarks)
- **Documentation** — [pharlux.com/docs/getting-started/](/docs/getting-started/)
- **The cost-side post** — [Running Pharlux on a $20/month VPS](/blog/pharlux-on-a-20-dollar-vps/)

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software license management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
