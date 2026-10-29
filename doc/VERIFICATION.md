# Verification record

Execution date: 2026-10-29. See `TIME_LOG.md` for checkpoints.

## Confirmed so far

- PostgreSQL 16 local cluster on port 55432; Redis 8 local test instance on 56379 (CI/Compose target Redis 7).
- Prisma migration applied to separate development and test databases; idempotent Persian seed ran repeatedly.
- TypeScript checks, ESLint, domain/API/queue tests, and Next.js production build passed. Final counts/results are recorded below.
- Nest API and independent worker start locally. Next production server starts on port 3000.

## Unverified / incomplete

- Browser/UI interactions, visual layout and responsive behavior: no browser connected to CUA.
- Docker image/Compose runtime: Docker executable resolves to an absent Docker application in this environment.
- Live OpenAI call: no `OPENAI_API_KEY` configured. Automated provider tests use explicitly labeled test doubles.
- Hosted HTTPS deployment: no host/account configured. No live URL is claimed.
- Remote GitHub Actions: workflow authored, but GitHub rejected the push because the existing token lacks `workflow` permission. No remote run is claimed.
- Video: script supplied; required recorded video not produced.
- Abrupt host/power-loss crash recovery is not tested. Controlled PostgreSQL restart and actual post-commit HTTP response loss are verified below.
- Load/capacity benchmarks, RLS, immediate JWT revocation, full staff-management UI and browser E2E tests are outside the implemented slice and must not be described as delivered.

## Final local checks

- Full `pnpm verify` succeeded before the final Nest worker-lifecycle refactor: formatting, ESLint, TypeScript, **13 unit/client/provider tests**, **20 PostgreSQL/Redis integration tests**, and API/Next.js production builds.
- `node --env-file=.env scripts/smoke.mjs` passed against the built local stack, checking Persian RTL HTML, the runtime web/API proxy, HttpOnly/SameSite cookies, role sessions, waiter ordering, kitchen preparation, serving/completion, and persisted `AI_NOT_CONFIGURED` failure without disabling core readiness.
- `.env`, generated Next type declarations and TypeScript build caches are ignored by Git.
- Final worker lifecycle check passed: **21 integration tests**, plus the unchanged **13 unit/client/provider tests**, for **34 passing tests** total. Formatting, lint and backend compilation were rerun after the worker lifecycle change and passed. The frontend production build is unchanged from the passing full run.

## Continued delivery checks

- Initial source commit: `c2085ba`; pre-commit Husky/lint-staged checks executed successfully. GitHub rejected push of the CI workflow because the existing token lacks `workflow` scope. Source remains local until authentication is updated.
- The fault smoke test discarded two real HTTP responses after upstream commits, restarted only the isolated local PostgreSQL cluster, replayed the original request keys, verified zero duplicate orders/items, and completed the order. This tests response-loss recovery and controlled database restart, not power-loss durability.
- Added a Docker Compose CI job for complete startup, built-stack waiter/kitchen flow, committed-response-loss/database-restart replay, ordering while Redis is stopped, and HTTPS configuration validation. It is not verified remotely yet.
- Added `docker-compose.https.yml` and `Caddyfile`; the override forces HTTPS origin/Secure cookies, persists certificate state, and keeps web port 3000 on localhost. YAML parses and lint/format checks pass; actual container/certificate verification remains pending.
- Railway was identified as an optional compatible host integration; it is not connected. No hosting resources were created.

## Nx migration

- Nx 24.0.2 discovers `api`, `worker`, `web`, `database`, `shared` and `workspace`.
- Exported graph confirms API/worker → database/shared and web → shared.
- `pnpm verify` passed through the new Nx-backed root scripts: formatting, lint, backend/web type checks, all 13 unit tests and 21 integration tests, and both backend/Next.js production builds.
- An immediate unchanged build reused 4 of 5 tasks from local cache; Prisma client generation intentionally ran again. The shared backend compilation executed once per task graph. Removing the generated backend output (with a backup retained) and running `nx build api` restored identical API/worker/client entrypoint hashes from cache. Repeating unit targets reused all three app test caches (5 API + 4 worker + 4 web tests).
- CI task-cache restoration and Docker ownership were updated for Nx. Remote CI/container execution remain unverified under the existing delivery blockers.

## Tailwind-only styling

