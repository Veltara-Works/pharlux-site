---
title: How the WAL+Parquet union query works
slug: wal-parquet-union-query
authors: [Ian]
tags: [engineering, deep-dive, datafusion, parquet, observability]
date: 2026-05-05
description: A walkthrough of the Apache DataFusion TableProvider that lets Pharlux serve queries against in-memory WAL records and on-disk Parquet files as a single consistent view — the load-bearing piece behind sub-second freshness.
---

# How the WAL+Parquet union query works

*Last updated: 2026-05-05 · Pharlux v1.0.0 · By Ian Holt*

The thing most observability platforms don't talk about: you cannot query data you have not persisted, and persisting hurts throughput. ClickHouse-style batch writers compress beautifully and scan fast, but typical batch intervals introduce tens of seconds of staleness before new data is queryable. In-memory buffers are immediate but lose data on crash. The two requirements — durability and freshness — pull in opposite directions, and most platforms pick one and document around the other.

Pharlux ships a different design. A custom Apache DataFusion `TableProvider` unions an in-memory WAL buffer with on-disk Apache Parquet files into one consistent view at query time. Freshly-ingested data is queryable as soon as it lands in the WAL — no flush wait, no buffer-window staleness — and it is queryable through the same SQL surface as historical data on disk.

<!-- truncate -->

This is the load-bearing piece behind Pharlux's freshness story, and the riskiest decision we made in the whole architecture — risky enough that we held the proof-of-concept as a mandatory gate before writing any production code. It lives in [`pharlux-store/src/table_provider.rs`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/pharlux-store/src/table_provider.rs). This post walks through the design, the runtime semantics, and the trade-offs.

## The trade-off, concretely

Three specific scenarios drive the design:

1. **Acknowledged-but-not-flushed data must survive a crash.** When OTel Collectors send a batch and Pharlux returns 200 OK, that data is persisted. A `SIGKILL` immediately afterwards must not lose the batch.
2. **Just-acknowledged data must be queryable.** Operators run `pharlux user add`, restart a service, hit a dashboard. The dashboard query lands within seconds. The metric points just emitted by the restarted service must appear in that query — not "in 30 seconds when the next flush completes."
3. **Compressed historical data must scan fast.** Six months of metrics needs to live in a format the query engine can scan efficiently — column-pruned, predicate-pushed, page-skipped. That is what Parquet was designed for.

A single storage format that satisfies all three is hard. Parquet is column-stored, optimised for analytical scans, and not designed for high-frequency small writes. An append-only WAL is fast to write and easy to crash-recover, but Parquet's compression ratios and scan performance assume larger, well-organised files. Pharlux uses both, with the WAL as the durable buffer and Parquet as the compressed steady state — which puts the unification problem at query time.

## The naive options that don't work

A few approaches the design considered and rejected:

- **Query Parquet only, accept N-second staleness.** Loses requirement #2. ClickHouse, SigNoz, and most batch-oriented platforms accept this. Pharlux's design centre — small teams debugging incidents in real time — does not.
- **Flush WAL → Parquet on every batch.** Parquet writers have meaningful per-file overhead (footer encoding, schema serialisation, dictionary pages). Flushing on every batch destroys throughput and produces thousands of tiny Parquet files that are slow to scan.
- **In-memory buffer only, no on-disk WAL.** Loses requirement #1. Any crash between ingest and the next flush loses data. Rejected explicitly in ADR-0018.
- **Two storage layers, two query paths.** Some systems route "recent" queries to a hot store and "historical" queries to cold storage, requiring the user to know which is which. The user does not want to know which is which. They want one SQL surface.
- **A real database (PostgreSQL, ClickHouse, etc.).** Violates the single-binary constraint. Pharlux is one statically-linked Rust binary; there is no PostgreSQL or ClickHouse process to run alongside it.

The design that satisfies all three requirements is: keep the WAL durable on disk, keep recently-acknowledged records in an in-memory snapshot of that WAL, write Parquet files when the WAL exceeds a size or time threshold, and let the query engine see both at once.

## The split

Pharlux runs two storage layers in the same process:

**The WAL** is an append-only file on disk with a strict frame format (length-prefixed prost-encoded protobuf records, each followed by a CRC32 — see [ADR-0018](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0018-wal-file-format-prost-crc32.md)). Every accepted batch is written to the WAL with a configurable fsync policy before the API returns 200 OK. On crash, replay reads the WAL forward, validates each record's CRC, truncates at the first invalid record (a partial write at the tail), and rebuilds the in-memory state. Crash recovery is gated by a hard test: 10 consecutive crash-recovery test runs with zero flakes is one of the V1 release gates.

**Parquet** is the on-disk steady state. Per-signal schemas (metrics, logs, and roadmap traces) are frozen ([ADR-0003](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0003-separate-parquet-schemas-per-signal.md)). Files live under `/var/lib/pharlux/{metrics,logs}/{tenant_id}/YYYY/MM/DD/HH/` so retention and compaction can operate on time partitions without scanning the whole tree. Compression is column-stored, dictionary-encoded for high-repeat fields like `name` and `scope_name`, with timestamp-sorted row groups for predicate pushdown.

**The link between them** is the `PharluxMetricsTable` (and its `PharluxLogsTable` sibling), which holds:

```rust
struct TableState {
    wal_records: Vec<WalRecord>,      // in-memory snapshot of the WAL tail
    parquet_files: Vec<PathBuf>,      // committed files on disk
}

pub struct PharluxMetricsTable {
    schema: SchemaRef,
    state: Arc<RwLock<TableState>>,
}
```

The `RwLock` is the load-bearing primitive. Ingest takes the write lock briefly to push a `WalRecord` into the buffer. Query takes the read lock briefly to snapshot both halves. Flush takes the write lock briefly to drain WAL records and register newly-written Parquet paths.

## How a query executes

The implementation lives in `impl TableProvider for PharluxMetricsTable`. The DataFusion query planner calls `scan()` with the projection, filters, and limit; Pharlux returns an `ExecutionPlan` that yields Arrow `RecordBatch`es covering both layers.

The interesting bit is the snapshot:

```rust
async fn scan(&self, ...) -> Result<Arc<dyn ExecutionPlan>> {
    // Snapshot WAL records and open Parquet file handles under read lock.
    // Opening handles inside the lock ensures compaction cannot delete
    // files between path observation and handle acquisition.
    let (wal_records, parquet_handles) = {
        let state = self.state.read().unwrap();
        let records = state.wal_records.clone();
        let handles: Vec<File> = state.parquet_files.iter()
            .filter_map(|p| File::open(p).ok())
            .collect();
        (records, handles)
    };
    // ... build RecordBatches, delegate to MemTable for projection/filter/limit
}
```

Two subtle properties matter here:

- **Open handles inside the lock.** A naive implementation would clone the path list under the read lock and open files later. Compaction or retention could delete one of those files in the gap between the path snapshot and the open call, causing a query to fail with `ENOENT` mid-flight. Opening the handles inside the read lock means each query holds a kernel-level reference to its set of files for the duration of the scan, even if the on-disk path is unlinked.
- **Clone the WAL records.** The `Vec<WalRecord>` clone is a real cost (shallow copy of the slice plus protobuf payloads), but it removes the WAL data from the lock's lifetime. The query proceeds on a private copy; ingest and flush can continue concurrently on the original buffer without the query holding the read lock for the full scan duration.

After the snapshot, WAL records are converted into a single Arrow `RecordBatch` matching the production Parquet schema (timestamp as `Timestamp(Nanosecond, UTC)`; `name` as a `Dictionary(Int32, Utf8)`; `tenant_id` as a non-null `Utf8`; etc.). Parquet files are read through `ParquetRecordBatchReaderBuilder`, which yields the same Arrow shape. All batches are collected into a `MemTable`, and `MemTable::scan()` applies projection pushdown, filter pushdown, and the optional `LIMIT` — the same DataFusion optimisations that run for any other table.

The user-side SQL surface is just SQL:

```sql
SELECT name, count(*) AS cnt
FROM metrics
WHERE timestamp > now() - INTERVAL '5 minutes'
GROUP BY name
ORDER BY cnt DESC;
```

There is no `metrics_recent` vs `metrics_historical` distinction in the schema. The query engine sees one logical table; the `TableProvider` produces the union; the user does not need to know.

## Atomic transitions

The other moving piece is what happens when WAL records *become* Parquet files. The flush path:

```rust
// Step 1: read-lock to clone the records we'll flush
let to_flush = {
    let state = self.state.read().unwrap();
    let n = count.min(state.wal_records.len());
    state.wal_records[..n].to_vec()
};

// Step 2: write Parquet files — no lock held during I/O
let written = parquet_writer::flush_records_to_parquet(data_dir, &to_flush, ...)?;
let paths: Vec<PathBuf> = written.iter().map(|w| w.path.clone()).collect();

// Step 3: write-lock to drain flushed records and register new files
{
    let mut state = self.state.write().unwrap();
    let n = to_flush.len().min(state.wal_records.len());
    state.wal_records.drain(..n);
    state.parquet_files.extend(paths);
}
```

The relevant invariant is in the doc comment on this function: *"records transition from WAL to Parquet atomically under the write lock — a concurrent query sees records in either WAL or Parquet, never both and never missing."*

That property is what makes the union query correct. Step 2 (the actual Parquet write) happens with no lock held — disk I/O cannot block ingest or queries. Step 3 takes the write lock just long enough to swap pointers: drain the flushed prefix from `wal_records`, push the new `PathBuf`s into `parquet_files`. A query running on a snapshot taken before this step sees the records as WAL entries; a query on a snapshot taken after sees them as Parquet entries. There is no in-between state where a record is missing or duplicated.

## Performance characteristics

The design's runtime profile, on a 4 GB / 2 vCPU VPS:

- **Ingest path:** OTLP request → bounded `tokio::sync::mpsc` channel (default 1,000 batches) → WAL writer task → fsync. The channel bound is the primary backpressure signal; when full, ingest returns HTTP 429 / gRPC `RESOURCE_EXHAUSTED` after a 100 ms send timeout (per [ADR-0015](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0015-ingest-channel-bounded-mpsc-backpressure.md)). OTel Collectors retry 429 with exponential backoff out of the box.
- **WAL ceiling:** 64 MB. Above this, a flush is forced regardless of the configured flush interval. The 64 MB figure is a deliberate cap on memory-resident WAL state, since the in-memory `Vec<WalRecord>` is what the query path snapshots.
- **Query path:** `scan()` snapshots state under read lock (microseconds), reads Parquet (column-pruned per the projection, predicate-pushed per the filter), unions with the WAL batch, and streams back through DataFusion. Memory is bounded by an explicit `MemoryPool` cap of 256 MB (per [ADR-0011](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0011-memory-budget-200-430mb.md)) — pathological queries fail with a clear error rather than OOM-killing the box.
- **Process ceiling:** 1 GB hard `MemoryLimit` enforced by systemd. If the process ever exceeds 1 GB, the kernel kills it; `Restart=always` brings it back; WAL replay rebuilds the in-memory state from disk; no acknowledged data is lost.

Sustained load testing on a 4 vCPU / 8 GB VPS produced 350,000 metric points/sec over 10.5 million points with zero errors and ~7 ms average request latency. The 4 GB / 2 vCPU tier handles considerably less than that in absolute throughput — but the architectural ceiling sits well above small-team production traffic.

## What we give up

The design is honest about its limits:

- **No per-record delete.** Parquet is append-only. GDPR-style erasure runs at the partition level via retention plus targeted deletes, not row-level.
- **No incremental Parquet.** Flushed Parquet files are immutable; updates to old data require a rewrite of the affected file by the compaction job.
- **DataFusion has no sparse indexes.** Full-text log search via `LIKE` on a large logs table is a Parquet full scan. ADR-0005 documents the V1 threshold (~10 GB/day) above which Tantivy indexing is the roadmap scaling story.
- **MemoryPool ceiling is real.** Unbounded `GROUP BY` over a long time range can fail with a 256 MB MemoryPool error. The error message names the cap and recommends narrowing the time range or adding `LIMIT`. We chose this over silent OOM.

These trade-offs are listed in the ADRs. They are not surprises; they are the cost paid for the single-binary, embedded-execution architecture.

## Why this design over alternatives

As I said up top, this was the highest-risk decision we made — risky enough that we treated the proof-of-concept as a mandatory gate. The PoC ran the full path (WAL crash recovery, concurrent ingest + query, compaction, two-tenant isolation) before any production code was written. It passed. The fallback — embedded DuckDB behind the `QueryEngine` trait ([ADR-0014](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0014-query-engine-trait-abstraction.md)) — remains documented but unused.

