# RestaurantOS / نارنج

All project documentation is in `doc/`. Run the commands below from the repository root, one directory above this file.

Persian-first restaurant operations MVP implemented from [rfp.md](./rfp.md). Original scope is in [SCOPE.md](./SCOPE.md); execution checklist is [PLAN.md](./PLAN.md).

## Current status

Local PostgreSQL migrations/seeding, the NestJS API/worker, Next.js production build, and automated tests have been exercised. Real Chromium staff-workflow and kitchen pagination tests now pass, including responsive overflow checks. Docker runtime, remote GitHub Actions, live AI responses, public HTTPS hosting, and the required recording remain **unverified/incomplete**. The admin expansion adds routed manager and separate platform interfaces; see [ADMIN_IMPLEMENTATION.md](./ADMIN_IMPLEMENTATION.md) for setup and current verification. See [VERIFICATION.md](./VERIFICATION.md). This is not a claim of full RFP acceptance.

## Requirements

Node.js 22+, pnpm 10.32.1, PostgreSQL 16, Redis 7+; alternatively Docker with Compose. No external fonts or image service are needed. OpenAI is optional for ordering and required only for live AI parsing.

## Run with Docker Compose

Run `pnpm demo:up` from the repository root on a Docker-enabled machine. It generates an ignored demo `.env` only when absent, preserves existing configuration/data, starts Compose and waits for readiness. If `.env` already exists, replace placeholder values and confirm its targets first. Open `http://localhost:3000`. Docker runtime remains unverified here because Docker is unavailable.

Manual alternative: copy `.env.example`, configure strong secrets and a 12+ character demo password, then run `docker compose up --build`. Do not enable a live paid AI provider until service eligibility and request-budget controls are established.

