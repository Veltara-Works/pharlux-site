# Sizing Guide

Pharlux is designed for single-VPS observability — one binary, one process, all data on local disk. Right-sizing the VPS is the most important pre-deployment decision: too small and queries fail under load; too large and you're paying for capacity you'll never use.

This guide covers memory accounting, disk accounting, the 10 GB/day full-text-search threshold, and how to tune the `[query]` and `[storage]` knobs in `pharlux.toml` for your workload. The architectural rationale behind the memory budget is in [ADR-0011](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/adr/0011-memory-budget-200-430mb.md).

## Quick reference

| VPS size | Suitable for | Metric points/sec | Log volume/day | Trace volume (V1.1) | Default retention |
| --- | --- | --- | --- | --- | --- |
| **2 vCPU / 4 GB / 80 GB SSD** | 1–3 services, dev / staging | Up to 10,000 | Up to 2 GB | Up to 5,000 spans/sec | 7 days |
| **4 vCPU / 8 GB / 200 GB SSD** | 5–10 services, small production | Up to 50,000 | Up to 10 GB | Up to 20,000 spans/sec | 30 days |
| **8 vCPU / 16 GB / 500 GB SSD** | Above the V1 target audience | Up to 200,000 | Up to 50 GB | Up to 100,000 spans/sec | 30 days |

These are the tiers Pharlux is tested against. The V1 design target is **1–10 services on a single VPS**, which the 4 vCPU / 8 GB tier covers comfortably with headroom. The 2 vCPU / 4 GB tier is the documented minimum and works well for dev, staging, or small production.

