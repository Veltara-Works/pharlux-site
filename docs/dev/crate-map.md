# Pharlux — Crate Map

Pharlux is a Cargo workspace with **12 Rust crates** plus one frontend project. This page is the per-crate reference for contributors: purpose, intra-workspace dependencies, public API boundary, where the work actually happens, and where the tests live.

For the data flow and runtime layout that wires these crates together, see [`architecture.md`](architecture.md). For the high-level workspace summary, see the table in [`README.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/docs/dev/README.md). For the design rationale behind individual decisions, follow the ADR links — ADRs are immutable per [`CLAUDE.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/CLAUDE.md).

---

## Workspace topology

```
            pharlux-bin                                 (binary)
                 │
                 ├──► pharlux-api ──┬──► pharlux-auth
                 │                  ├──► pharlux-query  ──► pharlux-store
                 │                  ├──► pharlux-alert  ──► pharlux-query
                 │                  ├──► pharlux-dashboard
                 │                  ├──► pharlux-license
                 │                  └──► pharlux-core   ──► pharlux-common
                 │
                 ├──► pharlux-ingest ──► pharlux-store ──► pharlux-common
                 │
                 └──► pharlux-loadtest                       (binary, standalone)
```

`pharlux-common` is the leaf — every other crate depends on it (directly or transitively). `pharlux-bin` is the only crate that pulls everything together. `pharlux-loadtest` is intentionally isolated: a standalone OTLP load generator with no path-dependency on the rest of the workspace.