Compose initializes the database, runs migrations and an idempotent demo seed, then starts web/API/worker. PostgreSQL and Redis are internal; only web port 3000 is exposed by default. Super Admin is an opt-in `platform` profile on port 3001 and platform APIs are disabled by default in production. Frontends do not receive API signing, database or provider credentials. The API does not depend on Redis readiness. If Redis stops after startup, core ordering continues; AI requests remain persisted for worker recovery. Stopping with `docker compose down` preserves named database volumes. Do not delete volumes if their data is needed.

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
pnpm nx start web
pnpm nx start super-admin
```

For source development, `pnpm dev` uses Nx to compile the backend once and run API/worker Node file watchers plus Next dev. Re-run `pnpm nx build api` (or `pnpm nx build worker`) after backend edits to regenerate watched files. The explicit TypeScript compilation preserves Nest's DTO metadata; esbuild-only startup would skip that metadata.

The task environment uses a temporary pnpm installation. If pnpm is not on PATH, prepend `/tmp/restaurantos-tools/node_modules/.bin` to PATH for commands in this checkout. Local test services were started on PostgreSQL 55432 and Redis 56379; the ignored `.env` contains those local URLs.

## Nx workspace

Nx 24.0.2 orchestrates the existing pnpm workspace. Projects are `api`, `worker`, `web`, `super-admin`, `database`, `shared`, and the root `workspace` tooling project. Each has explicit `project.json` configuration; `nx.json` defines shared inputs and caching. No Nx Cloud account is required or connected.

```sh
pnpm nx show projects
pnpm nx build api
pnpm nx build worker
pnpm nx build web
pnpm nx test api
pnpm nx test worker
pnpm nx test web
pnpm nx run database:generate
pnpm nx run database:migrate
pnpm nx run database:seed
pnpm graph
```

The existing root scripts now run Nx targets: `pnpm build`, `pnpm typecheck`, `pnpm test`, `pnpm lint`, and `pnpm test:integration`. `pnpm verify` retains the required sequence and runs all checks through those targets. Use `--output-style=static` on an Nx invocation to show complete task logs. Run a project's `dev` or `start` target through `pnpm nx`; start expects an existing build.

API and worker build/typecheck targets delegate to a single shared TypeScript compilation/check in `workspace`. This preserves current `dist/apps/...` entrypoints and lets Nx deduplicate the prerequisite instead of letting two compilers write the same output directory. Their graph dependencies include database/shared; web depends on shared.

Builds, type checks, lint and isolated unit tests use local caching. Inputs include relevant app/library source, workspace configuration, lockfile and Node version. Web builds additionally account for `NODE_ENV`; its API address is resolved at runtime. Database client generation, migrations, seeding, integration/E2E tests, formatting and long-running services are uncached. Integration tests remain serial and exercise actual database/queue state on every invocation.

GitHub Actions restores `.nx/cache` for task reuse; it does not persist Nx workspace metadata. Docker builds run as the `node` user so runtime Nx/Prisma tasks can write their generated state. `.nx/` is excluded from Git, formatting, lint and Docker build context. Daemon mode is disabled for reproducible local/container runs.

For focused checks, use `pnpm nx affected -t test,build --base=<base-commit> --head=HEAD` after committing the change you want to compare. Use `pnpm nx reset` to clear local Nx state if needed.

References: [adding Nx to an existing monorepo](https://nx.dev/docs/kb/adding-to-monorepo), [project configuration](https://nx.dev/docs/reference/project-configuration), and [cache inputs](https://nx.dev/docs/reference/inputs).

## Frontend styling

The frontend uses Tailwind utilities exclusively. `apps/web/app/globals.css` contains only the Tailwind import; there are no custom selector rules, CSS modules, inline style objects or hand-written keyframes. Repeated utility groups live in `apps/web/lib/ui.ts`, with data-attribute variants for nested layouts and state styling. `tailwind-merge` resolves conflicting composed utilities. Responsive breakpoints, RTL layout, focus/disabled states and reduced-motion behavior are expressed through Tailwind variants.

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

Closing an order is operational completion, not payment. Empty orders can be cancelled with a reason by waiter/manager. Pending lines can be cancelled by waiter/manager; preparing/ready lines require a manager and direct kitchen communication. Served lines cannot be cancelled. Cancelling the last remaining line releases the table; retained cancelled lines are excluded from operational totals. Partial-line quantity cancellation, refunds and accounting remain unsupported.

## Checks

Set `TEST_DATABASE_URL` to a separate database whose name is exactly `restaurantos_test`. Create that database before running the integration script. The test runner refuses any other database name, deploys migrations and seeds it, then runs PostgreSQL/Redis-backed API and queue tests. Test fixtures are not deleted automatically; use a disposable database. Never point tests at a live restaurant database.

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm test:browser
```

`pnpm test:e2e` runs the same integration suite, which includes the complete waiter/kitchen API E2E path. `pnpm verify` runs all checks in sequence. GitHub Actions supplies PostgreSQL/Redis service containers and fails on any mandatory check. No production provider credentials are used by automated tests.

For an HTTP smoke check against the running local stack, run `node --env-file=.env scripts/smoke.mjs`. It creates and completes one demo order and submits an AI request, so use demo data. It is an HTTP check, not browser verification.

`scripts/fault-smoke.mjs` deliberately discards successful upstream responses, retries the same request keys, and verifies there is only one order/item. It completes the resulting demo order. With `FAULT_RESTART_COMPOSE_POSTGRES=1`, it also restarts the disposable Compose PostgreSQL service. Run only against a demo/test stack; the local controlled-restart variant accepts the isolated `/tmp/restaurantos-pg` cluster explicitly. See VERIFICATION.md for the observed result.

## Architecture and correctness

- `apps/api`: NestJS modules for auth, orders/tables/kitchen, menu, and AI. Orders use framework-independent rules, application use cases/ports, Prisma adapters, and thin HTTP controllers. Small auth/menu/AI services use Prisma directly outside controllers; full layering is intentionally concentrated in the critical ordering workflow.
- `apps/web`: Persian RTL React/Next.js UI with polling. A runtime server proxy keeps cookie-authenticated API calls on the same origin and resolves `API_INTERNAL_URL` at runtime.
- `apps/worker`: independent NestJS context, BullMQ worker, persisted pending-request reconciliation, and replaceable menu parser.
- `packages/database`: schema, migrations, seed, password hashing and Prisma client.
- `packages/shared`: framework-independent contracts and strict AI schema.

