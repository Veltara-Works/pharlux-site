# Pharlux — Testing Guide

The practical "how to run tests locally" reference for contributors. The deeper *what* and *why* — the test tiers, the proptest invariants, the crash-recovery rationale — is in [`TEST_STRATEGY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/TEST_STRATEGY.md). This page is the runbook that complements it.

If you are about to commit code, scroll to [The four pre-commit gates](#the-four-pre-commit-gates) — that is the bar.

---

## Contents

1. [The four pre-commit gates](#the-four-pre-commit-gates)
2. [Crash recovery — the 10-run gate](#crash-recovery--the-10-run-gate)
3. [Test tiers](#test-tiers)
4. [Test infrastructure](#test-infrastructure)
5. [Frontend tests](#frontend-tests)
6. [Adding tests for new code](#adding-tests-for-new-code)
7. [What CI runs](#what-ci-runs)
8. [Common pitfalls](#common-pitfalls)
9. [Where each test tier lives](#where-each-test-tier-lives)

---

## The four pre-commit gates

These four commands must pass before you declare a task complete. They mirror what CI runs, so a green local run is a strong predictor of a green CI run. From [`CLAUDE.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/CLAUDE.md):

```bash
cargo fmt --check
cargo clippy --workspace --all-targets -- -D warnings
cargo nextest run --workspace --all-targets
cargo build --workspace --release
```

`cargo nextest run` is the test runner — not `cargo test`. Nextest runs tests in parallel processes (real isolation, not threads) and produces faster, more deterministic output. The pinned version in CI is `cargo-nextest@0.9.132`.

If you don't have nextest installed:

```bash
cargo install cargo-nextest --version 0.9.132 --locked
```

You can use `cargo test` for ad-hoc work but **the gate is nextest** — some race-sensitive tests will pass under nextest's per-test process isolation and fail under `cargo test`'s shared-process default.

### Faster iteration during development

Per-crate runs are fastest:

```bash
cargo nextest run -p pharlux-store
cargo nextest run -p pharlux-query --test crash_recovery   # specific test target
cargo nextest run -p pharlux-api -- handlers::query   # filter by name substring
```

`cargo clippy --workspace --all-targets -- -D warnings` is slow; for a single crate use `cargo clippy -p <crate> --all-targets -- -D warnings`. Run the workspace form before pushing.

---

## Crash recovery — the 10-run gate

From Phase 1 onwards, the crash-recovery test suite must pass **10 consecutive runs without a single flake**. This is a hard gate. A flaky crash test is a bug, never an acceptable characteristic — do not retry, do not `#[ignore]`, do not add sleeps.

```bash
for i in 1 2 3 4 5 6 7 8 9 10; do
  cargo nextest run --test crash_recovery || { echo "FLAKY on run $i"; exit 1; }
done
```

The crash-recovery test (`pharlux-store/tests/crash_recovery.rs`) drives a separate `wal_harness` binary via `assert_cmd`, sends 10,000 WAL records, `SIGKILL`s the process after 7,500, then replays and asserts the count is ≥ 7,500 with no corruption panics. It exercises the prost + length-prefix + CRC32 framing from [ADR-0018](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/adr/0018-wal-file-format-prost-crc32.md).

