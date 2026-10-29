# RestaurantOS — Phased Implementation Plan

Source: [rfp.md](./rfp.md). Execution checklist updated during implementation. Checked implementation tasks do not imply browser, Docker, live-provider, or hosted-deployment verification; see [VERIFICATION.md](./VERIFICATION.md).

**Budget:** 360 minutes of actual work, submitted within four calendar days. The estimates below are timeboxes, not a guarantee that every requirement fits. Record actual time per phase and disclose any overrun or incomplete requirement.

**Core workflow:** Table selection → order creation → item addition/modification → kitchen preparation → ready → served → order completion.

**Execution order:** Complete phases 1–8 sequentially. Add critical tests alongside their implementation; phase 7 consolidates verification. Preserve data integrity, tenant security, usable ordering, and reproducibility before adding polish.

## Execution status

- [x] Phases 1–4: original scope, workspace/database, authentication/isolation, and core ordering/kitchen API implemented; critical automated checks pass.
- [x] Phase 5 code: Persian RTL frontend and retry handling implemented; browser walkthrough remains pending.
- [x] Phase 6 code: AI requests, worker, validation, recovery and approval implemented; automated provider tests use test doubles.
- [ ] Phase 6 live acceptance: verify a real OpenAI call with a configured server credential.
- [x] Phase 7 local checks: formatting, lint, typecheck, automated tests, production build and production-proxy HTTP smoke check pass.
- [ ] Phases 7–8 external verification: browser/mobile checks, Docker runtime, remote CI, HTTPS deployment and recorded walkthrough remain outstanding.

Actual phase times were not separately instrumented. `TIME_LOG.md` records observed checkpoints and conservative wall elapsed time, including approval/interruption delays; no precise phase-level time is claimed.

## Phase 1 — Scope and workflow decisions

**Timebox:** 35 minutes · elapsed target: 0:35 · actual: not separately timed (see `TIME_LOG.md`)

**Goal:** Establish a defensible MVP before production code.

- [x] Read the RFP and create `SCOPE.md` before writing production code.
- [x] Document practical Iranian restaurant workflow, Persian menu structure, kitchen/cashier coordination, table practices, currency conventions, and deployment/service availability. Separate sourced findings from assumptions; do not imply customer interviews occurred.
- [x] Define manager, waiter, and kitchen permissions, including restaurant and branch membership rules.
- [x] Define item states and allowed transitions, such as `PENDING → PREPARING → READY → SERVED`, and order states `OPEN → COMPLETED`.
- [x] Decide when quantities may change, when an order may close, and how a table becomes available. Explicitly document any omitted cancellation behavior.
- [x] Choose one active branch per session while retaining multi-branch support in the data model. Resolve tenant context from verified identity and membership.
- [x] Define integer rial storage, explicit toman conversion, accepted input precision, rounding/rejection policy, UTC storage, and Tehran/Persian display.
- [x] List exclusions: payments, accounting, inventory, reservations, delivery integrations, full offline sync, WebSockets, microservices, and advanced analytics.
- [x] Start `DECISIONS.md`, `AI_USAGE.md`, and a time log; identify hosting and credential prerequisites early.

**Exit gate:** `SCOPE.md` describes one complete workflow, permissions, assumptions, exclusions, and acceptance checks. Unresolved rules are recorded before schema design.

## Phase 2 — Workspace, architecture, and database

**Timebox:** 35 minutes · elapsed target: 1:10 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Phase 1 decisions.

