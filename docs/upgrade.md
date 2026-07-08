# Upgrading Pharlux

Pharlux is a single statically-linked binary, so upgrades are mechanically simple — stop the service, replace the binary, start. The procedure below adds a backup and a schema-compatibility check on top of that to keep the upgrade reversible if anything goes wrong.

For installs from scratch, see [`getting-started.md`](getting-started.md). For backup/restore mechanics referenced here, see [`backup-restore.md`](backup-restore.md).

## Standard upgrade

Five steps. Plan for ~30 seconds of ingest gap on the OTel Collector side; Collector retry/buffering normally handles it without operator intervention.

```bash
# 1. Stop the service.
sudo systemctl stop pharlux

# 2. Take a pre-upgrade backup. Keep this until you have verified
#    the new version is healthy.
sudo pharlux backup --output /backups/pharlux-pre-upgrade-$(date +%Y%m%d).tar

# 3. Check schema compatibility against the on-disk Parquet partitions.
#    This MUST succeed before you replace the binary — if it fails,
#    abort the upgrade.
sudo pharlux migrate --config /etc/pharlux/pharlux.toml

# 4. Replace the binary.
sudo curl -L https://github.com/Veltara-Works/pharlux/releases/latest/download/pharlux-linux-amd64 \
  -o /usr/local/bin/pharlux
sudo chmod +x /usr/local/bin/pharlux

# 5. Start the service. Pharlux replays any unflushed WAL on startup,
#    so no operator action is required to recover in-flight ingest.
sudo systemctl start pharlux
sudo systemctl status pharlux
```

After step 5, do a 60-second smoke check:

```bash
# Service is up
curl -fsS http://localhost:3100/api/v1/health
# {"status":"ok","version":"<new-version>"}

# OTLP is accepting traffic again
journalctl -u pharlux -n 20 --no-pager

# A query against existing data still works
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"..."}' | jq -r .token)
curl -s -X POST http://localhost:3100/api/v1/query \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"sql":"SELECT count(*) FROM metrics WHERE timestamp > now() - INTERVAL '\''10 minutes'\''"}'
```

If health is `ok`, journal shows the new version starting cleanly, and the query returns a row count, the upgrade is successful. Once you've watched it run normally for ~24 hours under your real workload, the pre-upgrade backup can be archived or deleted.

## The schema-compatibility check (`pharlux migrate`)

`pharlux migrate` walks every Parquet file under `metrics/` and `logs/` looking for the `pharlux.schema_version` metadata key in the Parquet footer. Pre-versioned files (those without the metadata key) are treated as compatible. Files written by a newer schema version that the new binary does not recognise will be reported, and the command exits non-zero.

```bash
sudo pharlux migrate --config /etc/pharlux/pharlux.toml
# checking schema compatibility in /var/lib/pharlux
# inspected: 1024 files
# compatible: 1024
# mismatched: 0
# OK
```

If `mismatched` is non-zero, **do not start the new binary against the same data directory**. The mismatched files belong to a future schema version that this build does not know how to read. Restore from your pre-upgrade backup and stay on the previous version until you have a build that supports the data.

For V1.0.x, every Parquet file is version `1`, and the check is a low-cost sanity test rather than a real migration. The command becomes load-bearing in a future release, when the schema actually evolves.

## Rollback

Pharlux V1 has no in-place downgrade — rollback is "stop, restore the backup, start the old binary." Sequence:

```bash
# 1. Stop the (broken or unwanted) new version.
sudo systemctl stop pharlux

# 2. Restore the data directory from the pre-upgrade backup. The
#    --strip-components=1 strips the leading `data/` from the archive
#    so files land at the right paths.
sudo rm -rf /var/lib/pharlux/*
sudo tar xf /backups/pharlux-pre-upgrade-20260428.tar -C /var/lib/pharlux/ --strip-components=1

# 3. Restore the previous binary. Either keep the old binary aside
#    before step 4 of the upgrade, or fetch the prior release tag.
sudo curl -L https://github.com/Veltara-Works/pharlux/releases/download/v1.0.0/pharlux-linux-amd64 \
  -o /usr/local/bin/pharlux
sudo chmod +x /usr/local/bin/pharlux

# 4. Start.
sudo systemctl start pharlux
```

The pre-upgrade backup includes the SQLite databases (users, alerts, dashboards) but **not** the JWT secret file (per [`backup-restore.md`](backup-restore.md)). On rollback, `/etc/pharlux/jwt.secret` is unchanged from the upgrade, so existing JWTs remain valid.

> **Recommendation:** keep the previous release binary at `/usr/local/bin/pharlux.prev` before step 4 of the upgrade. Rollback then becomes `mv /usr/local/bin/pharlux.prev /usr/local/bin/pharlux && systemctl start pharlux`, no curl required.

