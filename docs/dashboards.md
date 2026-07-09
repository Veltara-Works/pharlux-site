# Dashboards

Pharlux V1 ships a user-defined dashboards system: tenant-scoped collections of SQL-backed panels, persisted server-side, manageable via the REST API or the bundled web UI, exportable as JSON for Git storage.

This guide covers the dashboards model, the panel types, the UI editor, the JSON export/import format for Git-versioned dashboards, and the multi-tenancy and authentication semantics.

> The bundled web UI is the **Clarity console**: a fixed set of operational screens — Overview, Explore (SQL), Metrics, Logs, Alerts, Settings — in the sidebar, plus your own dashboards under **Manage**. The console has a light/dark theme (dark by default), remembered per device. This guide covers the user-built **Dashboards**; the other screens are read-only views over the same query and admin APIs.

## Quick start

The fastest path is the web UI: open Pharlux, log in, and click **Dashboards** in the sidebar (under **Manage**). Click **New dashboard**, give it a name, and you land in the editor. The starter layout has a time-series panel (metric volume over time) alongside a bar-chart panel of top metric counts and a stat KPI of metric points per 5 minutes, plus a **Host** filter at the top that scopes the panels to selected hosts — change the SQL, click **Save**, and you have a working dashboard. See [Dashboard variables](#dashboard-variables) for how the filter works.

Via the API:

```bash
# Create
curl -s -X POST http://localhost:3100/api/v1/dashboards \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "name": "Errors overview",
    "description": "Top error sources and recent log lines",
    "layout_json": {
      "version": 1,
      "panels": [
        {
          "id": "p1",
          "type": "bar",
          "title": "Top error sources",
          "sql": "SELECT service.name AS svc, count(*) AS n FROM logs WHERE severity_text = '\''ERROR'\'' GROUP BY svc ORDER BY n DESC LIMIT 10",
          "x": 0, "y": 0, "w": 6, "h": 4
        }
      ]
    }
  }'

# List
curl -s http://localhost:3100/api/v1/dashboards \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Export (Git-portable JSON)
curl -s http://localhost:3100/api/v1/dashboards/$ID/export \
  -H "Authorization: Bearer $ADMIN_TOKEN" > errors-overview.dashboard.json
```

## How dashboards work

A dashboard is three things on the wire: a `name`, a `description`, and a `layout_json` payload. The `layout_json` is opaque structured JSON — the engine never parses or validates it, so the format can evolve without server changes. The bundled UI defines a V1 layout shape (below); third-party UIs can use their own.

Each dashboard has provenance fields the server fills in automatically: `id` (UUIDv7, server-generated), `tenant_id` (taken from the JWT, never the request body), `created_by` (user id of the creator), and `created_at` / `updated_at` timestamps (RFC-3339 UTC).

`(tenant_id, name)` is unique. Creating a second dashboard with a name that already exists in the tenant returns `409 conflict`. Renaming via `PUT` to an existing name does the same. Different tenants can use the same dashboard name.

## V1 layout JSON shape

The bundled web UI uses this layout format. The `version` field reserves room for future shapes; keep it at `1` for V1.

```json
{
  "version": 1,
  "panels": [
    {
      "id": "p1",
      "type": "bar",
      "title": "Top metrics by count",
      "sql": "SELECT name, count(*) AS cnt FROM metrics GROUP BY name ORDER BY cnt DESC LIMIT 10",
      "x": 0, "y": 0, "w": 6, "h": 4
    },
    {
      "id": "p2",
      "type": "pie",
      "title": "Log severity distribution",
      "sql": "SELECT severity_text, count(*) AS n FROM logs GROUP BY severity_text",
      "x": 6, "y": 0, "w": 6, "h": 4
    }
  ]
}
```

Panel fields:

| Field   | Type   | Meaning |
|---------|--------|---------|
| `id`    | string | Unique within the dashboard. Used by the UI for keying. |
| `type`  | string | `"bar"`, `"pie"`, `"table"`, `"timeseries"`, or `"stat"`. |
| `title` | string | Header shown above the panel. |
| `sql`   | string | SQL query. The same SQL surface as `/api/v1/query` — see [`sql-query-reference.md`](sql-query-reference.md). Tenant-scoped automatically. May reference dashboard [variables](#dashboard-variables) as `$name`. |
| `x`     | int    | Column origin on a 12-column grid (0–11). |
| `y`     | int    | Row origin (any non-negative integer). |
| `w`     | int    | Column span (1–12). Panels with `w=6` take half the row; `w=12` is full-width. |
| `h`     | int    | Row span. Each unit is roughly 60 px tall in the V1 UI. |
| `area`  | bool   | `timeseries` only (optional): render a filled area chart instead of a line. |
| `unit`  | string | `stat` only (optional): suffix shown after the big number (e.g. `"pts"`, `"ms"`). |
| `thresholds` | array | `stat` only (optional): ascending `{ "value": n, "color": "green"\|"amber"\|"red" }` entries; the highest one whose `value` is ≤ the current value colours the number. |

`x/y/w/h` match react-grid-layout's default `cols: 12` convention. The V1 UI renders the grid statically (CSS Grid, sorted by `(y, x)`); a future drag-drop editor (V1.x) can read the same payload.

Chart conventions:

- **`bar`** — column 0 of the result is the category axis, column 1 is the value. Other columns are ignored.
- **`pie`** — same convention; column 0 is the slice name, column 1 is the slice value.
- **`table`** — every column is rendered as a column. No truncation; if the table is wider than the panel, it scrolls horizontally inside the panel.
- **`timeseries`** — column 0 is the time bucket (x-axis), produced with `date_bin()`. For multiple lines, column 1 is the series key and column 2 is the value; for a single line, column 1 is the value. Lines are smooth and share one time axis; a legend appears when there is more than one series. Set `"area": true` for a filled area chart. Example:

  ```sql
  SELECT date_bin(INTERVAL '1 minute', timestamp) AS bucket,
         resource['host.name'] AS series, avg(value) AS value
  FROM metrics GROUP BY bucket, series ORDER BY bucket
  ```

- **`stat`** — a single-value KPI. Column 1 is the value (column 0 if the query returns only one column). A scalar query (one row) shows just the big number; a time-bucketed query (many rows, same shape as a single-series `timeseries`) shows the **last** value big, a **sparkline** of the whole series, and the **delta** versus the first bucket. Set `"unit"` to suffix the number and `"thresholds"` to colour it. Example:

  ```sql
  SELECT date_bin(INTERVAL '5 minutes', timestamp) AS bucket,
         count(*) AS value
  FROM metrics GROUP BY bucket ORDER BY bucket
  ```

  ```json
  { "type": "stat", "title": "Metric points / 5 min", "unit": "pts",
    "thresholds": [ { "value": 0, "color": "green" },
                    { "value": 5000, "color": "amber" } ],
    "sql": "…", "x": 0, "y": 0, "w": 4, "h": 3 }
  ```

## Dashboard variables

Variables are dashboard-level filters that you set once at the top of the page and have apply to every panel. The canonical use is a **host filter**: pick one or more hosts from a dropdown and every panel re-queries scoped to that selection. They are an optional top-level `variables` array in the layout JSON, alongside `panels`.

```json
{
  "version": 1,
  "variables": [
    {
      "name": "hosts",
      "label": "Host",
      "type": "query",
      "query": "SELECT DISTINCT resource['host.name'] AS host FROM metrics WHERE resource['host.name'] IS NOT NULL ORDER BY host LIMIT 100",
      "multi": true,
      "includeAll": true
    }
  ],
  "panels": [
    {
      "id": "p1",
      "type": "timeseries",
      "title": "Metric volume by host",
      "sql": "SELECT date_bin(INTERVAL '1 minute', timestamp) AS bucket, resource['host.name'] AS series, count(*) AS value FROM metrics WHERE resource['host.name'] IN ($hosts) GROUP BY bucket, series ORDER BY bucket LIMIT 500",
      "x": 0, "y": 0, "w": 12, "h": 5
    }
  ]
}
```

Variable fields:

| Field        | Type    | Meaning |
|--------------|---------|---------|
| `name`       | string  | Variable name, referenced in panel SQL as `$name` or `${name}`. Must be a SQL-identifier token (`[A-Za-z_][A-Za-z0-9_]*`). A malformed name is ignored. |
| `label`      | string  | Optional UI label for the control; defaults to `name`. |
| `type`       | string  | `"query"` — options come from column 0 of a SQL query; `"custom"` — options come from a static `options` list. |
| `query`      | string  | `type:"query"` only: SQL returning the option values in column 0. Runs against the same tenant-scoped surface as a panel. |
| `options`    | array   | `type:"custom"` only: a static list of string option values. |
| `multi`      | bool    | Allow selecting multiple values. Default `true`. A single-select variable substitutes one value. |
| `includeAll` | bool    | Offer an "All" choice that selects every option. Default `true` when `multi`. |

### How substitution works

Before each panel query runs, the UI replaces `$name` (or `${name}`) with the current selection rendered as a **comma-separated list of quoted SQL string literals, without surrounding parentheses**. You supply the SQL context:

- **Multi-select** (the usual case) — write an `IN (…)` clause and put the variable inside the parentheses:

  ```sql
  WHERE resource['host.name'] IN ($hosts)      -- becomes  IN ('mx1', 'web2')
  ```

- **Single-select** (`"multi": false`) — compare directly:

  ```sql
  WHERE resource['env'] = $env                 -- becomes  = 'prod'
  ```

A dashboard opens with every option selected for a multi variable (so it shows the whole fleet) and the first option for a single one. Choosing **All** expands to every option. If the selection is empty — because you deselected everything, or the option query returned no rows — the variable substitutes `NULL`, which keeps the SQL valid (`IN (NULL)` / `= NULL`) and correctly matches nothing.

Panels wait for the variables to load before they run, so a panel never executes with an unresolved `$name`. A panel whose SQL doesn't reference any variable is unaffected and runs once.

> **Security.** Substitution is injection-safe by construction: the values you can pick are allowlisted to the variable's own option set, every value is emitted as a single-quote-escaped string literal (`'` → `''`), and the variable name itself is never spliced into the SQL — only its selected values are. Substitution happens in the browser, so the server only ever sees ordinary, fully-formed SQL on `/api/v1/query`.

Variables round-trip through export/import like the rest of the layout, so a host-filtered dashboard is portable across deployments (the option query re-runs against the target's own data).

## Global time range and auto-refresh

A dashboard has a single **time range** and an **auto-refresh** control in its header, shared by every panel (V1.1). The time range is applied to panel SQL through two reserved tokens:

- `$__timeFrom` — the start of the selected window
- `$__timeTo` — the end of the selected window (now, for the relative presets)

Reference them in a panel's `WHERE` clause exactly where you'd write a timestamp bound. Because Pharlux stores telemetry in per-hour partitions, a time predicate also lets the engine prune partitions, so a tighter range is a faster query:

```sql
SELECT date_bin(INTERVAL '1 minute', timestamp) AS bucket, count(*) AS value
FROM metrics
WHERE timestamp > $__timeFrom AND timestamp <= $__timeTo
GROUP BY bucket ORDER BY bucket
```

The picker offers four relative presets — **Last 15 minutes / 1 hour / 2 hours / 24 hours** — and a **Custom…** option with start/end pickers for an absolute window. A relative preset resolves `$__timeFrom` to `now() - INTERVAL '…'` and `$__timeTo` to `now()`; a custom window resolves both to `TIMESTAMP` literals.

**Auto-refresh** re-runs every panel on a fixed interval — **Off / 10s / 30s / 1m / 5m**. `Off` is the default; the manual **Refresh** button works regardless.

### Saved default vs. session override

Both controls have a **saved default** that lives in the layout JSON, plus a **session override**: whatever a viewer picks in the header applies to their view only and does **not** change the saved dashboard. Set the default with two optional top-level keys, alongside `panels` and `variables`:

```json
{
  "version": 1,
  "timeRange": { "kind": "preset", "preset": "1h" },
  "refresh": "30s",
  "panels": [ ... ]
}
```

- `timeRange`: either `{ "kind": "preset", "preset": "15m" | "1h" | "2h" | "24h" }` or `{ "kind": "custom", "from": "<ISO-8601>", "to": "<ISO-8601>" }`.
- `refresh`: one of `"off"` (default), `"10s"`, `"30s"`, `"1m"`, or `"5m"`.

Both keys are optional — omit them and the dashboard opens on **Last 1 hour** with auto-refresh **Off**. A panel that doesn't reference `$__timeFrom`/`$__timeTo` simply ignores the range (it isn't force-filtered), so mixing time-scoped and all-time panels on one dashboard is fine. The keys round-trip through export/import with the rest of the layout.

> **Security.** Like variable substitution, the time bounds are injection-safe by construction. A preset resolves to a fixed `now() - INTERVAL '…'` expression built from a closed allowlist — no user text is involved. A custom bound is accepted only if it is a well-formed ISO-8601 timestamp; it is emitted as a canonical `TIMESTAMP '…'` literal, and anything that isn't a valid instant is refused rather than passed through. Resolution happens in the browser, so the server still only ever sees ordinary, fully-formed SQL on `/api/v1/query`.

## The web UI editor

The editor is at `/dashboards/:id`. It has three editable fields (name, description, layout JSON) and a live preview pane. The time-range and auto-refresh controls appear above the preview — seeded from the layout's saved defaults — and, when the layout defines variables, so does the filter bar, so you can test a selection and a window while authoring.

The layout JSON box is a CodeMirror editor with line numbers and bracket matching. As you type valid JSON, the preview pane re-runs each panel's SQL and renders the result. If the JSON is invalid, the preview keeps the last valid render and a yellow banner above the editor shows the parse error. Save is disabled while the JSON is invalid, so you can't write a broken dashboard.

`Save` writes to the API (`PUT /api/v1/dashboards/:id`); the response replaces the local state with the server's canonical version, so timestamps and provenance stay accurate. `Export` downloads a JSON file named `<sanitised-name>.dashboard.json` containing the export shape (no id, no tenant, no timestamps) — see "Git-versioned dashboards" below.

The list page at `/dashboards` shows all dashboards in the current tenant as cards. The `Import` button accepts the export shape and creates a new dashboard with a fresh id. Cross-tenant import is implicit: import always uses the importing user's tenant, regardless of where the file came from.

## Git-versioned dashboards

The export endpoint emits a deliberately-minimal JSON shape so dashboards round-trip cleanly through version control:

```json
{
  "name": "Errors overview",
  "description": "Top error sources and recent log lines",
  "layout_json": {"version": 1, "panels": [...]}
}
```

The omitted fields are recreated on import: `id` is freshly minted, `tenant_id` and `created_by` come from the importing JWT, and timestamps are stamped at import time. This means an exported file is portable across deployments — pull it down via `gh release`, hand it to a colleague over chat, commit it to a repo — and `import` always works the same way.

A typical workflow:

```bash
# Author + tweak in the UI, then export to a git-tracked directory:
mkdir -p dashboards/
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3100/api/v1/dashboards/$ID/export \
  > dashboards/errors-overview.dashboard.json
git add dashboards/
git commit -m "Add errors-overview dashboard"

# A teammate pulls and re-creates the dashboard in their environment:
curl -s -X POST http://localhost:3100/api/v1/dashboards/import \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  --data @dashboards/errors-overview.dashboard.json
```

There is no "update by export" — re-importing a previously-exported dashboard creates a new one with a fresh id. To version a dashboard in place, edit it via `PUT /api/v1/dashboards/:id` (or use the UI Save button) and check the file in. The import endpoint is for moving dashboards across deployments, not for incremental edits.

## Authentication and authorization

V1 RBAC: **admin-only across all seven endpoints**. Read-only users get 403 on every dashboards endpoint, including `GET /api/v1/dashboards`. This is the same posture as `/api/v1/admin/users` and `/api/v1/admin/alerts`.

[ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/adr/0010-auth-jwt-argon2id.md) calls out that V1 ships a coarse role model and the SQLite schema supports finer-grained RBAC for V1.2. The dashboards table captures `created_by` on every record so the V1.2 split between owner and non-owner reads needs no migration.

The web UI does not currently surface dashboards to read-only users. If you need a read-only viewer, log in as admin or wait for the V1.2 RBAC enrichment.

## Multi-tenancy

Every dashboard belongs to exactly one tenant. The tenant id comes from the JWT, never the request body — admins cannot create dashboards in tenants they don't belong to. Cross-tenant access (any operation on a dashboard id that exists in a different tenant) returns `404 not found`, the same status as a missing id, so the response cannot be used to enumerate ids in other tenants.

Same name in different tenants is fine: a `default` tenant and a `staging` tenant can both have a dashboard called `Errors overview`, with completely independent contents. The UNIQUE constraint is on `(tenant_id, name)`, not name alone.

The community deployment uses the constant `"default"` tenant — single-tenant operators see no functional difference between their dashboards and the multi-tenant case.

## V1 limitations

Things the V1 dashboards system does not have yet, with the V1.x or V1.2 line they belong on:

- **Drag-drop layout editing** — V1 renders the grid from `x/y/w/h` statically. Operators edit the JSON directly. The data model already matches react-grid-layout, so a V1.x drag-drop editor can read the same payload.
- **Read-only access for non-admin users** — V1 is admin-only; V1.2 RBAC enrichment lifts this.
- **Panel type extensibility** — V1 ships bar, pie, and table; V1.1 adds time-series (line/area) and stat (single-value KPI with sparkline). Heatmap and other types remain V1.x.
- **Per-panel time ranges** — the time range is dashboard-global (V1.1 adds the shared range + auto-refresh); a panel that wants a different window sets its own bound in SQL. Independent per-panel range pickers are V1.x.
- **Panel-level options** — colours, axis formatting, legends are V1's defaults. Panel-level overrides via additional layout-JSON fields are V1.x and forward-compatible (unknown fields are preserved on round-trip).
- **Storage unification** — dashboards live in `dashboards.db`, alongside `auth.db` and `alerts.db`. The unified `meta.sqlite` from [`spec/file-layout.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/spec/file-layout.md) is V1.x cleanup.

## Storage and lifecycle

Dashboards are persisted in `dashboards.db` (SQLite, in the configured `data_dir`). The schema is created automatically on first startup. Backups follow the [`backup-restore.md`](backup-restore.md) procedure — `dashboards.db` is captured by the same data-directory snapshot as the WAL and Parquet files.

Deleting a dashboard is permanent — there is no soft-delete or trash in V1. Use `Export` first if you want a copy. The export file plus a fresh `import` is the recovery path.

## Reference

- [API surface §1.5](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/spec/api-surface.md) — the seven endpoints, request/response shapes, and the export format.
- [`sql-query-reference.md`](sql-query-reference.md) — the SQL surface available to panel queries.
- [`auth.md`](auth.md) — admin tokens, the V1 two-role model.
- [ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/adr/0010-auth-jwt-argon2id.md) — V1 RBAC scope and V1.2 commitments.
