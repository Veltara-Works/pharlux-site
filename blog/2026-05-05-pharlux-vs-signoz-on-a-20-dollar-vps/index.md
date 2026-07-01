---
title: Pharlux vs SigNoz on a $20 VPS — what actually happened
slug: pharlux-vs-signoz-on-a-20-dollar-vps
authors: [Ian]
tags: [comparison, self-hosting, observability, signoz, otel]
date: 2026-05-05
description: An honest write-up of trying to benchmark Pharlux against SigNoz on the same $20/month VPS. The benchmark we wanted is not the result we got — but the result we got is more useful than a pile of throughput numbers.
draft: true
---

{/* ⚠️ DRAFT — DO NOT PUBLISH. Two blockers, one serious:

    1. PROVENANCE (blocking). This post narrates a specific first-hand SigNoz
       install experiment — exact wall-clock timestamps, product/version numbers,
       an OpAMP "cannot create agent without orgId" stack trace, "2 h 38 m" total.
       We hold NO captured artifact for this run: no VPS provisioning record, no
       saved container/collector logs, no benchmark output — unlike every Pharlux
       benchmark, which we log. As drafted it reads as reported fact. It must not
       publish as first-hand fact unless it was actually performed and these
       observations are real. If it was not run, reframe or drop it — do not
       publish. Owner to confirm.

    2. DATA (blocking). The [PHARLUX_*] placeholders need REAL 2 vCPU / 4 GB
       ($20-VPS) v1.2.0 numbers. No such verified run exists in our records, and
       /benchmarks only publishes 4 vCPU / 8 GB figures. Do not invent these.

    EDITORIAL: a whole post about a competitor failing to install sits close to
    the house rule "market Pharlux, never write a competitor buying-guide," even
    with the heavy caveats. Owner call on whether this reframes to a
    Pharlux-forward angle. Set draft: false only after 1 + 2 are resolved. */}

# Pharlux vs SigNoz on a $20 VPS — what actually happened

*Last updated: 2026-05-05 · Pharlux v1.0.0 · By Ian Holt*

