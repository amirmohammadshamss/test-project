# Review against the Solo AI Builder Assessment

Historical review before remediation; current fixes and remaining gates are tracked in [ASSESSMENT_FIXES.md](ASSESSMENT_FIXES.md). Findings below preserve the pre-fix evidence.

Reviewed 29 October 2026. Target: the original open-ended assessment, not completion of every later feature proposal.

## Verdict

**Strong locally verified engineering; not ready for final assessment submission.** The table → order → kitchen → served → complete workflow is a defensible product choice. Concurrency, retry safety and tenant-aware authorization have meaningful implementation and test evidence. The largest remaining problems are delivery and product evidence, rather than a shortage of features.

A reviewer cannot currently open a verified public HTTPS deployment, observe a working configured AI capability, or watch the required narrated recording. The latest notification/AI/assistant changes are not in the current commit. The first-run seed is substantially thinner than the assessment's realistic-history requirement. Six-hour compliance cannot be established from the recorded work log.

Do not describe this as a production-ready system or a completed assessment. Do not add voice, imports, forecasting or more administration before closing the submission gates.

## What was checked

- Read the original scope, decisions, AI usage, owner handover, setup/deployment guidance and work log.
- Inspected the Prisma schema/seeds, authentication, guards, REST boundaries, order transactions, idempotency, real-time delivery, AI providers/workers, notification design and reporting boundaries.
- Reran `pnpm verify`: formatting, lint, TypeScript, **23 unit tests, 63 PostgreSQL/Redis integration tests**, and production builds passed. Some deterministic tasks reused Nx cache; stateful integration tests were rerun.
- Reran `pnpm test:browser`: **10 Chromium workflows passed**, including staff service, recovery, notifications and saved AI/report workflows.
- Applied all **six migrations** and ran the seed against a newly created isolated local database. Existing restaurant databases were preserved. Inspected the fresh seed rather than counting accumulated test/smoke data as demo history.
- Checked tracked environment-file names and searched working source for a few common private-key/token patterns without printing secret values. Only `.env.example` is tracked among the checked environment/key file names; the limited pattern scan found no matches. This is not a complete Git-history secret audit.

This is a focused code and delivery review, not a penetration test, field trial, load test, live provider benchmark or public-host acceptance test. Docker is unavailable locally. Remote CI and remote branch contents were not independently inspected. A configured Git remote is not proof that this working tree has been submitted.

## Submission blockers

### 1. No verified live HTTPS product

[DEPLOYMENT.md](DEPLOYMENT.md) explicitly describes prepared configuration, not a deployment. Caddy/Compose files and local services do not satisfy a live URL requirement. Docker startup, public TLS/cookies, production origins, proxy transport and restore operations have not been verified on the intended host.

**Close when:** the submission includes a reachable HTTPS URL, reviewer credentials, a fresh-host setup result, a complete multi-session service workflow, and recorded production smoke results. Keep privileged platform administration disabled or restricted according to the current prototype policy. Verify backup restoration rather than equating a database restart test with a backup test.

### 2. Latest source is not represented by the submitted commit

The inspected local HEAD is `84934fd` (the earlier Socket.IO change). The centralized notifications, provider-independent AI expansion and manager assistant remain in the working tree/index. A checkout of that HEAD does not include those additions. A remote is configured, but this review does not establish what remote branch or CI run a reviewer would receive.

**Close when:** freeze the intended scope, commit it, deliver the exact repository/branch/commit and confirm remote CI against that same source. Commit/push were not performed during this review.

### 3. AI is implemented but live capability remains unverified