- Removed 2,120 lines of custom global CSS; the stylesheet now contains only `@import 'tailwindcss'`.
- Converted reusable component styles to Tailwind utilities/data-attribute variants in `apps/web/lib/ui.ts`, including responsive, focus, disabled, active, pseudo-element and reduced-motion rules. No inline style objects, CSS modules or custom keyframes remain in frontend source.
- All 911 unique utility candidates are detected by Tailwind's scanner and accepted by its compiler. Tailwind class merging was checked for button size, padding, alignment and color overrides.
- Full Nx-backed verification passed: formatting, lint, type checks, 13 unit tests, 21 real-service integration tests and production builds. The final transparent-search/active-hover adjustments were separately compiled in a successful web production build.
- Browser inventory remains empty. Visual parity and responsive interactions have not been observed in a browser.

## Admin expansion — 29 October 2026

- Full `pnpm verify` passed: formatting, ESLint, backend and both frontend typechecks, 13 unit tests, 27 real PostgreSQL/Redis integration tests (40 total), and API/worker/web/Super Admin production builds. Integration tasks were uncached.
- Added tests for manager-only access, cross-context cookies including renamed-cookie attempts, exact CSRF origins, transactional provisioning replay/changed payload/duplicate reference, concurrent provisioning, suspension of existing sessions and login, stale lifecycle versions, activation, audit consistency, menu stale/concurrent edits, category inactivity, staff sanitization, pagination, occupied/inactive tables, actual monitoring and revoked platform sessions. Existing branch/idempotency/AI workflow tests still pass with explicit restaurant JWT audiences.
- Additive migration applied to the existing local development/test databases. Opt-in platform seed succeeded in development.
- Restarted all four local services. HTTP smoke checks returned 200 for restaurant `/dashboard` and platform `/login`; platform login, dashboard, tenant directory, audit, queue and health APIs succeeded through port 3001's Next proxy. Health measured API/database/Redis ready and a fresh available worker heartbeat. No raw credentials were printed.
- Evidence logs in this execution environment: `/tmp/restaurantos-admin-final-verify.log`, `/tmp/restaurantos-admin-integration-final.log`, and service logs `/tmp/restaurantos-{api,worker,web,super-admin}.log`.
- Browser visual/keyboard/mobile behavior, new monitoring outage/race permutations beyond the listed tests, clean-database deployment, Docker runtime, remote CI, live OpenAI, video and HTTPS hosting remain unverified. Production MFA and production onboarding remain unimplemented. These are open gates, not passing checks.

## Shift recovery remediation — latest checkpoint

See [REMEDIATION_STATUS.md](./REMEDIATION_STATUS.md) for the current evidence and open gates. Full Nx checks pass with 13 unit + 35 real-service integration tests; 3 additional Chromium tests pass, for 51 tests total. Independent browser sessions now exercise the waiter/kitchen lifecycle, accidental empty-order cancellation, copied-cookie logout denial, >100 kitchen orders, polling/navigation, responsive overflow and offline/stale recovery. All migrations also passed against a new empty local database. Earlier browser-unavailable statements are historical checkpoints, not the current browser status. Docker runtime, remote CI, live AI, HTTPS hosting and the narrated recording still remain unverified/incomplete.

## Socket.IO expansion — subsequent scope

Full local Nx verification passes with 13 unit tests and 43 real PostgreSQL/Redis/Socket.IO integration tests. Five Chromium scenarios pass, including live staff updates, manager dashboard refresh, reconnect REST synchronization and REST commands with Socket.IO blocked (61 tests total). Integration connections exercise actual WebSocket and polling transports, exact-origin admission, later polling-origin rejection, tenant/branch isolation, post-commit state visibility, failed transaction/replay behavior, concurrent additions, kitchen notifications, socket command denial, delivery failure, session/logout revocation and idle authorization changes.

See [REALTIME.md](./REALTIME.md) for architecture, primary references and limits. Local Next relay transport is long-polling; the API's WebSocket transport is verified directly. Caddy's HTTPS WebSocket upgrade forwarding is configured but unverified in Docker/hosting. No outbox, Redis adapter, cross-instance delivery or capacity guarantee is claimed. Latest logs: `/tmp/restaurantos-realtime-final-verify.log` and `/tmp/restaurantos-realtime-browser.log`.

The restarted local demo additionally passed standard-client Socket.IO polling through Next, direct WebSocket connection to Nest, and logout-driven disconnection of both transports. Next's Socket.IO trailing-slash redirect was corrected and covered through the real browser-server test setup. Final lint/format/whitespace checks pass; no runtime Docker/TLS upgrade claim is added.

## Central notification verification

Full local Nx verification and Chromium workflow suite passed after the notification expansion. Coverage includes recipient/tenant/branch ownership, private and platform socket namespaces, restricted suspension notices, stable outbox deduplication, rollback, ready/preparation/cancellation routing, requesting-manager AI failure, delayed-order/retention behavior, read/ack persistence, session revocation, encrypted subscription registration and bounded real-Redis retry processing. Browser checks cover the persistent center, mobile layout, platform separation and suspended-manager access. Push HTTP sender outcomes are injected; no real browser push service or OS display is claimed. HTTPS/device acceptance remains pending operator configuration.

