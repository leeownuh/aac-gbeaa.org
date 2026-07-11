# AAC GBEAA Website - 3 Tier + PostgreSQL

This project is now structured for 3-tier deployment on AWS with PostgreSQL as the primary data store.

1. Web tier: Nginx serves static pages and proxies `/api/*`
2. App tier: Node.js/Express API
3. Data tier:
- PostgreSQL for CMS/auth data
- Persistent volume for uploads and gallery assets

## Current Storage Model

- Primary: PostgreSQL tables (`articles`, `events`, `gallery_*`, `admins`, `refresh_tokens`, `audit_logs`, `content_blobs`)
- Bootstrap import: existing JSON is imported on first run if DB tables are empty
- Frontend compatibility: API-first with JSON fallback for resilience during transition

## PostgreSQL Migration Summary

- Added PostgreSQL client and DB layer:
  - `src/db/client.js`
  - `src/db/schema.js`
  - `src/db/seedFromJson.js`
  - `src/db/repositories/*`
- Migrated auth persistence (admin creds, refresh tokens, audit log) from JSON files to DB.
- Migrated articles/events/gallery/principles APIs to DB-backed repositories.
- Added `/api/principles` endpoint backed by DB blob storage.
- Updated frontend loaders to use API first, then fallback to JSON if API is unavailable.

## Local Run (Docker)

1. Create env file:
```bash
cp .env.example .env
```

For production-prep values, start from:
```bash
cp .env.production.example .env
```

2. Generate strong secrets:
```bash
npm run secrets:generate
```

3. Paste those values into `.env`, then run preflight:
```bash
npm run preflight
```

To validate a different env file without replacing your local `.env`:
```bash
ENV_FILE=.env.production.example npm run preflight
```

4. Start stack:
```bash
docker compose -f docker-compose.three-tier.yml up --build
```

5. Open:
- `http://localhost:8080`
- `http://localhost:8080/api/health`
- `http://localhost:8080/api/ready`

## Environment Variables

Core:
- `NODE_ENV`
- `PORT`
- `WEB_PORT`
- `SERVE_STATIC`
- `DATA_ROOT`
- `CORS_ORIGIN`
- `TRUST_PROXY_HOPS`

Database:
- `DATABASE_URL`
- `POSTGRES_DB`
- `POSTGRES_USER`
- `POSTGRES_PASSWORD`

Security:
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `SESSION_COOKIE_SECURE` (set `false` for local HTTP, `true` behind HTTPS in production)
- `ENCRYPTION_KEY`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `ADMIN_SUPER_USERNAME` / `ADMIN_SUPER_PASSWORD`
- `ADMIN_EDITOR_USERNAME` / `ADMIN_EDITOR_PASSWORD`
- `ADMIN_MODERATOR_USERNAME` / `ADMIN_MODERATOR_PASSWORD`
- `ADMIN_VIEWER_USERNAME` / `ADMIN_VIEWER_PASSWORD` (legacy alias for moderator)
- `TEMP_PASSWORD_VALID_HOURS` (default temporary credential validity window)
- `PASSWORD_MAX_AGE_DAYS` (default `90`)
- `TEMP_PASSWORD_MIN_HOURS` (default `1`)
- `TEMP_PASSWORD_MAX_HOURS` (default `24`)

Performance / Scale:
- `HOT_CACHE_ENABLED` (default `true`)
- `HOT_CACHE_TTL_MS` (default `30000`)
- `REDIS_URL` (optional, only needed for multi-replica session sharing)
- `REDIS_SESSION_PREFIX` (default `aac:sess:`)

Contact form email:
- `SMTP_HOST` (for AWS SES SMTP, use `email-smtp.<region>.amazonaws.com`)
- `SMTP_PORT` (default `587`)
- `SMTP_SECURE` (`false` for port `587`, `true` for port `465`)
- `SMTP_USER`
- `SMTP_PASS`
- `CONTACT_FORM_FROM` (must be a verified SES sender/domain)
- `CONTACT_FORM_TO` (default `contact@aac-gbeaaa.com`)

## Performance Setup (Implemented)

1. Nginx gzip compression is enabled for `text/css`, `application/javascript`, `application/json`, and related text content.
2. Static caching headers are enabled:
- `/assets/*` and `/img/*`: long-lived immutable cache
- `/uploads/*`: short public cache
- `/data/*`: short revalidation cache
- `/`: short revalidation cache for HTML entry
3. API responses are intentionally non-cacheable at proxy level:
- `/api/*` returns `Cache-Control: no-store`
4. Hot read endpoint in-memory cache is enabled in app tier (short TTL):
- `GET /api/events`
- `GET /api/articles`
- `GET /api/principles`
- Cache invalidation happens on article/event writes.

