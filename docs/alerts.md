# Alerts

Pharlux V1 ships a built-in alert evaluator: SQL-backed rules, a four-state machine (`OK` → `PENDING` → `FIRING` → `RESOLVED` → `OK`), and notification dispatch to generic webhooks and Slack incoming-webhooks. Alert state survives restarts; failures of a notification target never stall the evaluator.

This guide covers the rule lifecycle, the state machine semantics, the notification payloads, and the operator surface for managing rules. The architectural rationale for the circuit-breaker design is in [ADR-0016](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0016-background-task-circuit-breaker.md).

## Quick start

```bash
# Create a rule that fires when CPU usage stays above 90% for two
# consecutive evaluation cycles.
curl -s -X POST http://localhost:3100/api/v1/admin/alerts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "cpu-high",
    "query": "SELECT 1 FROM metrics WHERE name = '\''cpu.usage'\'' AND value > 0.9 AND timestamp > now() - INTERVAL '\''2 minutes'\''",
    "for_cycles": 2,
    "webhook_url": "https://your-receiver.example.com/pharlux-alerts",
    "slack_webhook_url": "https://hooks.slack.com/services/T0XXX/B0XXX/yyyy"
  }'
```

That's the entire setup. Pharlux evaluates the rule every `evaluation_interval_seconds` (default 60s); when the query returns one or more rows for two consecutive cycles, the rule transitions `OK` → `PENDING` → `FIRING` and notifications go out.

## How rules work

