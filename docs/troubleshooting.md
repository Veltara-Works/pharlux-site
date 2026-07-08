# Troubleshooting Pharlux

This page is a triage guide. Each problem describes the symptom, the diagnosis, and the fix — and points at the deeper procedure in [`RUNBOOK.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md) when one applies.

If you are not sure where to start, check the service first:

```bash
sudo systemctl status pharlux
curl -fsS http://localhost:3100/api/v1/health
```

A non-200 health response or a refused connection means Pharlux is not serving — go to [Service won't start](#service-wont-start). Otherwise, find the symptom that matches yours below.

## Contents

1. [Service won't start](#service-wont-start)
2. [Authentication and user management](#authentication-and-user-management)
3. [Ingestion problems](#ingestion-problems)
4. [Query problems](#query-problems)
5. [Alerts](#alerts)
6. [Dashboards](#dashboards)
7. [Storage and resource usage](#storage-and-resource-usage)
8. [systemd hardening pitfalls](#systemd-hardening-pitfalls)
9. [Collecting diagnostic info](#collecting-diagnostic-info)
10. [Filing bug reports](#filing-bug-reports)

---

## Service won't start

Start with the journal and the listener state, then map the error to the row in the table below.

```bash
sudo journalctl -u pharlux --since "15 minutes ago" -n 100 --no-pager
sudo ss -tlnp | grep -E ":3100|:4317|:4318"
```

| Journal message contains | Cause | Fix |
| --- | --- | --- |
| `JWT secret at .../jwt.secret is world-readable` | The secret file has any `o+r` bit set. Pharlux refuses to start (ADR-0010). | `sudo chmod 0640 /etc/pharlux/jwt.secret` (DynamicUser layout) **or** `sudo chmod 0600 /etc/pharlux/jwt.secret` (owner-only). See [`auth.md`](auth.md). |
| `No such file` on `/etc/pharlux/pharlux.toml` | Config file missing or path wrong in the unit. | Restore the config or fix `ExecStart=` in the unit. |
| `toml parse error` | Malformed config. The error names the line. | Fix `pharlux.toml` and restart. |
| `Address already in use` on `:3100`, `:4317`, or `:4318` | A previous Pharlux process did not exit, or another service is bound. | `sudo pkill -f /usr/local/bin/pharlux` then `sudo systemctl start pharlux`. If a different process owns the port, change the port in `pharlux.toml`. |
| `Permission denied` on `/var/lib/pharlux` | DynamicUID can no longer write the data directory (often after a manual restore). | See [systemd hardening pitfalls](#systemd-hardening-pitfalls). The fix is `chown` to the dynamic UID, or remove a stale `:pharlux` group reference. |
| `Disk quota exceeded` / `No space left on device` | Disk full. | `df -h /var/lib/pharlux`, then [RUNBOOK.md §12](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#12-diagnosing-disk-usage-growth). |
| `schema version mismatch` | Upgrade ran but the new binary cannot read the existing data. | Do not force-start. Run `pharlux migrate` and consult [RUNBOOK.md §6](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#6-rollback-procedure) for rollback. |
| `WAL` / `CRC` / `RecordTooLarge` / `ChecksumMismatch` | WAL replay hit a corrupt record. Tail-corruption is handled automatically — anything else is rare. | [RUNBOOK.md §13](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#13-recovering-from-a-corrupted-wal). |
| Repeated restarts every ~5 seconds | `Restart=always` is looping on a startup error. | Stop the unit (`systemctl stop pharlux`) before investigating, otherwise the journal will be drowned. |

The full procedure for an unrecoverable start is [RUNBOOK.md §14](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#14-recovering-from-a-crashed-process-that-wont-restart).

---

## Authentication and user management

Setup, role semantics, JWT details, and the rotation procedure live in [`auth.md`](auth.md). This section covers the symptoms operators most often see in production.

### Cannot log in (HTTP 401)

Possible causes, in rough order of frequency:

- **Wrong password.** `POST /api/v1/auth/login` returns 401 for both unknown user and bad password — by design, to avoid leaking which usernames exist.
- **Expired JWT.** Tokens have a TTL of `[auth].token_ttl_seconds` (default 3600). Verification uses zero leeway: a token whose `exp` has passed by even one second is rejected. Log in again.
- **JWT secret rotated.** If `/etc/pharlux/jwt.secret` was rewritten (deliberately or otherwise) every previously-issued token is invalid. Everyone has to log in again.
- **Clock skew.** The server validates `exp` against system time. If the host clock has drifted significantly, valid-looking tokens may be rejected. Run `timedatectl status` and reconcile NTP.
- **Missing or malformed `Authorization` header.** Pharlux requires the `Bearer ` prefix exactly. `Authorization: $TOKEN` (without `Bearer`) is rejected as 401.

```bash
# Verify the token's exp claim without trusting the JWT lib
echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq .exp
# Compare against:
date +%s
```

If the token is fine but login still 401s, the database may have been corrupted or restored partially. Check for the user with `sudo pharlux user list` (stop the service first) and recreate or reset the password if needed (see [`auth.md` § Forgot-the-admin-password rescue](auth.md#forgot-the-admin-password-rescue)).

### Locked out — no working admin password

Use the host-side rescue path in [`auth.md`](auth.md#forgot-the-admin-password-rescue):

```bash
sudo systemctl stop pharlux
sudo pharlux user list                       # find the admin's username
sudo pharlux user reset-password --username alice --password 'new-strong-password'
sudo systemctl start pharlux
```

This rewrites the password hash in `auth.db` directly using the configured Argon2id parameters from `[auth].argon2_*`. The full procedure with parameter notes is [RUNBOOK.md §8](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#8-resetting-an-admin-password).

### Read-only user gets 403 on a query

`POST /api/v1/query` enforces a default-deny whitelist for non-admin tokens (ADR-0010). Allowed: `SELECT`, `EXPLAIN`, `SHOW`, `DESCRIBE`, `DESC`, and `WITH ... SELECT`. Everything else returns:

```
HTTP/1.1 403 Forbidden
read-only users may only execute SELECT, EXPLAIN, SHOW, DESCRIBE, or WITH...SELECT statements
```

Comments and string-literal contents are stripped before tokenisation, so `SELECT 1; -- DELETE` and `SELECT '/* DELETE */ FROM x'` are not bypasses. If the user really needs write access, they need an admin token. Full surface in [`auth.md` § Read-only enforcement](auth.md#read-only-enforcement).

### Cannot create a user (`400 Bad Request`)

The `users.username` column is globally unique. Creating a user with a name that already exists anywhere in the database returns 400 — regardless of tenant. Pick a different username or delete the existing one first.

### Cannot delete a user (`404 Not Found` or `400 Bad Request`)

- **404** — the user id doesn't exist **or** belongs to a different tenant. The API does not distinguish, deliberately, to avoid leaking cross-tenant existence.
- **400** — an admin tried to delete their own account. Self-delete is blocked to prevent locking the tenant out. Have a different admin delete them.

### Cannot create a tenant — wrong endpoint for first install

`POST /api/v1/admin/tenants` is **not** the bootstrap path. It requires an existing admin token. For a fresh install with zero users, use `pharlux user add --admin` on the host. Once you have an admin, the API path works for adding more.

---

## Ingestion problems

### HTTP 429 / gRPC `RESOURCE_EXHAUSTED`

The bounded mpsc channel between the OTLP handlers and the WAL writer is full — ingest is bursting faster than the WAL can persist, or the WAL writer is stalled.

Quick diagnosis:

```bash
curl -s http://localhost:3100/metrics | grep pharlux_ingestion
journalctl -u pharlux --since "10 minutes ago" | grep -E "backpressure|channel full|send_timeout"
iostat -x 5 3   # check %util on the data-dir device
```

Quick fixes, ordered by what to try first:

1. Add a `batch` processor on the upstream OTel Collector to smooth bursty arrivals.
2. Raise `[ingest].channel_capacity` (default 1000) in `pharlux.toml` and restart.
3. Raise `[ingest].send_timeout_ms` (default 100ms).
4. If `iostat` shows `%util` near 100%, the disk is the bottleneck — move the data dir to faster storage or upgrade the VPS.

The full procedure with VPS-sizing crossover is [RUNBOOK.md §9](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#9-diagnosing-ingest-backpressure-http-429s).

### OTLP points being silently dropped

Pharlux validates every OTLP payload before it hits the WAL. Rejected points are logged at `INFO` level and counted in metrics, but the request still returns 200 — partial-batch rejection is per-point, not per-request. Look for these in `journalctl -u pharlux | grep otlp` (or set `RUST_LOG=pharlux_otlp=debug` for more detail):

| Reason | Default threshold | Config key |
| --- | --- | --- |
| Timestamp older than the late-arrival window | 1 hour | `[ingest].late_arrival_window_seconds` |
| Timestamp further in the future than allowed (ADR-0017) | 1 hour | `[ingest].reject_future_seconds` |
| Zero / missing timestamp | always rejected | — |
| Body exceeds the per-request size limit | 2 MB | hardcoded — not configurable in V1 |
| Tenant resolution failed (API key missing / unknown) | — | hardcoded — not configurable in V1 |

Tenant identity in V1 is resolved from the request's API key (header `x-api-key` or `Authorization: Bearer <key>`), not from a tenant header. A missing or unknown API key fails resolution and the request is rejected with HTTP 401. See [`auth.md`](auth.md) for the API-key model.

The full OTLP configuration surface is [`otlp-configuration.md`](otlp-configuration.md). The most common surprise on a new install is a clock-skewed source rejecting most points as "too far in the future" — fix the source's clock, or temporarily raise `reject_future_seconds`.

### Telemetry from a new host is being dropped

On a commercial plan with a host limit, telemetry from a host beyond your licensed maximum is rejected. Unlike the per-point validation drops above (which return 200), this is reported as an OTLP **partial success** with a message like `host cap reached: N data point(s) from host(s) beyond the licensed limit were rejected`. Already-counted hosts are unaffected; only *new* hosts past the cap are dropped.

Check your usage against the cap:

```bash
curl -fsS http://localhost:3100/api/v1/admin/hosts -H "Authorization: Bearer $TOKEN"
# {"count": 10, "cap": 10, "hosts": [...]}
```

If `count` has reached `cap`:

- **Decommissioned a machine recently?** Its slot frees automatically after `[storage].host_inactivity_days` (default 14) of inactivity. Lower that value to reclaim slots sooner.
- **Genuinely need more hosts?** Upgrade your plan — new limits apply on the next licence refresh.

The community build and the unlimited plans report `"cap": null` and never drop on this basis. Full details: [`host-limits.md`](host-limits.md).

### Upstream OTel Collector is queueing

`pharlux_ingestion_points_total` flat in `/metrics` while the Collector reports a growing queue means either (a) ingest is fully blocked (429s — see above) or (b) the network path to Pharlux is broken. Check `:4317` / `:4318` are reachable from the Collector host (`nc -zv pharlux-host 4317`), and check the Collector's own logs for retry/drop lines.

---

## Query problems

### Query timing out

Default timeout is `[query].query_timeout_seconds` = 30s. Common causes and fixes:

- **No time filter.** Partition pruning only fires on `WHERE timestamp > ...` filters. Always include one. A full-table scan defeats the per-hour Parquet partition layout.
- **Too many small Parquet files.** Run `sudo pharlux compact --config /etc/pharlux/pharlux.toml`. Compaction is crash-safe (uses a marker protocol).
- **DataFusion `MemoryPool` exhaustion.** V1 caps DataFusion at 256 MB (ADR-0011). Queries needing more memory are rejected with an OOM error mid-flight, not a timeout. Rewrite to aggregate earlier or filter more aggressively.
- **`LIKE` on logs above ~10 GB/day.** A documented V1 tradeoff — see [`logs-query-performance.md`](logs-query-performance.md). Tantivy full-text search is planned.
- **Genuinely large query.** Raise `[query].query_timeout_seconds`.

Get the plan to confirm partition pruning is firing:

```bash
curl -s -X POST http://localhost:3100/api/v1/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"sql":"EXPLAIN SELECT ..."}' | jq
```

The full diagnosis is [RUNBOOK.md §10](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#10-diagnosing-query-slowness).

### Query returns empty results when data should be there

- **Wrong tenant.** Every query is automatically filtered to the JWT's `pharlux.tenant_id`. If the data was ingested under a different tenant header, the user logged in for this query won't see it.
- **Time range outside retention.** `[storage].retention_days` (default 30) deletes older partitions on a periodic sweep. Older data is gone.
- **Late-arrival rejection.** If the ingest source is clock-skewed into the past beyond the late-arrival window, the points were rejected on ingest. See [OTLP points being silently dropped](#otlp-points-being-silently-dropped).
- **Query targeting the wrong column.** Check schemas: `DESCRIBE metrics` and `DESCRIBE logs` from any client. Schemas are frozen per ADR-0003.

### "Permission denied" on a table or column

Pharlux V1 has no per-table or per-column permissions — planned. The 403 you are seeing is the default-deny SQL-statement check (see [Read-only user gets 403 on a query](#read-only-user-gets-403-on-a-query)), not a row- or column-level permission.

---

## Alerts

The alert evaluator is documented end-to-end in [`alerts.md`](alerts.md). This section covers the symptoms operators most often see.

### Alert never fires

Check, in order:

1. **Does the rule SQL actually return rows when the condition is true?** Pharlux treats any returned row as "condition true" and zero rows as "condition false." A rule whose `WHERE` clause is too tight will never match. Test the SQL manually via `POST /api/v1/query` with the same admin token and the same time range.
2. **Is `for_cycles` higher than expected?** A rule with `for_cycles: 5` and the default 60s evaluation interval needs four solid minutes of true cycles before transitioning `PENDING → FIRING`. A burst that lasts three minutes will never escape `PENDING`.
3. **Is the evaluator running?** Check `journalctl -u pharlux | grep alert` for cycle messages. Cycles run every `[alerts].evaluation_interval_seconds` (default 60s).
4. **Has the circuit breaker tripped?** After `[alerts].max_consecutive_panics` (default 3) consecutive panicking cycles, the evaluator self-disables and logs a clear message — the loop keeps running but stops evaluating until the service is restarted (ADR-0016). Look for `evaluator self-disabled` or similar in the journal. The fix is `sudo systemctl restart pharlux` after fixing whatever caused the panics (usually a malformed rule SQL that survived the create-time check, or a transient DataFusion issue).

### Webhook or Slack message never received

Notification dispatch is fire-and-forget with a 10-second per-request timeout — a slow or failing target never stalls the evaluator and is **not retried**. Check:

```bash
journalctl -u pharlux --since "10 minutes ago" | grep -E "webhook|slack|notification"
```

You will see lines for 5xx responses, timeouts, DNS failures, and TLS handshake errors. There is no operator surface to retry a missed notification — fix the receiver and wait for the next state transition.

For Slack specifically: confirm the webhook URL is the full `https://hooks.slack.com/services/T0XXX/B0XXX/yyyyy` form and the receiving channel still exists. Slack returns 404 on a deleted incoming-webhook configuration; that 404 is logged but the alert state still transitioned correctly server-side.

### Cannot create a rule (`400 Bad Request`)

`POST /api/v1/admin/alerts` validates the rule SQL with the same default-deny whitelist that protects `/api/v1/query`. Only `SELECT`, `EXPLAIN`, `SHOW`, `DESCRIBE`, and `WITH ... SELECT` are accepted. Attempts to register a rule whose SQL is `DELETE FROM users` or `INSERT INTO ...` return 400 — even though you are an admin. This is intentional: alert rules should not have side effects. See [`alerts.md` § Create](alerts.md#create).

### Need to change a rule's webhook

V1 has no in-place update endpoint. Delete and recreate:

```bash
curl -s -X DELETE http://localhost:3100/api/v1/admin/alerts/$RULE_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# Then POST a fresh rule with the new webhook_url.
```

State is reset on recreate (the new rule is born `OK`). In-place update is planned.

---

## Dashboards

### `409 Conflict` on create or rename

`(tenant_id, name)` is unique per tenant. A second dashboard with a name that already exists in the same tenant returns 409. Pick a different name, or delete the existing one first. Different tenants can use the same name independently.

### `404 Not Found` on edit, delete, or fetch

Either the dashboard id genuinely doesn't exist, or it exists in a different tenant than the calling admin's. The API returns 404 in both cases — deliberately, to avoid leaking ids across tenants. Confirm the id with `GET /api/v1/dashboards` first.

### `403 Forbidden` for a read-only user

V1 dashboards are admin-only across all seven endpoints, including `GET`. Read-only users get 403 on every dashboards endpoint. Planned RBAC enrichment lifts this. See [`dashboards.md` § Authentication and authorization](dashboards.md#authentication-and-authorization).

### Save button is disabled in the editor

The layout JSON is invalid. The editor's preview pane keeps the last valid render and a yellow banner above the editor names the parse error. Fix the JSON and the Save button comes back. See [`dashboards.md` § The web UI editor](dashboards.md#the-web-ui-editor).

### A panel renders empty / `No data`

The panel's SQL returned zero rows. Most often:

- The time range in the SQL is outside the data — V1 panels do not have a global time picker; each panel's SQL is responsible for its own `WHERE timestamp > ...`.
- The panel is bar/pie and the result has fewer than two columns. Bar and pie expect column 0 = category, column 1 = value (see [`dashboards.md` § V1 layout JSON shape](dashboards.md#v1-layout-json-shape)).
- The query was rejected at the API layer (admin-only check, MemoryPool, partition not found). Open the browser dev tools' network tab to see the actual response.

---

## Storage and resource usage

### High memory

Expected V1 budget: WAL buffer ~64 MB, DataFusion MemoryPool 256 MB (ADR-0011), Parquet reader 50–100 MB, SQLite ~20 MB. Steady-state under load: 200–430 MB. The `pharlux install` unit sets `MemoryMax=1G`. Full diagnosis flow including how to read `pharlux_active_queries` and `pharlux_wal_bytes` is in [RUNBOOK.md §11](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#11-diagnosing-high-memory-usage).

### Disk filling up

Look at the data directory layout (`wal/`, `metrics/<tenant>/<YYYY>/<MM>/<DD>/<HH>/`, `logs/<tenant>/...`, `auth.db`, `alerts.db`, `dashboards.db`) and find what's growing:

```bash
sudo du -sh /var/lib/pharlux/*
sudo find /var/lib/pharlux -type f -size +100M | head -20
```

Common causes and fixes are listed in [RUNBOOK.md §12](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#12-diagnosing-disk-usage-growth) — usually it's retention not configured (`[storage].retention_days`), small-file proliferation (`pharlux compact`), or a runaway tenant.

### WAL replay errors on startup

WAL framing is prost + length prefix + CRC32 trailer (ADR-0018). Tail-corruption is expected after an unclean shutdown and is handled automatically — Pharlux stops replay at the previous valid record and continues. Anything else is rare and points at storage hardware. Full procedure (including segment quarantine) is [RUNBOOK.md §13](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#13-recovering-from-a-corrupted-wal).

---

## systemd hardening pitfalls

The unit installed by `pharlux install` is locked down: `DynamicUser=yes`, `NoNewPrivileges=yes`, `ProtectSystem=strict`, `ProtectHome=yes`, `PrivateTmp=yes`, `MemoryDenyWriteExecute=yes`, `RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6`, empty `CapabilityBoundingSet=`, plus `ConfigurationDirectory=pharlux` and `StateDirectory=pharlux`. These defaults are deliberate — the trade-off is that a few day-to-day operations look surprising compared to a "normal" service.

### "There is no `pharlux` user" — `useradd` fails or `chown` complains

There is no static `pharlux` host user, by design. `DynamicUser=yes` makes systemd allocate a transient service-only UID at start, with no persistent passwd entry. Any guide that says "create a `pharlux` user with `useradd`" was written for the pre-DynamicUser layout. Use the dynamic UID systemd already manages — don't add a static user.

The journal-friendly check for the running UID is:

```bash
sudo systemctl show pharlux --property=DynamicUser,User,UID
sudo ls -ln /etc/pharlux/jwt.secret /var/lib/pharlux/   # numeric UIDs
```

### After a manual restore, the service can't write `/var/lib/pharlux`

`StateDirectory=pharlux` chowns the top of `/var/lib/pharlux/` to the dynamic UID at every start, but it does **not** recursively chown the contents. A `tar xf` extraction with `--same-owner` (the default for root) or a `chown -R pharlux:pharlux` against a non-existent group leaves the *contents* — `wal/`, `data/`, the SQLite files — owned by the wrong UID/GID. The service can then write to `/var/lib/pharlux/` itself but gets `Permission denied` on every WAL or Parquet write underneath.

The fix is to chown the contents to match the dynamic UID:

```bash
# Find the dynamic UID (works while the service is running).
sudo systemctl start pharlux 2>/dev/null
DYN_UID=$(sudo systemctl show pharlux --property=UID --value)
sudo systemctl stop pharlux

# Recursively chown the data directory to that UID.
sudo chown -R "$DYN_UID:$DYN_UID" /var/lib/pharlux

# Restart.
sudo systemctl start pharlux
```

Do **not** `chown -R pharlux:pharlux` — there is no static `pharlux` user under DynamicUser. Always pin the chown to the numeric UID systemd allocated for this install.

Restoring through `pharlux backup` plus a tar extract preserving permissions but not ownership (`tar xf --no-same-owner`) avoids this trap; see [`backup-restore.md`](backup-restore.md).

### `jwt.secret` mode keeps "fixing itself" to the wrong value

Two layouts are valid:

- `0640`, owned by `root`, group-readable — works with the install-time `DynamicUser` + `ConfigurationDirectory` setup. This is the default.
- `0600`, owned by `root`, owner-only — works only if you have manually adjusted the unit so a non-DynamicUser process is reading the file.

If you `chmod 0600` the secret while still running the default DynamicUser unit, the service has no group-read access and login starts failing in subtle ways. The world-readable check refuses to start outright; this case is the silent failure mode. Either revert to `0640` or change the unit. See [`auth.md` § JWT signing secret](auth.md#jwt-signing-secret).

### `/tmp` looks empty when I `ls /tmp` from inside the service

`PrivateTmp=yes` gives the unit a private `/tmp` and `/var/tmp` namespace. Files written by Pharlux to `/tmp` are not visible from a regular shell — they live in a tmpfs scoped to this service's namespace and disappear when it stops. Don't put diagnostic dumps in `/tmp` and expect to find them with `ls`. Use a path under `/var/lib/pharlux` or `/var/log` instead.

### Cannot read `/home/<user>/...` from a `pharlux backup --output` invocation

`ProtectHome=yes` means `/home`, `/root`, and `/run/user` are inaccessible to the service. If you ask `pharlux` (running under the unit) to write a backup into a user home directory, it fails with `Permission denied` even though file-system permissions look fine. Write backups under `/backups/`, `/var/backups/`, or another path that is not under `/home`.

### `MemoryDenyWriteExecute` blocks JIT or W^X violations

Pharlux itself does not use JIT, but plugins or sidecars sometimes do. `MemoryDenyWriteExecute=yes` makes a process unable to map memory both writable and executable. If you are layering a tool that needs JIT into the same unit (don't), this is the blocker. The fix is to run that tool out-of-unit, not to relax the hardening.

---

## Collecting diagnostic info

When in doubt, run the bundle below and attach the output to your bug report.

```bash
# Version
pharlux --version

# Service state and recent journal
sudo systemctl status pharlux
sudo journalctl -u pharlux --since "1 hour ago" --no-pager > /tmp/pharlux-journal.txt

# Self-observability metrics
curl -s http://localhost:3100/metrics > /tmp/pharlux-metrics.txt

# System resources
free -h
df -h /var/lib/pharlux
sudo cat /proc/$(pidof pharlux)/status | grep -E "VmRSS|VmPeak"

# Listener state
sudo ss -tlnp | grep -E ":3100|:4317|:4318"

# Effective unit settings (in case the unit has been customised)
sudo systemctl show pharlux --property=DynamicUser,User,UID,MemoryMax,LimitNOFILE,RestrictAddressFamilies
```

Self-observability metrics interpretation, including the counter-reset semantics and what each `pharlux_*` metric means, is in [RUNBOOK.md §15](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/RUNBOOK.md#15-checking-self-observability-metrics).

---

## Filing bug reports

Public bug reports go to https://github.com/Veltara-Works/pharlux/issues.

Please include:

- Pharlux version (`pharlux --version`).
- OS and systemd version (`uname -a`, `systemctl --version`).
- The journal excerpt and `/metrics` output from [Collecting diagnostic info](#collecting-diagnostic-info).
- The minimal reproduction steps.
- For ingest issues: the OTel Collector version and a sample of the rejected payload (with secrets redacted).

**Do not file security vulnerabilities publicly.** See [`SECURITY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/SECURITY.md) for the security contact. For commercial-license and Enterprise-support enquiries, use the [contact form](https://pharlux.com/contact?intent=licensing).

---

*Last updated: 2026-05-02.*
