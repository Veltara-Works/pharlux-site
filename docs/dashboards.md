# Dashboards

Pharlux V1 ships a user-defined dashboards system: tenant-scoped collections of SQL-backed panels, persisted server-side, manageable via the REST API or the bundled web UI, exportable as JSON for Git storage.

This guide covers the dashboards model, the panel types, the UI editor, the JSON export/import format for Git-versioned dashboards, and the multi-tenancy and authentication semantics.

## Quick start

The fastest path is the web UI: open Pharlux, log in, and click **Dashboards** in the top nav. Click **New dashboard**, give it a name, and you land in the editor. The starter layout has one bar-chart panel showing top metric counts — change the SQL, click **Save**, and you have a working dashboard.

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
| `type`  | string | `"bar"`, `"pie"`, or `"table"`. |
| `title` | string | Header shown above the panel. |
| `sql`   | string | SQL query. The same SQL surface as `/api/v1/query` — see [`sql-query-reference.md`](sql-query-reference.md). Tenant-scoped automatically. |
| `x`     | int    | Column origin on a 12-column grid (0–11). |
| `y`     | int    | Row origin (any non-negative integer). |
| `w`     | int    | Column span (1–12). Panels with `w=6` take half the row; `w=12` is full-width. |
| `h`     | int    | Row span. Each unit is roughly 60 px tall in the V1 UI. |

`x/y/w/h` match react-grid-layout's default `cols: 12` convention. The V1 UI renders the grid statically (CSS Grid, sorted by `(y, x)`); a future drag-drop editor (V1.x) can read the same payload.

Chart conventions:

- **`bar`** — column 0 of the result is the category axis, column 1 is the value. Other columns are ignored.
- **`pie`** — same convention; column 0 is the slice name, column 1 is the slice value.
- **`table`** — every column is rendered as a column. No truncation; if the table is wider than the panel, it scrolls horizontally inside the panel.

## The web UI editor

The editor is at `/dashboards/:id`. It has three editable fields (name, description, layout JSON) and a live preview pane.

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

[ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/adr/0010-auth-jwt-argon2id.md) calls out that V1 ships a coarse role model and the SQLite schema supports finer-grained RBAC for V1.2. The dashboards table captures `created_by` on every record so the V1.2 split between owner and non-owner reads needs no migration.

The web UI does not currently surface dashboards to read-only users. If you need a read-only viewer, log in as admin or wait for the V1.2 RBAC enrichment.

## Multi-tenancy

Every dashboard belongs to exactly one tenant. The tenant id comes from the JWT, never the request body — admins cannot create dashboards in tenants they don't belong to. Cross-tenant access (any operation on a dashboard id that exists in a different tenant) returns `404 not found`, the same status as a missing id, so the response cannot be used to enumerate ids in other tenants.

Same name in different tenants is fine: a `default` tenant and a `staging` tenant can both have a dashboard called `Errors overview`, with completely independent contents. The UNIQUE constraint is on `(tenant_id, name)`, not name alone.

The community deployment uses the constant `"default"` tenant — single-tenant operators see no functional difference between their dashboards and the multi-tenant case.

## V1 limitations

Things the V1 dashboards system does not have yet, with the V1.x or V1.2 line they belong on:

- **Drag-drop layout editing** — V1 renders the grid from `x/y/w/h` statically. Operators edit the JSON directly. The data model already matches react-grid-layout, so a V1.x drag-drop editor can read the same payload.
- **Read-only access for non-admin users** — V1 is admin-only; V1.2 RBAC enrichment lifts this.
- **Panel type extensibility** — V1 ships bar, pie, and table. Adding line/area/heatmap/sparkline is V1.x.
- **Auto-refresh** — V1 panels run their SQL once when the dashboard loads (and re-run on layout-JSON changes in the editor preview). A configurable refresh interval is V1.1.
- **Panel-level options** — colours, axis formatting, legends are V1's defaults. Panel-level overrides via additional layout-JSON fields are V1.x and forward-compatible (unknown fields are preserved on round-trip).
- **Storage unification** — dashboards live in `dashboards.db`, alongside `auth.db` and `alerts.db`. The unified `meta.sqlite` from [`spec/file-layout.md`](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/spec/file-layout.md) is V1.x cleanup.

## Storage and lifecycle

Dashboards are persisted in `dashboards.db` (SQLite, in the configured `data_dir`). The schema is created automatically on first startup. Backups follow the [`backup-restore.md`](backup-restore.md) procedure — `dashboards.db` is captured by the same data-directory snapshot as the WAL and Parquet files.

Deleting a dashboard is permanent — there is no soft-delete or trash in V1. Use `Export` first if you want a copy. The export file plus a fresh `import` is the recovery path.

## Reference

- [API surface §1.5](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/spec/api-surface.md) — the seven endpoints, request/response shapes, and the export format.
- [`sql-query-reference.md`](sql-query-reference.md) — the SQL surface available to panel queries.
- [`auth.md`](auth.md) — admin tokens, the V1 two-role model.
- [ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.1.0/adr/0010-auth-jwt-argon2id.md) — V1 RBAC scope and V1.2 commitments.