- [x] Scaffold pnpm Workspaces with Next.js web, NestJS API, independently runnable NestJS worker, database package, and shared contracts.
- [x] Establish domain, application, infrastructure, and presentation boundaries. Keep the domain independent of NestJS, Prisma, Redis, BullMQ, and AI SDKs.
- [x] Define focused repository ports and a transaction/unit-of-work boundary; keep controllers thin and Prisma transaction objects inside infrastructure.
- [x] Create Prisma models for restaurants, branches, users, restaurant/branch memberships, tables, categories, menu items, orders, order items, order events, idempotency records, and AI drafts.
- [x] Add tenant/branch ownership, foreign keys, composite constraints where appropriate, scoped indexes, versions, integer monetary fields, and UTC timestamps.
- [x] Enforce at most one open order per table using a PostgreSQL partial unique index in a migration.
- [x] Design idempotency uniqueness around tenant, actor/client, operation, and key; include fingerprint, state, stored result, timestamps, expiry, and cleanup policy.
- [x] Choose and document recoverable AI enqueue behavior: a persisted pending request with a periodic reconciler, or a transactional outbox. Do not rely solely on Redis job IDs.
- [x] Configure ESLint, Prettier, Husky, lint-staged, root scripts, `.env.example`, and secret exclusions.
- [x] Add Docker Compose services for PostgreSQL, Redis, API, worker, and web, with health checks and persistent database storage.
- [x] Add a GitHub Actions skeleton for PRs and main pushes, with PostgreSQL/Redis services and mandatory checks.
- [x] Create migrations and an idempotent seed with two restaurants, multiple branches, all three roles, Persian menus, tables, and usable sample orders.

**Exit gate:** Workspace installs; migrations and seed run; domain boundaries and database constraints support the agreed invariants. Record infrastructure blockers immediately.

## Phase 3 — Authentication, authorization, and tenant isolation

**Timebox:** 45 minutes · elapsed target: 1:55 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Workspace and membership schema.

- [x] Implement login, logout, and current-user endpoints with secure password hashing and JWTs in HttpOnly cookies.
- [x] Configure cookie expiry, production `Secure` settings, appropriate SameSite/CSRF protection, and restricted CORS.
- [x] Resolve active restaurant/branch from authenticated, server-verified membership; never accept arbitrary tenant identity from request bodies.
- [x] Implement NestJS authentication, role, restaurant membership, and branch access guards, with use-case authorization where required.
- [x] Scope repository reads and writes, resource lookups, nested relations, and AI results to authorized tenant/branch context.
- [x] Add DTO validation using class-validator/class-transformer and a global ValidationPipe that rejects unexpected input where appropriate.
- [x] Add consistent sanitized errors, request IDs, login rate limiting, and structured logs without credentials or sensitive payloads.
- [x] Add Jest/Supertest checks for login, unauthenticated requests, waiter access to manager actions, cross-tenant known IDs, and unauthorized branches.

**Exit gate:** Authentication works; protected operations fail closed for the wrong tenant, branch, or role. Security checks run against real persisted memberships.

## Phase 4 — Transactional ordering and kitchen workflow

**Timebox:** 70 minutes · elapsed target: 3:05 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Schema, authorization, and scoped repositories.

- [x] Implement versioned `/api/v1` table/menu/order/kitchen endpoints from RFP section 10.
- [x] Implement manager-only menu creation/editing, categories, prices, availability, and activation/deactivation.
- [x] Implement table listing with occupancy derived from open orders and navigation to the active order.
- [x] Implement order creation, item addition, permitted quantity changes, item status updates, serving, and order completion.
- [x] Snapshot ordered item prices and retain historical order data and relevant audit events.
- [x] Validate menu ownership/availability, positive quantities, permitted transitions, and completion prerequisites in domain/use-case logic.
- [x] Wrap critical mutations in PostgreSQL transactions. Lock the parent order consistently when shared invariants are affected; use parameterized SQL if row locking requires it.
- [x] Use version/conditional checks for conflicting updates; return HTTP 409 with a way to recover current server state.
- [x] Preserve independent concurrent additions and kitchen changes; never replace an entire order from a stale client snapshot.
- [x] Implement database-backed idempotency for order creation, item additions, and order completion. Atomically commit mutation and stored result.
- [x] Replay completed results; reject changed payloads for a reused key; document controlled behavior for concurrent/in-progress requests.
- [x] Add focused tests for price snapshots, invalid transitions, closed-order changes, duplicate creation, repeated item addition, and concurrent mutations.

**Exit gate:** The API completes the entire waiter/kitchen workflow. Concurrent valid actions are preserved, retries do not duplicate data, and completed orders reject additions.

## Phase 5 — Persian frontend and demo experience

**Timebox:** 55 minutes · elapsed target: 4:00 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Stable authenticated core endpoints.

