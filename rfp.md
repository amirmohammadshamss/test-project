# Request for Proposal (RFP)
# Restaurant Operations SaaS — Senior Full-Stack AI Builder Assessment

**Project Name:** RestaurantOS  
**Project Type:** Multi-Tenant Restaurant Operations SaaS  
**Target Market:** Iran  
**Delivery Model:** Solo Full-Stack Engineering with AI Assistance  
**Architecture:** Clean Architecture + Modular Monolith  
**Implementation Time Limit:** 6 Working Hours  
**Submission Deadline:** Within 4 Calendar Days  
**Document Status:** Initial Implementation Specification

---

# 1. Executive Summary

## 1.1 Project Overview

RestaurantOS is a lightweight, multi-tenant SaaS platform designed for cafés and restaurants operating in Iran.

The platform aims to replace fragmented restaurant workflows involving handwritten orders, verbal kitchen communication, disconnected payment processes, and manual operational tracking.

The initial release must focus on one complete, reliable operational workflow rather than attempting to build an entire restaurant management ecosystem.

The selected MVP workflow is:

**Table Management → Order Creation → Order Modification → Kitchen Processing → Order Completion**

The system must support multiple staff members working concurrently, enforce strict tenant isolation, maintain data consistency, and remain operational when optional background services or AI providers are unavailable.

The project must demonstrate senior-level engineering judgment through deliberate scope management, security, architectural decisions, automated testing, and production deployment.

## 1.2 Primary Objectives

1. Deliver a functional restaurant ordering and kitchen workflow.
2. Support multiple independent restaurants through a secure multi-tenant architecture.
3. Establish support for restaurants operating multiple branches.
4. Prevent lost updates and inconsistent orders during concurrent operations.
5. Implement idempotent APIs and background jobs.
6. Apply Clean Architecture principles using NestJS.
7. Integrate one useful, clearly justified AI capability.
8. Establish automated testing, code quality enforcement, and continuous integration.
9. Provide reproducible development and deployment environments.
10. Deliver an immediately usable demonstration with realistic Iranian restaurant data.

## 1.3 Guiding Principles

- Correctness over feature count.
- Business rules over framework convenience.
- Tenant isolation by design.
- Explicit authorization at every protected boundary.
- Atomic database operations for critical workflows.
- Idempotent processing under retries.
- Graceful degradation when optional services fail.
- Minimal operational complexity.
- Clear separation of domain, application, infrastructure, and presentation concerns.
- Honest documentation of architectural limitations and unfinished functionality.

---

# 2. Product Scope

## 2.1 Target Customers

Independent cafés, restaurants, and small restaurant groups in Iran.

The system should accommodate:

- Single-location cafés.
- Small and medium-sized restaurants.
- Restaurants with multiple branches.
- Businesses with multiple employees sharing operational responsibilities.

## 2.2 Target Users

### Restaurant Manager

Responsibilities:

- Access the restaurant dashboard.
- Manage menu items.
- View and manage orders.
- Monitor table activity.
- Manage restaurant staff within authorized scope.
- Review AI-generated menu drafts.
- View operational information.

### Waiter

Responsibilities:

- View assigned branch tables.
- Create customer orders.
- Add items to existing orders.
- View order status.
- Mark completed items as served.

### Kitchen Staff

Responsibilities:

- View active kitchen orders.
- Start preparing ordered items.
- Mark items as ready.
- Track pending preparation work.

Access must be limited according to the user's role and restaurant membership.

## 2.3 MVP Functional Modules

### Module 1: Authentication and Authorization

Required features:

- Secure login.
- Authenticated sessions using JWT in HttpOnly cookies.
- Password hashing using a secure password hashing algorithm.
- Role-based authorization through NestJS Guards.
- Restaurant and branch membership verification.
- Secure logout.
- Proper authentication and authorization error responses.

Required roles:

- MANAGER
- WAITER
- KITCHEN

Do not implement an unnecessarily complicated permission management system.

### Module 2: Restaurant and Branch Context

Required features:

- Multi-tenant restaurant structure.
- Branch-aware data models.
- Restaurant membership.
- Branch access restrictions.
- Automatic tenant context resolution from authenticated identity.

The client must never be trusted to choose its own tenant identity.

The current MVP may expose only one active branch at a time while maintaining a domain model that supports multiple branches.

### Module 3: Table Management

Required features:

- View tables for the active branch.
- View table availability and active-order status.
- Select a table.
- Open an order for a table.
- Navigate to the current order.

Suggested table states:

- AVAILABLE
- OCCUPIED

Table availability should be derived from authoritative order state wherever practical rather than maintained through unsynchronized duplicate fields.

### Module 4: Menu Management

Required features:

- Menu categories.
- Menu items.
- Item descriptions.
- Item prices.
- Item availability.
- Menu item activation/deactivation.

Menu editing is restricted to managers.

Order items must store price snapshots so historical orders remain accurate after menu prices change.

### Module 5: Order Management

Required features:

- Create an order.
- Add items to an existing order.
- Update item quantities where permitted.
- View order details.
- Track item status.
- Complete and close an order.
- Preserve historical order data.
- Prevent invalid state transitions.
- Protect concurrent modifications.

Order operations must be transactional.

The system must never silently overwrite another user's changes.

### Module 6: Kitchen Workflow

Required features:

- Display active order items.
- Display order information and table numbers.
- Start preparing items.
- Mark items as ready.
- Support multiple kitchen users.
- Refresh order information without requiring a complete page reload.

For the MVP, short-interval polling is acceptable.

WebSockets are not mandatory because they introduce additional complexity and are not essential to demonstrate the required behavior.

### Module 7: AI-Assisted Menu Creation

Provide a focused AI capability that helps restaurant managers create structured menu entries from unstructured Persian-language descriptions.

Example input:

"چیزبرگر مخصوص با ۲۰۰ گرم گوشت، پنیر گودا و سیب‌زمینی، قیمت ۴۵۰ هزار تومان"

Expected AI output:

```json
{
  "name": "چیزبرگر مخصوص",
  "description": "۲۰۰ گرم گوشت، پنیر گودا و سیب‌زمینی",
  "priceToman": 450000,
  "category": "Burger"
}
```

Requirements:

- AI requests must run through the NestJS backend.
- Background AI processing must use BullMQ.
- AI-generated data must be validated using a strict schema.
- A human must review and approve generated menu information.
- Generated prices must never be committed automatically.
- AI failures must not interrupt ordering or kitchen operations.
- AI job status must be available to the frontend.
- Provider credentials must remain server-side.

AI is an assistant, not a source of authority over restaurant data.

---

# 3. Iran-Specific Requirements

The product must reflect the practical requirements of Iranian restaurants.

## 3.1 Language and Layout

- Persian-first user interface.
- Right-to-left layout.
- Appropriate Persian typography.
- Clear numeric presentation.
- Touch-friendly controls for tablets and phones.
- English technical identifiers internally where useful.

## 3.2 Currency

The user interface must support prices expressed in Iranian toman.

Monetary values must use integers rather than floating-point numbers.

Recommended policy:

- Store canonical monetary amounts as integer Iranian rials (IRR).
- Display values in toman where appropriate.
- Convert explicitly at input/output boundaries.
- Define a consistent rounding policy.
- Never mix rial and toman values without conversion.

Example:

450,000 toman = 4,500,000 rial.

## 3.3 Dates and Time

- Store timestamps in UTC.
- Display local time using the Asia/Tehran timezone.
- Support Persian date presentation where practical.
- Avoid storing formatted localized dates in the database.

## 3.4 Connectivity

The product should tolerate intermittent or unreliable connectivity.

For the MVP:

- Clearly communicate network failures.
- Do not report success until server confirmation.
- Support safe retries of submitted requests.
- Use idempotency keys to prevent duplicate actions.

Full offline operation and synchronization are outside MVP scope.

## 3.5 Local Market Research

Before implementation, document practical assumptions about:

- Common restaurant ordering workflows.
- Persian menu structures.
- Cashier and kitchen coordination.
- Typical table-management practices.
- Regional pricing conventions.
- Local deployment and service availability constraints.

Distinguish verified findings from assumptions.

Do not claim direct customer research unless it was actually conducted.

---

# 4. Technical Architecture

## 4.1 Required Technology Stack

| Category | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Backend | NestJS, TypeScript |
| Architecture | Clean Architecture |
| Application Structure | Modular Monolith |
| Database | PostgreSQL |
| ORM | Prisma |
| Background Jobs | BullMQ |
| Queue Infrastructure | Redis |
| Authentication | JWT + HttpOnly Cookies |
| Authorization | NestJS Guards + RBAC |
| Validation | class-validator, class-transformer |
| Unit Testing | Jest |
| API Integration Testing | Jest + Supertest |
| End-to-End Testing | Jest + Supertest |
| Package Management | pnpm |
| Monorepo | pnpm Workspaces |
| Code Formatting | Prettier |
| Static Analysis | ESLint |
| Git Hooks | Husky |
| Staged File Checks | lint-staged |
| Containers | Docker |
| Local Orchestration | Docker Compose |
| Continuous Integration | GitHub Actions |
| AI Integration | OpenAI API |
| Deployment | HTTPS-enabled hosting |

## 4.2 Architectural Style

The backend must use Clean Architecture within a Modular Monolith.

The system must not use microservices for the MVP.

The architecture should emphasize:

- Separation of business logic from infrastructure.
- Dependency inversion.
- Testable use cases.
- Thin controllers.
- Framework-independent domain rules.
- Replaceable infrastructure adapters.
- Explicit module boundaries.

Avoid unnecessary abstraction layers that do not provide meaningful value.

## 4.3 Clean Architecture Layers

### Domain Layer

Contains core business concepts and rules.

Examples:

- Order
- OrderItem
- MenuItem
- Restaurant
- Branch
- Money
- OrderStatus
- KitchenItemStatus

Responsibilities:

- Enforce business invariants.
- Validate permitted state transitions.
- Model order behavior.
- Define domain-specific errors.
- Represent core business concepts.

The domain layer must not depend on NestJS, Prisma, BullMQ, Redis, HTTP, or AI SDKs.

### Application Layer

Contains use cases and application orchestration.

Example use cases:

- CreateOrderUseCase
- AddOrderItemUseCase
- UpdateKitchenItemStatusUseCase
- CompleteOrderUseCase
- GetActiveOrdersUseCase
- RequestMenuDraftUseCase
- ApproveMenuDraftUseCase

Responsibilities:

- Coordinate domain operations.
- Enforce authorization policies.
- Work with repository interfaces.
- Define transaction boundaries.
- Apply idempotency policies.
- Manage application-specific errors.

