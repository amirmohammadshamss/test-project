# RestaurantOS — Phased Implementation Plan

Source: [rfp.md](./rfp.md). Execution checklist updated during implementation. Checked implementation tasks do not imply browser, Docker, live-provider, or hosted-deployment verification; see [VERIFICATION.md](./VERIFICATION.md).

**Original MVP budget:** 360 minutes of actual work, submitted within four calendar days. The estimates below are timeboxes, not a guarantee that every requirement fits. Record actual time per phase and disclose any overrun or incomplete requirement.

**Admin-panel expansion:** based on the populated [Restaurant Admin & Super Admin RFP](../admin_pable.md), version 1.0. Phases 9–17 below cover the concrete requirements, current gaps, separate restaurant/platform milestones and acceptance checks. They are additional scope; the original six-hour assessment is not a budget for full Super Admin delivery.

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

## Requested Nx addition

- [x] Add Nx to the existing pnpm workspace and define explicit app/library/tooling projects.
- [x] Route root build, typecheck, unit test, integration test, lint, format and database scripts through Nx targets.
- [x] Model dependencies and deduplicate the shared backend compile/check task.
- [x] Cache deterministic tasks and leave database operations, integration tests and services uncached.
- [x] Ignore local Nx artifacts and prepare CI cache restoration and non-root Docker task execution.
- [x] Verify all six projects, dependency graph, full local checks and unchanged-build cache reuse.

## Requested Tailwind-only styling

- [x] Replace the custom frontend stylesheet with Tailwind utility groups and state/responsive variants.
- [x] Keep the global stylesheet limited to the Tailwind import and remove custom keyframes/selector rules.
- [x] Resolve composed utility overrides without inline styles or another styling framework.
- [x] Verify all 911 utility candidates are extracted and accepted by Tailwind.
- [x] Pass the Nx-backed local check pipeline (34 tests), production build and utility-composition checks.
- [ ] Perform browser visual comparison when a browser is connected; unavailable in this session.

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
- [x] Verify duplicate keys, changed payloads, concurrent same-key requests, timeout/retry, and replay after application restart do not repeat committed mutations. A separate fault smoke check also verified actual post-commit response loss and controlled PostgreSQL restart with zero duplicates.
- [x] Verify idempotency expiration/cleanup behavior and document the retention guarantee.
- [x] Run Redis-backed queue tests for duplicate delivery, retries, permanent failures, tenant ownership, and recovery after enqueue interruption.
- [x] Run an automated API E2E test: waiter login → order → item addition → kitchen login → view item → change preparation status → confirm persisted state.
- [x] Finish CI: frozen-lockfile install, formatting, lint, typecheck, unit/integration/E2E tests, and production build; initialize test databases predictably.
- [x] Run required checks locally and record unavailable checks in `VERIFICATION.md`.
- [ ] Push source and inspect a successful remote GitHub Actions run; GitHub currently rejects workflow uploads because the credential lacks `workflow` access. Initial local commit and configured Docker CI checks are ready.
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

## Admin platform expansion — Phases 9–17

**Source:** [admin_pable.md](../admin_pable.md), version 1.0, sections 1–36. The specification defines both Restaurant Admin and Super Admin. This roadmap supersedes the earlier empty-file planning framework. It adds work to phases 1–8 without changing their recorded completion or outstanding verification.

**Delivery milestones:**

- **R1 — Restaurant Admin:** complete the manager dashboard, menu/categories, orders, tables overview and AI drafting/review workflow in `apps/web` before platform administration. Seeded staff and table configuration remain valid for the original assessment.
- **R2 — Restaurant configuration:** add the specified staff directory, basic settings and table configuration; staff invitations, role-assignment/deactivation UI and routine branch administration remain future work where the RFP explicitly defers them.
- **P1 — Super Admin prototype:** separate privileged login, restaurant directory/provisioning, activation/suspension, branch metadata, append-only audit history and actual operational/queue health. This is a separate milestone after the restaurant core is reliable, as required by RFP section 2.2.
- **Production release:** additionally requires verified MFA for privileged accounts, deployment/session/origin controls, CI and real environment checks. A prototype without MFA must be labeled unsuitable for managing real customers and must not be presented as production-ready.

