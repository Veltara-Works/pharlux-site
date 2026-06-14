# Backup and Restore

## Backup

Pharlux supports live backup — the WAL and Parquet files are safe to copy while the server is running.

### Quick backup

```bash
pharlux backup --output /backups/pharlux-$(date +%Y%m%d).tar
```

This creates a tar archive of the data directory. The backup includes:
- WAL segments (`wal/`)
- Parquet files (`metrics/`, `logs/`)
- Auth database (`auth.db`)
- Alert rules database (`alerts.db`)

### Scheduled backup (cron)

```bash
# /etc/cron.d/pharlux-backup
0 2 * * * root /usr/local/bin/pharlux backup --output /backups/pharlux-$(date +\%Y\%m\%d).tar --config /etc/pharlux/pharlux.toml
```

### Remote backup

Combine with standard tools:

```bash
pharlux backup --output - | ssh backup-server 'cat > /backups/pharlux-latest.tar'
```

## Restore

1. Stop Pharlux:
   ```bash
   sudo systemctl stop pharlux
   ```

2. Extract the backup into the data directory:
   ```bash
   sudo rm -rf /var/lib/pharlux/*
   sudo tar xf /backups/pharlux-20260413.tar -C /var/lib/pharlux/ --strip-components=1
   ```

3. Start Pharlux:
   ```bash
   sudo systemctl start pharlux
   ```

Pharlux will automatically replay any WAL segments and recover compaction state on startup.

## Upgrade procedure

1. Stop Pharlux:
   ```bash
   sudo systemctl stop pharlux
   ```

2. Take a backup (recommended):
   ```bash
   pharlux backup --output /backups/pharlux-pre-upgrade.tar
   ```

3. Check schema compatibility:
   ```bash
   pharlux migrate --config /etc/pharlux/pharlux.toml
   ```

4. Replace the binary:
   ```bash
   curl -L https://github.com/Veltara-Works/pharlux/releases/latest/download/pharlux-linux-amd64 \
     -o /usr/local/bin/pharlux
   chmod +x /usr/local/bin/pharlux
   ```

5. Start Pharlux:
   ```bash
   sudo systemctl start pharlux
   ```

The upstream OTel Collector's built-in retry/buffering handles the brief ingest gap during the restart.

## Data retention

Pharlux automatically deletes Parquet partitions older than `retention_days` (default 30 days). The sweep runs once at startup and then every `retention_sweep_interval_hours` (default 24). To change either:

```toml
[storage]
retention_days = 14
retention_sweep_interval_hours = 24
```

On a commercial licence, the effective retention is **clamped to your plan's maximum**: if `retention_days` is set higher than your plan allows, the lower of the two applies. The community build and unlimited plans use `retention_days` as written.

> **Upgrading from a build before retention was enforced?** See the [one-time retention note in `upgrade.md`](upgrade.md#retention-now-enforced) — the first sweep deletes data older than `retention_days`.

Manual compaction reduces the number of small Parquet files:

```bash
pharlux compact --config /etc/pharlux/pharlux.toml
```