### Infrastructure Layer

Contains implementation details.

Examples:

- PrismaOrderRepository
- PrismaMenuRepository
- PrismaUnitOfWork
- RedisQueueAdapter
- BullMqAiProcessor
- OpenAiMenuParserAdapter
- Authentication persistence
- Idempotency storage
- Structured logging

Infrastructure implementations must satisfy interfaces defined by the application or domain boundary.

### Presentation Layer

Contains HTTP entry points.

Examples:

- NestJS Controllers
- DTO classes
- Request validation
- Authentication Guards
- Role Guards
- Exception Filters
- Response serialization

Controllers must not contain complex business logic or direct database queries.

## 4.4 Dependency Rule

Dependencies must point inward:

```text
Presentation
     |
     v
Application
     |
     v
Domain

Infrastructure
     |
     +----> Application Ports
     |
     +----> Domain Types
```

The domain must never import an infrastructure package.

Use NestJS dependency injection to bind application interfaces to infrastructure implementations.

For example:

```typescript
export interface OrderRepository {
  findActiveOrder(
    tenantId: string,
    branchId: string,
    tableId: string,
  ): Promise<Order | null>;
}
```

Provide the concrete Prisma implementation through an injection token.

Avoid creating generic repository abstractions without a real domain requirement.

## 4.5 Transaction Management

Use PostgreSQL transactions for operations affecting multiple records or business invariants.

Transaction management must be exposed to application use cases through a clearly defined boundary.

Prisma transaction details should remain inside the infrastructure layer.

Business rules must not depend directly on Prisma transaction objects.

---

# 5. Multi-Tenancy and Data Isolation

## 5.1 Tenant Model

Each restaurant represents an independent tenant.

A restaurant may own multiple branches.

Users may belong to different restaurants through explicit membership records.

Suggested hierarchy:

```text
Restaurant (Tenant)
    |
    +-- Branch
    |    |
    |    +-- Tables
    |    +-- Orders
    |    +-- Kitchen Workflow
    |
    +-- Menu
    +-- Staff Memberships
    +-- Settings
```

## 5.2 Isolation Rules

- Every tenant-owned record must be explicitly associated with a tenant.
- Branch-owned records must additionally identify the branch.
- Tenant identity must originate from verified authentication context.
- User-supplied resource identifiers must always be checked for tenant ownership.
- Cross-tenant access must fail closed.
- Role checks must include relevant tenant and branch membership.
- Query filtering alone is insufficient unless consistently enforced across all access paths.

Where appropriate, use composite keys and database constraints to prevent cross-tenant relationships.

## 5.3 Security Tests

Required tests:

1. Restaurant A cannot read Restaurant B's orders.
2. Restaurant A cannot modify Restaurant B's menu.
3. Restaurant A cannot retrieve Restaurant B's order using a known ID.
4. Restaurant A cannot access another restaurant's AI job results.
5. A waiter cannot execute manager-only operations.
6. A branch-limited employee cannot access an unauthorized branch.

Authorization must occur server-side.

## 5.4 Defense in Depth

PostgreSQL Row-Level Security may be evaluated as a second isolation layer.

If not implemented within the time limit, application-enforced isolation must be tested thoroughly, and the remaining risk documented.

---

# 6. Concurrency and Data Consistency

## 6.1 Required Scenario

Two waiters may update the same order while kitchen staff changes the preparation state.

Example:

- Waiter A adds a drink.
- Waiter B adds a pizza.
- Kitchen staff marks a burger as preparing.

All valid operations must be preserved.

The system must not lose, overwrite, or silently corrupt changes.

## 6.2 Concurrency Strategy

Use PostgreSQL transactions and conditional updates.

Recommended approach:

- Append new order items through transactional operations.
- Serialize modifications that affect shared order invariants.
- Use row-level locking where required.
- Use version checks for conflicting state changes.
- Reject incompatible stale updates with HTTP 409.
- Return the current server state so clients can recover.

For critical order mutations, use a transaction and lock the parent order row when necessary.

For Prisma, PostgreSQL row locking may require parameterized SQL inside a transaction.

Do not implement read-modify-write operations that overwrite the entire order from a stale client snapshot.

## 6.3 Business Invariants

The system must enforce:

- Completed orders cannot accept new items.
- Invalid kitchen state transitions are rejected.
- Order items reference valid, tenant-owned menu items.
- Order item prices are captured at ordering time.
- Concurrent order creation cannot create duplicate active orders for the same table if the business rule requires only one.
- Stale updates must not silently succeed.
- Retried operations must not create duplicate order items.

Business invariants should be enforced using appropriate combinations of domain logic, transactions, and database constraints.

---

# 7. Idempotency Requirements

Idempotency is mandatory for critical API operations and background processing.

## 7.1 API Idempotency

Use the HTTP header:

```http
Idempotency-Key: <unique-request-identifier>
```

Required for selected operations such as:

- Order creation.
- Adding items to an order.
- Closing an order.
- AI draft creation.

## 7.2 Expected Behavior

First request:

- Validate the request.
- Claim the idempotency key atomically.
- Execute the operation.
- Store the result.
- Return the response.

Duplicate completed request:

- Return the previously stored result without repeating the operation.

Same key with different payload:

- Return a validation/conflict error.

Concurrent request using an in-progress key:

