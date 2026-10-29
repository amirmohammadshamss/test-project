# Deployment runbook

## Prepared, not deployed

The workspace has no configured hosting account/target or OpenAI credential. The available Sites runtime uses Cloudflare Workers and cannot run the existing NestJS/PostgreSQL-TCP/BullMQ stack unchanged. Do not replace the existing backend with a static imitation. Use a VM/container host with PostgreSQL/Redis networking instead. No new paid resources were provisioned.

## Single-host deployment

1. Provision a Linux container host in a region where outbound provider access/account use is supported. Configure DNS and backups. Verify requirements with the host/provider; no regional availability claim is made here.
2. Install Docker/Compose from the official vendor and clone this repository.
3. Configure `.env`: strong random `JWT_SECRET`, URL-safe `POSTGRES_PASSWORD`, separate demo password, `WEB_ORIGIN=https://your-domain`, `COOKIE_SECURE=true`, and an optional server-side `OPENAI_API_KEY`/`OPENAI_MODEL`.
4. Run `docker compose up --build -d`. The initialization service applies migrations and idempotent demo seed. For a real installation, replace demo seeding with explicit owner onboarding and remove demo memberships.
5. Set `PUBLIC_HOSTNAME` to the actual DNS hostname pointing to this server, allow incoming ports 80/443, then run `docker compose -f docker-compose.yml -f docker-compose.https.yml up --build -d`. The supplied Caddy reverse proxy provisions TLS for that hostname; the override forces HTTPS origin and Secure cookies. Web port 3000 is bound only to localhost, and database/Redis/API ports remain internal. Preserve Caddy data/config volumes across updates. A hostname, reachable server and successful certificate issuance are still prerequisites; writing this config does not prove HTTPS deployment.
6. Verify `/api/v1/health`, `/api/v1/health/ready`, browser login/cookie settings, isolation tests, waiter/kitchen behavior, and real AI draft/approval. Inspect logs for failures without exposing credentials.
7. Back up PostgreSQL and test restoration. Persist Redis data for prompt queue recovery; pending database requests also recover after queue loss, within persisted attempt limits.

## Updates and rollback

Review migrations before deploying. Back up first. Build the new image, run forward migrations, restart services, and smoke-test. Application rollback is safe only when the database schema remains compatible; do not automatically reverse migrations. Keep previous image tags and a tested restore plan.

The supplied image retains development tools/source for straightforward migrations and build reproducibility. A smaller multi-stage/pruned image and separate production initialization policy are follow-up work.

## Delivery checks still requiring external access

- Docker image/Compose startup on a Docker-enabled host.
- Remote GitHub Actions execution after source is pushed to the repository.
- HTTPS hostname and production cookie verification.
- Real provider account/key/model accessibility.
- Browser/mobile interaction verification and a 5–10 minute recorded walkthrough.

## Automated container verification

The GitHub Actions `Docker Compose smoke` job is configured to build the image, initialize all five services, run a full waiter/kitchen HTTP smoke flow, verify durable replay after response loss and a PostgreSQL restart, repeat core ordering while Redis is stopped, and validate the production HTTPS Compose/Caddy configuration. Its test data/volumes are disposable. This job remains unverified until GitHub accepts the workflow and it passes remotely.

Configuration references: [Compose startup dependencies](https://docs.docker.com/compose/how-tos/startup-order), [Caddy environment syntax](https://caddyserver.com/docs/caddyfile/concepts), and [reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Current source delivery blocker

The initial local source commit exists, but GitHub rejected its push because the existing credential lacks `workflow` scope for `.github/workflows/ci.yml`. Update GitHub authentication to include the required workflow access before retrying. Do not drop the CI workflow to bypass this server restriction. Railway was identified as a compatible optional deployment integration but is not connected.

## Super Admin deployment configuration

The expanded Compose stack includes `super-admin` on localhost port 3001 with a runtime API proxy. HTTPS configuration requires **both** `PUBLIC_HOSTNAME` and `PUBLIC_PLATFORM_HOSTNAME`; use distinct hostnames and exact `WEB_ORIGIN` / `PLATFORM_ORIGIN`. Caddy routes the platform hostname to `super-admin:3001`. Host-only HttpOnly cookies and explicit JWT audiences separate the contexts. Existing restaurant cookies require fresh login after this migration.

The platform seed is deliberately opt-in and rejects production. Password-only platform access is a nonproduction prototype, visibly labeled in the UI; production MFA/onboarding and restricted privileged access must be completed before real-customer use. This configuration has not been run with Docker or deployed over public HTTPS in this environment.

## Recovery hardening supersedes earlier platform routing notes

`pnpm demo:up` prepares demo-only configuration when absent and runs Compose with readiness waiting. It preserves existing `.env` and volumes; review configured targets before running. Docker execution remains unverified locally.

Compose now uses explicit service environment allowlists: signing credentials belong to API, provider credentials to worker, database credentials to API/worker/initialization; frontends get only runtime API addressing. API signing/database/provider credentials are not inherited by web containers. Use host-managed secrets for real production deployment.

The default public HTTPS configuration now serves only the restaurant hostname and returns 404 for platform paths. `PUBLIC_PLATFORM_HOSTNAME` is no longer required for that configuration. Super Admin is an opt-in local `platform` Compose profile; enable `PLATFORM_ADMIN_ENABLED=true` only for an explicitly restricted nonproduction environment. Do not expose password-only platform administration publicly. Earlier two-host forwarding instructions are historical and superseded.

Restaurant tokens issued before the persisted-session change require fresh login. Logout now revokes the current restaurant session; expiry, active membership and suspension checks remain server-side. Database validation failures fail closed.

AI eligibility must be verified for the actual service/customer location; moving the worker abroad is not sufficient proof. Current OpenAI guidance does not list Iran. No live key/provider acceptance or workaround is claimed.

## Socket.IO transport routing

The later real-time expansion adds `/socket.io/*` routing directly to the API in Caddy before the general Next proxy. The host must preserve the exact browser origin and support WebSocket upgrades; origin/session checks are enforced in Nest. Local Next route handlers relay polling only, using the existing runtime API address and cookie header. Do not point Socket.IO at a build-time Docker-only address in browser code. Keep proxy idle timeouts above the Socket.IO heartbeat window.

Run one API instance for this version. Multiple instances require committed-change fan-out, local recipient reauthorization, revocation propagation and polling session affinity; installing Redis broadcasting alone is insufficient with the current local-recipient publisher. HTTPS/Caddy upgrade and multi-instance behavior remain unverified. See REALTIME.md.
