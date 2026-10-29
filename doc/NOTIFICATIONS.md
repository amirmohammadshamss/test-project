# Central notifications — implementation contract

This is additional user-requested scope after the original assessment and Socket.IO expansion. PostgreSQL owns notification history, REST owns business commands, and delivery is best effort. Escalation is deferred; acknowledgment never serves an item or closes an order.

## Policies decided before implementation

- Business changes and stable outbox events commit together. External delivery is never called in the transaction. Outbox-storage failure is an atomic database failure; Redis/push/socket failure cannot undo an accepted mutation.
- Restaurant notifications are addressed to an active membership/user, tenant and optional branch. Platform notifications use a separate realm and platform-admin ownership. No global user room grants cross-tenant access.
- New orders/cancellations/preparation changes notify kitchen staff; ready items notify authorized waiters in the branch because assigned-waiter ownership is not modeled. Managers receive delayed-order, own AI-failure and tenant-suspension alerts. Platform issues notify active platform administrators only.
- HIGH alerts always remain in-app. Push is always opt-in and category preferences apply to push, including HIGH. Low-priority/category filtering may suppress noncritical in-app records. Sounds are off by default, user-enabled and subject to browser gesture/autoplay rules.
- Read and acknowledged are independent timestamps. Read-all covers existing eligible records at request time. HIGH acknowledgment only records responsibility for that notification; it changes no business state.
- Suspension access remains restricted: a still-valid manager session may read/acknowledge only its own tenant-suspension notices through the notification context, never ordinary orders or previous unrelated alerts. Standard restaurant routes remain blocked. Existing login restrictions are preserved.
- Notification/outbox deduplication is enforced by non-null composite database keys. History expires after 30 days; processed outbox events remain 90 days. Failed records remain inspectable within retention. No exactly-once push or viewing guarantee is made.
- Push subscriptions are encrypted with a dedicated server key, scoped to the current authenticated session/context, hidden from listing responses and deactivated on logout. Delivery rechecks membership/session/tenant/preferences. Accepted in-flight generic push cannot be recalled after logout; payloads must contain no private order/tenant/customer text.
- Push endpoints must use approved HTTPS browser-push hosts with public DNS destinations pinned at connection time. No client-controlled arbitrary callback URL, redirects, localhost/private address or caller-specified proxy is permitted.
- Push notification permission is requested only on an explicit button action. Service workers show generic lock-screen text and open the local app; full details require authenticated REST. Feature detection and installed-home-screen limitations are shown rather than assuming background delivery on iOS.
- A dedicated BullMQ notification queue handles bounded retryable push delivery. In-app outbox dispatch remains database-backed and can continue during Redis outages. No escalation, exactly-once delivery, automatic kitchen acknowledgement or unsupported-platform promise is introduced.

## Checklist

- [x] Additive schema/outbox and ownership constraints; preserve existing history.
- [x] Business-source integration, independently testable routing and idempotent processing.
- [x] Recipient-only REST history, counts, preferences, read/read-all and acknowledgment.
- [x] Personal Socket.IO hints with current authorization and separate platform context.
- [x] Shared Persian notification center in restaurant and platform apps.
- [x] Encrypted push registration/removal, gesture permission, service worker and PWA metadata.
- [x] BullMQ push retries, expired-subscription handling, persisted attempt state and cleanup.
- [x] Delayed-order/AI failure/suspension/platform-issue sources and spam suppression.
- [x] Real database/Redis/socket/browser security and recovery tests; all app checks/builds.
- [x] Document actual device/HTTPS verification and remaining limits without treating mocks as delivery evidence.