- Prevent duplicate execution.
- Return a controlled conflict response or wait according to a documented policy.

## 7.3 Persistence

Create a dedicated idempotency record containing:

- Tenant identifier.
- Actor or client scope.
- Operation identifier.
- Idempotency key.
- Request fingerprint.
- Processing status.
- Stored response or result reference.
- Creation timestamp.
- Expiration timestamp.

Use a unique database constraint covering the defined scope.

For database-only operations, commit the business mutation and final idempotency result atomically.

## 7.4 Failure Recovery

The design must address:

- Network interruption after successful commit.
- Duplicate requests during processing.
- Concurrent requests with the same key.
- Server restart.
- Retry after timeout.
- Expiration and cleanup of idempotency records.

Recovery must not reapply committed business mutations.

---

# 8. BullMQ and Background Processing

## 8.1 Queue Architecture

Use BullMQ with Redis.

NestJS must manage queue integration through dedicated modules and processors.

Recommended queue:

```text
ai-menu-processing
```

Suggested operations:

- Generate structured menu drafts.
- Process asynchronous AI parsing requests.
- Retry temporary provider failures.

Do not route critical order persistence through Redis or BullMQ.

The ordering workflow must continue functioning if Redis or the AI provider becomes unavailable.

## 8.2 Worker Design

Use an independently runnable NestJS worker process.

The API and worker may share application code, domain models, and infrastructure modules.

Worker responsibilities:

1. Receive a job.
2. Validate the job's identity and scope.
3. Check persisted processing state.
4. Execute the AI operation.
5. Validate AI output.
6. Persist the result idempotently.
7. Update job status.
8. Log processing metadata.

## 8.3 Retry Strategy

BullMQ jobs should use:

- Bounded retry attempts.
- Exponential backoff.
- Stable job identifiers.
- Defined timeouts.
- Failure-state persistence.
- Clear distinction between retryable and permanent failures.

Example:

```typescript
await queue.add(
  'generate-menu-draft',
  {
    tenantId,
    importId,
  },
  {
    jobId: `menu-${tenantId}-${importId}`,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
);
```

## 8.4 Worker Idempotency

BullMQ job IDs do not provide end-to-end exactly-once processing.

Workers must be designed for at-least-once execution.

Reprocessing a completed job must not:

- Create duplicate menu items.
- Apply the same result twice.
- Corrupt existing data.
- Cross tenant boundaries.

Use persisted processing states, uniqueness constraints, and transactional result application.

## 8.5 Queue Reliability

The design must consider the failure window between storing a job request in PostgreSQL and adding the job to Redis.

Preferred solution:

- Transactional Outbox with a reliable dispatcher.

A simpler recoverable enqueue mechanism may be used if necessary within the time limit, provided its failure behavior and limitations are documented.

Do not claim guaranteed delivery without implementing and testing the required mechanism.

---

# 9. AI Architecture

## 9.1 AI Use Case

Implement structured menu generation from Persian-language input.

The feature must have a clear business purpose: reducing the effort required to enter menu data.

## 9.2 AI Processing Flow

```text
Manager
   |
   v
Submit Persian Description
   |
   v
NestJS API
   |
   v
Persist AI Draft Request
   |
   v
BullMQ Queue
   |
   v
NestJS Worker
   |
   v
AI Provider
   |
   v
Validate Structured Output
   |
   v
Persist Draft
   |
   v
Manager Reviews and Approves
   |
   v
Menu Item Created
```

## 9.3 Required Safeguards

- Strict output validation.
- Maximum input length.
- Provider request timeout.
- Bounded retry policy.
- Rate limiting.
- Cost-conscious token limits.
- Structured logging of failures.
- No automatic menu publication.
- Explicit approval before persistence as an active menu item.
- Rejection of unsupported or invalid prices.
- Tenant-scoped AI requests and results.

## 9.4 Prompt Injection

Treat restaurant descriptions as untrusted data.

Do not permit text submitted by users to override system instructions or trigger privileged operations.

Use structured outputs, validation, least-privilege tools, and deterministic application checks.

The AI model must never control authorization decisions.

## 9.5 Provider Failure

When the AI provider fails:

- Existing ordering and kitchen functionality must remain available.
- The UI must show a clear failure or pending status.
- The job must retry only when appropriate.
- Users must be able to enter menu data manually.

---

# 10. API Design

Use versioned REST endpoints.

Suggested base path:

```text
/api/v1
```

## 10.1 Authentication

```text
POST /auth/login
POST /auth/logout
GET  /auth/me
```

## 10.2 Tables

```text
GET /tables
GET /tables/:id
```

## 10.3 Menu

```text
GET   /menu/items
POST  /menu/items
PATCH /menu/items/:id
```

## 10.4 Orders

```text
GET   /orders
GET   /orders/:id
POST  /orders
POST  /orders/:id/items
PATCH /orders/:id/items/:itemId
POST  /orders/:id/complete
```

## 10.5 Kitchen

```text
GET   /kitchen/orders
PATCH /kitchen/items/:id/status
```

## 10.6 AI

```text
POST /ai/menu-drafts
GET  /ai/menu-drafts/:id
POST /ai/menu-drafts/:id/approve
```

## 10.7 API Standards

