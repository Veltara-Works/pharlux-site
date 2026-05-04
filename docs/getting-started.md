# Getting Started with Pharlux

Pharlux is a single-binary observability platform for metrics and logs, designed for small teams running 1–10 services on a single VPS.

## Prerequisites

- Ubuntu 24.04 LTS (or any modern Linux with glibc 2.31+)
- 4 GB RAM minimum (2 GB too tight for DataFusion query spikes; see sizing guidance below)
- 2 vCPU, 80 GB SSD recommended for production
- A reverse proxy (Caddy or nginx) for TLS termination
- `curl` for verification

## Installing Pharlux

```bash
# Download the statically-linked Linux binary (no dependencies)
curl -L https://github.com/Veltara-Works/pharlux/releases/latest/download/pharlux-linux-amd64 \
  -o /usr/local/bin/pharlux
chmod +x /usr/local/bin/pharlux

# Install systemd unit
sudo pharlux install
sudo systemctl daemon-reload
sudo systemctl enable --now pharlux
```

The `install` command creates `/etc/systemd/system/pharlux.service` with `Restart=always`, 1 GB memory limit, and 65536 file descriptors.

## First run

Pharlux reads `/etc/pharlux/pharlux.toml` by default. A zero-length config is valid — all settings have sensible defaults.

```bash
# Check the service is healthy
curl http://localhost:3100/api/v1/health
# {"status":"ok","version":"0.1.0"}
```

## Ports

| Port | Protocol | Purpose |
|------|----------|---------|
| 3100 | HTTP | REST API (query, health, auth, metrics, admin) |
| 4317 | gRPC | OTLP metrics + logs ingestion |
| 4318 | HTTP | OTLP HTTP/protobuf ingestion |

## Sending your first metrics

### Option A: OpenTelemetry Collector

Point your OTel Collector at Pharlux:

```yaml
# otel-collector-config.yaml
exporters:
  otlp/pharlux:
    endpoint: "http://your-vps:4317"
    tls:
      insecure: true  # use a reverse proxy for TLS

service:
  pipelines:
    metrics:
      exporters: [otlp/pharlux]
    logs:
      exporters: [otlp/pharlux]
```

### Option B: Direct OTLP from your app

Any OpenTelemetry SDK can send directly to Pharlux's OTLP endpoints. Set the exporter endpoint to `http://your-vps:4317` (gRPC) or `http://your-vps:4318` (HTTP).

## Running your first query

```bash
# Login to get a JWT token
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"your-password"}' | jq -r .token)

# Count metrics by name in the last hour
curl -s -X POST http://localhost:3100/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sql":"SELECT name, count(*) as cnt FROM metrics GROUP BY name ORDER BY cnt DESC LIMIT 10"}' | jq .

# Search logs for errors
curl -s -X POST http://localhost:3100/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sql":"SELECT timestamp, severity_text, body FROM logs WHERE body LIKE '\''%error%'\'' ORDER BY timestamp DESC LIMIT 20"}' | jq .
```

## Data directory

Default: `/var/lib/pharlux/`

```
/var/lib/pharlux/
├── wal/               # Write-ahead log
├── metrics/           # Parquet: metrics/{tenant_id}/YYYY/MM/DD/HH/
├── logs/              # Parquet: logs/{tenant_id}/YYYY/MM/DD/HH/
└── auth.db            # SQLite user/API key database
```

## CLI commands

```bash
pharlux                              # Start the server
pharlux compact                      # Manual Parquet compaction
pharlux backup --output backup.tar   # Backup data directory
pharlux migrate                      # Check schema compatibility
pharlux install                      # Install systemd unit
pharlux version                      # Print version
```

## Sizing guidance

| VPS size | Metric points/sec | Log volume/day | Retention |
|----------|-------------------|----------------|-----------|
| 2 vCPU / 4 GB | Up to 10k | Up to 2 GB | 7 days |
| 4 vCPU / 8 GB | Up to 50k | Up to 10 GB | 30 days |
| 8 vCPU / 16 GB | Up to 200k | Up to 50 GB | 30 days |

The DataFusion query engine is capped at 256 MB memory (ADR-0011). Queries that exceed this cap are rejected rather than causing OOM.

## Next steps

- [OTLP Configuration Reference](otlp-configuration.md) — full `pharlux.toml` reference
- [SQL Query Reference](sql-query-reference.md) — available tables, columns, and query patterns
- [Logs Query Performance](logs-query-performance.md) — LIKE search thresholds and optimization
