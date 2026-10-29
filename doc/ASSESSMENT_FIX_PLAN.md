# Assessment remediation plan

Prepared 29 October 2026 against commit `4691938` and the user's original **Senior Full-Stack Engineer — Solo AI Builder Assessment**. This is a plan, not evidence that the fixes have been implemented. Checkboxes below now track local implementation evidence; unchecked tasks remain open. Current results are in [REMEDIATION_STATUS.md](./REMEDIATION_STATUS.md).

The submission story is one reliable workflow: **table → order → kitchen → served → operational completion**, including mistakes, simultaneous staff actions and uncertain network outcomes. Preserve Nx, Tailwind-only styling, existing data, tenant/branch boundaries and the existing 40-test baseline. Keep documentation in `doc/`.

Local implementation evidence: 13 unit tests, 35 PostgreSQL/Redis tests, 3 Chromium tests and all app builds pass. Docker/public hosting/live AI/recording and owner validation remain open.

## Priority and scope

1. Unblock safe shift recovery: accidental orders and incorrect items.
2. Make all kitchen work discoverable without an invisible 100-order ceiling.
3. Revoke restaurant sessions on logout and restrict deployment secrets.
4. Prove the complete experience in independent browser sessions.
5. Verify a reproducible deployed demo, legitimate AI availability and the final submission package.

Do not add billing, discounts, accounting, inventory, offline synchronization, WebSockets, staff invitations or more platform features during this work. These are not necessary to repair the chosen workflow. Existing Super Admin work remains separate follow-on scope. Its password-only prototype must not become a public production management interface by accident.

The six-hour assessment clock does not restart. The existing log does not establish exact active time. Reconstruct evidence honestly, distinguish original work from requested expansions, and disclose any overrun. Do not relabel new work as part of the original pre-build scope or manufacture interviews, timings or recordings.

**Planning estimate:** 11–19 additional active engineering hours, excluding access waits, owner availability, DNS propagation and provider approval. This is an extension estimate, not a commitment that it fits the assessment's original six hours. Re-estimate after Phase F0. If the original cap has already been reached, stop assessment implementation and disclose unfinished requirements; any further work is explicitly outside that cap.

## Research and implications

Sources checked 29 October 2026. External recommendations below are separated from observed repository defects.