- [x] Build a Persian-first RTL Next.js/React/TypeScript interface with Tailwind CSS and appropriate typography.
- [x] Build login with demo credentials and role-aware navigation.
- [x] Build dashboard/table selection, table order details, menu browsing, item addition/quantity controls, serving, and order completion.
- [x] Build kitchen lists for pending/preparing/ready items with allowed status actions and short-interval polling.
- [x] Build manager menu listing and manual create/edit controls; reserve the AI draft review flow for phase 6.
- [x] Display toman consistently with explicit conversion, clear numbers, and Tehran-local time; add Persian dates where practical.
- [x] Add loading, empty, validation, permission, network, and conflict states with touch-friendly mobile/tablet controls.
- [x] Confirm mutations only after server success. Preserve the same idempotency key for retries of the same submitted action; issue a new key for a new action.
- [x] Refresh authoritative state on conflict and preserve unsaved input where practical.
- [ ] Walk through seeded waiter and kitchen screens in separate sessions and verify polling reflects changes.

**Exit gate (pending browser verification):** A reviewer can complete the core restaurant workflow from the UI with realistic Persian data and understandable failure feedback.

## Phase 6 — Asynchronous AI menu drafts

**Timebox:** 35 minutes · elapsed target: 4:35 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Manager authorization, menu persistence, worker scaffold, and enqueue recovery design.

- [x] Implement manager-only request/status/approval endpoints with tenant-scoped persisted draft states and request idempotency.
- [x] Connect BullMQ/Redis and the independent NestJS worker using stable job IDs, bounded retries, exponential backoff, provider timeouts, and persisted failure states.
- [x] Implement the chosen reconciler/outbox dispatcher so a database commit followed by enqueue failure is recoverable.
- [x] Call OpenAI only from the backend/worker. Keep credentials server-side and treat Persian descriptions as untrusted data.
- [x] Enforce maximum input size, endpoint rate limits, token limits, strict structured-output validation, supported categories, and valid integer prices.
- [x] Persist validated drafts idempotently; repeated/concurrent worker delivery must not apply results twice or overwrite terminal state.
- [x] Add frontend pending/success/failure states and editable human review. Create an active menu item only after explicit manager approval.
- [x] Make approval transactional and repeat-safe so repeated approval cannot create duplicate menu items.
- [x] Verify ordering and kitchen actions remain available when Redis, the worker, or the provider is unavailable; keep manual menu entry usable.
- [x] Test success, duplicate processing, transient retry, permanent failure, invalid output, result ownership and enqueue recovery with clearly labeled test doubles.
- [ ] Verify a real provider request and reviewed draft with server-side OpenAI credentials.

**Exit gate (automated behavior verified; live provider pending):** A Persian description becomes a validated, reviewable draft through BullMQ. Human approval publishes it once; AI/queue failure leaves ordering operational.

## Phase 7 — Critical verification and CI completion

**Timebox:** 35 minutes · elapsed target: 5:10 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Implemented core workflow and AI path. This phase verifies and fixes high-risk behavior; it does not postpone correctness design until now.

- [x] Run domain unit tests for money, quantities, state transitions, and permission-sensitive rules.
- [x] Run PostgreSQL-backed Jest/Supertest tests for all six RFP isolation scenarios: cross-tenant order read, menu mutation, known order ID, AI result access, manager-only actions, and unauthorized branch access.
- [x] Verify concurrent order creation produces one active order; concurrent valid item additions plus kitchen updates preserve all accepted changes.
- [x] Verify stale incompatible updates return 409 and invalid transitions are rejected without partial writes.
- [x] Verify duplicate keys, changed payloads, concurrent same-key requests, timeout/retry, and replay after application restart do not repeat committed mutations.
- [x] Verify idempotency expiration/cleanup behavior and document the retention guarantee.
- [x] Run Redis-backed queue tests for duplicate delivery, retries, permanent failures, tenant ownership, and recovery after enqueue interruption.
- [x] Run an automated API E2E test: waiter login → order → item addition → kitchen login → view item → change preparation status → confirm persisted state.
- [x] Finish CI: frozen-lockfile install, formatting, lint, typecheck, unit/integration/E2E tests, and production build; initialize test databases predictably.
- [x] Run required checks locally and record unavailable checks in `VERIFICATION.md`.
- [ ] Push source and inspect a successful remote GitHub Actions run; no remote run is claimed.
- [x] Verify cookie/CSRF behavior, sanitized API errors, secret exclusions, Persian RTL HTML and full order flow through the production HTTP proxy.
- [ ] Verify responsive layout, polling and interactions in a connected browser on desktop/mobile/tablet.