## CDN Strategy (Static Files Only)

Keep API unchanged. Put CDN in front of static paths only:

- Cache through CDN:
  - `/assets/*`
  - `/img/*`
  - `/uploads/*` (if public assets are allowed)
  - `/assets/images/gallery/*`
- Do not cache API through CDN:
  - `/api/*` should continue directly to app/web origin with no-store behavior.

This gives low-risk global speed gains without changing backend API behavior.

## Session Scaling Guidance

- Current single app replica: MemoryStore is acceptable for now.
- When scaling beyond one app instance: set `REDIS_URL` so sessions become shared (Redis-backed).
- If `REDIS_URL` is not set, app logs a production warning and stays on MemoryStore fallback.

## Minimum Production Checklist

Before creating the AWS account or buying the domain, this repo should pass the following:

1. `cp .env.production.example .env`
2. `npm run secrets:generate`
3. Replace every placeholder value in `.env`
4. Set `CORS_ORIGIN` to the real production domain value you plan to buy
5. Run `npm run preflight`
6. Run `docker compose -f docker-compose.three-tier.yml up --build`
7. Confirm:
   - `GET /api/health` returns `200`
   - `GET /api/ready` returns `200`
   - admin login works
   - content CRUD works
8. Keep Docker volumes for `postgres_data` and `app_data`
9. Keep `SESSION_COOKIE_SECURE=true` for HTTPS production
10. Add Redis only if you later scale past one app instance

## EC2 Deployment Shape

The intended first production target is:

1. One EC2 instance
2. Docker Engine + Docker Compose plugin
3. This compose stack
4. Route 53 DNS to the EC2 public IP
5. HTTPS added after the domain exists

Until the domain exists, the repo is prepared for everything except the final DNS and certificate steps.

## Admin Roles and Accounts

- Role model:
  - `super`: full access, including account management
  - `editor`: submits content changes for moderation approval (cannot publish directly)
  - `moderator`: read-only content access plus approve/reject authority
- Bootstrap now ensures 3 admin accounts exist (super, editor, moderator) using the env vars above.
- New account management endpoints (super only):
  - `GET /api/admin/users`
  - `POST /api/admin/users`
  - `PUT /api/admin/users/:username/role`
  - `PUT /api/admin/users/:username/password`
  - `POST /api/admin/users/:username/temporary-password`
  - `DELETE /api/admin/users/:username`
- Moderation queue endpoints:
  - View queue/history: moderator + super
  - `GET /api/admin/changes/pending`
  - `GET /api/admin/changes/recent`
  - Approve/reject editor requests: moderator only
  - `POST /api/admin/changes/:id/approve`
  - `POST /api/admin/changes/:id/reject`
- Audit visibility endpoint (moderator + super):
  - `GET /api/admin/audit-logs`
- High-risk password controls:
  - Super admins can issue temporary credentials.
  - Temporary passwords enforce immediate rotation.
  - Expired temporary credentials block login.
  - Session ID rotates on successful admin login (session fixation hardening).
  - Standard admin passwords auto-expire based on `PASSWORD_MAX_AGE_DAYS`.
- Admin UI page:
  - `/admin/accounts.html`
  - `/admin/approvals.html`
  - `/admin/audit-logs.html`
  - `/admin/change-password.html`

## AWS Mapping

- Web: ECS/EC2 service using `Dockerfile.web`, fronted by ALB
- App: ECS/EC2 service using `Dockerfile.app` in private subnet
- DB: Amazon RDS PostgreSQL (recommended) or self-managed PostgreSQL
- Persistent files: EFS mounted to app/web for uploads and gallery assets

## Test & Verification (April 14, 2026)

Executed successfully:
- `node --check` on updated backend/frontend migration files
- `npm test -- tests/eventApi.test.js tests/contentRepository.test.js`
  - `tests/eventApi.test.js`: v2 events API with repository mocks (PostgreSQL-backed path)
  - `tests/contentRepository.test.js`: repository mapping/query behavior
- `npm test -- --runInBand`
  - 8/8 test suites passed
  - 49/49 tests passed
- Docker/runtime smoke checks:
  - `GET /`, `GET /api/health`, `GET /api/events`, `GET /api/articles`, `GET /api/principles` all return `200`
  - `GET /assets/events.js` returns `Content-Encoding: gzip` and static cache headers
  - `GET /api/events` returns `Cache-Control: no-store`

## Notes

- Legacy JSON cache service has been removed (`src/storage/cache.js`).
- JSON files are still present for fallback/bootstrap compatibility during rollout.
- After final production cutover, JSON fallback paths can be removed for strict DB-only mode.
