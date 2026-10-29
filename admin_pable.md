# Request for Proposal (RFP)
# RestaurantOS — Restaurant Admin & Super Admin Management Platform

**Project:** RestaurantOS  
**Document Type:** Product Requirements & Technical Specification  
**Version:** 1.0  
**Target Market:** Iran  
**Architecture:** Clean Architecture + Modular Monolith  
**Frontend:** Next.js + TypeScript  
**Backend:** NestJS + TypeScript  
**Database:** PostgreSQL + Prisma  
**Background Processing:** BullMQ + Redis  
**Package Management:** pnpm Workspaces

---

# 1. Executive Summary

RestaurantOS is a multi-tenant SaaS platform designed to streamline restaurant operations in Iran.

This RFP defines two complementary management interfaces:

1. **Restaurant Admin Panel:** A tenant-scoped management interface for restaurant owners and managers.
2. **Super Admin Panel:** A platform-level management interface for the SaaS operator.

Both interfaces must share the existing RestaurantOS backend architecture, authentication infrastructure, domain models, and engineering standards.

The system must enforce strict separation between restaurant-owned data and platform administration.

The Restaurant Admin Panel must prioritize practical daily operations.

The Super Admin Panel must prioritize tenant lifecycle management, operational visibility, security, and platform control.

The solution must be designed for long-term maintainability without introducing unnecessary microservices or infrastructure complexity.

## 1.1 Primary Objectives

- Provide restaurant managers with a usable operational dashboard.
- Centralize staff, menu, table, and order administration.
- Support multiple restaurants and branches.
- Provide secure platform-level administrative operations.
- Prevent cross-tenant data exposure.
- Enforce role-based access control.
- Maintain auditability of sensitive actions.
- Support reliable, idempotent administrative operations.
- Integrate with the existing NestJS and BullMQ infrastructure.
- Provide consistent Persian-first, RTL interfaces.

---

# 2. Scope and Delivery Strategy

The two panels have different delivery priorities.

## 2.1 Restaurant Admin MVP

The Restaurant Admin Panel is part of the initial restaurant workflow and must be included in the first usable product.

Its minimum scope is:

- Authentication.
- Restaurant dashboard.
- Menu management.
- Order monitoring.
- Table overview.
- AI-assisted menu creation.

Staff accounts may initially be provisioned using seed data.

## 2.2 Super Admin MVP

The Super Admin Panel is a separate administrative milestone.

Its minimum useful release consists of:

- Secure platform administrator login.
- Restaurant directory.
- Restaurant creation.
- Restaurant activation and suspension.
- Basic branch information.
- Minimal audit history.
- Basic system health overview.

Advanced features must not be implemented before the core restaurant workflow is reliable.

**Important scope constraint:** The original engineering assessment allows only six working hours. A complete Super Admin Panel cannot reasonably be added to that scope without removing other requirements or extending the agreed delivery time.

Therefore, this document specifies both panels, but full Super Admin implementation is designated as a subsequent phase unless explicitly approved as a scope replacement.

---

# 3. User Roles and Access Model

## 3.1 Restaurant Roles

### MANAGER

A restaurant manager can:

- View the restaurant dashboard.
- Manage menu items and categories.
- View and manage restaurant orders.
- Monitor table activity.
- Review AI-generated menu drafts.
- View staff assigned to the restaurant.
- Manage authorized branch information.
- Access operational summaries.

All permissions must be limited to the restaurant's own data.

### WAITER

A waiter can:

- View authorized branch tables.
- Create and modify orders.
- View order statuses.
- Mark appropriate items as served.

A waiter cannot access manager-only configuration features.

### KITCHEN

Kitchen staff can:

- View relevant kitchen orders.
- Update preparation statuses.
- View order details required for food preparation.

Kitchen staff cannot modify prices, restaurant settings, or staff permissions.

## 3.2 Platform Roles

### SUPER_ADMIN

A platform administrator can:

- Create restaurant tenants.
- View tenant lifecycle status.
- Activate or suspend restaurants.
- Review platform operational health.
- View restricted platform audit records.
- Manage approved platform configuration.
- Review aggregated operational metrics.

A platform administrator must not automatically gain unrestricted access to restaurant customer information, private operational details, or individual orders.

Exceptional access must require a separate, explicitly authorized, audited workflow.

## 3.3 Access Control Matrix