Final local smoke: restarted API, worker, restaurant web and platform web. Authenticated notification list/count/preferences/device endpoints returned successfully through the restaurant frontend for manager, kitchen and waiter; each test session was logged out. All four migrations also applied successfully to a newly created isolated local database, with existing databases preserved.

## AI strategy Phase 1 verification

Full local Nx verification: 20 unit and 60 integration tests, plus production builds. Chromium: 9 workflows, including request persistence, saved-draft reopening, explicit corrected-price publication and reload. Fresh isolated database: all five migrations apply. Tests cover real Redis recovery, tenant-scoped history/metrics, concurrent daily limits, replay, private completion, usage persistence, missing authorization and retention. Provider tests cover strict OpenAI/Ollama schemas, missing eligibility, invalid prices/refusal and oversized output. These are injected provider responses; no live model quality, billed cost or staff time-saving result is claimed.

## Manager assistant Phase 2 slice

Full local checks now cover 23 unit tests and 63 PostgreSQL/Redis integration tests. Chromium passes 10 workflows, including persistent manager questions, scoped factual results, reload recovery and mobile overflow. All six migrations apply from scratch to an isolated local database. New checks cover strict tool schemas, Tehran/Saturday windows, tenant and same-tenant manager privacy, branch isolation, cancelled-line exclusion, shared quota/replay, actual Redis retry, lost-lease fencing, exhausted-attempt deduplication and retention. The evaluation command refuses to invoke a model without opt-in. Provider responses remain fixtures; no live question-routing accuracy or time-saving result is claimed.

Final local smoke after restart: manager access to saved AI analyses/history succeeded through the restaurant frontend; waiter and kitchen access was denied. Notification and existing AI draft endpoints retained their expected role restrictions. All smoke sessions were logged out. No provider inference was invoked.

## Assessment hardening verification

Full pipeline passed: 25 unit tests, 66 database/Redis integration tests, TypeScript, lint, formatting and all production builds. Chromium passed 10 workflows, including kitchen instruction entry/display. New checks cover per-account proxy throttling, separate authenticated AI identities, ignored spoofed forwarded headers, provider-aware smoke policy, safe error diagnostics, instruction validation, immutable snapshots and idempotent replay. All seven migrations applied on a fresh isolated database. The seed produced 126 orders/366 lines/368 events plus useful labeled notifications and AI fixtures; two reruns preserved counts and reviewer edits/read state. No live model was called.

## User-requested operational analytics

- Local migration eight applied to the demo and dedicated test databases; nullable chronological item timestamps preserve legacy records.
- Full integration run: 69 tests passed. After adding a closed-first-day history correction and additional branch/empty-data cases, the targeted analytics suite passed all four tests. Prior suites were not rerun without a reason; the final new total is 70 integration cases.
- Final unit suite: 30 tests passed; backend TypeScript compilation, web TypeScript/build and targeted lint/format checks passed.
- Chromium: all 11 workflows passed, including the four direct reports, insufficient-data messages, mobile RTL and kitchen timing/order regression flows.
- Live AvalAI routing evaluation: 12 of 13 fixed questions matched tool and period; zero provider errors, 4,572 reported input and 187 output tokens, elapsed 55,863 ms. Billed cost was not measured. A separate four-question probe for the new reports matched all four. Model routing is imperfect and direct report buttons remain available independently.
- New PostgreSQL fixtures cover 56 complete demand days, real menu pair support, measured preparation/queue times, cross-tenant and same-tenant branch exclusion, denied caller-supplied scope, empty data, and idempotent kitchen transition timestamps. No real restaurant forecast accuracy, holiday behavior or measured business time savings is claimed.

## Menu assistant retirement

Owner-requested removal deletes menu-draft HTTP controllers/repositories and both UI entry points, stops registering the menu-processing worker, redirects old links to manual menu, removes the package evaluation command and stops creating new demo drafts. Historical draft rows are preserved but excluded from manager report quota. The shared worker heartbeat now comes from the active manager-analysis dispatcher. PostgreSQL/Redis integration: 69 tests passed; unit suite: 30 passed; backend/frontend type checking, production web build and targeted lint passed. Retired endpoint tests assert 404; manager reporting and manual menu APIs remain covered. Smoke now exercises manager analysis rather than removed menu drafting.

Final retirement verification: all 11 Chromium workflows passed, including absent menu-assistant controls, legacy-link redirect, manual-menu entry availability and the retained manager reports. The restarted local stack passed the full waiter/kitchen smoke and a queued live AvalAI manager-analysis request.
