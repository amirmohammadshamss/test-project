# Walkthrough recording script — 7 minutes

Status: script prepared; **no recording produced**. Browser automation was unavailable in the task environment. Do not submit this script as a recorded walkthrough.

- **0:00–0:45:** Explain the selected table-to-kitchen workflow, restaurant users, Persian RTL UI, and deliberate exclusion of payments/accounting/offline sync.
- **0:45–1:45:** Log in as waiter, select a table, add two items and adjust a pending quantity. Explain price snapshots and whole-toman display.
- **1:45–2:30:** Switch to a separate kitchen session. Start preparation and mark ready. Return to waiter, serve and close the order.
- **2:30–3:30:** Show domain/application/infrastructure/presentation boundaries, Nest modules and database constraints. Explain the modular monolith and independent worker.
- **3:30–4:30:** Run/show the concurrency and idempotency tests. Explain parent row locks, versions/409, advisory locks, replay after app restart, and branch-scoped request identity.
- **4:30–5:30:** Show cross-tenant/branch/role tests, authenticated context and scoped repositories. Explain why RLS remains a follow-up and demonstrate persisted restaurant-session revocation rather than claim complete protection.
- **5:30–6:15:** With a configured provider, generate a Persian draft, inspect/edit price, then explicitly approve. Otherwise show the honest configuration failure and manual menu flow; do not present a test double as live AI.
- **6:15–7:00:** Show test/build evidence, startup/deployment docs, accepted compromises and prioritized improvements. Explicitly identify unverified deployment/browser/provider items and actual working time.

At least 4 minutes of this script explain decisions, exclusions, safety, limitations and next work. Use fictional demo data only and do not display `.env` contents or secrets.

## Updated recovery sequence

Include accidental empty-table cancellation, a pending-item correction, historical cancelled lines and kitchen communication limitations. Show the actual >100-order browser test and stale-data behavior. Explain that admin expansion is separate follow-on work and disclose unknown total active time. The recording itself remains incomplete; browser test videos are not a substitute for a narrated 5–10 minute assessment walkthrough.
