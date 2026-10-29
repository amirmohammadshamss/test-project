# Real-time restaurant notifications

This is the user's subsequent Socket.IO expansion, separate from the original six-hour assessment and original WebSocket exclusion. No new assessment time allowance or production deployment is claimed.

## Architecture and event contract

REST remains the only command interface. The existing PostgreSQL order locks, versions, price snapshots, cancellation audit and persisted idempotency still determine every accepted mutation. Domain rules and shared event types import no Socket.IO/NestJS framework code.

`RealtimeEventPublisher` is an application port. `PrismaOrderUnitOfWork` records whether a mutation actually ran, awaits successful commit, and schedules best-effort notification publication through the port. Replayed results do not republish; failed transactions publish nothing. A publication failure is logged and cannot roll back or turn an accepted command into a failed REST response. Publication is not awaited by the request.

One `RestaurantEventsGateway` implements the adapter/presentation boundary. The shared typed events are:

- `order:created`: event ID, order ID, table ID and committed **order** version.
- `order:updated`: the same invalidation envelope for add/update/complete/cancel.
- `table:updated`: the same envelope, scoped to hall/manager clients. Its version refers to the originating order, not a fabricated table-occupancy revision. Clients fetch actual occupancy/totals through REST; no stale availability flag is applied locally.
- `kitchen:item-updated`: the order envelope plus item ID, item version and status. The status includes SERVED/CANCELLED so removal from actionable kitchen lanes is representable. Whole-order changes also invalidate kitchen state through order events.

The payload has no customer content, price, name, description, credentials or client-selected tenant. Notifications are hints, not an independent state store. Menu/configuration and Super Admin views retain polling; this release targets transactional shift changes.

## Authentication, rooms and revocation

REST and sockets use `RestaurantSessionAuthenticator`: a restaurant-audience/issuer-checked JWT cookie, persisted session expiry/revocation, active user/membership, authorized active branch and active tenant. Platform credentials confer no socket access. Authentication runs in Socket.IO connection middleware before room admission; an asynchronous gateway connection callback alone would not be an authorization gate.

The backend derives role rooms:

- `tenant:<tenant>:branch:<branch>:hall` for waiter/manager.
- `tenant:<tenant>:branch:<branch>:kitchen` for kitchen/manager.

There is no client room subscription interface, no order-room requirement and no socket command protocol. Incoming custom messages disconnect the client. Selected-order views receive branch invalidations and retain REST ownership checks when refetching.

Before every outgoing change, each local candidate's current database authorization is checked again; no blind room broadcast bypasses revocation. Role/context changes disconnect instead of retaining old room grants. Logout disconnects that session locally after database revocation. A five-second sweep also disconnects idle revoked/expired/suspended/changed accounts; no notification waits for that sweep to revalidate. Already-authorized/in-flight frames cannot be recalled after a later revocation, just as already-authorized REST work can finish.

Origin validation applies to WebSocket handshakes, subsequent polling requests and transport upgrade requests. Explicit origins must exactly match `WEB_ORIGIN`. An origin-less same-origin polling request additionally requires browser `Sec-Fetch-Site: same-origin` and the configured host. The Next relay reconstructs a missing origin only for same-origin requests; arbitrary cross-site/missing-origin clients are not admitted. Cookies, not query/auth tenant fields, establish identity.

Gateway options bound incoming payloads to 4 KiB. Admission checks limit local connected sockets to 500 and four per session; these are best-effort process-local resource checks, not a tested rate-limit/DoS or capacity guarantee. Authorization batches use at most 16 concurrent checks. Revalidation adds database work per connection/change; benchmark before increasing load or instance count. No raw token or handshake body is logged.

## Frontend and transport

The restaurant frontend uses one client connection per mounted staff/admin workspace and recreates it on actor-context changes. Typed listeners coalesce refetch requests over 100ms, ignore older/duplicate order versions and never issue mutation commands. Every connection/reconnection invalidates authoritative REST state. Generation counters prevent an older refresh response from overwriting a newer request's result.

Five-second polling remains active even while connected: it covers commit-to-publication crashes and missed events on an apparently live connection. A socket-status indicator is distinct from REST connectivity. Socket loss does not disable order buttons; uncertain command retries keep their original idempotency key. Offline views retain last successful work with stale warnings.