The default [provider factory](../apps/worker/src/provider.ts#L280) disables inference unless explicitly selected. Provider tests and browser fixtures prove schema/control behavior, not Persian extraction quality, semantic report selection, service eligibility or real latency/cost.

The menu draft assistant is the stronger assessment demonstration: it removes a concrete setup task and requires human price review. The manager assistant has safe read-only boundaries, but its incremental value over ordinary reports is not yet measured. Do not present more AI surfaces as evidence of more customer value.

**Close when:** configure one eligible provider or self-hosted model; run the supplied Persian evaluation corpus; demonstrate real text → reviewed draft → one published menu item; record failures, latency and reported usage honestly. Keep ordering independent. If access is unavailable, state the capability's delivery limitation instead of substituting a test double. Operator eligibility confirmation is a prerequisite, not proof of legal availability.

### 4. Required recording is absent

[WALKTHROUGH.md](WALKTHROUGH.md#L3) explicitly says no recording was produced. Its script is useful but not a 5–10 minute narrated walkthrough. Automated browser videos are also not a substitute.

**Close when:** supply a playable recording, spend at least half explaining product choice, exclusions, concurrency/isolation strategy and limitations, and show the actual deployed build. Focus on the core workflow and one justified AI capability.

### 5. Six-hour compliance is unresolved

[TIME_LOG.md](TIME_LOG.md) contains observations and several subsequent expansions but no trustworthy total of active work. Elapsed wall time includes interruptions and cannot be converted into active minutes. Calling later work “additional scope” records its origin; it does not itself waive the assessor's cap.

**Close when:** provide an honest original-delivery boundary and actual tracked time where available. If the cap was exceeded, disclose that and where the work went. If active time is unknown, say so explicitly; do not invent a compliant total. Four-calendar-day completion also depends on the eventual delivery, not merely today's local implementation.

## High-priority quality gaps

### 6. Fresh demo history is too thin

The isolated seed produced:

- 2 restaurants, 3 branches, 5 staff memberships and 24 tables.
- 16 menu records: the same eight-item menu repeated for both restaurants.
- Only **2 orders and 2 order lines**, both created within milliseconds during startup: one open/preparing and one completed/served.
- **0 order events, 0 notifications, 0 AI drafts and 0 manager analyses** immediately after seeding.

Evidence: [seed.ts](../packages/database/prisma/seed.ts#L115). The fresh database was `restaurantos_assessment_seed_1793298499247`, retained locally for inspection. API timers may generate subsequent alerts; those are not seeded business history.

This is not an empty application, but it resembles an integration fixture more than a restaurant's operating history. The management reports and audit views have little useful first-open evidence. Old browser/smoke data in the developer database must not be used to hide this.

**Recommended correction:** seed a small coherent fictional restaurant history across several shifts/days, with varied menu mixes, pending/preparing/ready work, served/completed orders, a defensible cancellation example, matching audit history and useful notifications. Give the second tenant a distinct identity/menu. A sample AI draft may be explicitly labeled a fixture, never represented as live inference. Preserve seed idempotency and reviewer edits. No real customer data or invented market-price claim is necessary.

### 7. Shift suitability still needs customer evidence

The main workflow survives automated concurrency, retries and reconnection, including safe cancellation and a kitchen backlog beyond one page. That is meaningful evidence. It is not proof that staff have used it during a real service.

[OrderItem](../packages/database/prisma/schema.prisma#L209) has no instruction/modifier field: “one burger without mushrooms” cannot be communicated through the order line. Kitchen cancellation receipt is not a business acknowledgment of stopping preparation; generic notification acknowledgment changes no order. Partial-quantity correction after preparation and branch switching remain limited or excluded.

These are product-fit questions, not a demand to build every restaurant feature. Validate one realistic service scenario with staff, including a mistaken order, a special instruction and a lost connection. Either solve the selected workflow's essential gap or explicitly restrict the pilot and describe direct coordination. Payments, discounts, accounting, stock and voice are valid exclusions when stated honestly; their absence alone is not an assessment failure.

### 8. The handover is no longer one coherent owner document

[HANDOVER.md](HANDOVER.md#L70) says business questions were not delivered, then immediately describes the manager question assistant. It begins in Persian and appends technical English material for a nontechnical Iranian owner. Earlier polling-only and later live-notification statements are not clearly distinguished. [WALKTHROUGH.md](WALKTHROUGH.md#L3) still says browser automation was unavailable even though ten current Chromium workflows pass; [DEPLOYMENT.md](DEPLOYMENT.md#L29) similarly retains an unqualified browser-verification gap.

The staff limitation is **not** a contradiction: [the controller](../apps/api/src/modules/restaurant-admin/presentation/admin.controller.ts) exposes a read-only staff list, not invitations or permission editing.

**Recommended correction:** preserve historical decisions separately, but rewrite the current owner handover into one Persian document. State what works now, which live services are unconfigured, how staff recover mistakes, the current ranked next five improvements, and concrete scale limits. Keep internal setup commands and JWT terminology in the operator runbook. Link the `doc/README.md` explicitly in the submission; documentation can stay in `doc/` as requested.

## Concrete engineering follow-ups

### 9. Shared proxy IPs couple unrelated users' rate limits

[app.ts](../apps/api/src/app.ts#L138) keys login/AI buckets by `req.ip` in a process-local map. Through the Next server proxy, many restaurant users share one upstream IP. Thirty login attempts or fifteen AI POSTs per minute can consume a shared bucket, including failed attempts before authentication. A distributed deployment would also have independent inconsistent buckets.

This is an availability/isolation concern, not an observed data leak. Existing signed-in order commands are not part of this login/AI bucket.

**Recommended correction before a broader pilot:** use an explicitly trusted proxy chain and combine appropriately bounded IP, identity and tenant controls. Do not simply trust arbitrary forwarded headers. Exercise two unrelated users through the real deployed proxy and confirm their ordinary activity does not lock each other out.

### 10. The smoke test assumes OpenAI is the only provider

[scripts/smoke.mjs](../scripts/smoke.mjs#L115) treats absence of `OPENAI_API_KEY` as meaning the AI job must fail with `AI_NOT_CONFIGURED`. A correctly configured Ollama job can become READY, violating that assertion; a present OpenAI key can skip outcome checks even when `AI_PROVIDER=disabled`. Default-disabled CI is not affected by the successful-Ollama case, but the documented smoke command is misleading for the new provider setup.

This finding comes from branch inspection, not an actual Ollama invocation.

**Recommended correction:** inspect explicit provider selection and assert its expected configured/disabled behavior. Treat a key's presence as configuration, not evidence of successful inference. Keep manual-core smoke independent of AI and run provider acceptance separately.

### 11. Unexpected errors lack enough cause information for diagnosis

[http.ts](../apps/api/src/common/http.ts#L43) produces useful structured request IDs, scope, route and sanitized codes. For an unexpected failure, however, the cause collapses to `INTERNAL_ERROR` without error class, dependency code or a sanitized server-side trace. Correlating a 500 is possible; diagnosing its cause may not be.

**Recommended correction:** retain sanitized server-side cause/class and relevant dependency codes or redacted traces, with log rotation and alert routing. Continue excluding request bodies, cookies, provider responses and subscription secrets. Verify the logs with one deliberate internal dependency failure.

## Assessment parts

### Part A — Scope: content mostly satisfied; provenance should be clearer

[SCOPE.md](SCOPE.md) names the customer problem, users, exclusions, currency contract, concurrency strategy, assumptions and acceptance rules. It clearly distinguishes desk research from interviews and preserves dated corrections. It claims pre-build authorship; Git/file content alone does not establish editing order. Present the original boundary and later amendments without rewriting history. The original brief does not require the later detailed RFP's stack or feature list.

### Part B — Product: locally credible, incompletely delivered

Choosing table-to-kitchen service over a general restaurant ERP is defensible. Three restaurant roles are sufficient for the chosen workflow; excluding cashier/payment is coherent because completion is not financial settlement. Persian RTL, whole-toman input/rial storage, Persian date/number formatting and Tehran time are real localization decisions. Provider independence, visible disconnect states and manual menu entry acknowledge access/connectivity constraints; full offline ordering is excluded.

Research remains desk-based: a local vendor and localization standards do not prove restaurant workflows or willingness to use the product. The absent hosted URL, thin history and unverified AI are larger problems than missing optional feature breadth. Platform admin, Push and manager AI should be presented as later expansions, not used to obscure the narrow workflow or budget.

### Part C — Engineering: strongest section, with deployment limits

Domain-oriented tables, price/name snapshots, row locks, optimistic versions, transactionally persisted idempotency, boundary validation, scoped authorization and meaningful real-service tests support the senior engineering bar. PostgreSQL is authoritative; Redis/Socket.IO/provider failures do not become business-state authorities. Durable AI reconciliation and notification outboxes address distinct failure windows.

One-command Docker startup is documented, but not executed here. CI configuration exists; a remote successful run for the delivered commit is not established. HTTPS, backups/restoration, representative load, physical-device Push and provider quality remain separate acceptance gates. Existing local proofs must not be relabeled as production proofs.

Three concrete security stories are defensible: (1) tenant/branch object access and private socket routing, (2) copied/revoked sessions and separate platform credentials, (3) duplicated/concurrent mutations and untrusted AI output. Negative tests support them. Application scoping plus composite ownership constraints is a deliberate baseline; lack of RLS is not automatically failure, but future query omissions remain a residual risk. This review did not discover a demonstrated cross-tenant exploit and does not claim exhaustive absence of one.

Tests earn their place: full staff workflow, competing changes, idempotency, cross-scope access, rollback, retry, revocation and browser recovery. Explicitly list untested boundaries and reasons in the submission: hosted TLS/proxy and Docker need the target runtime; model quality needs an eligible provider; iOS/OS Push needs devices/permission; capacity needs a representative workload; real-service usability needs staff. More mirrored unit tests would add less value than these missing checks.

### Part D — Decisions: satisfied in substance

[DECISIONS.md](DECISIONS.md) contains decision/reason/alternative/trade-off entries and at least two explicit revisits: omission of cancellation and sequencing broad administration before shift proof. Later notification and AI entries also name limitations. Consolidate superseded polling/deployment statements for reviewer clarity; do not delete honest retrospectives.

### Part E — AI usage: substantial, with candidate attribution still required

[AI_USAGE.md](AI_USAGE.md) names tools/tasks, repetitive work saved, generated mistakes, rejected recommendations and verification. It does not fabricate human architectural authorship. The candidate must personally identify which choices they owned, what they challenged and what they can explain; an agent cannot supply that personal history. Live usage quality and measured time saving are not established by test doubles.

### Part F — Handover: present, needs editorial repair

The owner workflow, limitations, five ranked next features with reasons, and 10/1,000/100,000-restaurant failure discussions exist. Capacity is correctly not promised without load tests. Current/historical contradictions and English technical appendices weaken owner usability. Make the next-five list reflect what is now partly shipped, while preserving payment/acknowledgment/staff-access gaps and concrete operational risks.

## Recommended finish order

1. **Freeze the product scope and establish honest time/source provenance.** Select the exact commit to submit and disclose unresolved active time. Stop feature expansion.
2. **Repair the first-open experience and submission documents.** Coherent demo history, one current Persian handover, exact setup/credentials and explicit exclusions.
3. **Configure and evaluate one defensible AI workflow.** Menu draft extraction with human approval is sufficient; report measured limitations rather than adding more AI.
4. **Verify deployment on HTTPS and the delivered commit's CI.** Include real proxy/role/tenant/concurrency smoke, restart/recovery and backup restoration evidence. Address the proxy rate-limit and provider-smoke issues while validating this path.
5. **Record the narrated 5–10 minute walkthrough.** Spend at least half on why: problem selection, what was cut, invariant protection, Iran-specific assumptions and where the architecture fails.

The strongest submission story is a finished Persian staff workflow with demonstrable tenant safety and one useful reviewed AI task. More feature surface does not compensate for missing delivery evidence or an unsupported time-box claim.
