# Host limits

Commercial Pharlux plans include a maximum number of **hosts** that can send
telemetry. This page explains what counts as a host, what happens when the limit
is reached, and how to see your current usage.

The community (AGPL) build and the unlimited plans (Scale, Custom) have **no host
limit** — everything on this page about rejection applies only to plans with a
capped host count.

## What counts as a host

A host is identified from the OpenTelemetry **resource attributes** on the
telemetry it sends, in this order of preference:

1. `host.name`
2. `host.id`
3. `service.instance.id`

The first one present is the host's identity. Telemetry that carries **none** of
these is attributed to a single shared `<unknown>` host, which counts as one
host. (This means you cannot dodge the limit by stripping `host.name`.)

Two different machines sending the same `host.name` count as **one** host; the
same machine sending under two different names counts as **two**. The count is
**deployment-wide** — all tenants on one Pharlux instance share a single host
count, because one licence covers one deployment.

## What happens at the limit

When a **new** host beyond your plan's limit sends telemetry, Pharlux **rejects
that host's data** and accepts everything from hosts already within the limit. A
request that mixes within-limit and over-limit hosts keeps the good data and
reports the rest.

The rejection is reported in the OpenTelemetry-standard way — a **partial success**
on the OTLP response (`rejected_data_points` / `rejected_log_records` with an
explanatory message), over both OTLP/HTTP (port 4318) and OTLP/gRPC (port 4317).
This is a *permanent* signal, not backpressure: a compliant OTLP exporter will
**not** retry it (unlike the `429` Pharlux returns when its ingest channel is
momentarily full). Retrying would not help — the host is over the licensed limit.

Already-registered hosts are never rejected, even once the limit is full.

## Freeing up slots — host inactivity

A host that **stops** sending telemetry is automatically removed from the count
after `[storage].host_inactivity_days` (default **14**) of inactivity, freeing
its slot. This means decommissioning or renaming machines does not permanently
consume slots — you do not need to manually reset anything.

```toml
[storage]
host_inactivity_days = 14
```

Eviction runs on the retention-sweep cadence (see
[`sizing-guide.md`](sizing-guide.md#storageretention_sweep_interval_hours)).

## Checking your usage

The admin-only endpoint reports your current count, the licensed cap, and the
host list:

```bash
curl -fsS http://localhost:3100/api/v1/admin/hosts \
  -H "Authorization: Bearer $TOKEN"
# {"count": 8, "cap": 10, "hosts": ["web-1", "web-2", ...]}
```

`cap` is `null` for the community build and the unlimited plans.

## Raising your limit

To monitor more hosts, upgrade your plan — see
[pharlux.com/pricing](https://pharlux.com/pricing). New limits take effect on the
next licence refresh (within ~12 hours of an upgrade, or immediately on a
`pharlux license refresh`).

## See also

- [`sizing-guide.md`](sizing-guide.md) — VPS sizing, retention, sweep cadence.
- [`troubleshooting.md`](troubleshooting.md#telemetry-from-a-new-host-is-being-dropped) — diagnosing dropped host data.
- [`otlp-configuration.md`](otlp-configuration.md) — pointing exporters at Pharlux.
