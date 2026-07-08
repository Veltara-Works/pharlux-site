# Authentication and Authorization

Pharlux V1 ships a built-in JWT-based authentication system with a two-role model — `admin` and `reader` — backed by Argon2id password hashing in an embedded SQLite database. There is no external identity provider in V1; OIDC/SAML/LDAP are deferred to later versions.

This page is the operator's guide to setting it up, creating users, rotating secrets, and using the resulting tokens against the REST API. The threat model and trust boundaries are in [`../../SECURITY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/SECURITY.md), and the design rationale is in [ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/adr/0010-auth-jwt-argon2id.md).

## The two-role model

| Role | What they can do | What they cannot do |
| --- | --- | --- |
| **`admin`** | Full SQL surface against `/api/v1/query` (read and any DataFusion-supported write); manage users via `/api/v1/admin/users`; manage tenants via `/api/v1/admin/tenants`; receive a token where the JWT claim `pharlux.admin` is `true`. | — |
| **`reader`** (non-admin) | `SELECT`, `EXPLAIN`, `SHOW`, `DESCRIBE`, and `WITH ... SELECT` queries against `/api/v1/query`, scoped to their own tenant. View `/api/v1/health` and `/api/v1/auth/login`. | Any other SQL statement type — `INSERT`, `UPDATE`, `DELETE`, `MERGE`, `CREATE`, `DROP`, `ALTER`, `ATTACH`, `DETACH`, `TRUNCATE`, `COPY`, `REPLACE`, `GRANT`, `REVOKE`, `PRAGMA`, `SET`, plus any unrecognised verb — is rejected with HTTP 403 at the API layer. Cannot reach any `/api/v1/admin/*` endpoint. Cannot see or affect data in other tenants. |

