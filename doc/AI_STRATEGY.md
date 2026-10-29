# AI integration — agreed implementation scope

This user-requested expansion completes the Phase 1 text-menu workflow. AI produces one editable menu draft per request; only an authenticated manager can publish it through the existing transactional approval operation. Manual menu creation remains available. Images/PDFs, batch extraction, voice ordering, forecasting and platform analysis remain later phases. A bounded read-only manager assistant was subsequently added; see MANAGER_ASSISTANT.md.

## Checklist

- [x] Provider-independent parser port with OpenAI and self-hosted Ollama adapters; disabled by default unless explicitly selected.
- [x] Bounded input/output, timeout, validated structured output, Persian categories and human-confirmed whole-toman prices.
- [x] Durable request reconciliation, bounded attempts, tenant checks and idempotent approval.
- [x] Transactional completion/failure notifications to the requesting manager only.
- [x] Persistent recent-draft list and reopening from notification links.
- [x] Per-tenant daily request cap, provider usage/latency and approval/correction measurements.
- [x] Thirty-day draft retention and explicit limits on measurement accuracy.
- [x] Automated provider, database, retry, ownership and UI workflow verification.

No unrestricted database tools or automatic order, price or financial actions are introduced. Provider eligibility must be verified by the operator for the actual serving market. No provider restriction bypass is offered. Actual model quality and paid usage require a configured eligible provider and a realistic Persian evaluation set.

## Operator configuration

AI defaults to `AI_PROVIDER=disabled`; manual menu editing and all shift operations work without it. Set a provider only in the worker environment:

- Self-hosted: `AI_PROVIDER=ollama`, `OLLAMA_MODEL=<installed, evaluated model>`, and `OLLAMA_URL`. Loopback HTTP or operator-managed HTTPS is supported; remote plaintext HTTP, credentials in URLs, redirects, query strings and caller-supplied endpoints are rejected. No model download is performed by the application. In containers, loopback means the worker container: provide a secured reachable HTTPS inference endpoint rather than exposing an unauthenticated model server.
- OpenAI: `AI_PROVIDER=openai`, `OPENAI_API_KEY`, optional `OPENAI_MODEL` (existing default unchanged), and `AI_PROVIDER_ELIGIBILITY_CONFIRMED=true`. This flag records an operator prerequisite, not legal verification or a bypass. Iran is absent from the official supported-country list reviewed for this work; do not enable this adapter for unsupported service. Use an eligible deployment/provider or self-hosted inference with appropriate model licensing and operational review.
- API: `AI_DAILY_REQUEST_LIMIT` defaults to 20 accepted requests per tenant per UTC calendar day, with a maximum configuration of 100. Concurrent submissions serialize this check in PostgreSQL. Idempotent replays do not consume another slot. This is a request-cohort cap, not an exact daily billing cap: retries/backlogged jobs can run later. Set provider account spending limits separately.

Run additive migrations and rebuild/restart the API, worker and web apps. Requests persist before Redis enqueueing; the worker rescans pending/expired-lease requests every five seconds, covering crashes between database commit and enqueue. Queue IDs supplement database claims; they are not an exactly-once guarantee. Three persisted processing attempts, a sixty-second fenced lease, twenty-second provider timeout, 600 generated-token limit, 2,000-character input limit and 64 KiB response limit bound processing. Provider error bodies and menu text are not logged. Output schemas are revalidated in the worker and again at human approval. Unknown fields, unsupported categories and invalid monetary values fail closed. Categories include Iranian foods and a general category; ambiguous/missing prices are rejected. Numerical accuracy is still a human review responsibility.

Original text, generated results and per-request measurements are retained for 30 days from request creation, then removed by worker reconciliation. A currently valid processing lease is allowed to finish before cleanup. Approved menu entries remain. Idempotency snapshots have their existing shorter retention. Notification history has its own 30-day policy; a link may expire with its draft. AI content is not a suitable place for customer personal data or secrets. OpenAI requests set `store:false`; this is not a claim about every provider-side retention policy. Self-hosted inference retention/logging is the operator's responsibility.

## Manager workflow and measurements