**Exit gate:** Required critical checks pass with real database/queue behavior where relevant. Failures or unverified claims are explicitly recorded; critical checks are not made optional.

## Phase 8 — Deployment, documentation, and handover

**Timebox:** 50 minutes · elapsed target: 6:00 · actual: not separately timed (see `TIME_LOG.md`)

**Depends on:** Passing core checks and available hosting credentials.

- [ ] Verify clean setup with documented environment configuration and `docker compose up --build`, including migrations, idempotent seeding, startup health, and controlled shutdown.
- [ ] Deploy frontend, API, worker, PostgreSQL, and Redis with HTTPS, persistent storage, secure production cookies, and server-side secrets.
- [x] Add/verify liveness and readiness behavior so optional queue/provider outages do not incorrectly disable healthy ordering endpoints.
- [ ] Verify production login, tenant/branch restrictions, ordering, kitchen updates, AI review/approval, and failure feedback using demo accounts.
- [x] Confirm structured JSON logs include relevant timestamp, level, request ID, tenant/user, operation, error, duration, and job ID without leaking secrets.
- [x] Complete `README.md`: prerequisites, setup, scripts, environment, migrations/seeding, test commands, demo accounts, architecture, and deployment steps.
- [x] Finalize `SCOPE.md`, `DECISIONS.md`, `AI_USAGE.md`, and `HANDOVER.md` with decisions, AI assistance, test evidence, operational guidance, limitations, and unfinished work.
- [x] Document residual isolation risk if PostgreSQL RLS is omitted, queue-delivery limitations, omitted tests/features, and deployment assumptions.
- [ ] Record a walkthrough of the product, architecture, tenant isolation, concurrency/idempotency evidence, AI failure behavior, and known limitations.
- [ ] Deliver repository URL, live HTTPS URL, demo credentials, recording link, and actual time spent with any overrun disclosed.

**Exit gate:** A reviewer can clone, start, log in, complete the workflow, inspect correctness evidence, use AI drafts, and access the HTTPS deployment. Mark anything unverified as unverified.

## Final acceptance checklist

- [x] Waiter can create/modify an order; kitchen can prepare/ready items; waiter can serve and complete the order.
- [x] Tables reflect authoritative active-order state; historical item prices remain unchanged after menu edits.
- [x] Tenant, branch, and role boundaries are enforced server-side and demonstrated by tests.
- [x] Transactions, concurrency protection, and API idempotency prevent lost updates and duplicate mutations.
- [ ] AI drafts are validated, tenant-scoped, human-approved, and safe under duplicate execution and provider/queue outages.
- [ ] Persian RTL UI works on mobile/tablet with toman values, local time, safe retries, and clear errors.
- [ ] Migrations, reproducible seed, Compose startup, required tooling, tests, build, and CI are verified.
- [ ] Repository, deployment, demo accounts, required documents, recording, time log, and limitations are delivered.

## Timebox and scope-control rules

- Record actual start/end times and unresolved work at every phase boundary. Calendar scheduling does not increase the six-hour implementation budget.
- If behind schedule, reduce visual polish, dashboard extras, filters, and optional infrastructure such as RLS or WebSockets first. Use polling and one active branch in the UI.
- Keep correctness and tenant isolation gates intact. Do not replace critical constraints/tests with mocked assurances to meet a deadline.
- The AI capability remains an RFP requirement. If it cannot be completed safely, disclose it as incomplete rather than presenting a mock as a working integration.
- Hosting access, provider credentials, and external service availability are dependencies. Prepare configuration and deployment instructions when blocked, and clearly distinguish prepared work from a verified live deployment.
- At 360 minutes, record the exact implementation state and any overrun. Remaining required work prevents claiming full RFP completion.