The plan was simple: spin up Pharlux on one Perth-region 2 vCPU / 4 GB / $20-per-month VPS, spin up [SigNoz](https://signoz.io/) on an identical VPS in the same region, run the same OTLP load test against both, and publish the numbers.

I want to be upfront about the result before getting into the detail. We got real numbers from the Pharlux side and zero numbers from the SigNoz side, because in roughly two and a half hours of an experienced operator's afternoon, I could not get SigNoz's default Docker Compose install to accept a single OTLP data point on the smaller-VPS tier the comparison was framed around. The post that comes out of this is not "Pharlux is X% faster than SigNoz" — it is "here is what 'install' actually means for each of these systems on the kind of small box a small team would actually deploy on."

<!-- truncate -->

## Why this comparison matters at all

Both Pharlux and SigNoz are self-hosted, OpenTelemetry-native observability tools that explicitly target teams who do not want to operate the full LGTM (Loki + Grafana + Tempo + Mimir) stack. SigNoz has more stars, more community, and a much longer head start. They are an obvious comparison point — possibly the most obvious one — for any serious technical reader of [the Pharlux $20 VPS post](/blog/pharlux-on-a-20-dollar-vps/).

The earlier post argued that a small team can run real OTel-native observability for a $20 VPS plus zero dollars in software (AGPL-3.0 community tier). It is a fair and obvious follow-up question: can SigNoz do the same? Both projects have public docker-compose files, both speak OTLP, both target self-hosted users. The smallest path to a defensible answer was to run them side-by-side on the same hardware class.

That answer is what this post is about, and it is not the answer I expected when I started.

## The hardware

Two BinaryLane VPSes in Perth, identical specs, different physical hosts so neither side gets to share a kernel page cache:

| Box | Role | Specs | Cost |
|---|---|---|---|
| `pharlux-test` | Pharlux v1.0.0 | std-2vcpu — 2 vCPU / 4 GB / 60 GB / Ubuntu 24.04 | $19.60/month |
| `signoz-bench` | SigNoz v0.121.1 | std-2vcpu — 2 vCPU / 4 GB / 60 GB / Ubuntu 24.04 | $19.60/month |

Both fresh, both clean Ubuntu 24.04. Same OTLP load harness — Pharlux's own `pharlux-loadtest` binary, sending OTLP/protobuf over HTTP — running on each box's localhost so the network is taken out of the comparison.

(Disclosure: Veltara Works dogfoods on BinaryLane. Pricing-equivalent providers — Hetzner CX22, OVH VPS Comfort, DigitalOcean Premium AMD 4 GB — would produce the same shape of result. The relevant constraint is "2 vCPU / 4 GB", not the brand of VPS.)

## The Pharlux side

I will keep this brief because the [previous post](/blog/pharlux-on-a-20-dollar-vps/) covered the install in detail.

Time from running the install command to the first OTLP data point being queryable: **about ten seconds**. Three steps:

1. `curl` the binary into `/usr/local/bin/pharlux`.
2. `sudo pharlux install` — writes the systemd unit, generates the JWT secret, prepares the data directory.
3. `sudo systemctl enable --now pharlux`.

After that, OTLP traffic to the box on port 4318 lands in storage. The bootstrap admin user is one extra `pharlux user add --admin` command, but ingestion does not depend on it — the OTLP endpoint accepts traffic from the moment the service starts.

The 30-second sustained load test produced [PHARLUX_30S_PTS_PER_SEC] points/sec with [PHARLUX_30S_ERR_PCT] errors. The 5-minute sustained test produced [PHARLUX_5MIN_PTS_PER_SEC] points/sec with [PHARLUX_5MIN_ERR_PCT] errors. Memory under load stayed within Pharlux's documented working envelope (200–430 MB resident, 1 GB hard ceiling per the systemd unit). Disk usage after the 5-minute run: [PHARLUX_DISK_USAGE].

(For context, the headline figure on the [v1.0.0 release page](https://github.com/Veltara-Works/pharlux/releases/tag/v1.0.0) is 250,000 points/sec on a 4 vCPU / 8 GB VPS — a different and larger hardware class. The numbers in this post are from the smaller $20 tier the comparison was framed around.)

## The SigNoz side — the actual story

Here is what I did and what happened, in order. I am writing this in detail because the detail is the point.

**11:24 — Spin up the VPS, install Docker.** Standard Ubuntu 24.04, official Docker apt repo via `get.docker.com`. About five minutes. Docker 29.4.2, Compose v5.1.3.

**11:30 — Clone SigNoz, `docker compose up -d`.** The repository is at `github.com/SigNoz/signoz`. The compose file lives at `deploy/docker/docker-compose.yaml`. The pull took several minutes — five containers, including ClickHouse 25.5.6 and Apache ZooKeeper 3.7.1. None of this is unusual; the SigNoz architecture is a multi-component stack and the images add up.

**11:51 — All five containers up, four marked healthy.** ZooKeeper healthy, ClickHouse healthy, the `signoz` server container healthy, the `signoz-otel-collector` running. ClickHouse needed about a minute of schema-migration work after the first `compose up` — also documented and not unusual.

**11:53 — First OTLP smoke test from inside the box.** Send 25,000 metric points over five seconds at the SigNoz collector's OTLP HTTP endpoint on `127.0.0.1:4318`, the documented receiver port. Result: 100% errors, all of them "Connection reset by peer." Zero data points landed in ClickHouse.

**11:53–14:09 — Diagnose.** This is where the post stops being about benchmarks and starts being about what "the install is done" actually means.

The SigNoz `otel-collector` container's logs end with the cheerful message *"Everything is ready. Begin running and processing data."* This is reassuring and incorrect. Inside the container, the only listening TCP port is 8888 — the collector's own Prometheus metrics endpoint. The OTLP receivers on 4317 and 4318, the health-check extension on 13133, and the pprof extension on 1777 are all configured in the static config file and none of them are bound. The host-side Docker port forward on 4318 is wired to nothing inside the container, which is why every connection from the load test gets reset.

The reason is in a different log stream entirely. The `signoz` server container — the one that runs the UI on port 8080 — emits an error every thirty seconds:

```
ERROR  failed to find or create agent
       agent_id=019df644-...
       exception.message="cannot create agent without orgId"
```

SigNoz's `signoz-otel-collector` is not a stock OpenTelemetry Collector running off the YAML file in the volume mount. It is an OpAMP-managed agent: its runtime pipeline configuration is push-delivered from the SigNoz server over a WebSocket connection. Until the SigNoz server has an organisation to associate the agent with, the OpAMP server returns an error to every agent registration attempt, and the collector never gets the runtime config that activates its receivers. The static YAML in the volume mount is a base configuration only. The receivers do not bind from it alone.

The fix for that specific error is to register the first user, which creates the first organisation, which gives the OpAMP server an `orgId` to bind the agent to. Three calls to the SigNoz API later (login, register, set initial config), the orgId existed, the OpAMP errors stopped, and the otel-collector successfully registered.

What did not happen: the receivers still did not bind. Inside the collector container, only port 8888 was listening. After another half-hour of tracing API calls and reading source — including stepping through the `signoz` server's onboarding state machine — I did not get the OpAMP control plane to push a runtime configuration that activates the OTLP receivers in this version. There is, almost certainly, an additional onboarding step that I missed. SigNoz's docs and forums refer to a "Get Started" wizard that walks through configuring the first integration; it is not obviously fixable from API calls alone, and I spent the time I had on diagnostic reading rather than UI clicking.

**14:09 — Stop.** A `pharlux-loadtest --duration 5 --rate 5000` against the same SigNoz collector still returned 100% "Connection reset by peer." Total elapsed time from `compose up` to giving up: 2 hours 38 minutes.

## What this is not

A few caveats I want to be very explicit about, because the conclusions are nuanced:

- **This is not a SigNoz teardown.** SigNoz is a serious, well-engineered project with a real community and full-fat features that Pharlux does not have in V1 (distributed traces, full APM, cloud sign-up, integrations marketplace). It is the right choice for a lot of teams.
- **This is not a benchmark either way.** I did not get SigNoz to ingest a single data point on this hardware in 2.5 hours. I cannot tell you it would not ingest 100,000 points/sec. I can only tell you that I could not measure it.
- **This is not "Pharlux is faster than SigNoz."** Two of the three things this post would need for that claim — a working SigNoz install and matching workload — are missing. The headline figure is "I could not measure SigNoz on this hardware in the time I had."
- **A more experienced SigNoz operator would probably have got it ingesting.** I am sure of that. Someone who has run SigNoz before, knows the onboarding wizard, and has already built the muscle memory would close the gap I hit faster than I did. The relevant question is whether *the average small-team operator* hits the same gap I did, given the same starting point.

What this *is* is one experienced operator's afternoon, on the smallest VPS tier the original cost framing depends on, trying to follow the documented install path to the documented "ingestion ready" state. That is not a benchmark. It is data about the install experience.

## What I learned about the operational comparison

A few things crystallised during the diagnostic work that would not have shown up in a benchmark even if I had got one:

**The collector's static config file is a base configuration, not the runtime configuration.** SigNoz's otel-collector runs in OpAMP-managed mode: its runtime pipeline (which receivers bind, which exporters fire, which processors apply) is push-delivered from the server. This is a perfectly reasonable design for fleet-managed scenarios — and it is also why "the static YAML on disk" does not mean "the set of receivers actually listening." Reading the YAML and seeing `otlp:` at `0.0.0.0:4318` is not the same as having the OTLP HTTP receiver bound on 4318.

**The "single command install" framing covers different surface areas.** Both projects are honest about their deployment shape, but the shape is different. For Pharlux, "install" is *one binary plus one systemd unit, ingesting from second one*. For SigNoz, "install" is *six containers, schema migrations, then sign-up, then OpAMP handshake, then onboarding wizard, then ingesting*. Each of those steps is a moment a real user can stop, and on a $20 VPS each one is also a moment something can fail in a way that does not show up in `compose ps`.

**The base memory budget matters more on small boxes.** SigNoz at idle, after `compose up` settled but before any load: about 1.3 GB resident memory across its containers. Pharlux at idle: about 30 MB. On an 8 GB box that difference is loose change. On a 4 GB box it is half the budget. Whatever throughput SigNoz can sustain on this hardware *under load*, the steady-state baseline is half the box.

**Time-to-first-byte is a real number that nobody publishes.** From `compose up` to "first OTLP data point landed and queryable":

| System | Time-to-first-byte | Notes |
|---|---|---|
| Pharlux v1.0.0 | ~10 seconds | Three commands, no sign-up, no onboarding |
| SigNoz v0.121.1 | Did not reach in 2.5 hours | On the $20 VPS tier, with a stock `compose up`, by an operator who has done a lot of self-hosting but not SigNoz specifically |

If your context is "we already have a SigNoz operator on the team and they have done this before," that table looks different. If your context is "we want to self-host observability and the first hour is all the patience the team has," it does not.

## What I would do differently next time

If I were going to make this comparison comprehensive — and I might, in a follow-up — here is what I would change:

- **A bigger box for SigNoz**, separately. The SigNoz-recommended deployment specs are 8 GB minimum for production, and the $20 VPS tier is below that. Running SigNoz at its recommended spec and Pharlux at the smaller spec is its own honest comparison — *what each system needs to run well* is part of the comparison.
- **A SigNoz operator in the loop.** Someone who has done the onboarding wizard before would close the install-friction question in a different direction.
- **A 1-hour and 24-hour benchmark.** SigNoz's ClickHouse-based architecture and Pharlux's WAL+Parquet architecture have different steady-state characteristics. A 30-second sprint does not surface those.

## Frequently asked questions

### Did you submit a bug report to SigNoz?

Not yet. The behaviour I hit looks like a documentation gap more than a bug — the install path I followed is the canonical one in the project README, but the post-install onboarding wizard step that activates the collector is not called out as mandatory in the same places. I would rather raise it as a documentation issue than file a bug, since the underlying system is working as designed; what I missed is the onboarding step.

### Are you saying SigNoz cannot run on a $20 VPS?

I am saying I could not get it ingesting on a $20 VPS in 2.5 hours of an experienced operator's time. SigNoz's own deployment docs recommend 8 GB minimum for production, so a 4 GB box is below their stated minimum already. Whether it would ingest given more time and more diagnostic reading, I genuinely do not know.

### Why did you not just use SigNoz Cloud?

The comparison is *self-hosted* observability on a small VPS. SigNoz Cloud is a managed product on different hardware running a different version, with a credit-card sign-up and a recurring per-host bill. It is a fair product comparison for *Pharlux Team* against *SigNoz Cloud* — but that is a different post, and the framing of this one is the $20 VPS.

### What numbers did Pharlux do on this hardware?

The 30-second sustained run produced [PHARLUX_30S_PTS_PER_SEC] points/sec with [PHARLUX_30S_ERR_PCT] errors. The 5-minute run produced [PHARLUX_5MIN_PTS_PER_SEC] points/sec with [PHARLUX_5MIN_ERR_PCT] errors. The 4 GB / 2 vCPU tier handles considerably less than the 250,000-point headline number on 4 vCPU / 8 GB hardware, but it handles the small-team workload well within its envelope.

### How is this any different from "we tried product X and it was hard"?

Fair question. The difference I would point at is that the friction I hit is not a Pharlux opinion — it is a stack-trace and a server log. The OpAMP `cannot create agent without orgId` error, and the collector container with port 8888 bound but not 4317/4318, are observable facts that another operator can reproduce on a fresh `compose up`. If a SigNoz operator reads this and points out the missing onboarding step, that is a useful outcome for everyone. The post is not the last word on the comparison; it is the first word.

### Do you think SigNoz is worse than Pharlux generally?

No. SigNoz is a well-built system with features Pharlux does not have in V1 — distributed traces, broader APM, a richer dashboard library, a hosted product. For a team that wants those things and has the operator-hours to run a multi-container deployment, it is a perfectly reasonable choice. The narrow claim of this post is about install friction on a small VPS, not overall product quality.

### Will you redo the benchmark with SigNoz on a bigger box?

Probably. Likely after V1.1 ships, when traces are in the comparison and the framing can be apples-to-apples on hardware SigNoz officially recommends. The result of that follow-up will be different from this one — and that is fine, because what each system needs to run well *is* part of the comparison.

## Get Pharlux

- **Download v1.0.0** — [github.com/Veltara-Works/pharlux/releases/tag/v1.0.0](https://github.com/Veltara-Works/pharlux/releases/tag/v1.0.0)
- **Documentation** — [pharlux.com/docs/getting-started/](/docs/getting-started/)
- **Source** — [github.com/Veltara-Works/pharlux](https://github.com/Veltara-Works/pharlux)
- **The cost-side post** — [Running Pharlux on a $20/month VPS](/blog/pharlux-on-a-20-dollar-vps/)

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software license management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
