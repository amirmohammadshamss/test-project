# RestaurantOS / نارنج

Persian-first restaurant operations MVP implemented from [rfp.md](./rfp.md). Original scope is in [SCOPE.md](./SCOPE.md); execution checklist is [PLAN.md](./PLAN.md).

## Current status

Local PostgreSQL migrations/seeding, the NestJS API/worker, Next.js production build, and automated tests have been exercised. Browser layout/interactions, Docker runtime, remote GitHub Actions, live OpenAI responses, public HTTPS hosting, and the required video are **not verified/delivered**. Automated verification currently covers 34 tests. See [VERIFICATION.md](./VERIFICATION.md). This is not a claim of full RFP acceptance.

## Requirements

Node.js 22+, pnpm 10.32.1, PostgreSQL 16, Redis 7+; alternatively Docker with Compose. No external fonts or image service are needed. OpenAI is optional for ordering and required only for live AI parsing.

## Run with Docker Compose

1. Copy `.env.example` to `.env`.
2. Set a long random `JWT_SECRET`, a URL-safe `POSTGRES_PASSWORD`, and a separate 12+ character `SEED_DEMO_PASSWORD`. Placeholders must be replaced. Set `OPENAI_API_KEY` only on the server if available.
3. Run `docker compose up --build`.
4. Open `http://localhost:3000`.

Compose initializes the database, runs migrations and an idempotent demo seed, then starts web/API/worker. PostgreSQL and Redis are internal; only web port 3000 is exposed. The API does not depend on Redis readiness. If Redis stops after startup, core ordering continues; AI requests remain persisted for worker recovery. Stopping with `docker compose down` preserves named database volumes. Do not delete volumes if their data is needed.

`COOKIE_SECURE=false` is for localhost HTTP only. Use `true` for HTTPS deployments. Do not expose this demo with unchanged example values.

Docker was not available in the execution environment; this path is supplied but has not been runtime-tested.

## Run with existing PostgreSQL and Redis

Configure `.env` with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `SEED_DEMO_PASSWORD`, `WEB_ORIGIN=http://localhost:3000`, and `API_INTERNAL_URL=http://127.0.0.1:4000`.

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm build
```

Start these processes in separate terminals from the repository root:

```sh
node --env-file=.env dist/apps/api/src/main.js
node --env-file=.env dist/apps/worker/src/main.js
pnpm --filter web start
```

For source development, `pnpm dev` compiles the API/worker and starts their Node file watchers plus Next dev. Re-run `pnpm --filter api build` after backend edits to regenerate watched files. The explicit TypeScript compilation preserves Nest's DTO metadata; esbuild-only startup would skip that metadata.

The task environment uses a temporary pnpm installation. If pnpm is not on PATH, prepend `/tmp/restaurantos-tools/node_modules/.bin` to PATH for commands in this checkout. Local test services were started on PostgreSQL 55432 and Redis 56379; the ignored `.env` contains those local URLs.

## Demo accounts

Use your configured `SEED_DEMO_PASSWORD` for all demo accounts:

- Manager: `manager@demo.restaurantos.test`
- Waiter: `waiter@demo.restaurantos.test`
- Kitchen: `kitchen@demo.restaurantos.test`
- Second restaurant manager: `other@demo.restaurantos.test`
- Restricted second-branch waiter: `branch@demo.restaurantos.test`

The current local seed password is `RestaurantOS-Demo-2026!`. This is deliberately public demo data, not a production secret. Re-seeding updates demo password hashes but preserves existing menu/order mutations. Seed two restaurants, three branches, eight tables per branch, five categories and eight fictional Persian items per restaurant, plus active/historical orders in Café Narenj.

## Staff workflow

1. Log in as waiter and select a free table, or open an occupied table.
2. Add food/drinks; adjust quantities only while pending.
3. Log in as kitchen staff in another browser profile and move items from pending to preparing to ready.
4. Return to waiter, mark ready items served, then complete the order. The table becomes available.
5. As manager, edit menu entries or submit a Persian description through the menu assistant. Review/edit all generated fields and explicitly approve publication.

Closing an order is operational completion, not payment. Empty orders cannot close; item cancellation/deletion is intentionally absent. If an empty order was opened accidentally, add/service the intended items; a future cancellation workflow is needed for normal production use.

## Checks

Set `TEST_DATABASE_URL` to a separate database whose name is exactly `restaurantos_test`. Create that database before running the integration script. The test runner refuses any other database name, deploys migrations and seeds it, then runs PostgreSQL/Redis-backed API and queue tests. Test fixtures are not deleted automatically; use a disposable database. Never point tests at a live restaurant database.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
```

