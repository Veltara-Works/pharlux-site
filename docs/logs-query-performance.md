# Logs Query Performance

## Full-text search approach (V1)

Pharlux V1 uses DataFusion SQL `LIKE` / `ILIKE` operators for log body search, scanning over Parquet files directly. This avoids the complexity of maintaining a separate full-text index while covering the majority of small-team use cases.

### Performance characteristics

| Daily log volume | 7-day LIKE scan time (2 vCPU) | 7-day LIKE scan time (4 vCPU) | Assessment |
|---|---|---|---|
| < 1 GB/day | < 2 seconds | < 1 second | Excellent |
| 1–5 GB/day | 2–15 seconds | 1–8 seconds | Good |
| 5–10 GB/day | 15–30 seconds | 8–15 seconds | Acceptable |
| 10–20 GB/day | 30–60 seconds | 15–30 seconds | Degraded — consider tantivy index (V1.1) |
| > 20 GB/day | > 60 seconds | > 30 seconds | Not recommended without full-text index |

**The recommended threshold for LIKE-based search is 10 GB/day sustained log volume.** Above this, 7-day `LIKE` scans will exceed the 30-second response time target on a typical 2-vCPU VPS.

### Why LIKE is sufficient for small teams

- Parquet's columnar layout means `LIKE '%pattern%'` only reads the `body` column, not the entire row
- Zstd compression reduces I/O; dictionary encoding on repeated fields (severity_text, scope_name) further reduces scan volume
- DataFusion's predicate pushdown and partition pruning (by time range) reduce the data scanned
- For the target audience (1–10 services on a single VPS), log volume is typically 0.5–5 GB/day

### Query patterns

```sql
-- Search log bodies
SELECT timestamp, severity_text, body
FROM logs
WHERE tenant_id = 'default'
  AND timestamp > now() - INTERVAL '1 hour'
  AND body LIKE '%connection refused%'
ORDER BY timestamp DESC
LIMIT 100;

-- Case-insensitive search
SELECT timestamp, body
FROM logs
WHERE body ILIKE '%error%'
  AND timestamp > now() - INTERVAL '24 hours';

-- Cross-signal correlation via trace_id
SELECT l.timestamp, l.body, l.severity_text
FROM logs l
WHERE l.trace_id = X'0102030405060708090a0b0c0d0e0f10'
ORDER BY l.timestamp;
```

### Partition pruning

Pharlux stores logs in hourly partitions (`data/logs/{tenant_id}/YYYY/MM/DD/HH/`). Queries that include a time range filter (`WHERE timestamp > ...`) automatically benefit from partition pruning — only relevant hour partitions are scanned.

**Always include a time range in log queries** to minimize scan volume.

### Future: tantivy full-text index (V1.1)

V1.1 will add an optional tantivy inverted index per log partition, enabling sub-second full-text search at any volume. The storage layer is designed so this can be added without schema changes — the index is a sidecar file alongside each Parquet partition.

tantivy is not yet a Pharlux dependency; the V1.1 work will add it through the standard `VERSIONS.md` review process. See [DESIGN.md](https://github.com/Veltara-Works/pharlux/blob/v1.1.3/DESIGN.md) §"Full-text log search" for the design-in note.
