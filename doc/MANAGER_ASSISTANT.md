# Read-only manager assistant — Phase 2 slice

Implement one bounded question-to-report workflow. The model selects one predefined tool and time period from strict schemas; PostgreSQL computes the facts and the application renders Persian explanations. No second model call receives restaurant metrics. This deliberately avoids hallucinated financial interpretation and extra disclosure/cost.

- [x] Durable, recipient-owned branch-scoped analysis requests with idempotency and daily cap.
- [x] OpenAI/Ollama constrained planner port; no SQL, tenant IDs, arbitrary dates or write tools.
- [x] Top sellers, completed-order value comparison and cancellations; unsupported questions fail clearly.
- [x] Tehran calendar windows and explicit operational-value versus payment distinction.
- [x] Leased BullMQ execution, bounded retries, authorization rechecks and 30-day cleanup.
- [x] Persian manager interface with saved history and authoritative REST polling.
- [x] Provider/schema, database isolation/retry and browser tests.

Images/PDFs, voice, forecasting and free-form analytical conclusions remain outside this slice. Live model accuracy requires an eligible configured provider and evaluation.

## Workflow and boundaries

Managers open **دستیار گزارش مدیر** and ask about the active branch. Supported tools are `TOP_SELLERS`, `SALES_SUMMARY` and `CANCELLATIONS`; the strict planner also supports `UNSUPPORTED`. Supported windows are today, the last seven calendar days including the partial current day, this Saturday-start week, and the previous full week. The request creation timestamp anchors the window, while data is read consistently when the worker runs. The result shows both its interval and computation time.

The model selects a tool through schema-constrained output; this is a bounded application dispatcher, not a general agent loop or unrestricted vendor tool executor. No model-provided tenant, branch, SQL, date range, table name, function name or limit is accepted. The application resolves scope from the authenticated session, and the worker checks the original membership, account, role and branch again before inference and before reporting. Unsupported compound/ambiguous/out-of-range questions should select `UNSUPPORTED`; evaluation must verify this behavior for the chosen model. Schema validation cannot prove that a valid tool selection matches the user's intent, so the selected report and interval are explicitly displayed.

Top sellers count noncancelled quantities only in completed orders and display at most ten rows. Historical names are preserved; renamed items can occupy separate rows. Completed-order value is a sum of stored line prices and quantities, excluding cancelled lines; it is not paid sales, profit or a tax report. Comparison uses the same elapsed window shifted one day or seven days, without percentage-growth claims. Cancellation order and item counts overlap when an entire order is cancelled and must not be added together. Missing data is displayed as insufficient evidence, never a forecast.

Only the question and the tool-selection instructions/schema go to the provider. No second language-model call receives restaurant metrics; answer text is deterministic Persian wording plus database facts. There is no invented narrative, free-form recommendation, financial action or business mutation. An authorized manager can inspect ordinary orders as the manual alternative when AI is unavailable.

## Persistence, authorization and recovery

`POST /api/v1/ai/analyses` (also `/admin/ai/analyses`) requires a manager session, CSRF header and idempotency key. It stores a request before enqueueing. `GET` lists the latest 30 questions belonging to that manager in the active branch; `GET /:id` uses the same recipient/membership/tenant/branch restrictions. Other managers do not inherit private question history. Platform routes receive no access. Composite foreign keys bind requests to their tenant, branch and requesting membership.

A dedicated `ai-manager-analysis` BullMQ queue is reconciled from PostgreSQL every five seconds. Processing has three persisted attempts, sixty-second token-fenced leases, bounded backoff and at most two concurrent jobs per worker. The shared provider adapters retain the existing twenty-second timeout, 600 output-token budget and 64 KiB response limit. Report transactions are read-only with a three-second statement timeout and eight-second transaction timeout. Reporting indexes cover tenant/branch and completion/cancellation timestamps. No unbounded custom query is exposed.

Successful results and private completion outbox entries commit together; terminal failures generate private failure entries. The existing notification center obeys optional low-priority/category preferences. REST polling restores request/result state even when Socket.IO delivery fails. A provider crash can cause another external inference call and cost; database claims prevent a duplicate persisted result from replacing a newer result. This is at-least-once processing, not exactly-once external inference.

Menu drafts and manager questions share `AI_DAILY_REQUEST_LIMIT` per tenant, serialized by the same PostgreSQL advisory lock. A repeated accepted idempotency key does not consume another slot. Questions, results and per-request reported token/latency measurements expire after 30 days, with live leases protected until completion. Billed cost may be unknown after a timeout/crash; no price is fabricated. Failed jobs are bounded to 1,000 retained records and sanitized codes are logged. Process heartbeat is not a dedicated health check for every queue; production monitoring should also inspect queue backlog/failures.

Provider setup and eligibility remain as documented in [AI_STRATEGY.md](AI_STRATEGY.md). Disabled/default configuration yields a clear failed request and preserves the normal restaurant workflows. No live provider or physical-device notification delivery is claimed by local fixtures.

## Remaining boundaries

Questions about custom dates, older history, preparation timing, customer details, ingredient costs, profit, payment, prediction, other branches or writes are unsupported. Reports operate on recorded application data and do not reconcile external POS/accounting systems. Historical pre-2023 Tehran windows are excluded by this first reporting implementation; current requests only select recent windows. Large branches may hit the bounded query timeout and should use purpose-built reporting infrastructure rather than expanding unrestricted AI queries.

Images/PDFs and voice ordering remain separately prioritized Phase 2 work. Forecasting, shift interpretation and platform AI remain Phase 3. The provider's semantic selection accuracy and actual manager time savings still need evaluation with realistic Persian questions.

References: [OpenAI function-calling safety and strict schemas](https://developers.openai.com/api/docs/guides/function-calling), [Ollama structured outputs](https://docs.ollama.com/capabilities/structured-outputs). This implementation uses strict structured tool selection rather than claiming a complete function-calling conversation protocol.

## Model evaluation

`AI_EVAL_CONFIRM=1 pnpm ai:evaluate-manager` invokes the configured eligible model against `scripts/fixtures/persian-manager-evaluation.json`. It checks exact tool/period selection and unsupported requests for writes, SQL, other restaurants, custom dates and forecasts. It may incur provider cost. Failures/outages count as errors, not safe rejections. This command never queries restaurant data and does not mutate business state. It is a small initial gate; benchmark against realistic consented manager questions before production. Do not paste private customer details or secrets into questions.

## Local verification

Formatting, ESLint, TypeScript, production builds and the test suites pass: 23 unit tests, 63 database/Redis integration tests and 10 Chromium workflows across the application. All six migrations apply cleanly. The new browser workflow checks saved questions, verified facts, reload and mobile width. No eligible live model has been configured or invoked.
