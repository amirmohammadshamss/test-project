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