**Planning estimate:** approximately **34–54 additional engineering hours**, with phase ranges below. This is an initial estimate for the functional prototype and its tests/documentation, not a delivery guarantee. It excludes future features, production MFA/provider integration and external access delays. Re-estimate after Phase 9; the original six-hour assessment does not absorb this expansion.

### Existing implementation and confirmed gaps

- Reuse existing manager/waiter/kitchen authentication, tenant/branch membership checks, price snapshots, transactional ordering, API idempotency, BullMQ AI drafts and human approval, Persian RTL/Tailwind utilities, Nx and pnpm.
- Menu categories currently support listing/seed data; category editing, ordering and activation are missing. Menu updates currently have no version check and can overwrite a concurrent manager edit.
- Existing order lists are capped at 100 records rather than paginated. Dashboard totals must come from database aggregates, not counts of that truncated list. Order details also need modification timestamps and useful history presentation.
- Table configuration is seeded. Staff directory, account-status presentation, basic restaurant settings and routed manager screens are missing.
- Restaurant/branch lifecycle metadata, platform identities/revocable sessions, privileged audit history, platform APIs and a Super Admin frontend are missing.
- Existing idempotency assumes a restaurant actor, tenant and branch. Platform provisioning needs an explicit platform principal/scope rather than a fabricated tenant or a bypass of restaurant guards.
- Current health endpoints cover liveness/database readiness. Redis/worker/queue status and sanitized operational summaries need real adapters with bounded failure behavior.

### Requirement groups

Use these identifiers in implementation notes and tests; they group the actual RFP sections rather than inventing new scope.

- **RA-01:** manager dashboard, summaries, recent orders and shortcuts — section 4.
- **RA-02:** categories, items, integer money, price snapshots and stale menu conflicts — sections 5.1–5.4.
- **RA-03:** order lists/details/history and safe operational actions — section 6.
- **RA-04:** table overview and configuration with historical preservation — section 7.
- **RA-05:** staff directory and restricted future staff administration — section 8.
- **RA-06:** basic restaurant/branch settings — section 9.
- **RA-07:** validated, human-approved asynchronous AI menu drafts — section 5.5.
- **SA-01:** separate platform identity, controlled provisioning and session security — sections 3.2, 13, 19 and 24.
- **SA-02:** directory, atomic tenant/initial-branch/manager provisioning, lifecycle and branch metadata — sections 11–12.
- **SA-03:** restricted append-only audit history — section 14.
- **SA-04:** actual aggregate dashboard/health and read-only queue monitoring — sections 10, 15, 25 and 30.
- **SH-01:** architecture, API contracts, isolation, transactions/idempotency, migrations, RTL, testing, Nx/tooling and delivery — sections 17–29 and 31–36, plus the user's Nx/Tailwind/document-location requirements.

Implementation record: [ADMIN_IMPLEMENTATION.md](./ADMIN_IMPLEMENTATION.md). Local API/UI work is implemented; unchecked mixed verification and delivery gates remain open.

### Phase 9 — Scope, policy and acceptance contracts

**Milestone:** foundation for R1/R2/P1. **Estimate:** 2–3 hours.

- [x] Read the now-populated specification and identify both management contexts and the separate Super Admin milestone.
- [x] Compare requirements with existing schema, guards, menu service, order queries and idempotency behavior; record the gaps above.
- [x] Write `doc/ADMIN_SCOPE.md` as an expansion scope without rewriting the original `doc/SCOPE.md` history; map every requirement group to its milestone and acceptance scenarios.
- [x] Define the manager/waiter/kitchen/platform authorization matrix: platform credentials confer no ordinary restaurant-order/customer-data access, and restaurant managers cannot assign platform privileges.
- [x] Define category/table deactivation behavior for new orders and historical records; define supported settings and the permitted scope of manager branch information changes.
- [x] Define the canonical tenant/provisioning identity for duplicate detection across administrators. Restaurant names and manager emails are not automatically unique tenant identifiers; choose a meaningful unique provisioning reference/business rule before writing constraints.
- [x] Define secure initial-manager setup for new/existing users, session expiry/revocation, suspension reasons and audit retention. Do not overwrite existing user credentials or introduce staff email invitations implicitly.
- [x] Define suspension semantics: reject subsequent protected restaurant requests using current tenant status; document whether already-authorized in-flight operations/AI jobs may finish. Previously accepted AI work must still never auto-publish menu data.
- [ ] Finalize request/response DTOs, pagination/filter limits, expected versions, error codes, idempotency scopes and test cases. Re-estimate the later phases from these decisions.