| Function | Manager | Waiter | Kitchen | Super Admin |
|---|---|---|---|---|
| Own restaurant dashboard | Yes | Limited | Limited | No |
| Own restaurant menu management | Yes | No | No | No |
| Create orders | Yes | Yes | No | No |
| Update kitchen status | Yes | No | Yes | No |
| Manage restaurant staff | Yes | No | No | No |
| Manage all SaaS tenants | No | No | No | Yes |
| Suspend a restaurant | No | No | No | Yes |
| View platform health | No | No | No | Yes |
| Access platform audit logs | No | No | No | Yes |
| Access another restaurant's orders | No | No | No | No by default |

All permissions must be enforced by the NestJS backend.

---

# PART I — RESTAURANT ADMIN PANEL

# 4. Restaurant Admin Dashboard

## 4.1 Purpose

The dashboard must provide managers with an immediate overview of their restaurant's current operations.

It must focus on information that helps them manage an active shift.

## 4.2 Required Dashboard Widgets

### Operational Summary

Display:

- Active orders.
- Occupied tables.
- Available tables.
- Orders awaiting preparation.
- Orders currently preparing.
- Orders ready for service.

### Recent Orders

Display:

- Order number.
- Table number.
- Order creation time.
- Current status.
- Total amount.
- Assigned branch.

### Kitchen Activity

Display:

- Pending preparation items.
- Preparing items.
- Ready items.

### Quick Actions

Provide shortcuts to:

- View active orders.
- Manage the menu.
- View tables.
- Create an AI menu draft.

## 4.3 Dashboard Requirements

- Data must be tenant-scoped.
- Branch restrictions must be enforced.
- Server-side pagination must be supported where appropriate.
- Dashboard metrics must be calculated from authoritative records.
- Recent operational information should refresh automatically.
- Failed requests must display understandable errors.

Advanced financial analytics are outside the initial MVP.

---

# 5. Menu Management

## 5.1 Menu Categories

Managers must be able to:

- Create categories.
- Edit category names.
- Change display ordering.
- Activate or deactivate categories.

Examples:

- نوشیدنی گرم
- نوشیدنی سرد
- صبحانه
- برگر
- پیتزا
- دسر

## 5.2 Menu Items

Managers must be able to:

- Create menu items.
- Edit names and descriptions.
- Set prices.
- Assign categories.
- Mark items as available or unavailable.
- Deactivate items without destroying historical order records.

## 5.3 Price Handling

- Store canonical monetary amounts as integer Iranian rials.
- Display prices in toman.
- Perform explicit currency-unit conversions.
- Never use floating-point arithmetic for money.
- Preserve historical order price snapshots.
- Validate prices before persistence.

## 5.4 Concurrency

If multiple managers edit the same menu item, stale updates must not silently overwrite newer data.

Use optimistic concurrency control where necessary.

For example, a menu item may contain a version field.

Updates must verify the expected version before applying changes.

Conflicting requests should receive HTTP 409 with a clear error response.

## 5.5 AI-Assisted Menu Creation

Managers may submit Persian descriptions of dishes or drinks.

The system should:

1. Receive unstructured Persian input.
2. Create an AI processing request.
3. Queue the request through BullMQ.
4. Generate structured menu information.
5. Validate the AI response.
6. Display the generated draft.
7. Allow the manager to edit the draft.
8. Require explicit approval.
9. Persist the approved menu item.

AI-generated prices and categories must not be trusted without validation.

Failed AI processing must not affect ordinary menu editing or restaurant ordering.

---

# 6. Order Management

## 6.1 Order List

Managers must be able to view:

- Active orders.
- Completed orders.
- Order creation times.
- Associated tables.
- Order totals.
- Kitchen preparation statuses.

## 6.2 Order Details

Display:

- Order identifier.
- Restaurant and branch context.
- Table number.
- Ordered items.
- Quantities.
- Price snapshots.
- Preparation statuses.
- Order creation and modification timestamps.
- Relevant order history.

## 6.3 Administrative Actions

Managers may:

- View active orders.
- Add items when the order remains editable.
- Complete eligible orders.
- Review order status transitions.

The MVP does not need a complex refund, cancellation, or discount system.

Actions affecting business invariants must be transactional and audited where appropriate.

## 6.4 Concurrency Requirements

Multiple staff members may interact with an order simultaneously.

The system must preserve valid concurrent changes.

Required mechanisms:

- PostgreSQL transactions.
- Row-level locks where appropriate.
- Conditional updates.
- Unique constraints.
- Idempotency keys.
- Explicit conflict handling.

Never overwrite an entire order using a stale frontend representation.

---

# 7. Table Management

## 7.1 Table Overview

The Restaurant Admin Panel must provide:

- Table number.
- Branch.
- Availability status.
- Active order reference.
- Current order total where applicable.

## 7.2 Table Administration

Managers may:

- View tables.
- Create tables.
- Rename or renumber tables.
- Deactivate unused tables.

For the initial assessment, table configuration may be prepopulated through seed data.

## 7.3 Business Rules

- Table numbers must be unique within the appropriate branch.
- Active orders must remain linked to the correct table.
- Deactivating a table must not delete historical orders.
- Table occupancy must remain consistent with active order state.

---

# 8. Staff Management

## 8.1 Staff Directory

The Restaurant Admin Panel should support:

- Staff name.
- Assigned role.
- Assigned branches.
- Account status.

## 8.2 Account Administration

In a later phase, managers should be able to:

- Invite employees.
- Assign restaurant roles.
- Assign branch permissions.
- Deactivate staff access.
- Revoke active sessions where supported.

## 8.3 Security Requirements

- A manager cannot assign platform administrator privileges.
- A manager cannot create memberships for an unrelated restaurant.
- Staff access changes must take effect according to a documented session-revocation policy.
- Role changes must be recorded in the audit log.

For the initial MVP, staff provisioning may be handled through secure seed data and configuration.

---

# 9. Restaurant Settings

Provide a basic restaurant information screen.

Recommended fields:

- Restaurant name.
- Branch name.
- Contact information.
- Business address.
- Default currency presentation.
- Timezone.

The following settings belong to future phases:

- Advanced tax configuration.
- Receipt customization.
- Payment provider integration.
- Inventory settings.
- Subscription configuration.

---

# PART II — SUPER ADMIN PANEL

# 10. Platform Dashboard

## 10.1 Purpose

The Super Admin Panel must provide a centralized control surface for operating RestaurantOS as a SaaS platform.

Unlike the Restaurant Admin Panel, it must focus on tenant lifecycle management and system operations rather than individual restaurant workflows.

## 10.2 Overview Metrics

Recommended metrics:

- Total registered restaurants.
- Active restaurants.
- Suspended restaurants.
- Number of branches.
- Total registered staff accounts.
- Total orders processed during a selected period.
- AI jobs pending.
- AI jobs failed.
- Background worker health.
- Service availability.

Operational metrics should avoid exposing unnecessary customer data.

## 10.3 Platform Health

Display:

- API health.
- Database readiness.
- Redis connectivity.
- BullMQ worker status.
- Failed background jobs.
- Recent application errors.

Health data must come from actual service checks and metrics.

Do not display fabricated uptime percentages or operational statistics.

---

# 11. Tenant Management

## 11.1 Restaurant Directory

Provide a searchable list containing:

- Restaurant ID.
- Restaurant name.
- Creation date.
- Account status.
- Number of branches.
- Owner or administrative contact where authorized.

The interface must support server-side pagination and filtering.

## 11.2 Restaurant Creation

Super Admin must be able to register a restaurant tenant.

Required fields:

- Restaurant name.
- Primary contact.
- Initial branch name.
- Contact information.
- Tenant status.

Tenant provisioning must establish required database records consistently.

## 11.3 Tenant Provisioning

A successful provisioning operation should:

1. Create the restaurant record.
2. Create its initial branch.
3. Establish required default configuration.
4. Associate an initial manager account through a secure provisioning process.
5. Record an audit event.
6. Return the created tenant identifier.

The operation must be idempotent.

Repeated requests with the same idempotency key must not create duplicate restaurants.

## 11.4 Tenant Statuses

Recommended statuses:

- ACTIVE
- SUSPENDED

Additional lifecycle states may be added when justified.

### ACTIVE

Authorized restaurant users may access the application normally.

### SUSPENDED

Normal restaurant access is restricted.

Suspension must not delete orders, menu records, staff information, or historical activity.

## 11.5 Suspension Requirements

A suspension operation must:

- Verify the platform administrator's authorization.
- Record the reason.
- Persist the change atomically.
- Record the action in an audit log.
- Apply the restriction to subsequent protected requests.

Any delay caused by authorization caching or existing sessions must be documented and tested.

---

# 12. Branch Management

The Super Admin Panel should provide a high-level view of tenant branches.

Required information:

- Branch ID.
- Branch name.
- Restaurant ownership.
- Branch status.
- Creation date.

Super Admin may create an initial branch during tenant provisioning.

Routine branch administration should normally belong to authorized restaurant managers in a later phase.

Platform administration must not bypass branch security in normal restaurant APIs.

---