References consulted: [BullMQ idempotent jobs](https://docs.bullmq.io/patterns/idempotent-jobs), [retry behavior](https://docs.bullmq.io/guide/retrying-failing-jobs), [MDN PushSubscription endpoints](https://developer.mozilla.org/en-US/docs/Web/API/PushSubscription/endpoint), [WebKit Home Screen push](https://webkit.org/blog/13878/), and [OWASP SSRF prevention](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html).

## Operator setup

Apply the additive migration with `pnpm db:migrate`, then rebuild and restart the API, worker and both frontends. `pnpm demo:up` remains the documented local startup entry point. The API dispatches the PostgreSQL outbox every second; the worker reconciles pending Push deliveries every two seconds. Redis is unnecessary for inbox persistence, but required for Push delivery.

Push is disabled by default. Run `pnpm notifications:keys` once to create ignored `.env.push` with owner-only permissions; it refuses to overwrite an existing file. Set a real `VAPID_SUBJECT` (`mailto:` operator contact or HTTPS URL), and provision these values through server secrets:

- API: `WEB_PUSH_ENABLED=true`, `VAPID_PUBLIC_KEY`, `PUSH_ENCRYPTION_KEY`.
- Worker: the same values plus `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT`.
- Never expose private VAPID or encryption keys to either Next.js client. Back up the encryption key securely; losing it requires users to register devices again.

Use HTTPS and secure cookies in production. After logging in, explicitly enable Push from the notification center. Permission is requested only then. Unsupported browsers and denied permission retain the in-app center. iOS eligibility generally requires installing the app on the Home Screen. A subscription belongs to its authenticated session; after logout/session expiry or key rotation, register the device again. Replacing VAPID keys may require removing the old browser subscription first. Device listings expose labels and timestamps, never endpoints or keys.

`NOTIFICATION_DELAY_MINUTES` defaults to 20 (accepted range 1–240). Delays are measured from order creation, scanned once per minute, with one alert per order. The first committed item triggers the kitchen's new-order alert; opening an empty table does not. Adding/correcting/cancelling items while preparation is underway triggers a preparation-change alert. Ready alerts go to authorized branch waiters because waiter assignment is not modeled.

Restaurant APIs live below `/api/v1/notifications` and `/api/v1/push/subscriptions`. The platform equivalents live below `/api/v1/platform/notifications` and `/api/v1/platform/push/subscriptions`; platform delivery-health is aggregate-only. Both realms expose list/count, preferences, read/read-all, HIGH acknowledgment and owned-device management. List pagination is bounded to 100 records. REST authorization is independent of Socket.IO membership.

## Delivery and operating limits

- Notifications expire after 30 days. Processed or exhausted outbox entries and stale subscriptions are cleaned after 90 days. Outbox processing retries five times with backoff; failed entries remain queryable in PostgreSQL. Platform delivery health exposes pending/failed totals. Operators inspect retained BullMQ failed jobs (bounded to 1,000) and sanitized structured logs; no automatic escalation is implemented.
- Push has five total persisted attempts, bounded network timeouts, exponential backoff, and lease fencing. HTTP 404/410 subscriptions are disabled and their encrypted secrets erased; permanent failures stop retrying. Stale operational Push (over 15 minutes) is skipped. Successful external delivery can be duplicated after a worker crash; receipt/viewing is never guaranteed.
- HIGH alerts remain visible in-app despite optional category settings. Push remains opt-in for every priority. Sound requires a browser gesture and is coalesced during bursts. OS notifications use fixed generic text, collapse into one inbox notification, and contain no private order details. Opening one requires authenticated REST to see details.
- Recipient/session/branch access is checked again before delivery. Revocation disconnects sockets on the existing periodic sweep and invalidates subsequent REST access; an already accepted generic Push cannot be recalled. Suspended managers with valid existing sessions can see only their own suspension notices; this does not permit a new suspended login or restaurant operations.
- Current deployment supports one API instance. Additional instances require a Socket.IO adapter for immediate fan-out; REST polling still restores state. Notification preferences use last-write-wins updates across devices. Queue/outbox backlogs can delay alerts; critical kitchen/hall state remains available through existing REST workflows.
- Platform health events cover observed unhealthy transitions while the API and database are functioning. A stopped API or unavailable database cannot persist its own alert; external monitoring is still required. Detailed delivery analytics, escalation, and administrative reports remain deferred.

## Verification and deployment boundary

Local `pnpm verify` passes formatting, ESLint, all TypeScript checks, unit/integration tests and production builds. `pnpm test:browser` passes restaurant/private/platform/restricted-suspension notification workflows alongside existing concurrent/offline workflows. Tests use real PostgreSQL, Redis, Socket.IO connections and Chromium. Retry tests inject a Push sender; service-worker tests verify fixed text and same-origin navigation against hostile payloads. These are not evidence of actual OS delivery.

No public HTTPS deployment or physical-device Push delivery has been verified. VAPID and subscription encryption keys remain unconfigured in the local environment, so system Push stays disabled safely. Final operator acceptance must enable secrets on HTTPS, allow permission on a supported browser/device, close the app, trigger an authorized alert, verify generic OS delivery and navigation, then verify logout/revocation and expired-device behavior. Check iOS Home Screen and Android/desktop independently. No claim of original six-hour assessment compliance is made for this expansion.