If the gate goes red, follow the procedure in [`TEST_STRATEGY.md` § When a crash test becomes flaky](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/TEST_STRATEGY.md#when-a-crash-test-becomes-flaky). The root cause is **always** one of:

- missing `fsync`,
- incorrect partial-record detection on replay,
- a race between WAL flush and rename, or
- unrelated test bleeding state via a shared tempdir.

Fix the root cause. Add a regression test that reproduces the flake deterministically. Re-run the 10-consecutive-runs gate before considering it fixed.

---

## Test tiers

### Unit tests (inline `#[cfg(test)]` modules)

Each crate tests its own logic in isolation. Use `tempfile::tempdir()` for any test that touches disk — never reuse a fixed path. Async tests use `#[tokio::test]`.

Location: `<crate>/src/**/*.rs`, inside `#[cfg(test)] mod tests { ... }` blocks.

```bash
cargo nextest run -p pharlux-common
cargo nextest run -p pharlux-auth -- jwt::         # filter by module
cargo nextest run -p pharlux-store wal::           # filter by name
```

Per-crate test counts as of V1.0.0:

| Crate | Inline tests |
| --- | --- |
| `pharlux-store` | 60+ inline (heaviest) plus 2 integration test files |
| `pharlux-api` | 38 inline (covers handlers + admin endpoints + dashboards) |
| `pharlux-auth` | 23 inline (jwt round-trip, Argon2id, db migrations) |
| `pharlux-query` | 17 inline (plan rewriter, tenant filter) |
| `pharlux-ingest` | 16 (translate, channel, tenant resolver) |
| `pharlux-dashboard` | 16 inline (CRUD, UNIQUE-violation mapping) |
| `pharlux-common` | 14 inline (config, schema, tenant) |
| `pharlux-alert` | 13 (state machine, payload builders, axum mock) |

The full workspace test count at V1.0.0 was **293 passing**. The number grows with each commit; the rule from [`DOCUMENTATION_POLICY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/DOCUMENTATION_POLICY.md) is *new code without tests does not merge*.

### Integration tests (`<crate>/tests/`)

Spin up real components against real disk and real network. Slower than unit tests (10–30s each) but the highest-value tests because they exercise the full stack end-to-end.

| Test file | What it does |
| --- | --- |
| `pharlux-bin/tests/e2e.rs` | Boots the full server binary in a tempdir, sends OTLP via HTTP to `:4318`, queries via REST on `:3100`, asserts results. The Phase 1 exit-gate end-to-end test. |
| `pharlux-store/tests/storage_integration.rs` | End-to-end ingest + query against real Parquet files in a tempdir. Exercises the WAL → Parquet flush → `TableProvider` → DataFusion path. |
| `pharlux-store/tests/crash_recovery.rs` | The 10-run gate (above). |

Run them individually:

```bash
cargo nextest run -p pharlux-bin --test e2e
cargo nextest run -p pharlux-store --test storage_integration
cargo nextest run -p pharlux-store --test crash_recovery
```

### Property-based tests

Proptest invariants — WAL round-trip, OTLP-to-Arrow round-trip, schema-evolution compatibility, timestamp policy, backpressure — are documented in [`TEST_STRATEGY.md` § Proptest invariants](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/TEST_STRATEGY.md#proptest-invariants). The proptest harness (including the `proptest-extended` feature flag) is V1.1 work and is not yet wired into this workspace. The `proptest` crate is not currently a workspace dependency. Do not invoke the feature flag yet — it does not exist.

### Race-condition tests

The WAL + Parquet union `TableProvider` (see [`crate-map.md` § pharlux-store](crate-map.md#pharlux-store)) is the highest-complexity component in the project. Targeted tests use `tokio::sync::Barrier` to synchronise flush + query at known race points and assert exact row counts. Touching this code requires a human pair-review session per [`CLAUDE.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/CLAUDE.md) — don't add or modify race tests in a solo session.

### Load tests

The `pharlux-loadtest` crate is a standalone OTLP load generator. Build it with `cargo build --release -p pharlux-loadtest`, then point it at a running server. The V1 reference target (used to validate the 500k pts/sec ceiling on a 4 vCPU / 8 GB VPS) is documented in the release notes for v1.0.0.

```bash
cargo build --release -p pharlux-loadtest
./target/release/pharlux-loadtest --points-per-sec 500000 --duration 60s --endpoint http://localhost:4318
```

---

## Test infrastructure

| Crate | Role |
| --- | --- |
| `tempfile` | Ephemeral directories — every test that touches disk. Never share a fixed path between tests. |
| `assert_cmd` | Subprocess management for crash-recovery and e2e tests (`Command::cargo_bin("pharlux")`). |
| `tokio` (test feature) | `#[tokio::test]` on async tests, `tokio::sync::Barrier` for race synchronisation. |
| `reqwest` (in tests) | HTTP client for e2e and webhook-mock tests. |
| `nextest` | The runner. CI pins `cargo-nextest@0.9.132`. |
| `wal_harness` (`pharlux-store` test bin) | Subprocess wrapper used by the crash-recovery test. Built automatically by the test target. |

Logging in tests: set `RUST_LOG=trace` (or `pharlux_store=trace`) when reproducing a flake. The default test config keeps logs quiet.

---

## Frontend tests

`pharlux-ui/` is a Vite + TypeScript project. The CI pipeline runs `npm ci && npm run build` before any cargo step (the build populates `pharlux-ui/dist/` for `rust-embed`).

There is no Rust-side browser-rendering test in V1. The pages and panels are exercised manually during development; the API surface they depend on is exercised by `pharlux-api`'s inline tests and `pharlux-bin`'s e2e test. Headless-browser smoke tests are V1.x.

Local iteration:

```bash
cd pharlux-ui
npm ci
npm run dev          # vite dev server with HMR; talks to a separately-running pharlux server
npm run build        # production build → pharlux-ui/dist
npm run lint         # eslint flat config
```

The known `set-state-in-effect` warning in `DashboardPage.tsx` is non-blocking and not in CI's lint scope. Don't introduce new warnings.

---

## Adding tests for new code

[`DOCUMENTATION_POLICY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/DOCUMENTATION_POLICY.md)'s definition-of-done says: *new tests exist for all new code (at least one unit test per new function; integration test for new public APIs)*. Apply it strictly.

Patterns that pass review:

- **New SQLite store method** → at least one inline unit test using `tempdir()` to create the db, exercising the happy path and one error path.
- **New REST endpoint** → at least one integration test in `pharlux-api/src/handlers/...`'s `#[cfg(test)]` block, plus an e2e cross-check in `pharlux-bin/tests/e2e.rs` if it touches public surface.
- **New OTLP validation rule** → a translate-time unit test in `pharlux-ingest/src/translate.rs` plus a proptest invariant if the rule is generic (timestamp bounds, body size, etc.).
- **New CLI subcommand** → an inline test in `pharlux-bin/src/main.rs` against a temp data directory (the existing `pharlux user` tests are the reference pattern).
- **New cross-tenant code path** → a test that creates two tenants and verifies the cross-tenant call returns 404, not 403.

Patterns that don't:

- **`#[ignore]` to silence flakes.** Never. Find the root cause.
- **Sleeps to "fix" timing flakes.** Never. Use barriers or explicit signals.
- **Tests that depend on external network.** Mock with an in-process axum server (the `pharlux-alert` webhook tests are the reference pattern).
- **Tests that share a fixed `/tmp/...` path between runs.** Use `tempdir()`. Always.

---

## What CI runs

[`.github/workflows/ci.yml`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/.github/workflows/ci.yml) on every PR and main-branch push. The job is named `check` and runs:

1. `npm ci && npm run build` in `pharlux-ui/` (populates `dist/` for `rust-embed`).
2. `cargo fmt --all --check`.
3. `cargo clippy --workspace --all-targets -- -D warnings`.
4. `cargo nextest run --workspace --all-targets --no-tests=pass`.
5. `cargo build --workspace --release`.

Plus the `dco` job on PRs only — verifies every commit has a `Signed-off-by:` trailer (`git commit -s` adds it automatically). Missing sign-offs block merge.

The toolchain is pinned: Rust `1.95.0`, Node `22`, `cargo-nextest@0.9.132`. CI uses `sccache` over GitHub Actions cache for warm compile caches.

The integration / nightly workflow with the 10-consecutive-runs crash-recovery gate is described in `TEST_STRATEGY.md` § CI matrix and is operator-managed (not yet wired as a separate workflow file at V1.0.0).

The musl release build runs out-of-CI on tag, via `cross build --release --target x86_64-unknown-linux-musl`. This is the path used to produce the binary attached to GitHub Releases.

---

## Common pitfalls

- **`cargo test` instead of `cargo nextest run`.** The gate is nextest. Some race-sensitive tests pass under nextest's per-test process isolation and fail under `cargo test`. Always use nextest before pushing.
- **Forgetting to build the frontend.** `cargo build --release` in `pharlux-bin` will fail with `rust-embed` error if `pharlux-ui/dist/` is missing or empty. Run `npm ci && npm run build` in `pharlux-ui/` first.
- **Shared `/tmp/pharlux-test/...` path between tests.** Two test processes running in parallel under nextest will collide. Use `tempfile::tempdir()` for everything.
- **Forgetting the SPDX header.** Every new `.rs` file needs `// SPDX-License-Identifier: AGPL-3.0-only` at the top. Clippy doesn't enforce this; reviewers do.
- **Forgetting `git commit -s`.** The DCO check fails the PR. Easiest fix: re-do the commit with `-s`.
- **Using `RUST_LOG=trace` and missing the actual error in the noise.** Filter narrowly: `RUST_LOG=pharlux_store=trace,info`.
- **Adding a new dep to satisfy a test.** Don't. Every dep needs a `VERSIONS.md` entry and human approval. Use what's already pinned, or escalate.

---

## Where each test tier lives

| Tier | Location | Run with |
| --- | --- | --- |
| Unit (inline) | `<crate>/src/**/*.rs` (`#[cfg(test)]`) | `cargo nextest run -p <crate>` |
| Integration (e2e binary) | `pharlux-bin/tests/e2e.rs` | `cargo nextest run -p pharlux-bin --test e2e` |
| Integration (storage) | `pharlux-store/tests/storage_integration.rs` | `cargo nextest run -p pharlux-store --test storage_integration` |
| Crash recovery | `pharlux-store/tests/crash_recovery.rs` | `cargo nextest run --test crash_recovery` (×10 for the gate) |
| Load | `pharlux-loadtest/` (binary crate) | `cargo run --release -p pharlux-loadtest -- ...` |
| Frontend | `pharlux-ui/` (Vite + TS) | `npm run lint`, `npm run build` |

For the rationale and invariants behind each tier, see [`TEST_STRATEGY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.0.0/TEST_STRATEGY.md). For the per-crate breakdown of where tests are concentrated, see [`crate-map.md`](crate-map.md).

---

*Last updated: 2026-05-02.*