Open **دستیار منو**, enter one food with an explicit price, and submit. The saved request can be reopened from the recent list after navigation or reload. Completion/failure notifications go only to the requesting manager's active tenant membership, subject to optional low-priority/category preferences. Other authorized managers can review tenant-wide menu drafts, consistent with their existing menu permissions; no platform or other-tenant access is added. Notification links reopen the specific draft. If AI fails, use the ordinary menu form.

Check the name, description, category and price in whole toman before selecting **تأیید قیمت و انتشار**. The database stores rial using the existing explicit conversion. Approval locks the draft and creates at most one item even when retried under different idempotency keys. Acknowledging a notification does not publish a menu item. No AI tool can create an order, change an existing price, or perform a financial action.

`GET /api/v1/ai/menu-drafts` (also `/admin/ai/menu-drafts`) returns the latest 50 tenant drafts. The `metrics` endpoint reports the last 30 days' status counts, processing attempts/time, reported token totals and corrected approvals. Measurements accumulate known usage across retries; timed-out/crashed calls may be billed without reportable usage. `currencyCost` is deliberately null: model pricing, local compute and billing reconciliation have not been configured. Approval/correction counts are not extraction accuracy or measured staff time savings. Provider/model labels and known token usage are persisted with the fenced result/failure update. Lease-losing attempts cannot overwrite newer results; their unreported external cost remains a measurement limit.

## Evaluation and acceptance

`scripts/fixtures/persian-menu-evaluation.json` includes explicit toman/rial, Persian digits, Iranian dishes, missing-price, injection and multi-item cases. With an eligible configured provider, deliberately run `AI_EVAL_CONFIRM=1 pnpm ai:evaluate`. This sends the fixture inputs to the selected model, may incur cost, prints aggregate exact-field/price/rejection results and returns failure on mismatches. It requires all positive fields to match and all unsafe cases to reject; provider outages never count as a successful safety rejection. This small corpus is an initial regression gate, not a representative business benchmark. Before production, expand it with consented restaurant examples and observe correction frequency, timed manual entry versus assisted entry, provider latency/failures and reconciled billing.

Automated tests use injected provider responses, real PostgreSQL/Redis processing and browser UI. They prove transport/schema/domain controls, recovery, recipient policy and approval behavior; they do not prove Persian model quality. No paid provider request or installed local-model inference has been executed in this environment. Live extraction accuracy, cost per successful operation and staff time savings remain unmeasured.

## Later phases — not implemented

- [ ] Phase 2: image/PDF import with bounded uploads, malware/file checks, OCR confidence and human verification.
- [ ] Phase 2: Persian voice drafts evaluated in noisy shifts; match real menu IDs server-side, expose ambiguous quantities/modifiers, and confirm through existing order commands.
- [x] Phase 2 slice: manager assistant with three predefined read-only reporting tools; see [MANAGER_ASSISTANT.md](MANAGER_ASSISTANT.md). Authentication supplies tenant/branch scope; tool schemas must not accept model-provided tenant IDs or SQL. Bound date ranges, result counts, calls and token budgets; display supporting metrics separately from interpretation.
- [ ] Phase 3: deterministic shift facts and preparation timing first, then optional grounded summaries; insufficient historical data must produce an explicit limitation.
- [ ] Phase 3: demand forecasts evaluated against weekday/statistical baselines with holdout data and uncertainty; no LLM-generated numerical forecast claim.
- [ ] Phase 3: menu/kitchen suggestions and a separate platform incident assistant restricted to sanitized operational metrics, never private restaurant data or administrative actions.

These later capabilities need separate customer validation and delivery scope. This work is additional to the original six-hour assessment, whose active duration was not instrumented.

Sources: [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), [official supported countries](https://developers.openai.com/api/docs/supported-countries), and [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs). Provider eligibility and API compatibility should be rechecked before deployment.

## Local verification results

Full Nx formatting, lint, TypeScript, unit/integration checks and production builds pass. The suite contains 20 unit tests and 60 PostgreSQL/Redis integration tests; Chromium passes 9 workflows, including saved AI draft reopening, corrected-price approval and reload persistence. All five migrations apply from scratch. The evaluation command refuses to invoke a model without explicit selection/confirmation. Provider responses in tests are fixtures, not live inference. An approval retried with identical values returns the existing item; conflicting values after another approval fail with 409 rather than silently accepting different prices.