A rule is a SQL query plus a few operational knobs. Every evaluation cycle, Pharlux runs the query (tenant-scoped to the rule's `tenant_id`, with `LIMIT 1` so it returns fast) and treats **any returned rows** as "condition true." Zero rows = condition false.

This row-presence model is intentionally simple: you write the SQL that returns rows when the alert should fire, and Pharlux handles the rest. Common patterns:

```sql
-- Threshold alert
SELECT 1 FROM metrics
WHERE name = 'http.5xx_rate' AND value > 0.05
  AND timestamp > now() - INTERVAL '5 minutes'

-- Anomaly via aggregate
SELECT count(*) FROM logs
WHERE severity_text = 'ERROR'
  AND timestamp > now() - INTERVAL '5 minutes'
HAVING count(*) > 100

-- Missing-signal alert (no recent heartbeats)
SELECT 1
WHERE NOT EXISTS (
  SELECT 1 FROM metrics
  WHERE name = 'app.heartbeat'
    AND timestamp > now() - INTERVAL '5 minutes'
)
```

> **Always include a tight time range** in the rule SQL. Without one, every evaluation cycle scans every Parquet partition since the dawn of retention. Pharlux's partition pruning makes time-bounded queries cheap; unbounded ones expensive.

## The state machine

```
       condition true  +1               firing for ≥ for_cycles
    OK ────────────────► PENDING ─────────────────────────────► FIRING
    ▲                       │                                     │
    │                       │ condition false                     │
    │                       ▼                                     │ condition false
    │                       OK                                    ▼
    └──────────────── condition false ──────────────────────── RESOLVED
                                                                  │
                                                                  │ condition false
                                                                  ▼
                                                                  OK
```

| State | Entered when | Notification on entry |
| --- | --- | --- |
| **`OK`** | Initial state; or a `RESOLVED` rule sees another false cycle. | No |
| **`PENDING`** | A rule in `OK` sees a true cycle and `consecutive_true < for_cycles`. | No (debouncing) |
| **`FIRING`** | A rule in `PENDING` reaches `consecutive_true >= for_cycles`. | **Yes** — webhook + Slack dispatch |
| **`RESOLVED`** | A rule in `FIRING` sees a false cycle. | **Yes** — webhook + Slack dispatch |

Transitions also fire when state changes back to `OK` after `RESOLVED`, but no notification is sent for `RESOLVED → OK` — the resolution notification is the user-visible signal.

The four-state design lets operators distinguish "transient blip caught by `for_cycles`" (PENDING, no noise) from "real ongoing problem" (FIRING, notified) and "problem ended" (RESOLVED, notified once).

### `for_cycles` and de-bouncing

`for_cycles` is the number of consecutive true cycles required before transitioning `PENDING → FIRING`. Default: `1` (fire on the first matching cycle). Common settings:

| `for_cycles` | Effective de-bounce window (default 60s interval) |
| --- | --- |
| 1 | None — fires on first match |
| 2 | ~1 minute |
| 3 | ~2 minutes |
| 5 | ~4 minutes |

Raise `for_cycles` for noisy signals where transient spikes are normal; keep it at 1 for hard-error signals where you want the alert to fire immediately.

State and counters are persisted to `alerts.db` after every cycle, so a restart in the middle of a `PENDING` window does not reset the counter — the next evaluation continues where the last one left off.

## Notifications

Pharlux V1 supports two notification channels. Configure either, both, or neither per rule. Notification dispatch is **fire-and-forget** — a slow or failing target never stalls the evaluator or blocks subsequent rules in the same cycle. Failures are logged via `tracing`.

### Generic webhook

Set `webhook_url` to receive a JSON POST on every state transition:

```json
{
  "rule_id": "01938a6c-...",
  "rule_name": "cpu-high",
  "tenant_id": "default",
  "from_state": "pending",
  "to_state": "firing",
  "fired_at": 1700000000,
  "query": "SELECT 1 FROM metrics WHERE ..."
}
```

`fired_at` is Unix epoch seconds. `from_state` and `to_state` are one of `ok`, `pending`, `firing`, `resolved`. Your receiver should be idempotent — if Pharlux retries on transport error in a future version, you'll see the same body twice.

### Slack incoming-webhook

Set `slack_webhook_url` to a Slack incoming-webhook URL (`https://hooks.slack.com/services/...`). Pharlux posts a `{"text": "..."}` body using Slack's mrkdwn format with a state-appropriate emoji:

- `:rotating_light:` — transitioning to FIRING
- `:white_check_mark:` — transitioning to RESOLVED or OK
- `:hourglass_flowing_sand:` — transitioning to PENDING (Pharlux does not actually post on PENDING, but the emoji is reserved for future use)

Example Slack-rendered text:

> 🚨 **Pharlux alert** — `cpu-high` (tenant `default`) transitioned `pending` → `firing` at *Apr 28, 2026 3:47:21 AM* `SELECT 1 FROM metrics WHERE name = 'cpu.usage' AND value > 0.9...`

The timestamp uses Slack's `<!date^...|...>` syntax so it renders in each recipient's local timezone.

### Both at once

Setting both URLs sends two independent dispatches per transition. If one fails (5xx, timeout, unreachable), the other still runs.

## Managing rules

The full CRUD surface lives at `/api/v1/admin/alerts` and is admin-only, tenant-scoped (admins can only see and modify rules in their own tenant).

### Create

```bash
curl -s -X POST http://localhost:3100/api/v1/admin/alerts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "...",
    "query": "...",
    "for_cycles": 1,
    "webhook_url": "",
    "slack_webhook_url": ""
  }'
# 201 Created
```

The rule's SQL is validated with the same default-deny whitelist that protects `/api/v1/query` from non-admin write statements: only `SELECT`, `EXPLAIN`, `SHOW`, `DESCRIBE`, and `WITH...SELECT` are accepted (with comment + literal stripping; `WITH` clauses are scanned for embedded write keywords). Attempts to register `DELETE FROM users` as an alert rule return 400. This is intentional — even an admin-authored rule should not have side effects.

The `tenant_id` is taken from the calling admin's JWT; you cannot create a rule in a different tenant. Server-assigned fields are `id` (UUIDv7), `state` (initialised to `ok`), `consecutive_true` (initialised to 0), `created_at`, and `updated_at`.

### List

```bash
curl -s http://localhost:3100/api/v1/admin/alerts \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# {"rules": [{...}, {...}]}
```

Returns rules in the calling admin's tenant only. Each entry includes the live `state` field, so this is also the operator's view of which rules are currently `firing` versus `ok`.

### Delete

```bash
curl -s -X DELETE http://localhost:3100/api/v1/admin/alerts/01938a6c-... \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# 204 No Content
```

Cross-tenant attempts and nonexistent IDs both return 404 (deliberate — same as the `/admin/users` deletion behaviour, to avoid leaking cross-tenant existence). Deleting a rule in `FIRING` state stops further notifications immediately; no `RESOLVED` notification is sent for the deleted rule.

### Update

V1 has no in-place update endpoint. To change a rule's webhook URL, query, or `for_cycles`, delete and recreate. State is reset on recreate (the new rule is born `OK`). In-place update lands in V1.1.

## Configuration

The `[alerts]` section of `pharlux.toml` controls the evaluator-wide behaviour:

| Key | Default | Meaning |
| --- | --- | --- |
| `evaluation_interval_seconds` | `60` | How often the evaluator runs through every rule. Lowering this trades alert latency for evaluator CPU. |
| `max_consecutive_panics` | `3` | Circuit-breaker threshold. After this many consecutive panicking evaluation cycles, the evaluator self-disables — the loop keeps running but stops evaluating, and a manual restart is required to re-enable. See [ADR-0016](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0016-background-task-circuit-breaker.md). |

The notification HTTP client uses a 10-second per-request timeout. This is a hard-coded constant in V1 (not configurable) — if your webhook receiver is consistently slow, the right fix is to make the receiver fast, not to extend the timeout.

## Storage

Alert rules and live state are persisted to `alerts.db` (SQLite, in the data directory — default `/var/lib/pharlux/alerts.db`). The schema:

```sql
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,                 -- UUIDv7 server-assigned
  name TEXT NOT NULL,
  tenant_id TEXT NOT NULL,
  query TEXT NOT NULL,                 -- SELECT-class only
  for_cycles INTEGER NOT NULL DEFAULT 1,
  state TEXT NOT NULL DEFAULT 'ok',    -- ok / pending / firing / resolved
  consecutive_true INTEGER NOT NULL DEFAULT 0,
  webhook_url TEXT NOT NULL DEFAULT '',
  slack_webhook_url TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

`pharlux backup` includes `alerts.db`. After a restore, all rules and their persisted state are recovered; the evaluator resumes from where it stopped.

## Known V1 limitations

- **No in-place update.** Delete + recreate is the V1 update path. V1.1 adds `PATCH /api/v1/admin/alerts/{id}`.
- **No notification retries.** Dispatch is fire-and-forget — a failed POST is logged but not retried. Operators wanting at-least-once delivery should run a queue (e.g. a small webhook receiver that posts to their final destination with retries).
- **No notification batching.** Two rules transitioning to `FIRING` in the same cycle produce two independent notifications, even if they share a `slack_webhook_url`.
- **No email channel in V1.** Email via `lettre` is V1.1; the dependency is already pinned in [`VERSIONS.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/VERSIONS.md).
- **No multi-channel routing per state.** A rule's webhook and Slack URLs apply to every transition; you cannot send `FIRING` to PagerDuty and `RESOLVED` to Slack only.
- **No alert silencing / muting.** Operators can delete a noisy rule; there is no time-bounded "snooze." V1.2 work.
- **No alert grouping / deduplication.** Each rule is independent.
- **No PromQL.** Pharlux's query language is SQL — there is no PromQL surface in V1 or planned.

## See also

- [`auth.md`](auth.md) — how to obtain the admin token used by the `/api/v1/admin/alerts` endpoints.
- [`sql-query-reference.md`](sql-query-reference.md) — the SQL surface available to alert rules (same surface as `/api/v1/query` for admins).
- [`logs-query-performance.md`](logs-query-performance.md) — guidance on writing efficient log-based alert rules (the `body LIKE` performance characteristics apply).
- [`backup-restore.md`](backup-restore.md) — what `pharlux backup` includes (alerts.db is included; webhook URLs travel with the backup).
- [`../../adr/0016-background-task-circuit-breaker.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0016-background-task-circuit-breaker.md) — the original decision record for the circuit-breaker design.