**Exit gate:** both milestones have explicit actors, boundaries, lifecycle/race policies and testable acceptance criteria. The source is no longer blocked by missing requirements.

### Phase 10 — Domain and migration foundation

**Milestone:** shared foundation. **Depends on:** Phase 9. **Estimate:** 3–5 hours.

- [x] Extend existing Restaurant/Branch with needed contact, status, creation/update timestamps and lifecycle-version fields; backfill existing tenants/branches as active without resetting data.
- [x] Add MenuItem versions/update timestamps and Category display order/active state; add version checks where category edits require them. Add table active state and appropriate modification/history metadata for the specified screens.
- [x] Add the minimal staff account/membership status and basic settings fields required for directories/settings. Keep restaurant roles as MANAGER, WAITER and KITCHEN.
- [x] Add a separate PlatformAdmin association to existing user identity plus revocable platform-session persistence. Do not duplicate restaurant/user tables or add platform power to restaurant memberships.
- [x] Add tenant lifecycle and administrative audit persistence with actor type, target/resource, action, UTC timestamp, request ID, outcome, reason and sanitized metadata. Normal APIs may append/read appropriately, not edit/delete audit history.
- [x] Extend PostgreSQL-backed idempotency to distinguish principal type and platform versus tenant/branch scope. Preserve existing replay behavior and use a unique non-null canonical scope (or equivalent constraints); nullable columns must not allow duplicate platform keys.
- [x] Implement domain/application ports and transaction adapters for the new use cases; keep domain rules framework-independent and controllers thin.
- [ ] Write migrations/backfills and repeat-safe two-tenant/admin demo fixtures. Preserve historical order prices, ownership constraints, one-open-order-per-table protection and existing request replay records.

**Exit gate:** migrations apply to an existing dataset and a clean database; scope/uniqueness constraints support both principal types without weakening restaurant isolation.

### Phase 11 — Restaurant Admin APIs and correctness

**Milestones:** R1, then R2. **Depends on:** Phase 10. **Estimate:** 4–6 hours.

- [x] Add `/api/v1/admin` manager-facing controllers that delegate to existing/new application use cases. Preserve existing waiter/kitchen APIs and avoid duplicating business rules.
- [x] Implement `GET /dashboard` from authoritative aggregates: active orders, occupied/available tables, pending/preparing/ready work, recent orders with table/branch/time/status/total, and kitchen item activity (RA-01).
- [x] Implement paginated/filterable `GET /orders` and `GET /orders/:id` with quantities, price snapshots, branch context, creation/modification timestamps and relevant history. Reuse transactional add/complete/status use cases for supported manager actions (RA-03).
- [x] Implement category create/rename/reorder/activate/deactivate operations and menu-item list/create/update/availability/deactivation. Define the extra category API contracts needed beyond the section-20 examples (RA-02).
- [ ] Require expected menu versions and return 409/current-state recovery information for stale changes. Define and test ordering versus item/category deactivation, and order completion versus concurrent item addition.
- [x] Implement table overview with branch, authoritative occupancy, active order and total. For R2, add table create/renumber/deactivate endpoints, enforcing branch-unique numbers and historical links (RA-04).
- [x] Add tenant-scoped `GET /staff` with role, authorized branches and account status; add validated basic settings read/update and authorized branch-information access. Do not add invitation/role-management UI in this milestone (RA-05/RA-06).
- [x] Expose scoped AI request/status/approve endpoints under the admin contract while reusing BullMQ processing and transactional repeat-safe approval. Validate approved categories/prices, input limits and optional-service failures (RA-07).
- [x] Ensure all listed `/admin` operations enforce manager role and verified restaurant/branch ownership; use explicit DTO allowlists, pagination limits, sanitized errors and required audit events.

