# Deployment runbook

## Prepared, not deployed

The workspace has no configured hosting account/target or OpenAI credential. The available Sites runtime uses Cloudflare Workers and cannot run this required NestJS/PostgreSQL-TCP/BullMQ stack unchanged. Do not replace the required backend with a static imitation. Use a VM/container host with PostgreSQL/Redis networking instead. No new paid resources were provisioned.

## Single-host deployment

1. Provision a Linux container host in a region where outbound provider access/account use is supported. Configure DNS and backups. Verify requirements with the host/provider; no regional availability claim is made here.
2. Install Docker/Compose from the official vendor and clone this repository.
3. Configure `.env`: strong random `JWT_SECRET`, URL-safe `POSTGRES_PASSWORD`, separate demo password, `WEB_ORIGIN=https://your-domain`, `COOKIE_SECURE=true`, and an optional server-side `OPENAI_API_KEY`/`OPENAI_MODEL`.
4. Run `docker compose up --build -d`. The initialization service applies migrations and idempotent demo seed. For a real installation, replace demo seeding with explicit owner onboarding and remove demo memberships.
5. Put a TLS reverse proxy in front of web port 3000, forwarding the original Origin and request headers. Keep database, Redis and API ports private; web proxies the API internally.
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