## Retention now enforced

Builds before this release shipped the `[storage].retention_days` setting but did **not** run a background sweep — so data accumulated indefinitely regardless of the configured window. This release wires the sweep up: it runs once at startup and then every `[storage].retention_sweep_interval_hours` (default 24), deleting Parquet partitions older than `retention_days`.

**One-time effect on upgrade:** if your deployment has been accumulating data for longer than `retention_days`, the first sweep after you start the new binary will delete everything older than that window. This is the documented behaviour finally taking effect, not a regression.

If you need to keep the older data:

- **Take the pre-upgrade backup** (step 2 of the standard procedure) — it captures the full data directory before any sweep runs.
- **Raise `retention_days`** to cover the span you want to keep *before* starting the new binary, e.g. `retention_days = 365`.

On a commercial licence the effective window is clamped to your plan's maximum (the lower of `retention_days` and the licensed cap), so raising `retention_days` above your plan's limit has no effect.

## Special considerations

**OTLP ingest gap.** The 30-second window between `systemctl stop` and `systemctl start` is buffered by the upstream OTel Collector. If you are sending OTLP directly from application SDKs without an intermediate Collector, those SDKs' own retry/buffer behaviour determines whether points are lost; OpenTelemetry's spec-compliant SDKs all retry, but the buffer depth varies. In practice, run a Collector in front of Pharlux for any production deployment — it's the right operational layer for this concern.

**Long-running queries.** `systemctl stop` sends SIGTERM, which Pharlux handles by completing in-flight requests up to a grace period and then exiting. Queries running longer than the grace period will be cut short. Avoid starting an upgrade while a multi-minute backfill query is in flight.

**Alert evaluator state.** Alert rule state (`OK` / `PENDING` / `FIRING` / `RESOLVED`) is persisted in `alerts.db` between cycles, so an upgrade does not re-fire already-firing alerts or lose pending counters. The first evaluation after restart will reuse the persisted state.

**JWT tokens.** Tokens issued before the restart remain valid until their `exp` passes (default 1 hour). Operators do not need to log in again after an upgrade — only after a JWT secret rotation, which is a separate operation (see [`auth.md`](auth.md)).

**WAL replay on startup.** If there were unflushed records in the WAL when you stopped the service (the common case under steady-state ingest), Pharlux replays them on the next start before opening the OTLP listeners. This is automatic and typically completes in under a second; for very large WALs (close to the 512 MB ceiling) it can take a few seconds. Watch the journal for `replayed N records from WAL`.

## Verifying the new version after upgrade

If you have a monitoring dashboard pointed at Pharlux's own `/metrics` endpoint, the post-upgrade checks to look at:

| Metric | Expected behaviour |
| --- | --- |
| `pharlux_info{version="..."}` | Version label updated to the new release. |
| `pharlux_ingestion_points_total` | Resumes climbing within seconds of `systemctl start`. |
| `pharlux_query_count_total` | Resumes climbing once you (or your dashboards) issue a query. |
| `pharlux_active_queries` | Returns to normal range. |
| Process RSS | Returns to the steady-state envelope (200–430 MB per [sizing-guide.md](sizing-guide.md) for typical workloads). |

Counter resets at restart are the Prometheus-native expectation — `rate()` and `increase()` handle them via the exposed `_created` timestamp. See [`troubleshooting.md`](troubleshooting.md) for the operational nuances.

## Known V1 limitations

- **No in-place downgrade.** Rollback is restore-from-backup. The `pharlux migrate` command checks forward compatibility, not backward — a binary cannot drop schema versions written by a newer build.
- **No staged / canary upgrade in V1.** Pharlux V1 is single-binary, single-VPS by design. There is no rolling-replace mechanism. The entire ingest gap is the duration of the `systemctl stop` → `systemctl start` cycle.
- **No automated pre-upgrade compatibility advisory.** `pharlux migrate` is the explicit check; there is no remote service that warns "your installed version is one major behind." Watch the GitHub Releases feed.
- **No automatic backup on upgrade.** Step 2 of the standard procedure is operator-driven. Skipping it leaves you without a rollback path.

## See also

- [`backup-restore.md`](backup-restore.md) — backup format, restore mechanics, retention.
- [`getting-started.md`](getting-started.md) — first-install walkthrough and the binary download URL pattern.
- [`auth.md`](auth.md) — JWT lifecycle around restarts and the secret-rotation procedure (a separate operation from upgrade).
- [`sizing-guide.md`](sizing-guide.md) — memory and disk envelopes the upgraded process should land within.
- [`reverse-proxy.md`](reverse-proxy.md) — proxy-side considerations during the brief downtime.
