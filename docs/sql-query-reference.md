# SQL Query Reference

Pharlux uses Apache DataFusion as its query engine. Queries are standard SQL with full support for aggregations, joins, subqueries, and window functions.

## Tables

### `metrics`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `tenant_id` | Utf8 | No | Tenant identifier |
| `timestamp` | Timestamp(ns, UTC) | No | When the metric was recorded |
| `name` | Dictionary(Int32, Utf8) | No | Metric name (e.g. `http.request.duration`) |
| `value` | Float64 | No | Metric value |
| `attributes` | Utf8 (JSON) | Yes | Key-value attributes as JSON |
| `resource` | Utf8 (JSON) | Yes | Resource attributes as JSON |
| `scope_name` | Dictionary(Int32, Utf8) | Yes | Instrumentation scope name |
| `scope_version` | Dictionary(Int32, Utf8) | Yes | Instrumentation scope version |

### `logs`

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `tenant_id` | Utf8 | No | Tenant identifier |
| `timestamp` | Timestamp(ns, UTC) | No | When the event occurred |
| `observed_timestamp` | Timestamp(ns, UTC) | Yes | When the event was collected |
| `severity_number` | Int32 | Yes | OTel severity (1-24) |
| `severity_text` | Dictionary(Int32, Utf8) | Yes | Severity label (TRACE, DEBUG, INFO, WARN, ERROR, FATAL) |
| `body` | Utf8 | Yes | Log message body |
| `name` | Dictionary(Int32, Utf8) | Yes | Log name |
| `attributes` | Utf8 (JSON) | Yes | Key-value attributes as JSON |
| `resource` | Utf8 (JSON) | Yes | Resource attributes as JSON |
| `scope_name` | Dictionary(Int32, Utf8) | Yes | Instrumentation scope name |
| `scope_version` | Dictionary(Int32, Utf8) | Yes | Instrumentation scope version |
| `trace_id` | FixedSizeBinary(16) | Yes | W3C trace ID (for log-trace correlation) |
| `span_id` | FixedSizeBinary(8) | Yes | W3C span ID |
| `flags` | UInt32 | Yes | OTel log record flags |

## Query patterns

### Metrics

```sql
-- Top 10 metric names by count
SELECT name, count(*) as cnt
FROM metrics
GROUP BY name
ORDER BY cnt DESC
LIMIT 10;

-- Average value over time (5-minute buckets)
SELECT
  date_trunc('minute', timestamp) as bucket,
  avg(value) as avg_value
FROM metrics
WHERE name = 'http.request.duration'
  AND timestamp > now() - INTERVAL '1 hour'
GROUP BY bucket
ORDER BY bucket;

-- Latest value per metric
SELECT DISTINCT ON (name) name, value, timestamp
FROM metrics
ORDER BY name, timestamp DESC;
```

### Logs

```sql
-- Recent errors
SELECT timestamp, severity_text, body
FROM logs
WHERE severity_number >= 17  -- ERROR and above
  AND timestamp > now() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 100;

-- Full-text search (LIKE)
SELECT timestamp, body
FROM logs
WHERE body LIKE '%connection refused%'
  AND timestamp > now() - INTERVAL '24 hours'
ORDER BY timestamp DESC;

-- Case-insensitive search (ILIKE)
SELECT timestamp, body
FROM logs
WHERE body ILIKE '%timeout%'
ORDER BY timestamp DESC
LIMIT 50;

-- Log count by severity
SELECT severity_text, count(*) as cnt
FROM logs
WHERE timestamp > now() - INTERVAL '1 hour'
GROUP BY severity_text
ORDER BY cnt DESC;
```

### Cross-signal correlation

```sql
-- Find logs associated with a specific trace
SELECT timestamp, severity_text, body
FROM logs
WHERE trace_id = X'0102030405060708090a0b0c0d0e0f10'
ORDER BY timestamp;
```

## Tenant isolation

All queries are automatically scoped to the authenticated tenant. The `WHERE tenant_id = ?` filter is injected at the logical plan level — it cannot be bypassed via SQL.

Community (single-tenant) deployments use the constant tenant `"default"`.

## Limits

- **Memory pool**: 256 MB per query (ADR-0011). Queries exceeding this are rejected.
- **Default row limit**: 100,000 rows per query (configurable via `[query].max_result_rows`).
- **Query timeout**: 30 seconds (configurable via `[query].query_timeout_seconds`).

## REST API

```
POST /api/v1/query
Authorization: Bearer <JWT>
Content-Type: application/json

{
  "sql": "SELECT ...",
  "limit": 1000  // optional, overrides default max_result_rows
}
```

Response:

```json
{
  "rows": [ {"name": "cpu.usage", "value": 0.75}, ... ],
  "row_count": 1
}
```

## Supported SQL features

Pharlux uses DataFusion 53.0.0 which supports:
- `SELECT`, `WHERE`, `GROUP BY`, `ORDER BY`, `LIMIT`, `OFFSET`
- Aggregate functions: `count`, `sum`, `avg`, `min`, `max`, `stddev`, `variance`
- Window functions: `row_number`, `rank`, `lead`, `lag`, `first_value`, `last_value`
- Date/time: `now()`, `date_trunc`, `date_part`, `INTERVAL`
- String: `LIKE`, `ILIKE`, `length`, `upper`, `lower`, `trim`, `substring`
- Math: `abs`, `ceil`, `floor`, `round`, `power`, `sqrt`
- Subqueries, CTEs (`WITH`), `UNION ALL`, `JOIN`
- `EXPLAIN` and `EXPLAIN ANALYZE` for query planning
