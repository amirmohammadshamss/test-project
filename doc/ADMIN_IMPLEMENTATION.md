# Admin implementation — 29 October 2026

The expansion is implemented as a nonproduction prototype. Restaurant Admin lives in `apps/web` under `/dashboard`. Super Admin lives in the separate Nx project `apps/super-admin`, port 3001. Both use Tailwind only and the same NestJS API. Original requirements remain in `../admin_pable.md`; policies are in [ADMIN_SCOPE.md](./ADMIN_SCOPE.md).

## Run

From the repository root, configure `.env`, then run:

```sh
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate
pnpm db:seed
ENABLE_PLATFORM_DEMO=true pnpm db:seed-platform
pnpm build
```

The platform seed requires a 12+ character `PLATFORM_DEMO_PASSWORD` or `SEED_DEMO_PASSWORD`, rejects production mode, and is never run by default migration/demo initialization. It creates `platform@demo.restaurantos.test`. Existing restaurant demo users remain documented in README. Never use demo credentials for real customers.

Start API, worker and both frontends in separate terminals:

```sh
node --env-file=.env dist/apps/api/src/main.js
node --env-file=.env dist/apps/worker/src/main.js
pnpm nx start web
pnpm nx start super-admin
```

Restaurant manager: log in on `http://localhost:3000`, follow the administration link or open `/dashboard`. Platform administrator: `http://localhost:3001/login`. Existing restaurant cookies issued before the explicit JWT audience change require a fresh login. Set `WEB_ORIGIN` and `PLATFORM_ORIGIN` to these exact origins; the proxies use `API_INTERNAL_URL` at runtime.

## Delivered behavior

- Manager-only, branch-scoped dashboard aggregates; paginated orders and details/history; category/menu CRUD and versions; table configuration/occupancy; safe staff directory; basic settings; existing AI workflow through the admin facade.
- Separate platform and restaurant JWT audiences, cookie, database sessions, expiry, logout revocation, current account checks, CSRF origins and rate limits. No restaurant-role bypass or public platform registration.
- Tenant directory, safe metadata and branch reads; transactional restaurant/branch/new manager/default category provisioning with separate persisted idempotency; unique normalized registration reference; desired-state lifecycle commands with versions/reasons and audit history.
- Suspension blocks subsequent protected restaurant requests, including existing cookies. Activation restores access. Accepted in-flight work may finish; AI never publishes without approval.
- Actual database/Redis health, worker heartbeat, queue counters and sanitized failure summaries. Unavailable measurements remain unavailable; no queue mutation controls.
- Additive migration applied to existing local development and test databases, preserving original order history and replay records.

## Verification and remaining gates

The first full `pnpm verify` passed formatting, ESLint, all app typechecks, 13 unit tests, 25 PostgreSQL/Redis integration tests and production builds for API, worker, web and super-admin. The expanded integration suite has 27 tests (40 tests together with the 13 unit tests), including concurrent menu/provisioning and table lifecycle cases. Final verification evidence is in VERIFICATION.md.

Browser interaction, responsive/keyboard checks, Docker runtime, remote CI, real HTTPS deployment, live OpenAI output and video remain unverified. Docker/HTTPS/CI configuration includes Super Admin but is not evidence of deployment. Production MFA and secure production onboarding are not implemented. Both the UI and auth responses label platform access as a password-only prototype; real-customer privileged use is outside this delivery.

Staff invitations, role-assignment UI, routine branch management, billing, impersonation and manual queue controls remain deferred. Audit history has no API update/delete endpoints; production retention/export policy remains an operational follow-up.
