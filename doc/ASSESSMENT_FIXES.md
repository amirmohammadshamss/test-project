# Assessment hardening — current remediation status

This records fixes following [ASSESSMENT_REVIEW.md](ASSESSMENT_REVIEW.md), which is a historical pre-fix review. It does not rewrite the original scope or create a retrospective six-hour claim.

## Local corrections

- [x] Account-aware login limits, authenticated per-user/tenant AI burst limits and per-admin write limits. A high coarse source ceiling remains; untrusted forwarded IP headers cannot select identity. Distributed edge/burst protection remains a deployment concern.
- [x] Provider-aware smoke outcomes for disabled, OpenAI and Ollama selection. No key-presence shortcut claims live inference.
- [x] Unexpected-error cause class/dependency code and safe frame diagnostics without raw messages or credentials.
- [x] Distinct fictional restaurant menus and thirty days of coherent order/cancellation history, audit events, active kitchen work and notifications.
- [x] Labeled fixed menu-draft/report examples. No model is invoked by seeding and no fixture is described as live AI.
- [x] Kitchen instructions snapshotted with each new order line, validated/bounded and immutable after creation. Different instructions require separate rows. Pending corrections use cancellation/re-entry.
- [x] Current owner handover rewritten in Persian; stale runtime/AI/browser statements consolidated in current runbooks.
- [x] Regression checks for account/proxy isolation, provider selection, error redaction and instruction/retry behavior.
- [x] Final local verification and fresh seed/reseed evidence completed; changes prepared for the requested commit.

## Still external or historically unknowable

- [ ] Actual compatible HTTPS host/domain, deployment and remote CI evidence.
- [ ] Eligible live AI provider or installed self-hosted model, with measured Persian quality and latency/cost.
- [ ] Narrated 5–10 minute recording; browser automation and a written script do not satisfy it.
- [ ] Physical-device Push and representative real-shift/load validation if those claims are made.
- [ ] Backup restoration on the intended deployment.
- [ ] Candidate's own architectural contribution and accurate active time/overrun disclosure. These cannot be invented by an assistant.

No compatible deployment connection, API key or installed local model is available in the task environment. The existing setup remains useful locally and AI is intentionally disabled by default. The user has been asked for an existing host/domain and eligible provider; absence of that information is not treated as permission to provision paid infrastructure or bypass provider eligibility.

## Verification evidence

`pnpm verify` passed with 25 unit tests and 66 PostgreSQL/Redis integration tests, plus production builds; Chromium passed 10 workflows including visible waiter-to-kitchen instructions. A fresh isolated database applied all seven migrations and seeded 126 orders, 366 lines, 368 events, four notifications and two labeled fixtures each for menu drafts/reports. Two consecutive reruns preserved counts, edited instructions/menu price and notification read state. No provider was invoked. Local demo history was then populated with the same idempotent seed.