`pnpm test:e2e` runs the same integration suite, which includes the complete waiter/kitchen API E2E path. `pnpm verify` runs all checks in sequence. GitHub Actions supplies PostgreSQL/Redis service containers and fails on any mandatory check. No production provider credentials are used by automated tests.

For an HTTP smoke check against the running local stack, run `node --env-file=.env scripts/smoke.mjs`. It creates and completes one demo order and submits an AI request, so use demo data. It is an HTTP check, not browser verification.

## Architecture and correctness

- `apps/api`: NestJS modules for auth, orders/tables/kitchen, menu, and AI. Orders use framework-independent rules, application use cases/ports, Prisma adapters, and thin HTTP controllers. Small auth/menu/AI services use Prisma directly outside controllers; full layering is intentionally concentrated in the critical ordering workflow.
- `apps/web`: Persian RTL React/Next.js UI with polling. A runtime server proxy keeps cookie-authenticated API calls on the same origin and resolves `API_INTERNAL_URL` at runtime.
- `apps/worker`: independent NestJS context, BullMQ worker, persisted pending-request reconciliation, and replaceable menu parser.
- `packages/database`: schema, migrations, seed, password hashing and Prisma client.
- `packages/shared`: framework-independent contracts and strict AI schema.

Every order mutation locks the scoped parent order before reading/changing invariants. Table creation locks the table and has a partial unique index for one open order. Independent additions append and increment the current version; stale item edits and order close use explicit versions. Composite foreign keys prevent cross-tenant/branch relationships. Price/name snapshots preserve history.

Critical mutations require `Idempotency-Key` (8–128 ASCII letters/digits/underscore/hyphen). Scope is tenant + actor + operation + active branch + key. A transaction advisory lock serializes simultaneous absent-key requests, then the mutation and serialized result commit together. Same payload replays; different payload conflicts. Failed transactions leave no committed claim. Calls wait for the first request within database/transaction limits; timeouts can be retried with the same key. Retention is seven days; worker reconciliation cleans expired records, and expired records are ignored/replaced on reuse. Deduplication is not guaranteed after retention expires.

AI requests are persisted before enqueue. A five-second reconciler re-enqueues unfinished work with stable IDs; persisted leases/attempts and conditional updates fence duplicate result application. Redis/provider calls are at-least-once, not exactly-once, and duplicate provider cost is possible after crashes. Three persisted attempts, bounded backoff, 20-second provider timeout, strict validation, and transactional human approval prevent duplicated menu publication. Reconciliation batch size is 100. The API does not import/connect BullMQ, so optional-service outages do not prevent order persistence.

## API and security

Base path `/api/v1`; routes follow RFP section 10. Menu updates send a full editable representation rather than a sparse patch. Category listing is `/menu/categories`. All writes, including login/logout, require `X-CSRF-Protection: 1`; critical order/AI writes also require `Idempotency-Key`. JSON DTOs reject extra fields. Non-simple CSRF headers, strict-origin checks, SameSite cookies, restricted CORS and server guards protect cookie-based sessions.

JWT lifetime is eight hours; membership/branch/role are rechecked on each request. Logout clears the browser cookie; it does not revoke a previously copied JWT, which remains valid until expiry unless membership is removed. Add revocation/session storage before stricter production requirements. Limits are currently process-local and IP-based; behind the Next proxy users can share the same bucket. Distributed/user-aware rate limiting and proxy configuration need production review.

Money is integer IRR, with whole-toman inputs and explicit 10:1 conversion; invalid fractions are rejected. UTC timestamps display in `Asia/Tehran`. Table occupancy derives from open orders.

Liveness: `GET /api/v1/health`. Database readiness: `GET /api/v1/health/ready`. Redis and AI are excluded from core readiness. Logs are structured JSON for requests/errors/jobs, without credentials or user description bodies. Persist/rotate logs and establish alerting in hosting.

## Deployment and handover

See [DEPLOYMENT.md](./DEPLOYMENT.md), [HANDOVER.md](./HANDOVER.md), [DECISIONS.md](./DECISIONS.md), [AI_USAGE.md](./AI_USAGE.md), and [WALKTHROUGH.md](./WALKTHROUGH.md). No public deployment URL or recording is claimed.