# 13. Platform Users and Administrative Accounts

## 13.1 Platform Administrator Identity

Platform administrator privileges must be distinct from restaurant membership roles.

A restaurant manager cannot become a platform administrator by editing a role field or crafting a request.

## 13.2 Administrator Provisioning

For the MVP:

- Platform administrator accounts must be provisioned through a secure controlled process.
- Public Super Admin registration must not exist.
- Administrative privileges must not be assignable through restaurant APIs.

## 13.3 Authentication Security

Required security controls for production:

- Secure password storage.
- HttpOnly and Secure cookies.
- CSRF protection.
- Authentication rate limiting.
- Session expiration.
- Session revocation.
- Strong authentication requirements.
- Multi-factor authentication for privileged accounts.

If MFA is not implemented in the assessment prototype, Super Admin access must be clearly labeled as unsuitable for managing real production customers.

## 13.4 Privileged Operations

Sensitive changes should require:

- A valid platform administrator session.
- Explicit authorization.
- Request validation.
- Audit logging.
- Idempotency where appropriate.

---

# 14. Audit Logs

## 14.1 Objective

Track security-sensitive and operationally significant administrative actions.

## 14.2 Audited Events

At minimum:

- Tenant created.
- Tenant activated.
- Tenant suspended.
- Platform administrator login failure.
- Restaurant membership role changed.
- Privileged configuration changed.
- Exceptional support access granted or revoked, if implemented.

## 14.3 Audit Record Structure

Recommended fields:

- Audit event ID.
- Actor ID.
- Actor type.
- Target tenant ID.
- Action.
- Resource type.
- Resource ID.
- Timestamp.
- Request ID.
- Outcome.
- Reason where required.
- Sanitized metadata.

## 14.4 Audit Security

- Audit records must be append-only through normal application APIs.
- Unauthorized users must not edit or delete logs.
- Sensitive credentials must never appear in logs.
- Audit access must be restricted.
- Log retention policies must be documented.
- Privileged events must remain attributable to individual administrator accounts.

The MVP may use a dedicated PostgreSQL audit table.

Immutable external audit storage may be considered later.

---

# 15. Background Job Monitoring

## 15.1 Purpose

Super Admin should be able to inspect operational information from BullMQ without requiring direct Redis access.

## 15.2 Required Information

- Queue name.
- Waiting job count.
- Active job count.
- Completed job count, where retained.
- Failed job count.
- Recent failure summaries.
- Worker availability.

## 15.3 Administrative Actions

Read-only monitoring is sufficient for the initial release.

Future capabilities may include:

- Retry failed jobs.
- Pause or resume queues.
- Inspect sanitized job metadata.
- Trigger controlled recovery procedures.

## 15.4 Safety Rules

Queue administration must not expose raw job payloads containing sensitive restaurant information.

Manual retries must preserve idempotency.

Platform administrators must not be able to bypass tenant validation by modifying job payloads.

---

# 16. SaaS Subscription and Billing Management

**Status: Future Phase**

The Super Admin Panel should eventually support:

- Subscription plans.
- Trial periods.
- Subscription activation.
- Subscription suspension.
- Billing history.
- Payment status.
- Plan-based feature limits.

The initial MVP must not implement billing unless explicitly required.

Do not introduce unnecessary payment provider dependencies during the engineering assessment.

A future billing module must support the legal, operational, and payment requirements applicable to the Iranian market.

---

# PART III — SHARED TECHNICAL ARCHITECTURE

# 17. Monorepo Architecture

Both admin interfaces must integrate with the existing RestaurantOS pnpm monorepo.

Recommended structure:

```text
restaurant-os/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (restaurant-admin)/
│   │   │   ├── (waiter)/
│   │   │   └── (kitchen)/
│   │   └── features/
│   │
│   ├── super-admin/
│   │   ├── app/
│   │   ├── components/
│   │   └── features/
│   │
│   ├── api/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── tenants/
│   │       │   ├── branches/
│   │       │   ├── staff/
│   │       │   ├── menu/
│   │       │   ├── orders/
│   │       │   ├── kitchen/
│   │       │   ├── ai/
│   │       │   ├── platform-admin/
│   │       │   └── audit/
│   │       └── common/
│   │
│   └── worker/
│       └── src/
│
├── packages/
│   ├── database/
│   ├── shared/
│   ├── ui/
│   └── eslint-config/
│
├── .github/workflows/
├── .husky/
├── docker-compose.yml
├── pnpm-workspace.yaml
├── README.md
└── docs/
```

