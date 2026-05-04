# Pharlux — Developer Architecture Overview

This page summarises the architecture for developers working on the codebase. For the authoritative design document, see [`DESIGN.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/DESIGN.md). Architecture decisions are in [`adr/`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/).

## Data flow

```
OTel Collector / SDK
        |
        v
  OTLP gRPC (:4317)  or  OTLP HTTP (:4318)
        |                        |
        v                        v
   OtlpGrpcMetrics          handle_metrics / handle_logs
   OtlpGrpcLogs                  |
        |                        |
        +----> TenantResolver ---+
                    |
                    v
            translate_metrics_request / translate_logs_request
                    |
                    v
              IngestSender (bounded mpsc, capacity 1000)
                    |
                    v
             WAL Writer Task
                    |
         +----------+----------+
         |                     |
    WalWriter.append()    metrics_table.ingest() / logs_table.ingest()
         |                     |
         v                     v
   WAL on disk          In-memory buffer (RwLock<TableState>)
                               |
                          flush (periodic)
                               |
                               v
                    Parquet files on disk
                    data/{signal}/{tenant_id}/YYYY/MM/DD/HH/
```

## Query path

```
REST API  POST /api/v1/query
        |
        v
  extract_claims() → JWT verification → tenant_id
        |
        v
  QueryEngine::query(sql, QueryContext { tenant_id })
        |
        v
  Per-request SessionContext (fresh each query, shared RuntimeEnv)
        |
        v
  tenant_filter::tenant_scoped_query()
    → parse SQL to LogicalPlan
    → transform_up: inject Filter(tenant_id = <literal>) on every TableScan
        |
        v
  DataFusion execute → scan PharluxMetricsTable / PharluxLogsTable
    → read-lock: snapshot WAL records + open Parquet file handles
    → materialize into MemTable
    → DataFusion handles projection, filtering, aggregation, limits
        |
        v
  RecordBatch → JSON → HTTP response
```

## Tokio runtime layout (ADR-0004)

All async work runs on a single `tokio::runtime::Builder::new_multi_thread()` runtime:

- **HTTP API server** (Axum, port 3100) — query, health, auth, metrics, admin, UI fallback
- **OTLP HTTP server** (Axum, port 4318) — metrics + logs ingestion
- **OTLP gRPC server** (Tonic, port 4317) — MetricsService + LogsService
- **WAL writer task** — consumes from ingest channel, writes to WAL + table providers, periodic flush
- **Alert evaluator task** — configurable interval (default 60s), circuit breaker

No second runtime is ever spawned.

## Key invariants

- **WAL format frozen** (ADR-0018): prost + length prefix + CRC32 trailer
- **Parquet schemas frozen** (ADR-0003): per-signal, never unified
- **DataFusion MemoryPool cap** (ADR-0011): 256 MB in V1
- **Multi-tenant from day one**: every record carries `tenant_id`, every query is filtered
- **Single binary**: no external databases, Parquet on local disk, SQLite embedded

## SQLite databases

| Database | Purpose | Location |
|----------|---------|----------|
| `auth.db` | Users, API keys | `{data_dir}/auth.db` |
| `alerts.db` | Alert rules and state | `{data_dir}/alerts.db` |

## Self-observability

`GET /metrics` returns Prometheus exposition text with atomic counters:
- `pharlux_ingestion_points_total` — total metric points ingested
- `pharlux_ingestion_logs_total` — total log records ingested
- `pharlux_query_duration_seconds_sum/count` — query duration
- `pharlux_active_queries` — current concurrent queries
- `pharlux_wal_bytes` — WAL size

## Frontend

React 18 + TypeScript + Vite, built to `pharlux-ui/dist/` and embedded in the binary via `rust-embed`. The Axum API router has a fallback handler that serves static files, with SPA routing (non-file paths serve `index.html`).

---

*Last updated: 2026-04-13.*
