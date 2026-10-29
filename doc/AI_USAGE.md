# AI assistance record

## Tools and tasks

Codex drafted the plan and original scope, implemented the workspace/schema, NestJS modules, framework-independent order rules/application ports, Prisma adapters, Persian Next.js screens, BullMQ worker, tests, Compose/CI configuration, and delivery documents. Desk research is explicitly distinguished from assumptions in SCOPE.md; no customer interviews occurred.

The runtime OpenAI adapter extracts one Persian menu draft using the Responses API, strict structured output, timeout/token limits, application validation and explicit human approval. Provider format was checked against [official structured-output documentation](https://developers.openai.com/api/docs/guides/structured-outputs). No real provider call was made because no key is configured. Provider test doubles are not live-provider evidence.

## Where assistance saved work

Scaffolding the workspace, writing consistent tenant-scoped queries/contracts, translating product states into Persian screens, and constructing reproducible real-database/queue checks reduced repetitive setup. Time savings were not independently measured.

## Generated errors found and corrected

- The first Prisma one-to-one AI publication relationship lacked a composite unique key; schema generation caught it and the schema was corrected before migration.
- Prisma nested seed writes initially repeated ownership fields already supplied by the parent relation; TypeScript caught the invalid input.
- Early server startup used esbuild/tsx, which omits Nest DTO metadata. Backend development now compiles with TypeScript before running Node.
- A build-time API rewrite would have kept a localhost destination in Docker. It was replaced with a runtime server proxy and exercised through HTTP.
- Frontend mutation/refresh handling initially risked treating a post-save refresh failure as an uncertain write. Confirmed writes and refresh failures are handled separately.
- Retry metadata originally applied to login payloads; it now applies only to critical order/AI operations and stores hashed request signatures, never login passwords. Regression tests check this.
- Late poll responses could overwrite a different user's/view's state. Refresh results now carry a scope check and account switches clear workspace state.

## Rejected recommendations and accepted decisions

Rejected using BullMQ job IDs alone as end-to-end deduplication. Persisted attempts, leases, conditional result application and transactional approval are the authority. Also rejected replacing the mandated stack with a static hosted imitation merely to obtain a URL.

The owner can review original business rules in SCOPE.md and explicit architecture decisions/trade-offs in DECISIONS.md. AI output never decides authorization or commits a menu price without a manager.

## Verification at the original checkpoint (historical)

Real PostgreSQL/Redis tests cover isolation, concurrency, idempotency, state transitions, duplicate queue delivery, bounded retries and recovery. Unit tests cover domain rules, provider handling and browser-client retry metadata. Formatting, lint, type checks and the production build pass. A local HTTP smoke test exercises the built web proxy and complete waiter/kitchen path, including missing-provider failure. Final counts and remaining verification gaps are recorded in VERIFICATION.md.

A subsequent fault smoke check also verified actual HTTP response loss after commit and controlled PostgreSQL restart, with no duplicate orders/items. At that checkpoint browser interactions, Docker runtime, public deployment, remote CI and the required video were unverified/incomplete; current verification is recorded below and in VERIFICATION.md. No security, capacity or delivery guarantee beyond tested behavior is claimed.

User-requested Nx migration: Codex added explicit project/task configuration, safe caching boundaries, CI cache restoration and non-root Docker build ownership. The existing compiler and test tools were preserved. Nx project discovery, dependency graph, full verification and repeated-build cache reuse were checked locally.

User-requested Tailwind-only migration: Codex converted the custom selectors to reusable Tailwind utilities/data variants and removed custom CSS rules/keyframes. Tailwind accepted and extracted all 911 candidates; utility composition was checked for size/alignment/padding/color overrides. No browser was connected, so visual parity is not claimed.

## Admin implementation

Codex implemented the additive schema/migration, manager administration APIs/screens, distinct platform authentication and sessions, tenant provisioning/lifecycle, audit reads, real monitoring adapters, Nx Super Admin app and regression tests. Generated code was checked through formatting, lint, TypeScript, real PostgreSQL/Redis tests and builds. No live model output, browser walkthrough, public deployment or production MFA implementation is claimed.

## Assessment remediation assistance

Codex researched official PostgreSQL, OWASP, Playwright, Docker and provider-eligibility guidance, then implemented cancellation transactions/UI, kitchen pagination, persisted restaurant-session revocation, per-service credential configuration and real Chromium tests. A generated test wrongly assumed every kitchen order was on page one; pagination-aware assertions corrected it. A later offline browser test depended on another test's fixtures; it was made independent. These fixes are recorded as generated-code errors, not product failures hidden by mocks.

The user supplied the assessment and explicitly requested Nx, Tailwind, admin scope and remediation. Codex proposed the cancellation/locking/session policies and generated their implementation; the record does not establish that those architecture details were independently authored by the human. No human interview, measured AI time saving or live-provider success is invented.

Rejected simply increasing/removing the kitchen limit: explicit bounded navigation and a visible total address discoverability without unbounded polling. Rejected treating a foreign deployment region as sufficient proof an AI provider may serve Iranian users. Legitimate provider eligibility, a server credential, live quality and cost evaluation remain open.

## Real-time implementation assistance

The user supplied the REST/Socket.IO/PostgreSQL proposal. Codex consulted primary NestJS/Socket.IO documentation and implemented the gateway, shared auth, post-commit port, UI listeners, transport relay and tests. The design uses connection middleware rather than relying on async `handleConnection` to gate messages. Next's route relay is explicitly polling-only; Caddy upgrade forwarding is configuration, not a verified deployment. A generated idle-revocation test initially timed out sooner than the specified five-second sweep; its timeout was corrected instead of weakening authorization behavior. No durable delivery or multi-instance capability is claimed.

The final live transport smoke caught a Next trailing-slash redirect tolerated by browsers but rejected by the standard Node polling client. Preserving the endpoint URL fixed it; both browser and Node relay connections were verified afterwards.

## Notification expansion

The coding agent implemented the outbox, recipient policies, adapters, shared center and tests, and consulted primary BullMQ/MDN/WebKit and SSRF guidance. It saved time on repetitive DTO, UI and fixture work. An initial platform browser test requested the restaurant origin and failed correctly; its URL was corrected and the browser suite rerun. A timing-sensitive delivery fixture was changed to an explicitly due timestamp. Arbitrary client-supplied push callback URLs and automatic permission prompts were rejected in favor of validated browser endpoints and explicit user consent. Architecture choices were made against the existing domain and the user proposal; no unobserved human architectural authorship is claimed. Generated code was checked with TypeScript, lint, production builds, real database/Redis/socket integration tests and Chromium. Mock Push success is not claimed as physical-device delivery.

## AI strategy expansion

The agent extended the existing parser rather than generating an autonomous agent framework. Official OpenAI and Ollama documentation informed schema/adapter behavior. Generated tests caught a repeatability defect when historical seeded test requests exhausted the new quota; fixture setup now resets only AI histories for the two dedicated seed-owned test tenants. The recommendation to make AI directly publish or execute unrestricted analytical SQL was rejected: the parser has no business mutation/tools, and approval remains transactional REST. No live provider output was used as evidence of quality. API/worker/browser tests inject known outputs; an explicit opt-in Persian evaluation command is provided for operator verification.

## Manager assistant expansion

The coding agent reused structured provider adapters for bounded tool selection and wrote deterministic PostgreSQL reports. It rejected a second model-generated narrative: factual values and explicit limitations better fit this first slice and avoid disclosing business metrics externally. TypeScript caught an invalid nested Prisma fixture shape and a frontend BigInt literal incompatible with the target; both were corrected before verification. Real PostgreSQL/Redis tests check filters, private ownership, caps, retries and fencing; Chromium checks saved-result behavior. Provider replies are fixtures, not evidence of live semantic accuracy. A separate opt-in Persian routing evaluation command checks allowed reports and unsupported intents.

## Assessment hardening

The agent corrected account/tenant burst limits, provider-aware smoke outcomes, safe error diagnostics, kitchen instructions and deterministic demonstration history. Fixed AI examples explicitly say no provider was invoked. The owner handover was rewritten in Persian. Historical scope/time records were preserved rather than rewritten to claim compliance. These changes follow the user-requested audit; actual provider quality, hosted deployment, narrated recording and the candidate’s own architectural authorship cannot be fabricated by the agent.