The Super Admin frontend may be a separate Next.js application while using the same NestJS backend.

A separate frontend application is an organizational and security-boundary choice, not a substitute for server-side authorization.

Within the six-hour assessment, adding a separate frontend application is optional and should not delay core product delivery.

---

# 18. Clean Architecture Requirements

The NestJS backend must maintain Clean Architecture boundaries.

## 18.1 Domain Layer

Examples:

- Restaurant
- Branch
- TenantStatus
- StaffMembership
- AdministrativeAction
- AuditEvent

Domain business rules must remain independent of infrastructure frameworks.

## 18.2 Application Layer

Example use cases:

- CreateRestaurantUseCase
- SuspendRestaurantUseCase
- ActivateRestaurantUseCase
- ListRestaurantsUseCase
- UpdateMenuItemUseCase
- GetRestaurantDashboardUseCase
- GetPlatformHealthUseCase

Use cases must coordinate business logic, authorization policies, persistence ports, and transaction boundaries.

## 18.3 Infrastructure Layer

Implement:

- Prisma repositories.
- PostgreSQL transaction adapters.
- BullMQ queue adapters.
- Redis connectivity.
- Audit persistence.
- AI provider adapters.
- Operational health adapters.

## 18.4 Presentation Layer

Implement:

- NestJS controllers.
- DTO validation.
- Authentication guards.
- Tenant authorization guards.
- Platform administrator guards.
- Exception filters.
- Consistent response serialization.

## 18.5 Dependency Rule

The domain must never depend on NestJS, Prisma, Redis, BullMQ, or HTTP.

Infrastructure must implement application-defined ports.

Avoid building unnecessary abstraction layers for trivial operations.

---

# 19. Authentication and Authorization Architecture

## 19.1 Separate Security Contexts

Define two authorization contexts:

**Restaurant Context**

- Authenticated user.
- Restaurant membership.
- Branch membership.
- Restaurant role.

**Platform Context**

- Authenticated platform administrator.
- Platform permissions.
- Privileged operation policies.

## 19.2 NestJS Guards

Recommended guards:

- JwtAuthGuard
- RestaurantMembershipGuard
- BranchAccessGuard
- RolesGuard
- PlatformAdminGuard

Use separate platform-administrator routes and authorization policies.

## 19.3 Tenant Context

Restaurant identity must come from verified authentication and membership context.

A route parameter may identify the requested restaurant, but it must never independently authorize access.

## 19.4 Super Admin Restrictions

Super Admin accounts must not automatically bypass restaurant authorization guards.

Any support-access mechanism must be:

- Explicit.
- Restricted.
- Time-limited.
- Audited.
- Justified.
- Disabled unless necessary.

Customer impersonation is not part of the MVP.

---

# 20. API Specification

## 20.1 Restaurant Admin APIs

**Base path:** `/api/v1/admin`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Restaurant operational overview |
| GET | `/orders` | List orders |
| GET | `/orders/:id` | Order details |
| GET | `/tables` | Table overview |
| POST | `/tables` | Create table |
| PATCH | `/tables/:id` | Update table |
| GET | `/menu/items` | List menu items |
| POST | `/menu/items` | Create menu item |
| PATCH | `/menu/items/:id` | Update menu item |
| GET | `/staff` | List restaurant staff |
| POST | `/ai/menu-drafts` | Request AI draft |
| GET | `/ai/menu-drafts/:id` | Read AI draft |
| POST | `/ai/menu-drafts/:id/approve` | Approve AI draft |

Every endpoint must enforce restaurant and branch authorization.

## 20.2 Super Admin APIs

