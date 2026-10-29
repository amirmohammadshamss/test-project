# Architecture decisions

1. **NestJS modular monolith plus Next.js:** stack chosen/inherited from the detailed project RFP, not mandated by the original open-ended assessment; independent HTTP and worker processes. Alternative: unified web server. Trade-off: more build/configuration work; reconsider if maintaining three processes dominates a small team's needs.
2. **PostgreSQL transactions and parent order locks:** serialize invariants and append independent additions. Alternative: whole-order optimistic replacement. Trade-off: per-order contention, but no lost accepted additions.
3. **Persisted idempotency result in business transaction:** retries replay results. Alternative: Redis-only deduplication. Trade-off: database storage and bounded retention; avoids queue/cache dependence for critical writes.
4. **Polling:** five-second refresh is sufficient. Alternative: WebSockets. Trade-off: delayed visibility and periodic read load.
5. **Application isolation plus composite constraints, no RLS initially:** explicit scoped access supports a short build. Alternative: PostgreSQL RLS. Trade-off: new query paths can omit filters; reconsider before broader production rollout and keep isolation regression tests mandatory.
6. **Pending-draft reconciliation:** persisted requests are repeatedly enqueued with stable BullMQ IDs until terminal. Alternative: transactional outbox. Trade-off: polling recovery and retained queue jobs, not an exactly-once provider call guarantee. Persisted result/application is deduplicated.
7. **Clean Architecture concentrated in critical workflows:** application ports hide transaction/ORM mechanics. Alternative: full layering for every CRUD field. Trade-off: smaller modules remain pragmatic rather than multiplying files without business value.

8. **Nx over the existing pnpm workspace (user-requested):** explicit project targets orchestrate the existing tools, with local caching for deterministic tasks and no Nx Cloud dependency. Alternative: replace the existing compiler/Jest setup with framework plugins and generated layouts. Trade-off: the backend retains one shared compile owner because both services currently emit into the same `dist` tree; Nx deduplicates that task. Stateful database/queue operations are never cached.

9. **Tailwind-only styling (user-requested):** all visual rules use Tailwind utilities; shared groups and data-attribute variants preserve repeated components and state selectors. Alternative: retain a custom stylesheet or use CSS modules. Trade-off: utility strings are longer, so they are centralized in a small helper; `tailwind-merge` keeps composed overrides predictable. The global CSS file now contains only Tailwind's import.

Reconsider decisions 1 and 5 for the reasons above; they are accepted trade-offs, not claims of proven mistakes.

## Admin expansion — 29 October 2026

Added separate Restaurant Admin and platform modules over the existing modular monolith, plus an independent Nx Super Admin frontend. Platform identities/sessions are separate from restaurant memberships and both JWT contexts have explicit audiences. Tenant registration uses a normalized unique provisioning reference; initial-manager emails must be new accounts. Provisioning, lifecycle, idempotency result and audit writes are atomic. Category/menu/order locking preserves deactivation and historical-price invariants. Policies and prototype security limits are recorded in ADMIN_SCOPE.md.

## Recovery decisions and revisions

10. **Cancellation as a terminal audited state.** Reason: ordinary mistakes must not require fake served items or direct SQL. Alternative: delete orders/items or allow arbitrary state reversal. Trade-off: every status/total consumer must understand cancelled history; refunds, partial-quantity cancellation and kitchen acknowledgement remain outside this change.
11. **Stable keyset kitchen pages with visible backlog.** Reason: the old 100-order cap hid work. Alternative: fetch an unbounded list every five seconds or add WebSockets. Trade-off: staff navigate explicit windows; results change between requests and do not form a frozen snapshot.
12. **Persisted restaurant sessions.** Reason: deleting a browser cookie does not invalidate a copied JWT. Alternative: short JWT expiry alone or a Redis denylist. Trade-off: one additional database lookup per authenticated request; database outage fails closed.
13. **Service-specific environment allowlists; production platform access off by default.** Reason: shared `.env` injection gave frontends unnecessary signing/database/provider credentials. Alternative: inherit all environment values and rely on frontend code not to use them. Trade-off: deployment configuration is more explicit and optional platform startup requires a deliberate profile/API flag.

**Revisited omission — no cancellation:** originally limited the state machine to keep scope small. That was wrong for a shift workflow: a mistaken empty order held a table indefinitely. The correction preserves history and constrains authority instead of adding financial features.

**Revisited sequencing — broad administration before shift proof:** platform features were later requested and remain useful follow-on work, but they did not resolve recovery or provide browser/deployment evidence. For this assessment, proving the narrow staff workflow should have preceded additional platform breadth. This is the current retrospective assessment, not an invented record of the original author's thoughts.

## Later Socket.IO expansion

**Decision:** add best-effort post-commit Socket.IO invalidations while retaining REST mutations and polling recovery. **Reason:** improve staff coordination without changing concurrency/idempotency authority. **Alternative:** polling alone, socket mutation commands, or a transactional outbox immediately. **Trade-off:** a commit-to-publication crash can lose a notification; regular/refetch-on-reconnect REST synchronization repairs state. Domain/application code contains no Socket.IO dependencies.