- [PostgreSQL explicit locking](https://www.postgresql.org/docs/16/explicit-locking.html): locks protect concurrent mutations; consistent lock ordering reduces deadlocks. Extend the existing transaction/parent-order lock rather than creating independent cancellation updates. Keep transactions short and never wait for a user/provider while holding locks.
- [PostgreSQL LIMIT/OFFSET](https://www.postgresql.org/docs/16/queries-limit.html): limited results need a unique ordering, and deep offsets incur skipped-row work. Use a stable `(createdAt, id)` keyset for the changing kitchen backlog, with explicit visibility of remaining work. This is an application design choice, not a claim that pagination creates a cross-request snapshot.
- [OWASP session management](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html): server-side logout invalidation is required; cookie deletion alone does not invalidate a copied token. Add persisted restaurant sessions, preserving the separate platform identity context.
- [Playwright isolation](https://playwright.dev/docs/browser-contexts): independent browser contexts isolate cookies/storage and support multi-user scenarios. Use separate waiter, kitchen, manager and other-tenant contexts in one meaningful workflow test.
- [OWASP prompt injection prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html): prompt instructions are not an authorization boundary. Keep deterministic schema/role/tenant checks and exact human approval outside the model; no tools or autonomous publication.
- [OpenAI supported countries and territories](https://help.openai.com/en/articles/5347006-openai-api-supported-countries-and-territories): Iran is not listed, and the page restricts accessing or offering access outside supported locations. Check the actual intended customer/service eligibility before choosing an AI deployment. A foreign server alone is not proof of eligibility. Do not plan VPN/account/location workarounds. If this provider cannot legitimately serve the intended use, evaluate a provider with documented applicable support or a self-hosted model; the existing parser port supports substitution. Live-provider acceptance remains blocked until an eligible option is verified.
- [Docker container environment configuration](https://docs.docker.com/compose/how-tos/environment-variables/set-environment-variables/): environment files populate container environments; Docker recommends secrets for sensitive values. The current shared `env_file: .env` exposes more server credentials to each service than needed. Replace it with service-specific allowlists and supported secret injection.
- [Menuchee's own product description](https://menuchee.ir/) advertises kitchen displays, table ordering and cashier permissions in Iran. This establishes a local vendor's positioning, not prevalence, customer demand, usability or market pricing. Do not copy its whole feature set. Validate this project's narrow workflow with an actual owner/staff member if available.

## F0 — Freeze contracts, feasibility and assessment boundaries

**Estimate:** 0.5–1 hour. **Depends on:** none. Start external-access checks immediately; do not wait until all code is finished.

- [x] Preserve original `SCOPE.md` history. Add a clearly dated correction/addendum and identify the original assessment versus the later detailed RFP/admin expansion.
- [ ] Confirm the policies in F1 with the owner when available. Until then label them proposed product assumptions; no customer-contact tools/messages are authorized by this plan.
- [ ] Prepare a 20-minute owner/staff validation script: last incorrect order, when cooking becomes irreversible, who may cancel, shared-device use, kitchen handoff, connectivity, receipt expectations and how staff recognize stale information. Record actual findings separately from assumptions.
- [ ] Check hosting account/DNS/Docker availability, repository workflow permissions, browser runtime and AI-provider eligibility/key availability. Record each dependency, responsible party and exact verification needed. Do not provision paid resources merely because a plan exists.
- [x] Inspect current backlog and auth fixtures; establish baseline schema, seed, tests and build evidence before migrations. Use disposable test databases for fault tests.
- [ ] Start recording active work intervals now. Reconstruct previous work only from available evidence; unknown time remains unknown.

**Exit:** cancellation semantics, external blockers, submission boundary and time policy are explicit. No claim of a fresh six-hour allowance.

## F1 — Audited cancellation and correction

**Estimate:** 2–3 hours. **Depends on:** F0 policies. **Priority:** shift blocker.

### Proposed behavior

- A waiter or manager can cancel an **empty** open order with a reason. The table is released in that transaction.
- A waiter or manager can cancel a whole **PENDING** item line. Only a manager may cancel **PREPARING** or **READY** lines, with a prominent instruction to notify the kitchen. Persist the prior state: food already prepared is distinguishable from an accidental entry.
- A **SERVED** item cannot be cancelled by this workflow. Refunds, post-service adjustments and payment changes are deferred and visibly described as unsupported.
- A manager can cancel a whole open order only when it has no served lines. Cancellation of a whole order with preparing/ready food carries the same kitchen warning.
- Cancelling the last noncancelled line atomically makes the order **CANCELLED**, freeing the table. With served lines remaining, the order stays open until ordinary completion; completion accepts served lines plus cancelled lines and requires at least one served line.
- Cancellation is a terminal recorded state, never physical deletion or reversal to PENDING. Original quantity/name/price snapshots remain intact. Chargeable operational totals exclude cancelled lines; retain enough history to reconstruct the prior gross value. These totals do not claim to be receipts, settled payments or accounting.
- Partial-quantity cancellation is deferred. Cancel a whole pending line and add a corrected line; the UI explains that sequence. Do not create an atomic-replacement promise the implementation does not provide.
- The system cannot recall spoken instructions or food already being cooked. Five-second polling is not proof the kitchen acknowledged a cancellation. Staff must communicate changes to preparing/ready food; explicit acknowledgement is future work unless owner validation makes it essential.

### Implementation checklist

- [x] Add additive `CANCELLED` order/item enum values and nullable cancellation actor/time/reason/prior-state metadata. Scope audit/event ownership with existing tenant/branch constraints; do not rewrite existing history. Apply enum changes before statements using new values; verify migration behavior on PostgreSQL 16.
- [x] Extend shared contracts, domain rules and application ports. Audit cancellation with actor, order/item, prior status, reason, request ID and resulting version in the same business transaction.
- [x] Add `POST /orders/:id/cancel` with expected **order** version/reason and `POST /orders/:id/items/:itemId/cancel` with expected **item** version/reason. Require existing idempotency headers and reject extra fields. Use reason text bounded to 1–500 trimmed characters.
- [x] Reuse parent-order locking for add, prepare, serve, complete and cancel. Check versions/state/role after the lock; whole-order cancellation and all line transitions commit together. Reuse the existing idempotency transaction so replay never appends duplicate cancellation events.
- [x] Review the actual lock graph against table opening/deactivation. Do not add an order→table lock where another mutation takes table→order without redesigning the ordering. Preserve the one-open-order partial unique index.
- [x] Update every total/status consumer: operational UI, manager detail/history, dashboards, table totals, kitchen filters, smoke scripts and demo fixtures. Keep cancelled history visible but exclude cancelled work from actionable kitchen lanes.
- [x] Add Persian reason/confirmation controls to both operational and manager views. Preserve entered reason on conflicts; refresh current state and require review before resubmission. After uncertain responses retry the same action/key; do not show success until confirmed.
- [x] Test empty cancellation/reopen; pending correction; manager-only post-preparation cancellation; kitchen denial; served denial; mixed served/cancelled completion; last-line cancellation; cross-tenant/branch IDs; duplicate/changed-payload replay and reason validation.
- [x] Exercise cancel-vs-add, cancel-vs-prepare, cancel-vs-serve and cancel-vs-complete using separate database connections. Valid serialized outcomes are acceptable; neither lost accepted writes nor duplicate terminal events are acceptable. Verify historical price snapshots and excluded cancelled totals.

**Exit:** an accidental empty order and incorrect pending item can be corrected without SQL, fake service completion or history deletion; concurrent staff actions remain valid and attributable.

## F2 — Kitchen backlog visibility without silent truncation

**Estimate:** 1.5–2.5 hours. **Depends on:** F1 statuses. **Priority:** shift blocker.

- [x] Replace the kitchen-only bare array with a typed envelope: `items`, `nextCursor`, `hasMore`, active matching `total` and `checkedAt`. Default 50 orders, maximum 100 per request. Update all consumers/tests together; do not silently change unrelated legacy response contracts.
- [x] Include only open orders with PENDING/PREPARING/READY items. Scope every page/count to the authenticated tenant/branch. Order by immutable `(createdAt ASC, id ASC)` and use a tuple boundary so the cursor does not depend on an anchor remaining in the active set. Validate cursor shape/limits; cursors confer no authority.
- [ ] Add or adjust a tenant/branch/status/createdAt/id index only after inspecting the actual query plan on representative backlog data. Do not introduce an indexing project without evidence.
- [x] Show “displayed / active total”, explicit next/load-more navigation and backlog warnings. Never describe the displayed subset as the entire kitchen queue. Every matching order, including number 101 and later, must be reachable.
- [x] Poll the current visible window and queue summary without resetting navigation. Make new/unseen work visible through a count/banner and an explicit action to refresh/load it. Clear stale cursors on tenant/branch/filter changes; reject late responses from previous scopes.
- [x] Define live semantics explicitly: pages are current views, not a frozen transaction snapshot. Deduplicate by ID when merging loaded windows; completion/cancellation can remove entries and new orders can arrive between reads. Do not promise exactly-once viewing or auto-fetch an unlimited backlog every five seconds.
- [x] Preserve last successful data on poll failure with a conspicuous stale timestamp. Never display a failed fetch as an empty kitchen. Keep ordering by age and expose overdue work without inventing a performance SLA.
- [ ] Test 0/50/100/101/250 active orders; equal timestamps; cursor anchor completing/cancelling; new inserts; malformed/cross-tenant cursor attempts; and active items appearing/disappearing between pages. On a quiescent fixture, traverse all pages with no missing/duplicate IDs.
- [x] Add browser checks that work beyond the first page stays reachable during polling and that cancelled items disappear from actionable lanes while their history remains accessible.

**Exit:** no invisible fixed-cap backlog, no hidden failure-as-empty state, and no cross-tenant pagination access. Remaining live-pagination limitations are documented.

## F3 — Restaurant session revocation and credential boundaries

**Estimate:** 1.5–2.5 hours. **Depends on:** F0. Can be implemented independently of F1/F2.

- [x] Add a persisted `RestaurantSession` tied to user, membership and branch, with created/expiry/revocation timestamps. Store a session identifier, never the raw bearer token. Login issues restaurant-audience JWTs containing `sid`; guard verifies session ownership/expiry/revocation plus current user/membership/branch/tenant state.
- [x] Revoke the current session on logout before clearing its cookie. Make repeated logout safe. Copied pre-logout cookies must receive 401 afterwards. Existing tokens without `sid` require fresh login; document this rollout.
- [ ] Keep an eight-hour absolute cap as a provisional shift policy. Decide idle timeout from owner validation; background polling must not count as human activity if an idle timeout is introduced. Do not silently expire a busy kitchen display because a generic timeout was copied into code.
- [x] Preserve separate platform sessions/audiences. Logging out one restaurant device must not revoke another device or platform session. Account/membership deactivation and tenant suspension continue to take effect on subsequent requests. Already-authorized in-flight requests may finish.
- [x] Fail closed if session validation cannot reach the database. Provide safe re-login/error behavior and clear prior-user state on shared devices; never fall back to trusting only the JWT.
- [ ] Remove shared full `.env` injection from Compose app inheritance. API receives its signing/database/session requirements; worker receives database/Redis/provider secrets; frontend proxies receive only API addressing and their own required settings. No JWT signing key, provider key or database password in frontend containers, browser bundles or public environment variables. Use the host's secret facility where supported.
- [ ] Inspect effective container configuration and browser bundles without printing secret values; test a minimal environment for each process. Ensure CI credentials are disposable and no seed runs against real customer data.
- [ ] Document process-local/proxy-IP rate-limit limitations. For the public shared demo, test login throttling and avoid treating untrusted forwarded headers as identity. If multiple API instances are deployed, a shared limiter becomes a release requirement; do not add infrastructure unnecessarily to a single-instance assessment demo.
- [ ] Test copied-token revocation, expiry, wrong audience, session/principal mismatch, inactive membership, tenant suspension, independent sessions and cross-tenant claims. Bound cleanup of expired session rows without deleting retained audit history.

**Exit:** logout invalidates copied restaurant credentials server-side; service credentials follow least privilege; public demo security limitations are explicit.

## F4 — Owner validation, browser proof and realistic seed recovery

**Estimate:** 1–2 hours, excluding waiting for participants. **Depends on:** F1–F3 for acceptance.

- [ ] Run the validation script with an owner or staff member if access exists. Distinguish their observations from vendor marketing and our assumptions. If unavailable, retain that gap honestly rather than blocking independent technical checks.
- [ ] Use Playwright independent contexts for waiter, kitchen, manager and another restaurant. Test the complete add → prepare → ready → serve → complete flow through the real Next proxy/API/PostgreSQL, then accidental-order recovery and pending-item correction.
- [ ] Exercise concurrent additions and stale status edits, account switching, session expiry/logout, response loss/retry, offline/stale indicators and Redis unavailable while ordinary orders still work. Use observable assertions, not fixed sleeps or fabricated UI responses.
- [ ] Check Persian RTL, keyboard navigation/focus, dialogs, long labels, mixed Persian/Latin identifiers, toman clarity and mobile/tablet overflow at representative 390px/768px/1280px widths. Verify Persian/Arabic digit input normalization or explicit usable validation wherever money/table numbers are entered.
- [ ] Extend idempotent demo seeds with recognizably different tenant menus and pending/preparing/ready/served/cancelled history. Demo prices remain fictional. Keep terminal/cancelled events coherent and timestamps plausible; do not reset reviewer mutations on ordinary seed reruns.
- [ ] Provide a deliberate disposable-demo reset procedure, separate from normal startup. Explain destructive behavior and restrict the target; never automatically reset customer data.
- [ ] Verify every documented role credential against the deployed seed. Capture sanitized screenshots/traces; keep authentication state and secrets out of Git.

**Exit:** browser evidence demonstrates real independent staff sessions and recovery, not only API tests. An unavailable browser or participant is recorded as unavailable.

## F5 — Eligible AI capability and measured failure behavior

**Estimate:** 1.5–3 hours if an eligible provider is available; a provider/model replacement may require re-estimation. **Depends on:** F0 eligibility and access, not just a configured key.

- [ ] Write the product argument: this AI capability converts an owner's unstructured Persian dish description into an editable menu draft during setup/menu changes. It does not manage a live shift, invent prices or autonomously change orders. Compare against manual entry; if it saves little effort, say so and keep the capability small.
- [ ] Record provider eligibility for the actual operating/service locations from applicable official terms/support. If unsupported, select and verify a legitimate alternative through `MenuParser`, or report AI delivery incomplete. Never claim a different hosting region automatically solves customer eligibility.
- [ ] Submit a small evaluation set: at least 8 benign Persian cases (clear prices, Persian digits, missing price, ambiguous amount, category mismatch, mixed language) and 4 adversarial cases (instruction override, unauthorized actions, secret extraction and schema-breaking output). Keep fixed expected application outcomes; judge draft usefulness manually against the entered description.
- [ ] Retain server-only credentials, bounded input/output, 20-second timeout, three persisted attempts, strict schema and manager-only transactional approval. Add a small tenant/user request quota or bounded demo budget before enabling public paid calls; IP-only process limits are not a spending budget.
- [ ] Measure actual latency, failure code, attempt count and usage/cost metadata when available. Mark unavailable usage as unknown; do not invent token or cost figures. Avoid recording raw prompts, secrets or unnecessary personal information in logs.
- [ ] Show one legitimate live request → editable draft → approval → menu result, then missing-provider/timeout handling and manual entry. Confirm request submission alone never publishes and another tenant cannot read/approve the draft.
- [ ] Record provider/model/date and individual case results with limits. Deterministic fakes remain unit/integration tests, not evidence of live quality or regional availability.

**Exit:** a defensible, eligible AI capability is demonstrated with honest quality/cost/failure evidence, or explicitly remains incomplete. A self-hosted replacement is not automatically cheap, accurate or deployable within this estimate.

## F6 — Clean setup, CI and HTTPS delivery

**Estimate:** 1.5–3 hours, excluding hosting/account/DNS delays. **Depends on:** F1–F4; F5 for a complete AI submission.

- [x] Supply one documented command, proposed `pnpm demo:up`, that validates prerequisites, creates a demo-only ignored environment with generated secrets when absent, builds/starts Compose, migrates/seeds and waits for readiness. Never overwrite existing secrets/data. Missing Docker/ports must fail with actionable instructions. No live AI credential is required for core startup.
- [ ] Run that command on a clean Docker-enabled checkout and empty disposable database, then on an existing migrated dataset. Verify seed reruns, supported rollback compatibility and migration failure behavior. Keep setup evidence, not just configuration files.
- [ ] Fix the current GitHub workflow permission blocker through appropriate repository authentication, without deleting CI to bypass it. Run uncached real-service integration tests, browser workflow tests, build and Compose smoke remotely; record the passing run URL and tested commit.
- [ ] Deploy a fictional-data assessment demo using the existing stack on an authorized compatible host. Verify exact origins, Secure/HttpOnly cookies, hostnames, trusted proxy configuration and certificate validity from a client. Expose only required HTTPS endpoints; DB/Redis remain private.
- [ ] Keep Super Admin out of the public assessment demo by default (profile/edge restriction or omitted service), and reject platform API exposure through the public restaurant path. A hidden link is not a boundary. If privileged public access is required later, MFA and proper onboarding are a separate release gate.
- [ ] Run the real full staff workflow, cancellation, revoked-cookie, tenant-isolation and provider checks through the public URL. Test the intended Iranian user network if an authorized tester is available; do not infer accessibility from the hosting region.
- [ ] Verify structured request/error/job logs contain request IDs and useful failure codes without credentials. Define a short operational runbook for API unavailable, Redis unavailable, stuck AI and session validation failure. Keep readiness separate from optional AI health.
- [ ] Back up and restore the demo PostgreSQL database into an isolated target; verify history and tenant ownership after restoration. Avoid load/capacity claims without measurements.
- [ ] Run a modest measured 10-restaurant fixture with independent staff clients, record hardware/concurrency/duration/error/latency results, and distinguish contention testing from a capacity certification. Defer a 1,000/100,000-tenant benchmark.

**Exit:** clean setup, remote CI and public HTTPS workflow have actual evidence. Missing credentials or host access leave the relevant boxes open; localhost is not the live URL deliverable.

## F7 — Documentation and final submission

**Estimate:** 1–2 hours. **Depends on:** preceding evidence; drafting may start earlier.

- [x] Add a dated `SCOPE.md` addendum explaining recovery policies and the original brief. Do not rewrite the initial agreement into a description of the final product. Separate original MVP, user-requested Nx/Tailwind changes and admin expansion.
- [x] Correct `DECISIONS.md` so the stack is described as chosen/inherited from later requirements, not mandated by this original brief. Each entry must contain decision/reason/alternative/trade-off.
- [x] Document at least two concrete revisions with consequences: omitting cancellation made ordinary mistakes unrecoverable; platform expansion consumed attention before proving the shift workflow. Distinguish this retrospective judgment from any claim about what the original author thought at the time.
- [x] Update `AI_USAGE.md` with actual tools, useful acceleration, mistakes, a genuinely rejected suggestion, verification and which decisions the human supplied versus accepted from generated proposals. Do not invent human architectural authorship or precise time savings.
- [x] Keep `HANDOVER.md` in owner-friendly Persian. Explain cancellation, kitchen communication, stale data, logout and unsupported post-service/payment adjustments. Rank five next steps with a reason each; move technical commands into technical docs.
- [x] Make scale discussion concrete: at 10 restaurants, single-host failure/restore and staff usability; at 1,000, polling/request volume, shared connection pools, process-local limits and AI fairness; at 100,000, tenant-aware storage/queue partitioning and operational recovery. Base claims on query shapes and observations, not invented capacity numbers. Example: 3 active devices × 1,000 restaurants × one refresh/5s = 600 refresh cycles/s before multiplying by requests per refresh; this is a workload illustration, not a benchmark.
- [ ] Update README architecture, one-command setup, root discoverability (a minimal root README pointing to `doc/`), live URL and all role credentials. Keep secrets out; only intentional disposable demo credentials may be public.
- [ ] Produce a real 5–10 minute recording. Target 8 minutes: 1 minute problem/local assumptions; 2 minutes staff/recovery demonstration; 2 minutes concurrency/isolation reasoning and evidence; 1 minute AI purpose/failure; 2 minutes trade-offs/limitations/time. At least 4 minutes explain why. Use only demo data, show no `.env` or keys, and verify playback/access.
- [ ] Publish repository access, tested commit, live URL/credentials, required document links, recording URL, test evidence, and honest time/known limitations in a short submission index. Do not imply push/deployment/recording succeeded without checking access.

**Exit:** a reviewer can independently open the repository, run the demo, use the hosted workflow, inspect evidence and watch the recording without asking for missing files or access.

## Verification policy and release gate

Add tests alongside each risky change. Unit tests belong on state/role/total rules; real PostgreSQL tests belong on transaction races/ownership/replay; browser tests belong on staff coordination and failure recovery. Do not test Tailwind strings, mirror trivial DTO plumbing or chase a coverage percentage. Live-provider evaluations are bounded/manual evidence, not flaky mandatory CI calls. Explicitly list untested load, network/provider combinations and accessibility coverage limits.

- [x] Existing 40-test baseline still passes; new cancellation/session/kitchen cases pass with real dependencies.
- [ ] Nx formatting/lint/typecheck/unit/integration/build checks pass for all retained apps, and migrations pass on clean and existing datasets.
- [x] No accidental-order dead end, silently hidden backlog, lost accepted concurrent change or copied-cookie access after logout.
- [ ] Browser multi-role workflow and two-tenant isolation pass against the real backend.
- [ ] Eligible AI live evidence, clean one-command setup, remote CI and public HTTPS evidence exist.
- [x] Public platform exposure is restricted; real-customer privileged use is not claimed without MFA/onboarding.
- [ ] Required documents, accurate time disclosure and playable recording are accessible.

Only then call the assessment submission complete. This gate does not claim production readiness or an absolute mathematical proof against every future tenant-isolation regression.

## Immediate next implementation step

Execute F0, then implement F1 as one reviewable schema/domain/API/UI/test change. Run targeted tests before broad checks. Follow with F2 and F3. Start external-access feasibility checks early, but do not spend the remaining assessment allowance building extra administration features while the shift recovery path is missing.
