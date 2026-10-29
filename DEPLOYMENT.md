# Deployment runbook

## Prepared, not deployed

The workspace has no configured hosting account/target or OpenAI credential. The available Sites runtime uses Cloudflare Workers and cannot run this required NestJS/PostgreSQL-TCP/BullMQ stack unchanged. Do not replace the required backend with a static imitation. Use a VM/container host with PostgreSQL/Redis networking instead. No new paid resources were provisioned.

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