**Exit gate:** R1/R2 APIs work against PostgreSQL, stale menu edits conflict, metrics cover all matching records and existing operational invariants still hold.

### Phase 12 — Restaurant Admin routed interface

**Milestones:** R1, then R2. **Depends on:** Phase 11 contracts/operations. **Estimate:** 5–8 hours.

- [x] Refactor the manager views into feature components and protected routes in `apps/web`; keep waiter/kitchen workflows and login behavior working.
- [ ] Build `/dashboard` with operational cards, paginated recent orders, kitchen activity, quick actions, automatic refresh and honest request-failure states (RA-01).
- [x] Build `/dashboard/menu` category and item controls, supported settings/availability changes, and useful stale-version conflict recovery that preserves unsaved form input (RA-02).
- [x] Build `/dashboard/orders` list/detail/history and eligible order actions, and `/dashboard/tables` with current totals/active-order navigation. Add R2 table configuration after overview correctness (RA-03/RA-04).
- [x] Build `/dashboard/menu/ai-drafts` with persisted pending/failed/ready states, editable review and explicit price/category approval. Manual menu editing must remain usable without AI/Redis (RA-07).
- [x] Build read-only `/dashboard/staff` and basic `/dashboard/settings`, showing only permitted controls and authorized branch information (RA-05/RA-06).
- [ ] Use Tailwind utilities only, Persian RTL labels, integer-toman presentation, Tehran-local time, keyboard/focus support and responsive layouts; add clear confirmations for supported sensitive/deactivation actions.
- [ ] Verify real manager workflows, API denial for waiter/kitchen roles and ongoing polling across sessions before declaring R1 accepted.

**Exit gate:** a manager can complete the Restaurant Admin acceptance scenarios in RFP 34.1; the core restaurant workflow remains reliable before P1 delivery.

### Phase 13 — Separate platform authentication and authorization

**Milestone:** P1 security foundation. **Depends on:** Phase 10 and reliable R1 core. **Estimate:** 4–6 hours.

- [x] Add a dedicated platform-admin NestJS module and explicit PlatformAdminGuard with a platform principal context; no `isSuperAdmin` bypass in restaurant guards/repositories (SA-01).
- [x] Define platform login/logout/me contracts, for example `/api/v1/platform/auth/*`, with separate JWT audience/purpose and cookie name. Restaurant sessions must not authenticate platform routes, or vice versa.
- [x] Provision administrator accounts through controlled configuration/CLI/opt-in nonproduction seed; never expose public platform signup or platform-role assignment through restaurant endpoints.
- [x] Enforce secure password storage, expiry, database-backed session revocation, authentication/privileged-operation rate limits, strict DTO validation, HttpOnly/Secure cookies and context-appropriate CSRF protection.
- [x] Configure exact allowed origins for restaurant and Super Admin frontends and verify cookie/origin boundaries. A second frontend origin must not turn the current single-origin CSRF check into a wildcard exception.
- [x] Audit attributable privileged authentication failures and relevant access/configuration changes without recording passwords, tokens or sensitive request bodies.
- [ ] For a demo without MFA, display/document the prototype restriction and keep real-customer administration out of its production claim. Implement and verify MFA as a separate production-release requirement before privileged production use.

**Exit gate:** only controlled platform identities with valid, unrevoked platform sessions reach platform APIs; they still cannot read ordinary restaurant orders by default.

### Phase 14 — Tenant provisioning, lifecycle and audit use cases

**Milestone:** P1. **Depends on:** Phases 10 and 13. **Estimate:** 5–8 hours.

