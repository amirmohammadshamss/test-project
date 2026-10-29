# Deployment and operator runbook

## Current verification boundary

Deployment update: see [LIVE_DEPLOYMENT.md](LIVE_DEPLOYMENT.md). Server Docker, public HTTPS, independent browser workflows and isolated backup restoration passed before an interruption. Subsequent SSH/HTTPS connections timed out; current availability and temporary-key revocation remain unresolved. The following original boundary predates that deployment.

Local API/worker/frontends, real PostgreSQL/Redis checks and Chromium workflows pass. Public HTTPS hosting, Docker/Compose runtime, remote CI for the final commit, live AI quality, physical-device Push, backup restoration and a narrated recording remain unverified. No hostname or compatible host account is configured here. Available static/Workers hosting cannot run this NestJS/PostgreSQL/BullMQ stack unchanged; no static imitation or paid host was provisioned.

## Reproducible local demo

Install Node 22+, pnpm 10.32.1 and Docker with Compose, then run `pnpm demo:up` from the repository root. It checks Docker, creates an ignored demo `.env` only when missing, starts Compose and waits for readiness. Existing environment values and volumes are preserved; review targets before use. Manual PostgreSQL/Redis setup and credentials are in [README.md](README.md).

The initializer applies migrations and seeds two fictional restaurants, distinct menus, thirty days of shift history, active work, audit events and clearly labeled fixed AI examples. Reseeding preserves existing order/menu edits and notification state; demo passwords/roles and base restaurant names are restored. Do not mix real customer data with demo data. Production onboarding must replace demo seeding and remove demo memberships.

## Single-host HTTPS deployment

1. Use a compatible Linux container host with PostgreSQL/Redis networking and an actual DNS hostname. Verify provider eligibility for the serving market; relocating a worker is not itself proof of service eligibility.
2. Install Docker/Compose, check out the exact submitted commit, and configure ignored server secrets: strong random `JWT_SECRET`, URL-safe `POSTGRES_PASSWORD`, demo/reviewer password and `PUBLIC_HOSTNAME`. Set `WEB_ORIGIN=https://your-hostname` and `COOKIE_SECURE=true`. Never commit `.env` or keys.
3. Start with `docker compose -f docker-compose.yml -f docker-compose.https.yml up --build -d`. The initializer migrates/seeds before API/worker start. Caddy needs reachable ports 80/443 and successful certificate issuance; preserve its data/config volumes. API, database and Redis are internal. Do not expose database or API ports directly.
4. Leave `PLATFORM_ADMIN_ENABLED=false` and the `platform` Compose profile disabled for public deployment. Caddy returns 404 for platform APIs. The separate password-only platform UI is a restricted nonproduction prototype; real privileged use requires MFA/onboarding and access controls.
5. Verify health/readiness through the public hostname, secure cookie flags, exact origins, independent staff logins, cross-tenant/branch rejection, and the complete waiter/kitchen flow. Test a correction, a kitchen instruction, concurrent additions and uncertain-response retry. Verify real Caddy WebSocket upgrade; local Next proxies relay polling only.
6. Configure one eligible AI provider or self-hosted model according to [AI_STRATEGY.md](AI_STRATEGY.md). AI defaults to disabled. Run the explicit opt-in evaluation commands, then review and approve one real generated draft. A fixed seeded example must never be used as live-inference evidence.
7. Configure optional VAPID/encryption secrets and verify supported devices separately according to [NOTIFICATIONS.md](NOTIFICATIONS.md). Ordering must remain usable when Redis, AI or Push is unavailable.
8. Run backup restoration into an isolated database and verify restored business state and access. Set a measured recovery procedure and retain previous images. A successful PostgreSQL restart is durability evidence, not a backup-restore test.

## Smoke and acceptance commands

`node --env-file=.env scripts/smoke.mjs` performs a real demo order lifecycle. It uses explicit `AI_PROVIDER` configuration to check either a READY result or the expected disabled/missing-configuration failure. For an ordering-only check use `SMOKE_SKIP_AI=1`; do not claim provider success from key presence. The check creates data and uses the shared daily AI quota. Against a separately configured host, set `SMOKE_URL` and the exact browser origin.

`scripts/fault-smoke.mjs` tests loss of a committed HTTP response and replay. Its Compose PostgreSQL restart is allowed only against a disposable stack. Do not restart or remove real customer databases to run a smoke test.

`pnpm verify` covers source checks, tests and builds. `pnpm test:browser` starts dedicated test servers and requires the isolated `restaurantos_test` database and Chromium. CI additionally configures a Docker startup/outage/durability job; its presence is not evidence of a successful remote run. Confirm the actual branch/commit and CI result when delivering the repository. Earlier workflow-authentication failures are historical observations, not an assertion about current credentials.

## Security and monitoring

Environment allowlists keep signing secrets in API, provider private credentials in worker, database access in API/worker/initializer and only runtime API addressing in frontends. Maintain host secret storage, rotation and restricted logs/backups.

Burst limits are process-local and identity-aware. Login accounts have separate hashed buckets plus a high coarse source ceiling; authenticated AI calls and platform writes use verified identities. Do not trust arbitrary forwarded IP headers. Add trusted-edge and distributed capacity controls before multiple API replicas. Daily tenant AI quotas are persisted and shared.

HTTP/job logs contain request/tenant/actor identifiers and sanitized codes. Unexpected errors include cause class, dependency code where known and redacted frame information; raw error messages, bodies, cookies, provider output and Push endpoints are excluded. Configure rotation, retention and alert routing. Test an internal dependency failure so the operator can correlate it at 3am.

Run one API instance for immediate notifications. More instances require fan-out, local authorization/revocation checks and polling affinity; a Redis adapter alone is not a demonstrated scaling solution. Monitor outbox backlog, queue failures, database pools and worker heartbeat. Reports have bounded read-only query timeouts; a shared heartbeat does not prove every individual queue is healthy. Database/API failures need independent external monitoring because the application cannot persist its own outage alert.

## Updates and rollback

Review migrations, back up, build the new image, apply forward migrations, restart all services and verify the exact release. Application rollback is safe only if the schema remains compatible; do not automatically reverse migrations. Keep restore evidence and prior image tags. The current image retains build tooling/source for simple reproducibility; pruning it is a later optimization, not a delivery proof.

## Final submission gates

- [ ] Compatible host, actual HTTPS URL and secure production cookies verified.
- [ ] Reviewer credentials tested without privileged platform exposure.
- [ ] Exact source commit delivered and remote CI verified.
- [ ] Live eligible-provider quality/latency and human approval demonstrated.
- [ ] Backup restoration and public-proxy recovery verified.
- [ ] Supported-device Push checked if claimed as delivered.
- [ ] Playable narrated 5–10 minute walkthrough linked.
- [ ] Actual active-time history or honest unknown/overrun disclosure included.