> Pharlux is the **wrong tool** for workloads above ~50 GB/day of logs sustained, or for organizations that need horizontal scale-out across multiple data nodes. See [Known V1 limitations](#known-v1-limitations) at the bottom.

## Memory accounting

Pharlux's planning memory figure under load is **200–430 MB** (per [ADR-0011](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/adr/0011-memory-budget-200-430mb.md)). The breakdown:

| Component | Typical | Configurable | Notes |
| --- | --- | --- | --- |
| Rust binary baseline | 20–30 MB | — | Statically-linked, stripped release binary. |
| WAL buffer | up to 64 MB | `[storage].wal_max_segment_bytes` | Bounded per-segment; rotates at the configured size. |
| DataFusion query execution | 50–200 MB | `[query].memory_pool_mb` (default 256) | Hard cap. Queries that would exceed this fail cleanly with an out-of-memory error. |
| Parquet reader page cache | 50–100 MB | — | Lazy; grows under load and shrinks idle. |
| SQLite + page cache | 10–20 MB | — | `auth.db`, `alerts.db`, `meta.sqlite` combined. |
| HTTP connection buffers | 10–20 MB | — | At the documented concurrency (~100 connections). |

The systemd unit produced by `pharlux install` sets `MemoryMax=1G` as a kernel-enforced hard ceiling. If Pharlux ever exceeds 1 GB (which would indicate either a configuration mistake or a bug), the kernel kills the process and `Restart=always` brings it back. WAL crash recovery (per ADR-0018) ensures no persisted data is lost across the restart.

### Process-level RSS reporting

The `/metrics` endpoint exposes the running figures:

| Metric | Meaning |
| --- | --- |
| `pharlux_wal_bytes` | Current WAL footprint on disk. |
| `pharlux_active_queries` | Currently in-flight queries. |
| `pharlux_query_duration_us_sum` / `_count` | Aggregate query latency (use for `rate()` / `increase()` in your monitoring). |

Use these on a dashboard alongside the host's process RSS to confirm Pharlux is sitting in the 200–430 MB range under your real workload. If RSS is climbing close to the systemd ceiling under steady-state load, the right knob to turn is `[query].memory_pool_mb` — see [Tuning](#tuning).

## Disk accounting

Pharlux's data directory layout (default `/var/lib/pharlux/`):

```
/var/lib/pharlux/
├── wal/                    # Write-ahead log (active + rotated segments)
├── metrics/{tenant}/YYYY/MM/DD/HH/   # Parquet partitions, hourly
├── logs/{tenant}/YYYY/MM/DD/HH/      # Parquet partitions, hourly
├── auth.db                 # SQLite — users + API keys
├── alerts.db               # SQLite — alert rules + state
└── meta.sqlite             # SQLite — dashboards + tenant metadata
```

The dominant disk consumer is the per-signal Parquet partitions; the WAL is bounded; the SQLite files are tiny.

### WAL footprint

Bounded by configuration:

| Key | Default | Meaning |
| --- | --- | --- |
| `[storage].wal_max_segment_bytes` | `67108864` (64 MB) | Max segment size before rotation. |
| `[storage].wal_max_total_bytes` | `536870912` (512 MB) | Max total WAL size across all segments. |

The WAL holds buffered records that have not yet been flushed to Parquet. Under steady-state ingest, WAL footprint stays close to one-or-two segments (~64–128 MB). Plan for the full 512 MB ceiling when sizing the disk.

### Parquet footprint

Parquet is the long-term store. Its on-disk size depends on:

- The volume of points/rows ingested per day,
- The Parquet codec and level (`[storage].parquet_compression`, default `zstd`; `[storage].parquet_zstd_level`, default `3`),
- The schema (metrics records are smaller than logs records on the wire; logs records compress harder thanks to repeated `severity_text` and `scope_name` values),
- The retention window (`[storage].retention_days`, default `30`).

Pharlux does not publish a single bytes-per-record figure because real-world ratios vary substantially by cardinality (number of distinct attribute combinations) and value distribution. For order-of-magnitude planning:

| Signal | Typical compressed footprint | Notes |
| --- | --- | --- |
| Metrics | ~30–60% of the raw OTLP payload size on disk | Higher cardinality (many label combinations) shifts toward 60% and beyond. |
| Logs | ~15–25% of the raw OTLP payload size on disk | Repeated severity, source, and JSON-shape values dictionary-encode and zstd-compress aggressively. |

**The pragmatic approach is to measure your own ratio after one full day of ingest.** Watch `pharlux_ingestion_points_total` and the size of `metrics/` and `logs/` on disk; that gives you a real bytes-per-point figure for *your* workload.

### Disk sizing rule of thumb

For a workload that ingests $D$ GB/day of raw OTLP traffic and you want $R$ days of retention:

```
Disk needed ≈ (D × R × 0.40) + 1 GB (WAL ceiling + SQLite + headroom)
```

The 0.40 multiplier is a conservative blended figure between metrics (~0.50) and logs (~0.20). Keep at least 20% free headroom on top so retention enforcement, compaction, and OS journals never run the disk to zero.

Worked example — a 4 vCPU / 8 GB VPS ingesting 5 GB/day with 30-day retention:

```
5 × 30 × 0.40 + 1 = 61 GB on disk
+ 20% headroom    = 73 GB
→ 200 GB SSD comfortably sufficient
```

## Logs sizing — the 10 GB/day LIKE threshold

Pharlux V1 uses DataFusion `LIKE` / `ILIKE` for log full-text search, scanning the `body` column of Parquet directly. This is fast and predictable up to **~10 GB/day of sustained log volume**; above that, 7-day searches start to exceed the 30-second response-time target on a 2 vCPU VPS.

| Daily log volume | 7-day LIKE scan time (2 vCPU) | Verdict |
| --- | --- | --- |
| < 1 GB/day | < 2 seconds | Excellent |
| 1–5 GB/day | 2–15 seconds | Good |
| 5–10 GB/day | 15–30 seconds | Acceptable |
| 10–20 GB/day | 30–60 seconds | Degraded |
| > 20 GB/day | > 60 seconds | Not recommended without a full-text index |

Above 10 GB/day, the options are:

- **Move to the 4 vCPU / 8 GB or 8 vCPU / 16 GB tier** — more vCPU directly scales LIKE throughput.
- **Always include a tight time range** in log queries (`WHERE timestamp > now() - INTERVAL '1 hour'`), which lets partition pruning skip most of the data on disk.
- **Wait for V1.1**, which adds an optional Tantivy inverted index per partition for sub-second full-text search at any volume. The schema is forward-compatible — no migration needed when V1.1 ships.

Full performance characteristics and tuning guidance for log queries are in [`logs-query-performance.md`](logs-query-performance.md).

## Tuning

Most operators never need to touch these. Change them only if `/metrics` shows a specific symptom.

### `[query].memory_pool_mb`

Default: `256`. Hard cap on DataFusion's query memory. Raise this if complex `GROUP BY` queries over long time ranges fail with out-of-memory errors and you have RAM headroom; lower it if you're running on the 2 vCPU / 4 GB tier and want a more conservative ceiling on worst-case query memory.

```toml
[query]
memory_pool_mb = 512   # for an 8 GB VPS willing to let queries spike higher
```

Raising above ~512 MB starts to bring you close to the systemd `MemoryMax=1G` ceiling — verify your RSS under load before committing.

### `[storage].retention_days`

Default: `30`. Time-based retention; Parquet partitions older than this are deleted on the next sweep. Setting this to a smaller number (e.g. 7) is the simplest way to bound disk usage on a small VPS without changing ingest configuration.

```toml
[storage]
retention_days = 14
```

There is no bytes-based retention in V1 — the policy is purely time-based. On a commercial licence, the effective window is the **lower** of `retention_days` and your plan's licensed maximum.

### `[storage].retention_sweep_interval_hours`

Default: `24`. How often the retention sweep runs; one sweep also runs at startup. Lower this (e.g. `6`) on a tight disk to reclaim space from expired partitions more promptly. The sweep is cheap — it stats and removes whole hour directories — so a shorter interval adds negligible overhead.

```toml
[storage]
retention_sweep_interval_hours = 6
```

### `[storage].parquet_zstd_level`

Default: `3`. Range `1–22`. Level 3 is the Pharlux default because it sits at the inflection point of the size/CPU trade-off curve — substantial compression with low write-time CPU. Operators with abundant CPU and disk pressure can raise to 6 or 9 for ~15–25% smaller files at the cost of a measurable bump in ingest CPU. Lowering to 1 is rarely worth it unless ingest CPU is the bottleneck.

### `[storage].wal_max_total_bytes`

Default: `536870912` (512 MB). The WAL is bounded — once it fills, ingest blocks until flush catches up (a deliberate backpressure mechanism — see ADR-0015). Raising this in V1 buys longer ingest spike tolerance at the cost of more memory and a longer crash-recovery replay window. Most operators leave this at the default.

### `[ingest].channel_capacity` and `send_timeout_ms`

These govern the bounded ingest mpsc channel between OTLP handlers and the WAL writer. Defaults (`1000` batches, `100 ms` timeout) are tuned for the V1 target; if you see HTTP 429 / gRPC `RESOURCE_EXHAUSTED` from the OTLP endpoints under load, the right fix is to scale up the VPS rather than enlarge the channel — the backpressure is signalling that the storage layer cannot keep up, and burying that signal in a bigger channel just delays the failure.

## When to scale up — and what to do when Pharlux is no longer the right tool

Signs that you've outgrown the current VPS:

| Signal | Action |
| --- | --- |
| `pharlux_active_queries` regularly maxes out at `[query].max_concurrent_queries` (default 16) | Scale vCPU; consider raising the cap. |
| Parquet directory growth + `retention_days` no longer bounds the disk to a comfortable size | Scale disk, or shorten `retention_days`. |
| 7-day log searches exceed 30 seconds | Move to a higher tier *or* tighten time ranges in your queries. Above 10 GB/day, V1.1's Tantivy index is the structural fix. |
| Process RSS sits above 800 MB under steady-state load | Scale RAM; review whether `[query].memory_pool_mb` was raised too aggressively. |
| Sustained ingest 429s | Scale vCPU + disk together — the backpressure indicates the storage layer is the bottleneck. |

Pharlux is **not** a fit for:

- **Workloads above ~50 GB/day of logs sustained.** The single-VPS architecture and the V1 LIKE search ceiling become structural limits.
- **Multi-region or HA-required deployments.** V1 is single-binary, single-VPS by design. Replication, multi-replica reads, and cross-region routing are not on the V1 roadmap.
- **Above ~200,000 metrics points/sec sustained.** The 8 vCPU / 16 GB tier is the documented top end; loads beyond this benefit from a horizontally-scaled stack rather than a larger Pharlux.

If your workload genuinely exceeds the documented envelope, you're outside the V1 target audience, and Pharlux is the wrong tool — that's a conscious scope decision, not a regression.

## Known V1 limitations

- **No bytes-based retention.** Retention is time-based only (`retention_days`). To bound disk by size, choose `retention_days` based on your expected daily volume.
- **No automatic compaction in V1.** Compaction runs are manual via `pharlux compact`. Auto-compaction lands in V1.1.
- **No tiering to cold storage in the AGPL build.** S3 cold-tier offload is a Pharlux Enterprise feature.
- **No multi-VPS replication.** Backup-restore (see [`backup-restore.md`](backup-restore.md)) is the recovery path; cross-host hot replication is not on the V1 roadmap.

## See also

- [`getting-started.md`](getting-started.md) — first-install walkthrough including a condensed sizing table.
- [`otlp-configuration.md`](otlp-configuration.md) — full `pharlux.toml` reference for every key cited above.
- [`logs-query-performance.md`](logs-query-performance.md) — deep dive on the 10 GB/day LIKE threshold and the V1.1 Tantivy plan.
- [`backup-restore.md`](backup-restore.md) — backup, restore, and disk recovery procedures.
- [`../../adr/0011-memory-budget-200-430mb.md`](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/adr/0011-memory-budget-200-430mb.md) — original decision record for the memory accounting.