The reason the design is preferred over a real database engine is alignment, not novelty. ClickHouse, embedded or otherwise, would deliver excellent compression and scan performance — and would also bring its own internal WAL, its own page cache, its own memory accounting, and 1-2 GB of resident memory in its own right. On a 4 GB VPS that is most of the budget. The DataFusion + Parquet path lives within Pharlux's memory budget (200-430 MB realistic, 1 GB hard ceiling) because there is no second engine to feed.

The reason it is preferred over an in-memory-only design is durability. Acknowledged data must survive a crash; the WAL is the contract.

The reason it is preferred over a flush-on-every-batch design is throughput and Parquet hygiene. Many small Parquet files are slow to scan and burn footer encoding overhead; the WAL absorbs the small writes and Parquet sees larger, well-organised files.

## Frequently asked questions

### Why an in-memory WAL snapshot if the WAL is on disk?

The on-disk WAL is the durable record. The `Vec<WalRecord>` in memory is a snapshot of the same records, kept as Arrow-shaped objects to avoid re-parsing protobuf on every query. The on-disk WAL is the source of truth on crash recovery; the in-memory copy is the source of truth on hot-path queries.

### What happens if a query is running when the WAL flushes?

The query took its snapshot under the read lock before the flush ran. The query sees those records as WAL entries. A query that starts after the flush completes sees them as Parquet entries. There is no race window where a record is missing or duplicated — that is the property the doc comment on `flush()` calls out explicitly.

### How is `tenant_id` enforced across the union?

`tenant_id` is a non-null `Utf8` column in every Parquet schema and a field on every `WalRecord`. Every query goes through `TenantScopedQueryBuilder` with a mandatory `WHERE tenant_id = ?` predicate before reaching the `TableProvider`. Community deployments use the constant `"default"` tenant — the code path is identical. Multi-tenant from day one (per Pharlux's hard invariants) is not a retrofit.

### Can DataFusion push my filter into the Parquet reader?

Yes for predicate pushdown on standard column types — DataFusion uses Parquet page indexes and row group statistics to skip pages that cannot match. Projection pushdown applies on every scan. The WAL side is in-memory Arrow, where filters are applied at scan time without an indexing pass — at typical WAL sizes (well under 64 MB) this is fast.

### What happens if the Parquet file is deleted by retention while my query is reading it?

The query holds an open `File` handle taken inside the read lock. On Linux, deleting an open file unlinks the directory entry but leaves the file content readable through any open handle until the last handle closes. The query completes against the original content; the disk space is reclaimed when the query finishes. This is documented in the `scan()` comment: *"opening handles inside the lock ensures compaction cannot delete files between path observation and handle acquisition."*

### Why not just use embedded DuckDB?

DuckDB was the documented Phase 0 fallback ([ADR-0013](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0013-phase-0-poc-gate.md)) and would also have worked — DuckDB has a battle-hardened Parquet reader and real production mileage in embedded mode. The reason DataFusion is the preferred choice is forward compatibility: Pharlux writes plain Apache Parquet files, readable directly by DuckDB, Trino, Ballista, Polars, Spark, and any other engine that speaks Parquet. Operators who outgrow Pharlux take their data with them in an open interchange format that every analytical tool understands. DataFusion's Arrow-native API also lets Pharlux compose query results as zero-copy Arrow streams from Parquet through the engine to the API response, where DuckDB's API exposes SQL strings — Arrow composition matters for the dashboard latency budget.

## Get Pharlux

- **Download v1.0.0** — [github.com/Veltara-Works/pharlux/releases/tag/v1.0.0](https://github.com/Veltara-Works/pharlux/releases/tag/v1.0.0)
- **Documentation** — [pharlux.com/docs/getting-started/](https://pharlux.com/docs/getting-started/)
- **Source** — [github.com/Veltara-Works/pharlux](https://github.com/Veltara-Works/pharlux)
- **The TableProvider source** — [pharlux-store/src/table_provider.rs](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/pharlux-store/src/table_provider.rs)

Pharlux is one of several developer tools built by [Veltara Works](https://veltaraworks.com/) — alongside email hosting, cloud infrastructure, and software license management. See [veltaraworks.com](https://veltaraworks.com/) for the full portfolio.