The role is encoded in the JWT itself (the `pharlux.admin` boolean claim) and cannot be changed without re-issuing the token. Resource-level RBAC is planned — see [Known V1 limitations](#known-v1-limitations) below.

## Quick start

A fresh Pharlux install has zero users. The bootstrap admin is created via the CLI on the host (the operator-trust path); subsequent users are created via the API by an existing admin.

```bash
# 1. Create the bootstrap admin on the host. Stop the service first
#    if it's already running, to avoid SQLite write contention.
sudo systemctl stop pharlux
sudo pharlux user add \
  --username alice \
  --password 'your-strong-password' \
  --admin
sudo systemctl start pharlux

# 2. Log in to get a JWT.
TOKEN=$(curl -s -X POST http://localhost:3100/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"alice","password":"your-strong-password"}' | jq -r .token)

# 3. Use the token on subsequent requests.
curl -s -X POST http://localhost:3100/api/v1/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"sql":"SELECT count(*) FROM metrics"}'
```

The token's TTL is 1 hour by default (`token_ttl_seconds` in `pharlux.toml`); after that, log in again.

> **`--password` and shell history.** The `--password` flag is visible in shell history and `ps` output while the command runs. For interactive use, prefer reading the password into a variable first:
>
> ```bash
> read -rs PW
> sudo pharlux user add --username alice --admin --password "$PW"
> unset PW
> ```

## JWT token details

Pharlux issues HS256-signed JWTs. The claims are:

| Claim | Type | Description |
| --- | --- | --- |
| `sub` | string | User ID (UUIDv7). |
| `pharlux.tenant_id` | string | The tenant this token is bound to. Every query is automatically filtered to this tenant. |
| `pharlux.admin` | bool | Whether this user holds the admin role. |
| `iat` | int | Issued-at timestamp (Unix epoch seconds). |
| `exp` | int | Expiration timestamp (Unix epoch seconds). The `exp` claim is **required** — tokens missing it are rejected. |

Verification uses zero leeway: a token whose `exp` has passed by even 1 second is rejected.

Pharlux does **not** issue refresh tokens in V1 — operators authenticate again to receive a new access token. Token revocation before `exp` requires rotating the JWT signing secret (which invalidates every active token). For short revocation windows, keep `token_ttl_seconds` short (e.g. 900 for 15 minutes).

## The `pharlux user` CLI (operator-trust path)

The `pharlux user` subcommand is the host-side tool for bootstrapping the first admin and for rescue scenarios where the API is unreachable (forgotten admin password, all admins deleted, etc.). It works directly against the SQLite `auth.db` file using the same Argon2id parameters from `[auth].argon2_*` that the API path uses.

```text
pharlux user add --username <U> --password <P> [--tenant <T>] [--admin]
pharlux user list [--tenant <T>]
pharlux user delete --user-id <ID>
pharlux user reset-password --username <U> --password <P>
pharlux user help
```

| Subcommand | Use case |
| --- | --- |
| `add` | Bootstrap the first admin; add additional users out-of-band (e.g. when scripting an install). |
| `list` | See all users on the host (across tenants, or filtered by `--tenant`). |
| `delete` | Remove a user without going through the API — useful in rescue scenarios. |
| `reset-password` | Forgot-the-admin-password rescue. Looks up by `--username` and rewrites the password hash. |

**Recommendation:** stop the service before mutating users via the CLI — `auth.db` is open by the running service and SQLite writes from two processes can contend. Day-to-day user management once an admin exists should go through `POST /api/v1/admin/users` (next section).

## Creating users via the API

Once you have an admin token (from logging in as the bootstrap admin), the day-to-day path is the REST API.

### Add a user

`POST /api/v1/admin/users`:

```bash
curl -s -X POST http://localhost:3100/api/v1/admin/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{
    "username": "bob",
    "password": "bob-strong-password",
    "admin": false
  }'
```

The `tenant_id` is taken from the calling admin's JWT — you cannot create a user in a different tenant. Set `"admin": true` to create another admin user in the same tenant; set `"admin": false` for a read-only user.

Response (`201 Created`):

```json
{
  "user_id": "01938a6c-...",
  "username": "bob",
  "tenant_id": "default",
  "admin": false
}
```

A `400 Bad Request` is returned if the username already exists in the database (the `users.username` column is globally unique).

### List users

`GET /api/v1/admin/users` returns the users in the calling admin's tenant only:

```json
{
  "users": [
    {
      "id": "01938a6b-...",
      "username": "alice",
      "tenant_id": "default",
      "admin": true,
      "created_at": 1700000000
    },
    {
      "id": "01938a6c-...",
      "username": "bob",
      "tenant_id": "default",
      "admin": false,
      "created_at": 1700000060
    }
  ]
}
```

### Delete a user

`DELETE /api/v1/admin/users/{user_id}` removes the user. The endpoint is tenant-scoped: deleting a user that belongs to a different tenant returns `404 Not Found` (the API does not distinguish "wrong tenant" from "doesn't exist", to avoid leaking cross-tenant existence). An admin cannot delete their own user — that returns `400 Bad Request` to prevent self-lockout.

```bash
curl -s -X DELETE http://localhost:3100/api/v1/admin/users/01938a6c-... \
  -H "Authorization: Bearer $ADMIN_TOKEN"
# 204 No Content
```

The deleted user's existing JWTs remain valid until their `exp` passes. To revoke immediately, rotate the JWT signing secret (see below).

## Multi-tenancy and `POST /api/v1/admin/tenants`

In V1, a tenant exists implicitly when a user has that `tenant_id` — there is no separate "tenants" table. Two endpoints touch tenant scope explicitly:

- **`POST /api/v1/admin/tenants`** (admin-only) — creates a tenant by inserting one user record with `admin: true`. Useful when an admin wants to provision a new tenant in a multi-tenant deployment.
- **`GET /api/v1/admin/tenants`** (admin-only) — lists tenants visible to the caller (currently inferred from the users table).

Note that for a fresh install, **`POST /api/v1/admin/tenants` is not the bootstrap path** — it requires an existing admin token. Use `pharlux user add --admin` to create the first admin.

## JWT signing secret

Pharlux signs and verifies tokens with a single shared secret stored in a file referenced by `[auth].jwt_secret_file` in `pharlux.toml`. Default path: `/etc/pharlux/jwt.secret`.

### Install-time layout

`pharlux install` creates the secret as 64 random bytes at mode `0640`, owned by `root:nogroup`. The generated systemd unit uses `DynamicUser=yes` plus `SupplementaryGroups=nogroup`, which puts the transient service UID in group `nogroup` at runtime — that's what grants it group-read access to the secret. (systemd does not chown files inside `ConfigurationDirectory=` under `DynamicUser=yes`; the `nogroup` membership is the supported way to bridge the dynamic UID to a root-owned secret.) `/etc/pharlux/` itself is mode `0755` — the only file inside that needs protection is `jwt.secret`, and that one is locked at `0640 root:nogroup`. `pharlux.toml` is mode `0644` (the default config has no secrets — operators who put secrets directly in `pharlux.toml` should `chmod 0640` and `chown root:nogroup` it themselves). There is no static `pharlux` host user — `useradd`/`groupadd` are not needed.

### Dev-mode auto-generation

If Pharlux starts and the `jwt_secret_file` does not exist, it generates a 64-byte random secret and locks the file to mode `0600` immediately. A warning is logged so operators know the secret was created, not pre-provisioned.

### World-readable check

Pharlux **refuses to start** if the secret file is world-readable (any mode bit `0o004` set). The error message names the actual mode found and points at two acceptable fixes — `chmod 0640` (the install-time DynamicUser layout) or `chmod 0600` (owner-only):

```
JWT secret at /etc/pharlux/jwt.secret is world-readable (mode 0644).
Refusing to start. Tighten the permissions (e.g. `chmod 0640
/etc/pharlux/jwt.secret` for the install-time DynamicUser layout, or
`chmod 0600 /etc/pharlux/jwt.secret` for owner-only) and restart.
```

### Rotation procedure

JWT secret rotation in V1 is a manual operator action and invalidates every active token (an intentional simplification — see ADR-0010). Sequence:

```bash
# 1. Stop the service.
sudo systemctl stop pharlux

# 2. Generate a fresh 64-byte secret with the same permissions as the
#    install-time layout.
sudo head -c 64 /dev/urandom | sudo tee /etc/pharlux/jwt.secret > /dev/null
sudo chmod 0640 /etc/pharlux/jwt.secret
sudo chown root:nogroup /etc/pharlux/jwt.secret

# 3. Restart. Existing tokens become invalid; users must log in again.
sudo systemctl start pharlux
```

If you only need to rotate occasionally (e.g. employee offboarding), keeping `token_ttl_seconds` short means the operational impact of a forced rotation is bounded — the same revocation outcome arrives naturally as tokens expire, without invalidating everyone at once.

### Forgot-the-admin-password rescue

If every admin's password is lost or forgotten, you cannot log in to use `POST /api/v1/admin/users`. Use `pharlux user reset-password` instead:

```bash
sudo systemctl stop pharlux
sudo pharlux user reset-password --username alice --password 'new-strong-password'
sudo systemctl start pharlux
```

`pharlux user list` (without `--tenant`) shows all usernames if you can't remember which one is the admin.

## Password hashing (Argon2id)

Pharlux hashes passwords with Argon2id via the [`argon2`](https://crates.io/crates/argon2) RustCrypto implementation (ADR-0010). The defaults are tuned to the OWASP 2023 baseline and are safe for V1 release on modern hardware:

| Parameter | Default | `pharlux.toml` key | Meaning |
| --- | --- | --- | --- |
| Memory cost | **19,456 KiB (19 MiB)** | `[auth].argon2_memory_kb` | Memory required per hash. The OWASP minimum. |
| Time cost | **2** | `[auth].argon2_time_cost` | Iterations. |
| Parallelism | **1** | `[auth].argon2_parallelism` | Threads. |

These parameters apply to every code path that hashes a new password — `pharlux user add`, `pharlux user reset-password`, `POST /api/v1/admin/tenants`, and `POST /api/v1/admin/users` all pull from `[auth].argon2_*` at runtime. Existing password hashes are stored with the parameters that were active when they were created and are verified against those (Argon2id stores its parameters in the hash itself).

A login takes roughly 100 ms on commodity x86_64 hardware with the defaults. If your hardware is much slower, raise `argon2_time_cost` rather than lowering `argon2_memory_kb` — memory hardness is the property that makes Argon2id resistant to GPU attacks.

Changing the defaults requires an ADR-level decision (see [ADR-0010](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/adr/0010-auth-jwt-argon2id.md)).

## Read-only enforcement

The reader role is enforced at the API layer in `POST /api/v1/query` before the SQL reaches DataFusion. The check is a default-deny whitelist:

- Allowed: `SELECT`, `EXPLAIN`, `SHOW`, `DESCRIBE`, `DESC`, and `WITH` (the `WITH` clause is then scanned for embedded write keywords; data-modifying CTEs such as `WITH x AS (DELETE ...) SELECT 1` and PostgreSQL-style `WITH x AS (SELECT 1) INSERT INTO y ...` are rejected).
- Blocked: every other statement type, returned as `403 Forbidden` with the message `"read-only users may only execute SELECT, EXPLAIN, SHOW, DESCRIBE, or WITH...SELECT statements"`.

Comments (`-- ...`, `/* ... */`) and the contents of single-quoted (`'...'`) and double-quoted (`"..."`) string literals are stripped before tokenisation, so attempts to hide a write keyword inside a comment or literal do not bypass the check. The check is layered on top of the read-only-by-construction `TableProvider` impls in `pharlux-store` — defence in depth, not the only line of defence.

Admin tokens bypass this check entirely. Pharlux V1's `TableProvider` implementations are themselves read-only (writes go through the OTLP ingest path, not SQL), so an admin attempting `INSERT` will receive a DataFusion plan-level error rather than corrupting data — but the API does not stop them at the role boundary.

## Where the data lives

Pharlux stores authentication state in two embedded SQLite files under the configured data directory (default `/var/lib/pharlux/`):

| File | Purpose |
| --- | --- |
| `auth.db` | Users (id, tenant_id, username, password_hash, admin flag, created_at) and API keys. WAL journal mode. |
| `meta.sqlite` | Dashboards and other tenant-scoped metadata. |

The data directory is owned by the systemd-managed dynamic UID at mode `0750` per the install-time `StateDirectory=pharlux` layout. `pharlux backup` includes `auth.db` (and therefore the password hashes); `pharlux backup` does **not** include `jwt.secret` — back the secret file up out of band. See [`backup-restore.md`](backup-restore.md).

## Known V1 limitations

The two-role model, user CRUD, and CLI surface described above are the entirety of V1's authentication and authorization. The following are explicit limitations operators should be aware of:

- **No resource-level RBAC.** The `users` table schema includes role and permission tables to support full RBAC without a future migration, but V1 only enforces the admin/reader distinction. Per-dashboard, per-tenant-data, or per-source permissions are planned. See ADR-0010.
- **No external identity providers.** OIDC, SAML, and LDAP integration are not in V1. Pharlux's built-in user table is the only identity source.
- **No token revocation before expiry.** A compromised token is valid until its `exp` passes. Mitigation is short `token_ttl_seconds` (default 1 hour) plus full secret rotation if needed.
- **No automatic secret rotation.** Rotation is the manual procedure documented above.
- **No password policy enforcement.** Pharlux does not enforce minimum length, character class, or complexity rules on passwords supplied to `pharlux user add` or `POST /api/v1/admin/users`. Operators are expected to enforce policy at the user-onboarding level.
- **No login rate limiting at the Pharlux layer.** The reverse proxy (Caddy `rate_limit`, nginx `limit_req`) is the recommended location. See [`reverse-proxy.md`](reverse-proxy.md).
- **No audit log of admin actions.** Tenant creation, user creation, and user deletion are logged via `tracing` to the service's stderr but are not written to a separate, durable audit trail. Audit logging is planned.
- **`--password` is visible in shell history and `ps`.** Mitigated by the `read -rs` pattern shown in the [Quick start](#quick-start) section.

## See also

- [`../../SECURITY.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/SECURITY.md) — trust boundaries, secret handling rules, the broader threat model.
- [`../../adr/0010-auth-jwt-argon2id.md`](https://github.com/Veltara-Works/pharlux/blob/v1.2.0/adr/0010-auth-jwt-argon2id.md) — the original decision record, including the alternatives considered.
- [`otlp-configuration.md`](otlp-configuration.md) — the full `[auth]` section of `pharlux.toml`.
- [`reverse-proxy.md`](reverse-proxy.md) — Caddy and nginx configurations, including rate limiting in front of `/api/v1/auth/login`.
- [`backup-restore.md`](backup-restore.md) — what `pharlux backup` does and does not include.