- [x] Implement `/api/v1/platform/restaurants` directory/detail with server-side search, filtering and pagination; expose only approved metadata/contact fields, timestamps, status and branch counts (SA-02).
- [x] Implement CreateRestaurantUseCase: atomically create restaurant, initial branch, supported defaults, secure initial-manager association/setup and audit event, together with the idempotency result.
- [ ] Handle completed replay, changed-payload conflicts, concurrent provisioning, network timeout/restart and the agreed cross-administrator duplicate-identity constraint. Do not deduplicate legitimate tenants merely because their names match.
- [x] Implement desired-state suspend/activate use cases with expected versions/conditional updates, required suspension reason and atomic lifecycle/audit persistence. Repeated commands must not duplicate provisioning or corrupt lifecycle state.
- [x] Enforce persisted tenant status on subsequent protected restaurant requests, including sessions issued before suspension; test the documented in-flight-work policy and activation recovery. Suspension must preserve all business/history records.
- [x] Implement high-level `GET /restaurants/:id/branches` with IDs, ownership, status and creation dates; do not route platform users through ordinary branch guards as an access shortcut.
- [ ] Implement restricted, paginated audit reads with actor/resource/action/time/outcome/reason filtering. Provide no ordinary audit mutation endpoints and document retention (SA-03).
- [x] Keep billing, impersonation, support-access grants, automated per-tenant databases and external provisioning side effects outside P1.

**Exit gate:** a platform administrator can create/list/suspend/reactivate tenants safely, every transition is attributable, and tenant data survives unchanged.

### Phase 15 — Super Admin frontend and actual observability

**Milestone:** P1. **Depends on:** Phases 13–14. **Estimate:** 4–6 hours.

- [x] Add `apps/super-admin` as a separate Next.js Nx project using the shared NestJS API, a distinct local port (proposed 3001) and a dedicated production origin. Keep this as another frontend, not another backend microservice.
- [x] Add `/login`, `/dashboard`, `/restaurants`, `/restaurants/new`, `/restaurants/[id]`, `/audit-logs`, `/queues` and `/system-health` with platform-only navigation and server-confirmed actions.
- [x] Build tenant forms/directory/detail, initial branch metadata and activation/suspension controls with reasons, confirmation, safe retry/conflict recovery and visible audit outcomes.
- [x] Add platform aggregate metrics for restaurants/statuses/branches/staff/orders in a selected period, plus pending/failed AI work where supported. Return aggregates and approved metadata, not individual restaurant order/customer records (SA-04).
- [x] Add bounded adapters for actual API/database readiness, Redis connectivity, queue counts and sanitized recent failure/error summaries. Surface unavailable/stale/unknown states with last-checked timestamps; never invent uptime percentages.
- [x] Record/query a real worker heartbeat or equivalent measurable signal so worker availability is distinguished from Redis availability. Optional monitoring failures must not disable restaurant ordering or startup.
- [x] Keep queue monitoring read-only: counts, retained completed/failed totals and sanitized summaries, with no raw payloads, manual retry, pause/resume or job-payload editing.
- [x] Reuse Tailwind design utilities/components where useful; create `packages/ui` only if it reduces real duplication. If extracted, configure both Tailwind source scanners and Nx/TypeScript boundaries so UI code is not compiled by the shared backend build.

**Exit gate:** P1 routes operate on real platform APIs; metrics/health are measured, sensitive tenant details remain hidden and no unsupported operational controls appear.

### Phase 16 — Security, concurrency and end-to-end verification

**Milestones:** R1/R2/P1 acceptance. **Depends on:** Phases 11–15. **Estimate:** 5–8 hours.

- [x] Implement all restaurant scenarios from RFP 27.2: manager item creation, waiter rejection, cross-tenant menu denial, stale menu rejection, repeat-safe AI approval and authorized dashboard data.
- [x] Implement all platform scenarios from RFP 27.3: restaurant-user denial, tenant creation, duplicate prevention, suspension enforcement, reactivation, lifecycle audit evidence and aggregate privacy.
- [x] Attempt known cross-tenant IDs, client tenant manipulation, restaurant-to-platform role escalation, platform credentials on restaurant APIs, revoked sessions, invalid CSRF/origins, stale writes and repeated sensitive requests.
- [ ] Exercise real PostgreSQL races for simultaneous menu edits/deactivation/order addition, order close/add, concurrent provisioning and suspend/activate; verify versions, uniqueness, price snapshots and audit consistency.
- [ ] Verify BullMQ duplicate delivery/retry behavior and queue/heartbeat monitoring with real Redis, including outage/timeout states without restaurant-ordering failure.
- [x] Extend API E2E flows for manager administration and platform create → manager access → suspend/denial → reactivate, plus read-only platform queue/audit/health flows.
- [x] Retain the current 34-test baseline and add meaningful new cases. Run Nx lint/typecheck/tests/builds across every app, including `super-admin`; integration/security tests stay uncached and mandatory in CI.
- [ ] Verify Persian RTL, keyboard access, mobile/tablet layouts, error/empty states and separate authenticated sessions in connected browsers. Record any unavailable verification without marking it passed.