Every order mutation locks the scoped parent order before reading/changing invariants. Table creation locks the table and has a partial unique index for one open order. Independent additions append and increment the current version; stale item edits and order close use explicit versions. Composite foreign keys prevent cross-tenant/branch relationships. Price/name snapshots preserve history.

Critical mutations require `Idempotency-Key` (8–128 ASCII letters/digits/underscore/hyphen). Scope is tenant + actor + operation + active branch + key. A transaction advisory lock serializes simultaneous absent-key requests, then the mutation and serialized result commit together. Same payload replays; different payload conflicts. Failed transactions leave no committed claim. Calls wait for the first request within database/transaction limits; timeouts can be retried with the same key. Retention is seven days; worker reconciliation cleans expired records, and expired records are ignored/replaced on reuse. Deduplication is not guaranteed after retention expires.

AI requests are persisted before enqueue. A five-second reconciler re-enqueues unfinished work with stable IDs; persisted leases/attempts and conditional updates fence duplicate result application. Redis/provider calls are at-least-once, not exactly-once, and duplicate provider cost is possible after crashes. Three persisted attempts, bounded backoff, 20-second provider timeout, strict validation, and transactional human approval prevent duplicated menu publication. Reconciliation batch size is 100. Core ordering has no Redis startup dependency; the optional platform monitoring adapter connects to BullMQ only for an explicit monitoring request.

## API and security

Base path `/api/v1`; routes follow RFP section 10. Menu updates send a full editable representation rather than a sparse patch. Category listing is `/menu/categories`. All writes, including login/logout, require `X-CSRF-Protection: 1`; critical order/AI writes also require `Idempotency-Key`. JSON DTOs reject extra fields. Non-simple CSRF headers, strict-origin checks, SameSite cookies, restricted CORS and server guards protect cookie-based sessions.

JWT lifetime is eight hours; membership/branch/role are rechecked on each request. Restaurant sessions are persisted and checked on every protected request. Logout revokes the current session before clearing its cookie; copied tokens then fail. Legacy tokens without a session ID require a fresh login. Other devices remain signed in. Limits are currently process-local and IP-based; behind the Next proxy users can share the same bucket. Distributed/user-aware rate limiting and proxy configuration need production review.

Money is integer IRR, with whole-toman inputs and explicit 10:1 conversion; invalid fractions are rejected. UTC timestamps display in `Asia/Tehran`. Table occupancy derives from open orders.

Liveness: `GET /api/v1/health`. Database readiness: `GET /api/v1/health/ready`. Redis and AI are excluded from core readiness. Logs are structured JSON for requests/errors/jobs, without credentials or user description bodies. Persist/rotate logs and establish alerting in hosting.

## Deployment and handover

See [DEPLOYMENT.md](./DEPLOYMENT.md), [HANDOVER.md](./HANDOVER.md), [DECISIONS.md](./DECISIONS.md), [AI_USAGE.md](./AI_USAGE.md), and [WALKTHROUGH.md](./WALKTHROUGH.md). No public deployment URL or recording is claimed.

## Recovery verification and assessment status

See [ASSESSMENT_FIX_PLAN.md](./ASSESSMENT_FIX_PLAN.md) and [REMEDIATION_STATUS.md](./REMEDIATION_STATUS.md). Browser tests require a dedicated `TEST_DATABASE_URL` ending in `/restaurantos_test`, migrated schema, generated Prisma client and Chromium (`pnpm exec playwright install chromium`). `pnpm test:browser` builds API/web and starts isolated test servers on 4002/3002; do not run another server on those ports. It creates fictional fixtures in the test database. Kitchen pagination returns an envelope, default 50/max 100 orders, with explicit backlog navigation and stale-data indicators.