**Decision:** revalidate local recipients before delivery rather than blindly broadcast to previously joined rooms. **Reason:** session/membership/tenant permissions can change after connection. **Alternative:** handshake-only authorization. **Trade-off:** additional database reads and a deliberately single-instance adapter; future Redis fan-out must preserve local reauthorization and cannot be enabled as a drop-in scaling claim. See REALTIME.md.

## Central notifications expansion

- **Decision:** transactional PostgreSQL outbox and recipient-level unique notifications. **Reason:** notification persistence survives worker/Redis failures without coupling external delivery to order transactions. **Alternative:** post-commit ephemeral callbacks only. **Trade-off:** extra writes and eventual dispatch; an outbox database failure still aborts the atomic transaction.
- **Decision:** independent platform realm, per-delivery live authorization, encrypted session-bound Push subscriptions. **Reason:** prevent tenant/private data leakage and shared-device alerts after logout. **Alternative:** permanent user rooms and long-lived device subscriptions. **Trade-off:** users explicitly register devices again after session expiry; generic in-flight Push cannot be recalled.
- **Decision:** one shared notification center and best-effort minimal hints. **Reason:** consistent Persian workflows without making transport delivery authoritative. **Alternative:** copying state into socket payloads. **Trade-off:** refetch traffic, polling recovery and a single-API immediate-delivery limit.
- **Revisit:** notifying all authorized waiters can create noise; add assigned-waiter routing after ownership is modeled. **Alternative considered:** inventing assignment during notification work. **Trade-off accepted:** broader branch visibility over incorrect ownership assumptions.
- **Revisit:** delay alerts use order creation time and a fixed threshold. **Reason:** current domain lacks reliable course/item service targets. **Alternative:** per-item scheduling and escalation now. **Trade-off accepted:** coarse alerts and no automatic escalation until real shift feedback establishes policy.

## AI strategy Phase 1

- **Decision:** retain a task-specific, provider-independent menu parser port and add a self-hosted Ollama adapter. **Reason:** the serving market cannot assume OpenAI eligibility. **Alternative:** a generic autonomous agent framework or one mandatory cloud vendor. **Trade-off:** each adapter needs compatibility/quality evaluation; self-hosting introduces model/hardware operations.
- **Decision:** persist completion outbox events with validated results, use existing database reconciliation for requests. **Reason:** durable recovery already exists; a second request outbox would duplicate it. **Alternative:** enqueue only on HTTP submission. **Trade-off:** up to the dispatcher interval of queue latency and at-least-once provider calls after crashes.
- **Decision:** single-item text drafts, explicit approval, capped requests and reported usage rather than invented cost. **Reason:** finish a defensible workflow and keep external inference away from critical commands. **Alternative:** voice/batch/import/tools immediately. **Trade-off:** repeated entry for a full menu; future capabilities require separate product validation.
- **Revisit:** the original narrow fast-food category enum excluded common Iranian dishes. Expanded it to Iranian foods/general while preserving strict validation; richer tenant-defined category mapping remains future work. **Alternative:** arbitrary model-defined categories. **Trade-off:** less flexible taxonomy in exchange for predictable approval validation.

## Read-only manager assistant slice

- **Decision:** strict schema-constrained tool selection followed by deterministic factual answers. **Reason:** answer bounded operational questions without exposing metrics to another model call or risking invented conclusions. **Alternative:** a full multi-turn function-calling agent with free-form narrative. **Trade-off:** less conversational flexibility; unsupported questions are explicit, and semantic routing still requires real-model evaluation.
- **Decision:** private requesting-manager history in the active branch, live membership checks and read-only bounded database transactions. **Reason:** report access must survive neither tenant/branch changes nor revoked roles. **Alternative:** tenant-wide assistant history or model-supplied scope. **Trade-off:** managers cannot browse each other’s private questions, even when both can inspect underlying orders.
- **Decision:** durable dedicated analysis queue and shared tenant AI request budget. **Reason:** reports should recover from Redis/provider outages without consuming unbounded requests across features. **Alternative:** synchronous HTTP inference or independent per-feature caps. **Trade-off:** eventual responses and additional queue monitoring; duplicate external inference cost remains possible.
- **Revisit:** fixed recent Tehran windows and historical snapshot names are a limited first reporting model. **Reason:** supported scope is visible and testable. **Alternative:** arbitrary date-language parsing and item-name reconciliation now. **Trade-off:** custom history and renamed-item consolidation require later reporting work.

## Assessment hardening

- **Decision:** identity-scoped burst limits plus a high coarse source ceiling. **Reason:** many restaurant users share a Next proxy IP. **Alternative:** trust caller-provided forwarded headers or keep low global IP buckets. **Trade-off:** process-local burst enforcement remains single-instance; tenant daily AI quotas stay durable.
- **Decision:** immutable line instructions with explicit cancellation/re-entry for correction. **Reason:** special preparation requests must reach the kitchen without silently changing work already started. **Alternative:** mutable notes or informal-only coordination. **Trade-off:** two identical dishes with different instructions require separate rows; kitchen confirmation remains a human action.
- **Decision:** deterministic 30-day demo history and prominently labeled fixed AI examples. **Reason:** fresh reviewers need coherent operational context without implying live inference. **Alternative:** rely on accumulated developer test data or call a provider during seeding. **Trade-off:** examples age from initial seeding and are fictional; reruns preserve edits rather than refreshing them destructively.
