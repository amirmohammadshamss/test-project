import { recordNotificationEvent } from '../../../../../../packages/notifications/src/persistence';
import { Prisma, PrismaClient } from '@prisma/client';
import type { PlatformPrincipal } from '../../../../../../packages/shared/src/contracts';
import { hashPassword } from '../../../../../../packages/database/src/password';
import {
  PlatformRepository,
  PlatformQuery,
  ProvisionRestaurant,
  LifecycleChange,
} from '../application/platform';
import { BusinessError, assertVersion } from '../../orders/domain/rules';
import { fingerprint } from '../../orders/infrastructure/prisma-uow';
import { audit } from '../../../common/infrastructure/audit';
const metadata = {
  id: true,
  name: true,
  status: true,
  version: true,
  provisioningKey: true,
  primaryContact: true,
  contactEmail: true,
  phone: true,
  address: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { branches: true } },
} as const;
export class PrismaPlatformRepository extends PlatformRepository {
  constructor(private readonly db: PrismaClient) {
    super();
  }
  private async once<T>(
    a: PlatformPrincipal,
    operation: string,
    key: string,
    payload: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (!/^[a-zA-Z0-9_-]{8,128}$/.test(key))
      throw new BusinessError('IDEMPOTENCY_KEY_REQUIRED', 400);
    const scope = { principalId: a.adminId, operation, key };
    const hash = fingerprint(payload);
    return this.db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(scope)},0))`;
        const previous = await tx.platformIdempotencyRecord.findUnique({
          where: { principalId_operation_key: scope },
        });
        if (previous && previous.expiresAt > new Date()) {
          if (previous.fingerprint !== hash)
            throw new BusinessError('IDEMPOTENCY_PAYLOAD_CONFLICT');
          return previous.response as T;
        }
        if (previous)
          await tx.platformIdempotencyRecord.delete({
            where: { id: previous.id },
          });
        const result = await work(tx);
        const response = JSON.parse(
          JSON.stringify(result),
        ) as Prisma.InputJsonValue;
        await tx.platformIdempotencyRecord.create({
          data: {
            ...scope,
            fingerprint: hash,
            response,
            expiresAt: new Date(Date.now() + 7 * 86400000),
          },
        });
        return response as T;
      },
      { maxWait: 5000, timeout: 15000 },
    );
  }
  async dashboard(q: PlatformQuery) {
    const from = q.from ? new Date(q.from) : new Date(Date.now() - 86400000);
    const to = q.to ? new Date(q.to) : new Date();
    if (from >= to || to.getTime() - from.getTime() > 366 * 86400000)
      throw new BusinessError('INVALID_DATE_RANGE', 400);
    const [
      restaurants,
      active,
      suspended,
      branches,
      staff,
      orders,
      aiPending,
      aiFailed,
    ] = await this.db.$transaction([
      this.db.restaurant.count(),
      this.db.restaurant.count({ where: { status: 'ACTIVE' } }),
      this.db.restaurant.count({ where: { status: 'SUSPENDED' } }),
      this.db.branch.count(),
      this.db.user.count({ where: { memberships: { some: {} } } }),
      this.db.order.count({ where: { createdAt: { gte: from, lte: to } } }),
      this.db.aiDraft.count({
        where: { status: { in: ['PENDING', 'PROCESSING'] } },
      }),
      this.db.aiDraft.count({ where: { status: 'FAILED' } }),
    ]);
    return {
      restaurants,
      active,
      suspended,
      branches,
      staff,
      orders,
      period: { from, to },
      aiPending,
      aiFailed,
      checkedAt: new Date(),
    };
  }
  async restaurants(q: PlatformQuery) {
    const where: Prisma.RestaurantWhereInput = {
      ...(q.status ? { status: q.status as 'ACTIVE' | 'SUSPENDED' } : {}),
      ...(q.q
        ? {
            OR: [
              { name: { contains: q.q, mode: 'insensitive' } },
              { provisioningKey: { contains: q.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.restaurant.findMany({
        where,
        select: metadata,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.restaurant.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      pages: Math.ceil(total / q.pageSize),
    };
  }
  async restaurant(id: string) {
    const value = await this.db.restaurant.findUnique({
      where: { id },
      select: metadata,
    });
    if (!value) throw new BusinessError('NOT_FOUND', 404);
    return value;
  }
  async branches(id: string) {
    await this.restaurant(id);
    return this.db.branch.findMany({
      where: { tenantId: id },
      select: {
        id: true,
        name: true,
        tenantId: true,
        active: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });
  }
  async create(a: PlatformPrincipal, x: ProvisionRestaurant, key: string) {
    const normalized = {
      name: x.name.trim(),
      provisioningKey: x.provisioningKey.toLowerCase(),
      primaryContact: x.primaryContact.trim(),
      contactEmail: x.contactEmail.toLowerCase(),
      phone: x.phone,
      branchName: x.branchName.trim(),
      managerName: x.managerName.trim(),
      managerEmail: x.managerEmail.toLowerCase(),
      managerPassword: x.managerPassword,
    };
    const passwordHash = await hashPassword(normalized.managerPassword);
    return this.once(a, 'tenant.create', key, normalized, async (tx) => {
      if (
        await tx.restaurant.findUnique({
          where: { provisioningKey: normalized.provisioningKey },
        })
      )
        throw new BusinessError('TENANT_REFERENCE_EXISTS');
      if (
        await tx.user.findUnique({ where: { email: normalized.managerEmail } })
      )
        throw new BusinessError('MANAGER_EMAIL_EXISTS');
      const tenant = await tx.restaurant.create({
        data: {
          name: normalized.name,
          provisioningKey: normalized.provisioningKey,
          primaryContact: normalized.primaryContact,
          contactEmail: normalized.contactEmail,
          phone: normalized.phone,
        },
        select: metadata,
      });
      const branch = await tx.branch.create({
        data: { tenantId: tenant.id, name: normalized.branchName },
      });
      const user = await tx.user.create({
        data: {
          email: normalized.managerEmail,
          name: normalized.managerName,
          passwordHash,
        },
      });
      const membership = await tx.membership.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'MANAGER' },
      });
      await tx.branchMembership.create({
        data: {
          tenantId: tenant.id,
          membershipId: membership.id,
          branchId: branch.id,
        },
      });
      for (const name of ['برگر', 'پیتزا', 'نوشیدنی', 'پیش‌غذا', 'دسر'])
        await tx.category.create({ data: { tenantId: tenant.id, name } });
      await tx.tenantLifecycleEvent.create({
        data: {
          tenantId: tenant.id,
          actorId: a.userId,
          toStatus: 'ACTIVE',
          reason: 'Provisioned',
        },
      });
      await audit(tx, a, 'TENANT_CREATED', 'restaurant', tenant.id, tenant.id);
      return {
        ...tenant,
        initialBranch: { id: branch.id, name: branch.name },
        initialManager: { id: user.id, email: user.email, name: user.name },
      };
    });
  }
  lifecycle(
    a: PlatformPrincipal,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    x: LifecycleChange,
    key: string,
  ) {
    return this.once(
      a,
      `tenant.${status}.${id}`,
      key,
      { version: x.version, reason: x.reason },
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Restaurant" WHERE id=${id}::uuid FOR UPDATE`;
        const old = await tx.restaurant.findUnique({ where: { id } });
        if (!old) throw new BusinessError('NOT_FOUND', 404);
        if (old.status === status)
          return tx.restaurant.findUnique({ where: { id }, select: metadata });
        assertVersion(old.version, x.version);
        if (status === 'SUSPENDED' && !x.reason.trim())
          throw new BusinessError('REASON_REQUIRED', 400);
        const updated = await tx.restaurant.update({
          where: { id },
          data: { status, version: { increment: 1 } },
          select: metadata,
        });
        await tx.tenantLifecycleEvent.create({
          data: {
            tenantId: id,
            actorId: a.userId,
            fromStatus: old.status,
            toStatus: status,
            reason: x.reason,
          },
        });
        if (status === 'SUSPENDED')
          await recordNotificationEvent(tx, {
            dedupeKey: `tenant:${id}:v${updated.version}:suspended`,
            realm: 'RESTAURANT',
            type: 'TENANT_SUSPENDED',
            tenantId: id,
            entityId: id,
            payload: { version: updated.version },
          });
        await audit(
          tx,
          a,
          status === 'SUSPENDED' ? 'TENANT_SUSPENDED' : 'TENANT_ACTIVATED',
          'restaurant',
          id,
          id,
          x.reason,
        );
        return updated;
      },
    );
  }
  async audits(q: PlatformQuery) {
    const where: Prisma.AdminAuditLogWhereInput = {
      ...(q.actorId ? { actorId: q.actorId } : {}),
      ...(q.outcome ? { outcome: q.outcome } : {}),
      ...(q.resourceType ? { resourceType: q.resourceType } : {}),
      ...(q.tenantId ? { tenantId: q.tenantId } : {}),
      ...(q.action ? { action: q.action } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.adminAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.adminAuditLog.count({ where }),
    ]);
    return {
      items,
      total,
      page: q.page,
      pageSize: q.pageSize,
      pages: Math.ceil(total / q.pageSize),
    };
  }
}