- Validate all incoming data through DTOs.
- Use a global ValidationPipe.
- Reject unknown fields where appropriate.
- Return consistent error responses.
- Use appropriate HTTP status codes.
- Never expose internal stack traces.
- Ensure resource IDs cannot bypass authorization.
- Use structured request IDs for troubleshooting.
- Do not rely on frontend validation for security.

Suggested error response:

```json
{
  "error": {
    "code": "ORDER_VERSION_CONFLICT",
    "message": "The order has changed. Refresh and retry.",
    "requestId": "req-example-123"
  }
}
```

---

# 11. Database Design

## 11.1 Core Entities

Recommended tables:

```text
restaurants
branches
users
restaurant_memberships
branch_memberships
restaurant_tables
menu_categories
menu_items
orders
order_items
order_events
idempotency_records
ai_menu_drafts
outbox_events
```

The outbox table is required only if the outbox reliability pattern is implemented.

## 11.2 Important Relationships

- One restaurant has many branches.
- One restaurant has many memberships.
- One branch has many tables.
- One table has many historical orders.
- One order has many order items.
- One menu item may appear in many orders.
- One order has many audit events.
- AI draft requests belong to specific restaurants.

## 11.3 Database Requirements

- UUID or similarly collision-resistant identifiers.
- Foreign key constraints.
- Appropriate unique constraints.
- Tenant-aware indexes.
- Explicit transaction handling.
- Prisma migrations.
- Idempotent seed scripts.
- Consistent monetary storage.
- UTC timestamps.
- Schema-level protection of critical invariants.

Avoid storing the entire order as one mutable JSON object.

## 11.4 Data Access

Repositories must enforce appropriate tenant scope.

Do not scatter raw Prisma calls across controllers and unrelated services.

Repository interfaces must express meaningful domain operations.

---

# 12. Frontend Requirements

## 12.1 Framework

Use:

- Next.js
- React
- TypeScript
- Tailwind CSS

## 12.2 User Experience

Requirements:

- Persian RTL interface.
- Responsive layout.
- Tablet and mobile usability.
- Clear loading and error states.
- Fast order entry.
- Visible order statuses.
- Immediate feedback after mutations.
- Safe recovery after network failures.

## 12.3 Primary Screens

### Login

- Demo role credentials.
- Secure authentication.
- Appropriate error handling.

### Restaurant Dashboard

- Active tables.
- Active orders.
- Navigation based on role.

### Table Order Screen

- Table information.
- Existing order items.
- Menu browser.
- Add item action.
- Item quantity management.
- Order status.

### Kitchen Screen

- Pending items.
- Preparing items.
- Ready items.
- Status transition actions.

### Manager Menu Screen

- Menu item listing.
- Create/edit menu item.
- AI-assisted menu draft action.
- Review and approve AI output.

## 12.4 Concurrency UX

When a conflict occurs:

- Do not silently overwrite local or server data.
- Show a comprehensible conflict message.
- Refresh authoritative server state.
- Allow users to retry safely.
- Preserve unsaved user input when practical.

---

# 13. Code Quality and Developer Tooling

## 13.1 pnpm Workspaces

Use pnpm as the package manager.

The repository must include:

```text
pnpm-workspace.yaml
pnpm-lock.yaml
```

All dependencies must be managed consistently.

## 13.2 ESLint

ESLint must enforce:

- TypeScript code quality.
- Basic safety rules.
- Unused variable handling.
- Consistent import conventions.
- Reasonable application-specific best practices.

## 13.3 Prettier

Prettier must provide consistent formatting across:

- TypeScript
- TSX
- JSON
- Markdown
- YAML
- CSS

## 13.4 Husky

Use Husky for Git hooks.

At minimum, configure:

```text
pre-commit
```

## 13.5 lint-staged

Run ESLint and Prettier on staged files.

Example configuration:

```json
{
  "*.{ts,tsx}": [
    "eslint --fix",
    "prettier --write"
  ],
  "*.{json,md,yaml,yml,css}": [
    "prettier --write"
  ]
}
```

## 13.6 Required Scripts

Provide consistent root-level scripts:

```json
{
  "scripts": {
    "dev": "pnpm --recursive --parallel dev",
    "build": "pnpm --recursive build",
    "lint": "pnpm --recursive lint",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "pnpm --recursive typecheck",
    "test": "pnpm --recursive test",
    "test:e2e": "pnpm --filter api test:e2e"
  }
}
```

Scripts must be adjusted to the actual workspace packages and verified before delivery.

---

# 14. Testing Strategy

## 14.1 Testing Stack

Required:

- Jest
- Supertest
- PostgreSQL-backed integration tests
- Redis-backed queue tests where necessary

## 14.2 Domain Unit Tests

Test critical business rules:

- Order state transitions.
- Invalid quantity handling.
- Money calculations.
- Permission-sensitive business rules.

## 14.3 API Integration Tests

Required scenarios:

1. Successful authentication.
2. Unauthorized access rejection.
3. Cross-tenant order access rejection.
4. Cross-tenant mutation rejection.
5. Duplicate order request prevention.
6. Same idempotency key with modified payload.
7. Concurrent order item additions.
8. Invalid order state transition.
9. Role-based authorization.

## 14.4 Queue Tests

Test:

- Successful AI job processing.
- Duplicate job execution.
- Retry after transient failure.
- Permanent failure behavior.
- Correct tenant ownership of results.

## 14.5 End-to-End Workflow

At least one automated test must cover:

1. Authenticate as waiter.
2. Create an order for a table.
3. Add a menu item.
4. Authenticate as kitchen staff.
5. View the new item.
6. Change preparation status.
7. Confirm persisted order state.

Use real database behavior where correctness depends on transactions and constraints.

## 14.6 Testing Trade-Offs

Document which tests were intentionally omitted.

Priority must be given to high-risk behaviors rather than superficial coverage percentages.

---

# 15. Docker and Local Development

## 15.1 Docker Compose Services

The local environment must include:

- PostgreSQL
- Redis
- NestJS API
- NestJS Worker
- Next.js Frontend

## 15.2 One-Command Startup

The target local startup command is:

```bash
docker compose up --build
```

This must start the required services with documented environment setup.

## 15.3 Initialization

The development environment must support:

- Database health checks.
- Database migrations.
- Idempotent seed execution.
- Dependency health checks.
- Predictable startup behavior.
- Persistent PostgreSQL storage.
- Controlled service shutdown.

## 15.4 Environment Configuration

Provide:

```text
.env.example
```

The example file must contain placeholder values only.

Never commit real:

- API keys.
- Database credentials.
- JWT signing secrets.
- Production Redis credentials.

---

# 16. GitHub Actions CI/CD

## 16.1 CI Triggers

Run CI on:

- Pull requests.
- Pushes to the main branch.

## 16.2 Required Pipeline

```text
Checkout Repository
        |
        v
Setup pnpm + Node.js
        |
        v
Install Dependencies
        |
        v
Prettier Check
        |
        v
ESLint
        |
        v
TypeScript Typecheck
        |
        v
Unit Tests
        |
        v
Integration Tests
        |
        v
E2E API Tests
        |
        v
Production Build
```

## 16.3 CI Infrastructure

Use PostgreSQL and Redis service containers for integration tests.

Ensure test isolation and predictable database initialization.

## 16.4 Pipeline Failure Conditions

CI must fail when:

- Code formatting is invalid.
- ESLint fails.
- TypeScript compilation fails.
- Required tests fail.
- Production build fails.

Do not mark failing critical checks as optional.

## 16.5 Deployment

Deployment automation is optional for the MVP.

A successful manual deployment is acceptable, provided the product is available over HTTPS and the deployment procedure is documented.

---

# 17. Security Requirements

Security is a core requirement.

## 17.1 Risk 1: Cross-Tenant Data Exposure

Mitigations:

- Verified tenant context.
- Scoped repositories.
- Tenant-aware authorization.
- Database constraints.
- Explicit cross-tenant tests.

## 17.2 Risk 2: Unauthorized Actions

Mitigations:

- Secure authentication.
- NestJS Guards.
- Role-based permission checks.
- Branch-level access checks.
- Server-side enforcement.

## 17.3 Risk 3: Concurrent Mutation and Duplicate Processing

Mitigations:

- Database transactions.
- Conditional updates.
- Idempotency keys.
- Unique constraints.
- Safe queue retries.
- Integration tests.

## 17.4 Additional Controls

- Rate limiting for authentication and AI endpoints.
- Password hashing.
- Secure cookies.
- CSRF protection appropriate to cookie-based authentication.
- HTTPS.
- Secure CORS configuration.
- Request validation.
- Sanitized error responses.
- No secrets in source control.
- Least-privilege access.
- No unnecessary logging of sensitive information.

Do not claim a security guarantee that has not been implemented or tested.

---

# 18. Logging and Observability

## 18.1 Structured Logging

Use structured JSON logging.

Required fields where relevant:

- Timestamp.
- Log level.
- Request ID.
- Tenant ID.
- User ID.
- Module or operation.
- Error code.
- Duration.
- Job ID.

## 18.2 Logging Requirements

Log important operational events, including:

- Authentication failures.
- Authorization failures.
- Failed order mutations.
- Database conflicts.
- AI provider failures.
- Queue retries.
- Worker errors.

Do not log authentication tokens, passwords, secrets, or unnecessary customer data.

## 18.3 Health Checks

Provide:

```text
GET /health
```

Health checks must expose useful operational status without revealing credentials or internal secrets.

Define whether the endpoint reports application liveness or dependency readiness.

---

# 19. Realistic Demo Environment

The deployed application must be usable immediately after opening.

## 19.1 Seed Data

Create believable sample data representing a restaurant operating in Tehran.

Example restaurant:

**Café Narenj**

Suggested data:

- A realistic Persian menu.
- Multiple menu categories.
- Tables with believable numbers.
- Active orders.
- Completed historical orders.
- Staff accounts.
- Kitchen preparation states.
- Realistic toman prices.

Create a second tenant for isolation testing.

Optionally include a second branch to demonstrate the branch-aware model.

## 19.2 Demo Accounts

Provide credentials for:

- Manager.
- Waiter.
- Kitchen Staff.

Demo credentials must be isolated from production secrets and use non-sensitive test data.

## 19.3 Demo Requirements

The reviewer must be able to:

1. Log in.
2. View active tables.
3. Open an order.
4. Add a menu item.
5. Switch to a kitchen account.
6. Update the item status.
7. Observe the updated order.
8. Test the AI menu draft workflow.

The demo must not be an empty shell.

---

# 20. Deliverables

## Deliverable A: SCOPE.md

Must be written before implementation.

Include:

- Problem statement.
- Target users.
- Research findings and assumptions.
- Selected workflow.
- In-scope features.
- Out-of-scope features.
- Business requirements.
- Acceptance criteria.
- Technical risks.
- Time constraints.

The document must describe the originally agreed scope rather than retroactively describing the final implementation.

## Deliverable B: Working Product

A deployed, functional SaaS MVP with:

- Authentication.
- Role-based access.
- Tenant isolation.
- Table management.
- Order management.
- Kitchen workflow.
- Concurrency protection.
- Idempotency.
- One AI capability.
- Realistic demo data.

## Deliverable C: Engineering Repository

Include:

- Source code.
- Prisma schema.
- Database migrations.
- Seed scripts.
- Docker configuration.
- Automated tests.
- Environment example.
- GitHub Actions workflow.
- README.

## Deliverable D: DECISIONS.md

Each decision must include:

1. Decision.
2. Reason.
3. Alternative considered.
4. Accepted trade-off.

Include at least two decisions that should be reconsidered or may have been mistakes.

Candidate topics:

- Separate NestJS backend versus a unified web application.
- Redis/BullMQ versus synchronous processing.
- Polling versus WebSockets.
- Application-level tenant isolation versus PostgreSQL RLS.
- Complexity introduced by Clean Architecture under a strict time limit.

Do not claim a choice was wrong unless there is an actual reason to reconsider it.

## Deliverable E: AI_USAGE.md

Document:

- AI tools used.
- Tasks performed with each tool.
- Where AI saved time.
- Where AI generated incorrect code.
- At least one rejected AI recommendation.
- How AI-generated code was verified.
- Human-owned architecture decisions.
- Testing performed on generated implementations.

## Deliverable F: HANDOVER.md

Write for a nontechnical restaurant owner.

Include:

- What was delivered.
- How staff should operate the system.
- How to start using it.
- Known limitations.
- Next five features, prioritized.
- Expected limitations at 10 restaurants.
- Expected limitations at 1,000 restaurants.
- Expected limitations at 100,000 restaurants.

Scaling assessments must be based on the actual architecture and its likely bottlenecks.

## Deliverable G: Recorded Walkthrough

Provide a 5–10 minute video.

At least half the recording must explain:

- Why this workflow was selected.
- What was intentionally excluded.
- Why the architecture was chosen.
- How concurrency and tenant isolation were handled.
- Which compromises were made.
- What should be improved next.

---

# 21. Repository Structure

Recommended pnpm monorepo:

```text
restaurant-os/
│
├── apps/
│   ├── web/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   └── lib/
│   │
│   ├── api/
│   │   └── src/
│   │       ├── modules/
│   │       │   ├── auth/
│   │       │   ├── tenants/
│   │       │   ├── branches/
│   │       │   ├── staff/
│   │       │   ├── tables/
│   │       │   ├── menu/
│   │       │   ├── orders/
│   │       │   ├── kitchen/
│   │       │   └── ai/
│   │       │
│   │       ├── common/
│   │       │   ├── guards/
│   │       │   ├── decorators/
│   │       │   ├── filters/
│   │       │   └── interceptors/
│   │       │
│   │       └── main.ts
│   │
│   └── worker/
│       └── src/
│           ├── processors/
│           └── main.ts
│
├── packages/
│   ├── database/
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       ├── migrations/
│   │       └── seed.ts
│   │
│   ├── shared/
│   └── eslint-config/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── .husky/
│   └── pre-commit
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
├── .env.example
├── .prettierrc
├── .lintstagedrc.json
│
├── README.md
├── SCOPE.md
├── DECISIONS.md
├── AI_USAGE.md
└── HANDOVER.md
```

## 21.1 Clean Architecture Module Example

The Orders module should follow:

```text
orders/
├── domain/
│   ├── entities/
│   │   ├── order.entity.ts
│   │   └── order-item.entity.ts
│   ├── value-objects/
│   │   └── money.vo.ts
│   ├── enums/
│   └── errors/
│
├── application/
│   ├── use-cases/
│   │   ├── create-order.use-case.ts
│   │   ├── add-order-item.use-case.ts
│   │   └── complete-order.use-case.ts
│   ├── ports/
│   │   └── order-repository.port.ts
│   └── dto/
│
├── infrastructure/
│   ├── repositories/
│   │   └── prisma-order.repository.ts
│   └── persistence/
│
├── presentation/
│   └── http/
│       ├── orders.controller.ts
│       └── dto/
│
└── orders.module.ts
```

This organization should be applied pragmatically.

Small modules may use a simpler structure if full layering would only introduce unnecessary files and abstractions.

---

# 22. Explicit Out-of-Scope Features

The following are not required for the initial MVP:

- Payment gateway integration.
- Bank transaction reconciliation.
- Full accounting.
- Inventory management.
- Supplier management.
- Employee payroll.
- Customer loyalty programs.
- Reservation systems.
- Delivery platform integrations.
- Complex discount engines.
- Advanced analytics.
- Native mobile applications.
- Full offline synchronization.
- Microservices.
- Kubernetes.
- Event sourcing.
- Advanced real-time messaging.
- Complex AI agents.
- Dynamic permission builders.

These features may be discussed in future roadmap documents but must not reduce the reliability of the core workflow.

---

# 23. Time Allocation

The implementation must respect the six-hour maximum.

Recommended allocation:

| Activity | Time |
|---|---:|
| Product research and SCOPE.md | 35 minutes |
| Database design and architecture | 35 minutes |
| NestJS authentication and tenant isolation | 45 minutes |
| Order and kitchen workflow | 70 minutes |
| Next.js screens and realistic seed data | 55 minutes |
| BullMQ and AI integration | 35 minutes |
| Idempotency and critical tests | 35 minutes |
| Deployment, documentation, and recording | 50 minutes |
| **Total** | **360 minutes** |

This is an aggressive target, not a guarantee of completion.

Prioritize a working core workflow, tenant security, concurrency safety, and clear documentation.

Code generation tools and reusable project scaffolding may be used to reduce setup time.

If the time budget cannot accommodate a feature, reduce scope rather than shipping incomplete or misleading functionality.

Track actual time spent and disclose any overrun.

---

# 24. Acceptance Criteria

The project will be considered functionally successful only when the following conditions are met.

## Functional Acceptance

- A waiter can create an order.
- A waiter can add items to an order.
- Kitchen staff can view the relevant order.
- Kitchen staff can update preparation status.
- Users see changes after refresh or polling.
- Historical orders preserve their original item prices.
- Demo data is present and usable.

## Correctness Acceptance

- Two concurrent valid additions do not silently overwrite each other.
- Duplicate requests do not create duplicate orders or order items.
- Invalid state transitions are rejected.
- Order modifications preserve transaction consistency.
- Background job re-execution does not duplicate persisted results.

## Security Acceptance

- Cross-tenant access is rejected.
- Branch restrictions are enforced.
- Role restrictions are enforced.
- Client-provided tenant IDs cannot override authenticated context.
- Secrets are not committed to the repository.
- Protected APIs do not expose sensitive data to unauthorized users.

## AI Acceptance

- The AI capability provides a relevant business benefit.
- AI outputs are validated.
- Human approval is required.
- AI failure does not disable restaurant operations.
- Job retries are bounded.
- Duplicate execution does not duplicate menu records.

## Engineering Acceptance

- Clean Architecture boundaries are reasonably maintained.
- NestJS modules have clear responsibilities.
- Prisma migrations run successfully.
- Seed execution is reproducible.
- Docker Compose starts the system.
- ESLint and Prettier checks pass.
- Husky and lint-staged are configured.
- Jest and Supertest tests pass.
- GitHub Actions CI passes.
- The deployed service is accessible over HTTPS.

## Delivery Acceptance

- Repository URL provided.
- Live URL provided.
- Demo credentials provided.
- README completed.
- SCOPE.md completed.
- DECISIONS.md completed.
- AI_USAGE.md completed.
- HANDOVER.md completed.
- Recorded walkthrough provided.

---

# 25. Engineering Priorities and Trade-Offs

When time is limited, prioritize work in the following order.

**Priority 1: Data Integrity**

Order mutations must be correct, atomic, and safe under concurrency.

**Priority 2: Tenant Security**

No restaurant may access another restaurant's data.

**Priority 3: Usable Core Workflow**

A restaurant must be able to complete a meaningful operational workflow.

**Priority 4: Reproducibility**

The system must be easy to run, test, and inspect.

**Priority 5: AI and Background Jobs**

Implement a small, practical AI capability with reliable asynchronous processing.

**Priority 6: Visual Polish**

Improve visual presentation after essential functionality and correctness are established.

No architectural or tooling requirement should justify leaving the central ordering workflow incomplete.

---

# 26. Final Implementation Instructions

The engineering implementation must follow these rules:

1. Read and understand the RFP before implementation.
2. Produce SCOPE.md before writing production code.
3. Define and document the selected workflow.
4. Establish the database schema and business invariants.
5. Implement the NestJS backend using Clean Architecture principles.
6. Keep domain logic independent of NestJS, Prisma, BullMQ, and external APIs.
7. Enforce tenant isolation and authorization in the backend.
8. Implement idempotency for selected critical operations.
9. Handle concurrency through PostgreSQL transactions and appropriate locking or conditional updates.
10. Use BullMQ for a meaningful asynchronous AI workflow.
11. Make background job processing idempotent.
12. Use pnpm Workspaces for dependency and repository management.
13. Configure ESLint, Prettier, Husky, and lint-staged.
14. Write meaningful automated tests using Jest and Supertest.
15. Configure Docker Compose and GitHub Actions.
16. Prepare realistic, Persian-language demo data.
17. Deploy the working application over HTTPS.
18. Document decisions, trade-offs, limitations, and AI usage.
19. Record a walkthrough explaining both product and architectural decisions.
20. Deliver within the time limit, with transparent reporting of anything incomplete.

**The primary success criterion is not the number of implemented features or installed technologies. It is the reliability, security, usability, and defensibility of the delivered product.**

---

# 27. Final Definition of Done

The project is complete when a reviewer can:

1. Clone the repository.
2. Start the application using the documented setup.
3. Log in using supplied demo credentials.
4. Create and modify a restaurant order.
5. Observe that order through the kitchen workflow.
6. Verify that concurrent modifications do not silently lose data.
7. Verify idempotent request processing.
8. Verify isolation between restaurants.
9. Use the AI-assisted menu creation capability.
10. Review passing tests and CI configuration.
11. Understand architectural decisions and limitations from the documentation.
12. Access the deployed application over HTTPS.

All incomplete or unverified requirements must be explicitly documented rather than described as finished.

**End of RFP — RestaurantOS MVP**
