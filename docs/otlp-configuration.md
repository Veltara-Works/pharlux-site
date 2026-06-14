# OTLP Configuration Reference

Full reference for `pharlux.toml`. All fields have sensible defaults — a zero-length config file is valid.

## `[server]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `bind_address` | string | `"0.0.0.0"` | Address to bind all listeners |
| `http_port` | u16 | `3100` | REST API port |
| `otlp_grpc_port` | u16 | `4317` | OTLP gRPC ingestion port |
| `otlp_http_port` | u16 | `4318` | OTLP HTTP/protobuf ingestion port |
| `tls_cert_file` | path | (none) | TLS certificate (use reverse proxy instead) |
| `tls_key_file` | path | (none) | TLS private key |
| `cors_allowed_origins` | list | `[]` | CORS allowed origins for the REST API |

## `[storage]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `data_dir` | path | `/var/lib/pharlux` | Root data directory |
| `retention_days` | u32 | `30` | Automatic data retention (days). On a commercial licence, clamped down to the licensed maximum. See [sizing-guide.md](sizing-guide.md#storageretention_days) |
| `retention_sweep_interval_hours` | u32 | `24` | How often the retention sweep runs (also once at startup) |
| `host_inactivity_days` | u32 | `14` | Days of inactivity before a host is evicted from the licensed-host count. See [host-limits.md](host-limits.md) |
| `wal_max_segment_bytes` | u64 | `67108864` (64 MB) | Max WAL segment size before rotation |
| `wal_max_total_bytes` | u64 | `536870912` (512 MB) | Max total WAL size |
| `parquet_row_group_bytes` | u64 | `134217728` (128 MB) | Target Parquet row group size |
| `parquet_compression` | string | `"zstd"` | Compression algorithm |
| `parquet_zstd_level` | u8 | `3` | Zstd compression level (1-22) |

## `[ingest]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `channel_capacity` | u32 | `1000` | Bounded mpsc channel size (batches) |
| `send_timeout_ms` | u32 | `100` | Timeout before returning 429/RESOURCE_EXHAUSTED |
| `late_arrival_window_seconds` | u32 | `3600` | Reject points older than this |
| `reject_future_seconds` | u32 | `3600` | Reject points further in the future than this |

## `[query]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `memory_pool_mb` | u32 | `256` | DataFusion MemoryPool cap (ADR-0011) |
| `query_timeout_seconds` | u32 | `30` | Query execution timeout |
| `max_result_rows` | u32 | `100000` | Default max rows per query |
| `max_concurrent_queries` | u32 | `16` | Max concurrent query executions |

## `[auth]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `jwt_secret_file` | path | `/etc/pharlux/jwt.secret` | Path to JWT signing secret (>= 32 bytes) |
| `token_ttl_seconds` | u32 | `3600` | JWT token lifetime |
| `argon2_memory_kb` | u32 | `19456` | Argon2id memory cost (OWASP 2023: 19 MiB) |
| `argon2_time_cost` | u32 | `2` | Argon2id iterations |
| `argon2_parallelism` | u32 | `1` | Argon2id parallelism |

## `[alerts]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `evaluation_interval_seconds` | u32 | `60` | Alert rule evaluation interval |
| `max_consecutive_panics` | u32 | `3` | Circuit breaker: self-disable after N panics |
| `notification_timeout_seconds` | u32 | `10` | Webhook notification timeout |

## `[telemetry]`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `self_scrape_enabled` | bool | `true` | Enable self-observability metrics |
| `self_scrape_interval_seconds` | u32 | `15` | Self-scrape interval |
| `log_level` | string | `"info"` | Log level (trace, debug, info, warn, error) |

## Example configuration

```toml
[server]
bind_address = "0.0.0.0"
http_port = 3100

[storage]
data_dir = "/var/lib/pharlux"
retention_days = 14

[query]
memory_pool_mb = 256

[auth]
jwt_secret_file = "/etc/pharlux/jwt.secret"

[telemetry]
log_level = "info"
```

## OTLP endpoints

| Endpoint | Method | Content-Type | Description |
|----------|--------|-------------|-------------|
| `/v1/metrics` (port 4318) | POST | `application/x-protobuf` | OTLP HTTP metrics |
| `/v1/logs` (port 4318) | POST | `application/x-protobuf` | OTLP HTTP logs |
| gRPC MetricsService/Export (port 4317) | gRPC | protobuf | OTLP gRPC metrics |
| gRPC LogsService/Export (port 4317) | gRPC | protobuf | OTLP gRPC logs |

## Backpressure

When the ingest channel is full, Pharlux returns:
- HTTP: `429 Too Many Requests`
- gRPC: `RESOURCE_EXHAUSTED`

The OTel Collector's built-in retry mechanism handles this automatically.

## Timestamp validation

- Points with timestamps older than `late_arrival_window_seconds` (default 1 hour) are rejected
- Points with timestamps more than `reject_future_seconds` (default 1 hour) in the future are rejected
- Points with zero timestamps are rejected