**Exit gate:** RFP sections 27 and 34 pass with evidence; no regression in the existing order/kitchen or tenant-isolation guarantees is observed.

### Phase 17 — Reproducible delivery and handover

**Milestones:** restaurant and platform releases. **Depends on:** Phase 16 and external environment access. **Estimate:** 2–4 hours, excluding access delays.

- [x] Add the Super Admin frontend to Compose, root Nx build/typecheck/test/dev targets, environment examples and CI/container smoke checks. Confirm non-overlapping outputs and correct runtime API proxy addresses.
- [x] Extend HTTPS routing to separate restaurant/admin hostnames with secure host-only cookies, exact CORS/CSRF origins, restricted privileged access and operational health/logging.
- [ ] Verify clean migrations/backfills and idempotent seed/setup with two independent restaurants, all restaurant roles, controlled platform demo access, AI draft examples, lifecycle records and audit history.
- [x] Update `doc/README.md`, expansion scope, decisions, AI usage, owner handover, verification and this plan; preserve the original MVP scope/history and document all deferred features/prototype limits.
- [x] Record the manager and platform workflows plus decisions about isolation, revocation, suspension races, idempotency, audit and health. Do not present a walkthrough script or fake provider/health data as verified functionality.
- [ ] Verify remote CI, Docker startup and actual HTTPS deployments before claiming them complete. Existing GitHub workflow-permission, hosting, browser and live-provider gaps remain independent delivery dependencies until resolved.
- [ ] Before real-customer platform use, verify MFA, production session/security controls and the privileged operational runbook; otherwise deliver only the labeled nonproduction prototype.

**Exit gate:** the agreed milestone is implemented, tested, documented and demonstrated; required live deployment and production-security claims are supported by evidence.

### Explicit future work

- Staff invitations, role/branch assignment and deactivation/session-management UI beyond the specified read-only directory; sensitive role changes must be audited whenever these are later implemented.
- Routine manager branch administration beyond supported basic information and initial platform provisioning.
- Billing/subscriptions, payment reconciliation, advanced financial analytics, inventory/payroll/loyalty, customer impersonation/support-access tooling, manual queue controls, complex role/feature builders and multi-region/microservice infrastructure.
- Production MFA integration is mandatory before real-customer privileged use; it is not silently counted as delivered by a password-only prototype.

### Admin expansion acceptance checklist

- [x] Source specification is populated and Restaurant Admin/Super Admin milestones and requirement groups are recorded.
- [ ] R1 manager authentication/dashboard/menu/orders/tables/AI review works with tenant/branch restrictions and authoritative data.
- [ ] Category/item lifecycle and menu version conflicts work without changing historical prices or allowing unsafe order races.
- [ ] R2 staff directory, supported table configuration and basic settings meet the documented scope; deferred staff/branch controls are not implied complete.
- [ ] Only controlled, valid platform sessions access P1; restaurant roles cannot escalate and platform users receive no default order/customer access.
- [ ] Tenant provisioning is atomic and repeat-safe, suspension blocks subsequent restaurant access, activation restores it, and historical data remains intact.
- [ ] Privileged/lifecycle events are attributable and append-only through APIs; audit and metrics expose only permitted sanitized data.
- [ ] Queue/system views use actual measurements and remain read-only; optional outages leave core ordering usable.
- [ ] Separate Persian RTL/Tailwind interfaces, all required security/concurrency/E2E tests, Nx checks and migrations pass.
- [ ] Documentation, demo records, video, CI, Docker and required HTTPS delivery are verified; production MFA/security gating or prototype restrictions are explicit.

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