Next preserves the Socket.IO trailing-slash endpoint without canonical redirects. Route handlers at `/socket.io` relay Socket.IO **HTTP long-polling** through the existing runtime `API_INTERNAL_URL`. They do not implement WebSocket upgrade forwarding. The local app therefore has working real-time Socket.IO via polling fallback. The supplied Caddy route sends `/socket.io/*` directly to Nest before forwarding other requests to Next, supporting WebSocket upgrades under HTTPS. That Caddy/Docker/HTTPS transport path is configured but not runtime-verified here. Direct API WebSocket and polling connections are covered by integration tests.

No client-readable JWT or hardcoded public API address is introduced. Frontend containers still do not receive signing, database or AI credentials.

## Reliability and scaling limits

This is a **single-API-instance** implementation. Notifications can be lost after commit/before publication or during a disconnect, and independent asynchronous publications can arrive out of order. Reconnection/refetch and periodic polling recover state; no exactly-once or durable event delivery is promised. Socket.IO's ordering within an established connection does not imply global database commit order across independently scheduled publications.

No outbox is added. Introduce one when durable notification latency/replay is worth the storage, dispatch and duplicate-processing complexity. Business mutation plus outbox row must then commit together; the current order response/idempotency record remains authoritative.

No Redis adapter is added, and BullMQ remains AI processing only. Merely installing an adapter would not make this implementation cluster-ready: delivery currently enumerates and reauthorizes **local** recipients. A multi-instance extension must fan committed invalidations to each instance, reauthorize local recipients there, propagate immediate session disconnects and configure session affinity when polling is enabled. Plain cross-instance room broadcasts must not bypass those checks. Redis Pub/Sub is not durable replay. Keep Redis private and review adapter credentials/isolation before scaling.

## Verification and remaining gates

`pnpm verify` passed formatting, lint, typechecks, 13 unit tests, 43 real-service integration tests and all app builds. `pnpm test:browser` passed 5 Chromium tests, for 61 tests total. These are local results; deployment gates below remain open.

- Real Socket.IO tests cover valid WebSocket/polling connections, invalid credentials/origins, tenant/branch isolation, post-commit visibility, no publication on failed/replayed mutations, concurrent additions, kitchen status, forbidden client join/command attempts, publication failure, logout revocation and database/idle authorization changes.
- Chromium tests cover live waiter/kitchen updates and manager dashboard refresh with assertions tighter than the five-second polling interval; missed-state REST synchronization after reconnect; REST cancellation with Socket.IO requests blocked; and the existing responsive/backlog/offline scenarios.
- Docker, public HTTPS, actual Caddy upgrades, multi-instance fan-out, socket capacity/load and long-duration network interruption remain unverified. Production MFA/onboarding, live AI/provider eligibility and the narrated assessment recording retain their previous open gates.

## Implementation checklist

- [x] Keep REST transactions/idempotency authoritative and add only post-commit invalidations.
- [x] Add one typed gateway and server-derived role/tenant/branch rooms.
- [x] Share session authentication and revalidate before delivery; disconnect revoked/changed sessions.
- [x] Add listeners, version-aware invalidation, reconnect refetch, status indicators and polling fallback.
- [x] Exercise actual Socket.IO security/delivery and simultaneous browser staff workflows.
- [ ] Verify the configured HTTPS/Caddy WebSocket upgrade path on a Docker-enabled host.
- [ ] Add multi-instance coordination/Redis adapter only when deploying multiple API instances.
- [x] Centralized persistent notifications subsequently added a transactional outbox; see NOTIFICATIONS.md. The original lightweight board invalidations still recover through authoritative refetching.

## Primary references

- [NestJS gateway lifecycle and authentication caveat](https://docs.nestjs.com/websockets/gateways).
- [Socket.IO delivery guarantees](https://socket.io/docs/v4/delivery-guarantees/).
- [Socket.IO origin/CORS boundaries](https://socket.io/docs/v4/handling-cors).
- [Reverse-proxy transport configuration](https://socket.io/docs/v4/reverse-proxy).
- [Multiple-node session affinity](https://socket.io/docs/v4/using-multiple-nodes/).
- [Redis adapter semantics and trust boundary](https://socket.io/docs/v4/redis-adapter/).

## Restarted local smoke

After restarting the API/frontend, a standard Node Socket.IO client connected through the Next polling relay on port 3000 and directly by WebSocket on port 4000. REST logout disconnected both connections for that session. The live smoke exposed a Next trailing-slash 308 redirect; `skipTrailingSlashRedirect` now preserves the Socket.IO endpoint and the browser suite includes a standard Node client through that relay. No credentials were printed. This verifies local transports, not public Caddy/TLS deployment.