**Base path:** `/api/v1/platform`

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/dashboard` | Platform overview |
| GET | `/restaurants` | Tenant directory |
| POST | `/restaurants` | Create restaurant |
| GET | `/restaurants/:id` | Tenant metadata |
| POST | `/restaurants/:id/suspend` | Suspend tenant |
| POST | `/restaurants/:id/activate` | Activate tenant |
| GET | `/restaurants/:id/branches` | List tenant branches |
| GET | `/audit-logs` | Platform audit history |
| GET | `/queues` | Queue statistics |
| GET | `/health` | Platform health summary |

These endpoints must require explicit platform administrator authorization.

The tenant metadata endpoint must not expose individual restaurant orders or customer details by default.

---

# 21. Idempotency Requirements

## 21.1 Restaurant Admin Operations

Idempotency must be applied to selected non-repeatable operations, including:

- Creating menu items through AI draft approval.
- Creating orders.
- Adding order items.
- Completing orders where duplicate submission could cause a repeated side effect.

## 21.2 Super Admin Operations

Idempotency must be applied to:

- Creating tenants.
- Creating initial branches.
- Provisioning initial administrative memberships.
- Any operation that triggers external side effects.

Suspension and activation must be designed as idempotent desired-state operations.

Repeated suspension of an already suspended tenant must not create inconsistent state.

## 21.3 Implementation

Use PostgreSQL-backed idempotency records with:

- Principal scope.
- Tenant or platform scope.
- Operation identity.
- Idempotency key.
- Request fingerprint.
- Execution state.
- Result reference.
- Expiration policy.

Critical database mutations and idempotency records must be committed atomically where applicable.

Do not rely exclusively on in-memory locks or Redis caching.

---

# 22. Concurrency Requirements

Administrative operations must remain correct when multiple authorized users act simultaneously.

## 22.1 Restaurant Admin Scenarios

Examples:

- Two managers edit the same menu item.
- A manager deactivates a menu item while a waiter submits an order.
- A manager completes an order while another user tries adding an item.

Required behavior:

- Preserve valid concurrent operations.
- Reject incompatible stale operations.
- Maintain price snapshots.
- Enforce valid state transitions.

## 22.2 Super Admin Scenarios

Examples:

- Two administrators attempt to create the same tenant.
- One administrator suspends a tenant while another attempts activation.
- Tenant provisioning is retried after a network timeout.

Required mechanisms:

- Database transactions.
- Unique constraints.
- Idempotency keys.
- Conditional updates.
- Explicit conflict responses.
- Audit logging.

---

# 23. Database Requirements

Extend the existing Prisma domain model.

Recommended additional entities:

- PlatformAdmin
- TenantLifecycleEvent
- AdminAuditLog
- SubscriptionPlan (future)
- TenantSubscription (future)
- PlatformConfiguration (future)

Reuse existing domain entities where possible:

- Restaurant
- Branch
- User
- RestaurantMembership
- MenuItem
- Order
- OrderItem
- IdempotencyRecord
- AiMenuDraft

Do not introduce duplicate restaurant or user tables solely because two admin interfaces exist.

Use database constraints to preserve ownership relationships and business invariants.

Use Prisma migrations for all schema modifications.

---

# 24. Security Requirements

## 24.1 Tenant Isolation

Restaurant A must never access Restaurant B's data through ordinary restaurant APIs.

Platform operations must not weaken this rule.

## 24.2 Privilege Escalation Prevention

Restaurant managers must not be able to:

- Create platform administrators.
- Modify platform roles.
- Access tenant lifecycle APIs.
- View global audit logs.
- Suspend competing restaurants.

## 24.3 CSRF and Session Protection

Because authentication uses cookies:

- Implement appropriate CSRF defenses.
- Use HttpOnly cookies.
- Use Secure cookies under HTTPS.
- Configure SameSite deliberately.
- Validate request origin where appropriate.
- Apply session expiration and revocation policies.

## 24.4 Sensitive Administrative Operations

Platform-level operations must have:

- Strong authentication.
- Explicit authorization.
- Rate limits.
- Audit logging.
- Request validation.
- Safe error handling.

## 24.5 Data Protection

- Never expose database connection strings.
- Never log access tokens or secrets.
- Sanitize operational logs.
- Avoid exposing customer data in platform metrics.
- Protect production seed and administrative credentials.
- Use least-privilege database accounts where practical.

---

# 25. BullMQ Integration

Use the existing BullMQ infrastructure.

## 25.1 Restaurant Admin Use Cases

- AI menu draft generation.
- Asynchronous AI result processing.
- Controlled retry of temporary failures.

## 25.2 Super Admin Use Cases

Initially:

- Read queue statistics.
- Review sanitized failure summaries.

Future:

- Controlled job retry.
- Scheduled tenant maintenance.
- Background onboarding tasks.
- Operational notifications.

## 25.3 Queue Reliability

Workers must tolerate at-least-once execution.

Persisted business actions must be idempotent.

Use database-backed processing states and unique constraints.

Do not assume a BullMQ job identifier guarantees exactly-once execution.

---

# 26. Frontend Design Requirements

## 26.1 Shared Design System

Both panels should share:

- Typography.
- Colors.
- Form controls.
- Tables.
- Dialogs.
- Validation messages.
- Loading states.
- Error components.
- Navigation conventions.

Use a shared UI package when it reduces meaningful duplication without delaying delivery.

## 26.2 Persian and RTL Support

Requirements:

- Fully responsive layouts.
- RTL navigation.
- Persian-first labels.
- Appropriate Persian typography.
- Toman formatting.
- Tehran-local time presentation.
- Accessible form controls.
- Keyboard navigation.
- Clear confirmation dialogs for destructive actions.

## 26.3 Restaurant Admin Navigation

Recommended routes:

- `/dashboard`
- `/dashboard/orders`
- `/dashboard/tables`
- `/dashboard/menu`
- `/dashboard/menu/ai-drafts`
- `/dashboard/staff`
- `/dashboard/settings`

## 26.4 Super Admin Navigation

Recommended routes in a separate frontend application:

- `/login`
- `/dashboard`
- `/restaurants`
- `/restaurants/new`
- `/restaurants/[id]`
- `/audit-logs`
- `/queues`
- `/system-health`

Do not render navigation links that users are not authorized to use.

However, hiding navigation items must never replace backend permission checks.

---

# 27. Testing Requirements

## 27.1 Testing Tools

- Jest.
- Supertest.
- PostgreSQL-backed integration tests.
- Redis-backed tests for queue functionality.

## 27.2 Restaurant Admin Tests

Required scenarios:

1. Manager can create a menu item.
2. Waiter cannot create a menu item.
3. Manager cannot modify another restaurant's menu.
4. Stale menu updates are rejected.
5. AI draft approval cannot duplicate a menu item.
6. Restaurant dashboard only includes authorized data.

## 27.3 Super Admin Tests

Required scenarios:

1. Normal restaurant users cannot access platform routes.
2. Super Admin can create a tenant.
3. Duplicate provisioning requests do not create duplicate tenants.
4. Tenant suspension blocks subsequent authorized restaurant operations according to the documented policy.
5. Tenant activation restores permitted access.
6. Tenant lifecycle actions create audit records.
7. Platform metrics do not disclose unauthorized customer records.

## 27.4 Security Tests

Include explicit attempts to:

- Access another tenant's data by ID.
- Manipulate tenant identifiers.
- Escalate restaurant roles.
- Access platform APIs with restaurant credentials.
- Retry sensitive operations.
- Submit stale concurrent updates.

Tests involving database correctness must use real PostgreSQL behavior rather than mocks alone.

---

# 28. Developer Tooling

The repository must continue using:

- pnpm Workspaces.
- TypeScript.
- ESLint.
- Prettier.
- Husky.
- lint-staged.
- Jest.
- Supertest.
- Docker Compose.
- GitHub Actions.

All applications must follow common linting and formatting standards.

Git hooks must execute lint-staged on relevant staged files.

GitHub Actions must run:

1. Dependency installation.
2. Prettier checks.
3. ESLint.
4. TypeScript typechecking.
5. Unit tests.
6. Integration tests.
7. API tests.
8. Production builds.

Super Admin security checks must not be excluded from CI.

---

# 29. Docker and Deployment

## 29.1 Docker Compose

Support:

- PostgreSQL.
- Redis.
- NestJS API.
- NestJS Worker.
- Restaurant frontend.
- Super Admin frontend when implemented.

## 29.2 Local Development

The project must provide reproducible setup instructions.

Target command:

`docker compose up --build`

Database migrations and seed initialization must be documented and reproducible.

## 29.3 Production Deployment

Requirements:

- HTTPS.
- Secure environment variables.
- Separate application URLs or routing boundaries.
- Restricted Super Admin access.
- Appropriate CORS configuration.
- Health checks.
- Structured error logging.

The Super Admin Panel should preferably use a dedicated origin.

A separate origin improves administrative isolation but does not replace authentication, authorization, or session security.

---

# 30. Logging and Observability

Use structured logging through the NestJS backend.

Required metadata where appropriate:

- Request ID.
- Timestamp.
- Actor ID.
- Actor type.
- Tenant ID.
- Operation.
- Response status.
- Error code.
- Duration.

Super Admin operations must generate sufficient audit records to investigate security incidents.

Avoid logging sensitive request bodies and credentials.

---

# 31. Demo Data and Accounts

The demonstration environment must include at least two independent restaurant tenants.

Example:

**Tenant A:** Café Narenj, Tehran  
**Tenant B:** Restaurant Golestan, Tehran

Provide:

- Manager account for Tenant A.
- Manager account for Tenant B.
- Waiter account.
- Kitchen account.
- Platform administrator account if the Super Admin Panel is implemented.

The demo should include:

- Restaurant menu data.
- Multiple categories.
- Tables.
- Active orders.
- Completed historical orders.
- AI menu draft examples.
- Tenant lifecycle records.
- Audit history where applicable.

Demo credentials must be documented and restricted to nonproduction data.

---

# 32. Explicitly Out of Scope

Unless separately approved, the following features are excluded:

- Full SaaS billing.
- Payment reconciliation.
- Advanced restaurant analytics.
- Payroll management.
- Inventory management.
- Customer loyalty systems.
- Customer impersonation.
- Full support ticket management.
- Complex subscription plans.
- Automated tenant billing.
- Custom role builders.
- Advanced feature flag platforms.
- Multi-region infrastructure.
- Microservices.
- Kubernetes.
- Automated tenant database provisioning.
- Advanced AI monitoring platforms.

These capabilities may be proposed in future roadmap documents.

---

# 33. Deliverables

## Restaurant Admin Deliverables

- Working Manager Dashboard.
- Menu Management.
- Order Overview.
- Table Overview.
- AI Menu Draft Interface.
- Authorization and tenant isolation.
- Relevant automated tests.
- Realistic demo data.

## Super Admin Deliverables

For the separately approved Super Admin milestone:

- Platform Dashboard.
- Restaurant Directory.
- Tenant Creation.
- Tenant Activation and Suspension.
- Basic Audit Logs.
- Basic Operational Health.
- Dedicated authorization checks.
- Security and idempotency tests.

## Documentation

Update:

- README.md
- SCOPE.md
- DECISIONS.md
- AI_USAGE.md
- HANDOVER.md

Document any differences between the approved implementation scope and the complete requirements in this RFP.

---

# 34. Acceptance Criteria

## 34.1 Restaurant Admin

The Restaurant Admin Panel is accepted when:

- A manager can authenticate successfully.
- The manager can view authorized restaurant operations.
- Menu items can be created and updated.
- Order information is consistent with operational data.
- Another restaurant's data cannot be accessed.
- Role restrictions are enforced.
- AI drafts require human approval.
- Concurrent mutations do not silently overwrite changes.

## 34.2 Super Admin

The Super Admin Panel is accepted when:

- Only authorized platform administrators can access the interface.
- Restaurant tenants can be listed.
- New restaurant tenants can be provisioned safely.
- Duplicate provisioning does not create duplicate tenants.
- Restaurants can be suspended and reactivated.
- Lifecycle actions are audited.
- Sensitive restaurant data is not exposed by default.
- Basic platform health is visible.
- All required security tests pass.

## 34.3 Engineering

Acceptance requires:

- Clean Architecture boundaries.
- Functional NestJS modules.
- Valid Prisma migrations.
- Reliable idempotency.
- Safe concurrency handling.
- Passing Jest and Supertest tests.
- Working pnpm workspace setup.
- ESLint and Prettier compliance.
- Configured Husky and lint-staged.
- Reproducible Docker Compose startup.
- Passing GitHub Actions CI.
- Deployment over HTTPS.
- Accurate technical and operational documentation.

---

# 35. Final Engineering Instructions

Implement both management interfaces as components of the existing RestaurantOS platform.

Follow these mandatory principles:

1. Preserve the existing NestJS Modular Monolith.
2. Apply Clean Architecture pragmatically.
3. Keep business logic out of controllers.
4. Enforce strict tenant isolation.
5. Keep platform roles separate from restaurant roles.
6. Never implement global authorization bypasses.
7. Use PostgreSQL transactions for critical operations.
8. Implement idempotency for sensitive requests.
9. Prevent lost updates under concurrency.
10. Make background processing idempotent.
11. Use BullMQ only where asynchronous processing provides a real benefit.
12. Maintain consistent UI and engineering standards.
13. Write meaningful security and workflow tests.
14. Keep platform administrative operations auditable.
15. Use realistic Persian demo data.
16. Document limitations and intentionally excluded features.
17. Prioritize operational correctness over visual complexity.
18. Never claim a requirement is complete without implementing and verifying it.

---

# 36. Definition of Done

**Restaurant Admin is complete when** a manager can log in, manage menu information, monitor restaurant operations, use the AI menu drafting workflow, and interact safely with authorized restaurant data.

**Super Admin is complete when** a platform administrator can securely manage restaurant tenants, review basic operational health, audit privileged actions, and perform lifecycle operations without compromising tenant isolation.

**The overall solution is complete when** the agreed scope has been implemented, tested, documented, deployed, and demonstrated.

Features outside the approved milestone must remain explicitly documented as future work.

**End of RFP — RestaurantOS Admin & Super Admin Platform**