The frontend (`pharlux-ui/`) is a Vite + React project, not a Cargo workspace member. It is built with `npm run build` and embedded into the binary at compile time via `rust-embed` (see [`pharlux-bin`](#pharlux-bin) below).

---

## `pharlux-common`

**Shared types, Arrow schemas, config, and error definitions.** The leaf crate — has no intra-workspace dependencies.

| Module | Responsibility |
| --- | --- |
| `config` | Strongly-typed `pharlux.toml` model (`PharluxConfig` and the `[ingest]` / `[storage]` / `[query]` / `[auth]` / `[alerts]` / `[otlp]` sub-structs). TOML deserialization, defaulting, validation. |
| `error` | The shared `PharluxError` and `PharluxResult` aliases. Errors that cross crate boundaries live here. |
| `schema` | Frozen Arrow schemas for metrics and logs Parquet files (ADR-0003). Schema-version metadata key. |
| `tenant` | `TenantId` newtype and the `"default"` constant for community deployments. Multi-tenant invariants are enforced at the type level. |
| `tracing_setup` | Shared `tracing-subscriber` initialisation (env filter, JSON formatter). |

**Why frozen:** the Arrow schemas in `schema` are an ADR-0003 hard invariant. Adding a column requires an ADR. The TOML config struct is also de-facto frozen — adding a field is fine, renaming or removing one is a breaking change.

**Tests:** inline `#[cfg(test)]` modules in each file.

---

## `pharlux-license`

**`LicenseProvider` trait and `NullLicenseProvider`.** The seam for the dual-license (AGPL + commercial) model from [ADR-0022](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0022-dual-license-agpl-commercial.md). No intra-workspace dependencies.

| Item | Role |
| --- | --- |
| `Tier` | Enum — `Community`, `Team`, `Business`, `Scale`, `Custom`. |
| `Entitlements` | What the active tier allows (currently a placeholder for V1; populated from V1.2 onwards). |
| `License` | The validated license payload. |
| `LicenseProvider` (trait) | The seam. The community AGPL build wires `NullLicenseProvider`; the Enterprise build (private repo) wires its own implementation. |
| `NullLicenseProvider` | Always returns Community tier, no entitlements. The default for this repo. |

**Why a separate crate:** keeps the license-checking surface tiny and stable, so the Enterprise repo can swap in its own implementation without forking the rest of the workspace.

**Tests:** one inline test for `NullLicenseProvider`.

---

## `pharlux-core`

**`AuditSink` trait and self-observability counters.** Depends on `pharlux-common`.

| Item | Role |
| --- | --- |
| `metrics` (module) | Atomic counters and gauges for `/metrics` (`pharlux_ingestion_*`, `pharlux_query_*`, `pharlux_active_queries`, `pharlux_wal_bytes`, `pharlux_info`). Not the `prometheus` crate — these are plain `AtomicU64` counters with manual exposition formatting (see [RUNBOOK.md §15](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/RUNBOOK.md#15-checking-self-observability-metrics) for counter-reset semantics). |
| `AuditEvent` | The structured record passed to `AuditSink::record()`. |
| `AuditSink` (trait) | Pluggable destination for admin-action audit events. V1 wires `NoopAuditSink`; durable audit logging is V1.2 (Enterprise tier). |
| `NoopAuditSink` | The default for the community build — implements `AuditSink` but does nothing. |

**Tests:** one inline test (audit-sink wiring).

---

## `pharlux-auth`

**JWT, Argon2id password hashing, SQLite user store.** Depends on `pharlux-common`.

| Module | Responsibility |
| --- | --- |
| `db` | SQLite schema for `auth.db`: users, API keys. WAL journal mode, manual schema migrations (no diesel/sqlx — `rusqlite` only). |
| `jwt` | HS256 sign + verify, `pharlux.tenant_id` and `pharlux.admin` claims, zero-leeway `exp` enforcement. The world-readable secret-file refusal lives in [`pharlux-bin`](#pharlux-bin), not here. |
| `password` | Argon2id wrapper. Defaults are OWASP 2023 (19 MiB / 2 iterations / 1 parallelism). Parameters come from `[auth].argon2_*` at runtime. |

**ADR pointer:** [ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0010-auth-jwt-argon2id.md) — the V1 two-role model and the V1.2 RBAC commitments.

**Tests:** inline `#[cfg(test)]` per module — round-trip tokens, hash/verify cycles, schema migration, duplicate-username rejection.

---

## `pharlux-store`

**WAL, Parquet writer, retention, compaction, `TableProvider` impls.** Depends on `pharlux-common`.

| Module | Responsibility |
| --- | --- |
| `wal` | Prost-framed WAL (length prefix + CRC32 trailer, ADR-0018). Append, rotate, replay, tail-corruption tolerance. **Format frozen.** |
| `parquet_writer` | Per-signal Parquet writer with Zstd-3 compression. Per-tenant / per-hour partition layout (`<signal>/<tenant>/YYYY/MM/DD/HH/*.parquet`). |
| `retention` | Periodic sweep that deletes partitions older than `[storage].retention_days`. |
| `compaction` | Crash-safe compaction. Writes a marker file before the rewrite, atomically renames the result, and removes the marker last — replay on startup completes any in-flight compaction or rolls it back cleanly. |
| `table_provider` | DataFusion `TableProvider` impls for metrics and logs — the read seam. **Read-only by construction:** writes go via the OTLP ingest path, not SQL. Touching this requires a human pair-review session per [`CLAUDE.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/CLAUDE.md). |

**ADR pointers:** ADR-0003 (frozen schemas), ADR-0018 (WAL framing).

**Tests:** the heaviest test-bearing crate in the workspace. Inline tests across every module, plus two integration test files:

- `tests/storage_integration.rs` — end-to-end ingest + query against real Parquet files.
- `tests/crash_recovery.rs` — simulated crash + replay invariants (ADR-0018). Run 10× consecutively in CI; a flaky crash test is a bug, not a quirk.

---

## `pharlux-ingest`

**OTLP gRPC and HTTP handlers, translation, backpressure channel.** Depends on `pharlux-common`, `pharlux-store`.

| Module | Responsibility |
| --- | --- |
| `otlp_grpc` | Tonic services — `MetricsService` on `:4317`, `LogsService` on `:4317`. |
| `otlp_http` | Axum routes — `/v1/metrics` and `/v1/logs` on `:4318`. |
| `tenant_resolver` | Resolves the OTLP request's `tenant_id` from the API key in the `x-api-key` or `Authorization: Bearer <key>` header. Single-tenant Community deployments use `DefaultTenantResolver`, which returns the constant `"default"` regardless of key. |
| `translate` | Converts OTLP protobuf → Arrow `RecordBatch`. Validates timestamps (ADR-0017 reject-future + late-arrival window), body size, and required fields. |
| `channel` | Bounded `tokio::sync::mpsc` between handlers and the WAL writer task. Capacity from `[ingest].channel_capacity` (default 1000). The HTTP-429 / `RESOURCE_EXHAUSTED` surface comes from this. |

**ADR pointers:** ADR-0017 (timestamp validation), ADR-0006 (OTLP subset).

**Tests:** inline tests for translate (timestamp boundaries, body-size limit, malformed protobuf), tenant resolver, channel backpressure semantics.

---

## `pharlux-query`

**DataFusion `QueryEngine`, per-request `SessionContext`, tenant filter.** Depends on `pharlux-common`, `pharlux-store`.

| Module | Responsibility |
| --- | --- |
| `engine` | The `QueryEngine` trait and its `DataFusionEngine` impl. Each query gets a fresh `SessionContext` with the shared `RuntimeEnv` (256 MB `MemoryPool` cap per ADR-0011). Query timeout from `[query].query_timeout_seconds`. |
| `tenant_filter` | The `TenantScopedQueryBuilder`. Parses SQL → `LogicalPlan`, walks the plan with `transform_up`, and injects `Filter(tenant_id = '<literal>')` on every `TableScan`. **Every query goes through this** — bypassing it leaks data across tenants. |

**ADR pointers:** ADR-0011 (MemoryPool cap), ADR-0008 (DataFusion), ADR-0009 (tenant-scoped query builder).

**Tests:** plan-rewriter unit tests covering CTEs, subqueries, joins, and `EXPLAIN`. The end-to-end query path is exercised via `pharlux-store/tests/storage_integration.rs`.

---

## `pharlux-alert`

**SQL-backed alert rules, four-state machine, notification dispatch.** Depends on `pharlux-common`, `pharlux-query`.

| Item | Role |
| --- | --- |
| `AlertRule` | The persisted rule record — id, name, tenant, query, `for_cycles`, state, webhook URLs, timestamps. |
| `AlertState` | Enum — `Ok`, `Pending`, `Firing`, `Resolved`. |
| `AlertStore` | SQLite-backed store at `alerts.db`. CRUD plus state-transition persistence. |
| `build_webhook_payload` / `build_slack_payload` | Pure-function payload builders. Generic JSON for webhooks, Slack mrkdwn (with `<!date^...|...>` syntax) for Slack. |
| `default_notification_client` | Pre-configured `reqwest::Client` with 10s per-request timeout, `rustls` TLS (no OpenSSL — see [`VERSIONS.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/VERSIONS.md)). |

**Operational properties:** dispatch is fire-and-forget (no retries in V1). The evaluator self-disables after `[alerts].max_consecutive_panics` (default 3) consecutive panicking cycles per [ADR-0016](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0016-background-task-circuit-breaker.md).

**Tests:** state-machine transition tests, payload-builder snapshot tests, an in-process axum mock for webhook dispatch, and the SQL-validation default-deny check (rejecting non-`SELECT` rule queries).

---

## `pharlux-dashboard`

**Dashboard CRUD store, `(tenant_id, name)` UNIQUE.** No intra-workspace dependencies (it imports `pharlux-common` types via re-export through the API layer rather than directly — keeps the crate decoupled).

| Item | Role |
| --- | --- |
| `Dashboard` | The full record — id, tenant, name, description, `layout_json` (opaque), `created_by`, `created_at`, `updated_at`. |
| `DashboardSummary` | Lighter projection used by the list endpoint. |
| `DashboardStore` | SQLite-backed store at `dashboards.db`. The seven endpoints in `pharlux-api` map 1:1 onto methods here. |
| `is_unique_violation` | Helper that handles both UNIQUE-constraint and PRIMARY-KEY-constraint error codes from `rusqlite`. Used to map storage errors to `409 Conflict`. |

**Storage choice:** dashboards live in a separate `dashboards.db` SQLite file alongside `auth.db` and `alerts.db`. The unified `meta.sqlite` from [`spec/file-layout.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/spec/file-layout.md) is V1.x cleanup work — flagged as a V1 limitation in [`docs/user/dashboards.md`](../dashboards.md).

**Tests:** 16 inline tests covering CRUD, UNIQUE-violation mapping, tenant scoping, timestamp handling.

---

## `pharlux-api`

**REST API surface — handlers, router, AppState wiring.** Depends on `pharlux-common`, `pharlux-core`, `pharlux-license`, `pharlux-query`, `pharlux-auth`, `pharlux-alert`, `pharlux-dashboard`. The widest fan-in in the workspace — this is where everything composes.

| Module | Responsibility |
| --- | --- |
| `handlers` | All HTTP handler functions — `/health`, `/auth/login`, `/query` (with the read-only default-deny SQL whitelist), `/metrics`, `/admin/users`, `/admin/tenants`, `/admin/alerts`, `/dashboards` (CRUD + import/export). |
| `router` | The Axum `Router` builder. JWT extraction middleware. Admin-only middleware. AppState type. |

**Spec pointer:** [`spec/api-surface.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/spec/api-surface.md) — the authoritative endpoint list, request/response shapes, and RBAC posture.

**Tests:** inline tests across handlers — auth flows, default-deny SQL whitelist, dashboards CRUD with admin/reader/cross-tenant matrices, tenant CRUD, the user CRUD self-delete guard.

---

## `pharlux-bin`

**Binary entry point, CLI subcommands, server wiring, install procedure.** Depends on every other library crate.

CLI surface (matches [`docs/user/`](../) operator docs):

| Subcommand | Purpose |
| --- | --- |
| `pharlux run` (default) | Start the server. Loads config, initialises the SQLite databases, builds the WAL writer, runs the API + ingest + alert evaluator on the shared Tokio runtime. |
| `pharlux install` | Generates the systemd unit (`DynamicUser=yes` + hardening), creates `/etc/pharlux/jwt.secret` at mode `0640`, prepares the data directory. |
| `pharlux backup` | Live backup — tarballs the data directory. Excludes `pharlux.toml` and `jwt.secret`. |
| `pharlux compact` | Triggers a one-shot compaction sweep. |
| `pharlux migrate` | Schema-version compatibility check. Run before swapping binaries on upgrade. |
| `pharlux user add / list / delete / reset-password` | Host-side rescue path for users when the API is unreachable (see [`auth.md`](../auth.md)). |
| `pharlux --version` | Prints `pharlux <version>` and exits. |

**Frontend embedding:** `rust-embed` pulls everything under `pharlux-ui/dist/` into the binary at compile time. The frontend must be built (`npm run build` in `pharlux-ui/`) before `cargo build` if you want a server with a working UI.

**The world-readable JWT secret refusal lives here** (in `main.rs::ensure_jwt_secret_not_world_readable`), at the boundary where the file is first opened. Refusing in `main` keeps the policy in the entry point rather than scattered across `pharlux-auth`.

**Tests:** inline `#[cfg(test)]` modules cover each CLI subcommand against a temp data directory.

---

## `pharlux-loadtest`

**OTLP HTTP load generator.** Standalone — no path-dependency on other workspace crates.

A small binary that hammers `:4318` with synthetic OTLP metrics at a configurable rate. Used to verify the V1 throughput target (500k pts/sec on a 4 vCPU / 8 GB VPS) and to reproduce backpressure scenarios. Not shipped to end users; intended for contributors and CI.

**Tests:** none — it's an executable, exercised by running it against a Pharlux instance.

---

## `pharlux-ui` (frontend)

**React 18 + TypeScript + Vite.** Not a Cargo workspace member.

Built with `npm ci && npm run build`, which produces `pharlux-ui/dist/`. That directory is embedded into the server binary at compile time via `rust-embed` (in `pharlux-bin`). The CI build runs the frontend build before the Rust release build for that reason.

Key surfaces:

- **Pages** — `LoginPage`, `DashboardPage` (the curated "Operations" overview), `DashboardsListPage` and `DashboardEditorPage` (user-defined dashboards), `QueryPage` (CodeMirror SQL editor + result table).
- **Charting** — ECharts via `echarts-for-react`. Bar / pie / table panels.
- **Layout** — `react-grid-layout` payload shape (matches the V1 dashboards layout JSON in [`docs/user/dashboards.md`](../dashboards.md)).
- **Build** — Vite, TypeScript strict, ESLint flat config. The pre-existing `set-state-in-effect` warning in `DashboardPage.tsx` is non-blocking and tracked separately.

The frontend has no Rust tests. The end-to-end test in `pharlux-store/tests/` exercises the API surface but not the rendered UI; browser-rendering smoke tests are V1.x.

---

## Adding a new crate

Don't, unless the new code has a different fan-in shape than every existing crate. The workspace is intentionally small. The historical pattern that justified a new crate (most recently `pharlux-dashboard`) was: a self-contained store + API surface that the binary needs but whose internal types should not leak into `pharlux-common`. If your new code does not match that shape, prefer a new module in an existing crate.

If a new crate is genuinely needed:

1. Add it to `[workspace.members]` in the root `Cargo.toml`.
2. Add the SPDX header to every new `.rs` file (`// SPDX-License-Identifier: AGPL-3.0-only`).
3. Pin every dependency to an exact version. Inherit from `[workspace.dependencies]` where possible.
4. Add a row to this file's [Workspace topology](#workspace-topology) diagram and a section below.
5. Add a row to the table in [`README.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/docs/dev/README.md).
6. Run all four cargo gates (see [`testing.md`](testing.md)) before opening the PR.

---

*Last updated: 2026-05-02.*
