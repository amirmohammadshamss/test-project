# RestaurantOS admin expansion scope

Source: `../admin_pable.md` v1.0 and phases 9–17 of `PLAN.md`. Recorded before expansion implementation. Original `SCOPE.md` remains the original assessment scope.

Restaurant Admin extends the existing application with an authoritative shift dashboard, paginated order/history views, category administration, versioned menu updates, table configuration, staff directory and basic settings. Existing ordering and human-approved BullMQ AI processing are reused. Staff invitations/role-assignment UI, routine branch administration and billing remain future work.

Super Admin is a separate Next.js application and separate privileged authentication context over the same NestJS modular monolith. It manages tenant metadata/lifecycle, controlled initial provisioning, append-only audit reads and measured queue/system summaries. Platform identity never bypasses restaurant membership guards or grants default access to restaurant orders/customer records.

## Policies

- Restaurant roles remain MANAGER/WAITER/KITCHEN. PlatformAdmin is a separate association to the existing User model. Platform JWT audience/cookie and revocable persisted session are distinct from restaurant sessions.
- Suspension rejects subsequent protected restaurant requests based on current database state, including previously issued cookies. Already-authorized atomic requests and accepted AI generation may finish. AI approval/publication still requires an active authenticated tenant. Reactivation restores permitted access without deleting data.
- Menu/category/table updates carry expected versions. Categories and items that are inactive are unavailable for new additions. A deactivated table cannot open a new order; historical/current orders remain linked. Table deactivation while occupied is rejected. Menu/category rows are locked consistently while an item snapshot is added, so deactivation and ordering have a defined serialization point.
- Platform registration uses an explicit, case-normalized, unique provisioning reference. Names and contact/manager emails do not identify a unique business. Same reference under concurrent administrators conflicts; distinct references are distinct registrations.
- Initial manager provisioning creates a new user with a minimum 12-character operator-provided demo/setup password stored only as a scrypt hash. Existing email addresses are rejected rather than silently reassociated or having credentials overwritten. No email is sent. Production onboarding/password-reset integration is a follow-up; do not use prototype setup credentials for real customers.
- Platform mutations and audit events commit atomically. Platform idempotency has its own table/unique principal-operation-key scope, separate from existing restaurant idempotency records, preserving old replay keys without a fake tenant. Retention is seven days. Lifecycle operations require expected versions; same desired state is a harmless no-op, not another transition.
- Audit records are append-only through normal APIs. Lifecycle/menu/category/table/settings changes are recorded with actor/request/target metadata. Application history is retained in the prototype; production retention/export must be established before real customer use. No credentials, raw AI descriptions or raw queue payloads are exposed in audit/monitoring.
- Platform sessions expire after one hour and are checked against active account/user/session state on every request. Logout revokes the session. Secure cookies are required under HTTPS; separate exact origins are required for the two frontend contexts. No public platform registration exists.
- Currency presentation supports TOMAN and timezone Asia/Tehran for this release; canonical values remain integer IRR and UTC. Settings cannot arbitrarily change those storage rules.
- Platform health uses actual database/Redis checks and a worker heartbeat with timestamps. Optional monitoring failures must not become a hard dependency for ordering/API startup.
- Production privileged administration requires MFA. A password-only implementation is explicitly a nonproduction prototype and must not manage real customers. No production-readiness claim is made without those controls and real deployment checks.

## Verification

Retain the existing 34-test baseline and add PostgreSQL/Redis-backed role, isolation, stale-update, provisioning, lifecycle, revocation, audit and monitoring tests. Both frontends use Persian RTL/Tailwind only and Nx/pnpm targets. All documentation stays in `doc/`; original input specifications are preserved.
