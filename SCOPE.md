# RestaurantOS — Original MVP Scope

Written before production code on 2026-10-29. Source: `rfp.md` and `PLAN.md`.

## Problem and users

Deliver one reliable Persian restaurant workflow for managers, waiters, and kitchen staff: select table → open order → add/update items → prepare → ready → serve → complete. Multi-restaurant and branch isolation, safe concurrent changes, and safe retries are acceptance requirements.

## Research and assumptions

Desk research only; no customer interviews were conducted. Sources checked 2026-10-29:

- [Menuchee](https://menuchee.ir/) advertises table ordering, kitchen displays, and cashier access controls. This verifies a local vendor offers these workflows, not their prevalence or usability.
- [Unicode Persian guidance](https://cldr.unicode.org/translation/language-specific/persian) specifies Persian letters/digits and separators. Use `Intl` for Persian numeric/date display.
- [CLDR currency data](https://github.com/unicode-org/cldr/blob/main/common/main/en.xml) identifies IRR as Iranian rial. The RFP defines this project's explicit conversion of 10 rials per displayed toman; it is an application contract, not a claim about future monetary policy.
- Assumptions to validate with a restaurant: table-based service, staff sharing a kitchen board, categories such as drinks/burgers/pizza, one active order per table, and whole-toman input. Demo prices are fictional, not a market price survey.
- Cashier/payment reconciliation is excluded; completion indicates operational service completion, not a financial settlement.
- Hosting, outbound AI access, and provider account eligibility must be verified for the chosen deployment location. No local availability guarantee is made. Ordering must work without Redis/AI.

## Rules decided before implementation

- Restaurant is tenant; branches belong to it. Server verifies restaurant and branch membership at every authenticated boundary. A session has one active membership/branch; there is no arbitrary client tenant override or branch-switch UI in MVP.
- MANAGER: tables/orders/kitchen plus menu editing and AI draft review. WAITER: tables/menu read, order creation/addition/quantity changes, serving and completion. KITCHEN: menu/order read, kitchen state updates; no menu editing, serving, or order completion.
- Order states: OPEN → COMPLETED. Item states: PENDING → PREPARING → READY → SERVED. Only pending quantities can change. Kitchen/manager advances preparation; waiter/manager serves. No cancellation/deletion in MVP.
- Close only a nonempty open order whose items are all served. Completed orders are immutable. Table availability derives from existence of an open order.
- Integer rial storage, integer whole-toman input/output conversion. Reject fractions, negatives, unsafe integers and out-of-range prices rather than silently round. Cap item price at 100,000,000 toman and quantity at 99. Snapshot name and price when ordering.
- PostgreSQL stores UTC timestamps; frontend uses `fa-IR`, Persian calendar and `Asia/Tehran`.
- Parent-order row locking serializes mutations affecting invariants; conditional versions reject stale quantity/status/close edits. Independent additions append to current state without a stale-order replacement.
- Critical operations require an idempotency key scoped to tenant, actor, operation and payload fingerprint. Business change and stored response commit together. Replays return the original result; changed payload gets 409. PostgreSQL serializes simultaneous same-key requests. Retain records for 7 days; guarantees end after cleanup.
- Persist AI requests first; a worker reconciles pending requests into BullMQ. Validate strict output and persist one draft. Explicit, transactional, repeat-safe manager approval creates one menu item. Retries are bounded, permanent failures stop, and no generated price auto-publishes.
- Poll every 5 seconds. On conflict, reload server state and preserve input. Do not claim success before server confirmation; retain the same request key after uncertain network outcomes.

## In scope

JWT HttpOnly sessions, role/tenant/branch guards, menu CRUD without destructive deletes, table dashboard, complete ordering/kitchen flow, audit events, price snapshots, idempotency, concurrency protection, async AI menu drafts, Persian RTL responsive screens, realistic reproducible seeds, Jest/Supertest checks, pnpm tooling, Compose, CI, deployment instructions, owner handover.

Staff membership is seeded and enforced. Interactive staff invitation/management is deferred; the RFP describes it in manager responsibilities but does not define it as a separate required MVP module. This limitation must be disclosed.

## Excluded

Payments, accounting, inventory, suppliers, payroll, loyalty, reservations, delivery, discount engines, advanced analytics, native apps, full offline synchronization, WebSockets, microservices, Kubernetes, event sourcing, dynamic permission builders and autonomous AI agents.

## Acceptance and risks

Use phase gates and final checklist in `PLAN.md`, plus RFP sections 24 and 27. Prioritize real PostgreSQL concurrency/isolation tests and Redis-backed worker tests over coverage percentages. A mock provider is only a deterministic test double, never evidence of live OpenAI integration.

Risks: six hours is aggressive; runtime/tooling installation, hosting credentials, regional service access, worker recovery, cookie/CSRF configuration and tenant filtering require verification. RLS is deferred; application isolation and composite FKs are the baseline. Record limitations and unverified deployment rather than claiming full completion.
