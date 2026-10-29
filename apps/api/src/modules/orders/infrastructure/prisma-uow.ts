import { createHash } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import type {
  Actor,
  OrderView,
} from '../../../../../../packages/shared/src/contracts';
import {
  OrderTransaction,
  OrderUnitOfWork,
  RequestIdentity,
} from '../application/ports';
import { BusinessError } from '../domain/rules';
export function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}
export async function idempotent<T>(
  db: PrismaClient,
  actor: Actor,
  request: RequestIdentity,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(request.key))
    throw new BusinessError('IDEMPOTENCY_KEY_REQUIRED', 400);
  const scope = {
    tenantId: actor.tenantId,
    actorId: actor.userId,
    operation: `${request.operation}@${actor.branchId}`,
    key: request.key,
  };
  return db.$transaction(
    async (tx) => {
      // Transaction-scoped lock serializes the absent-key case as well as completed replays.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${JSON.stringify(scope)}, 0))`;
      const prior = await tx.idempotencyRecord.findUnique({
        where: { tenantId_actorId_operation_key: scope },
      });
      const hash = fingerprint(request.payload);
      if (prior && prior.expiresAt > new Date()) {
        if (prior.fingerprint !== hash)
          throw new BusinessError('IDEMPOTENCY_PAYLOAD_CONFLICT');
        return prior.response as T;
      }
      if (prior) await tx.idempotencyRecord.delete({ where: { id: prior.id } });
      const value = await work(tx);
      const response = JSON.parse(
        JSON.stringify(value),
      ) as Prisma.InputJsonValue;
      await tx.idempotencyRecord.create({
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
export class PrismaOrderUnitOfWork extends OrderUnitOfWork {
  constructor(private readonly db: PrismaClient) {
    super();
  }
  run(
    actor: Actor,
    request: RequestIdentity,
    work: (tx: OrderTransaction) => Promise<OrderView>,
  ) {
    const scoped = { tenantId: actor.tenantId, branchId: actor.branchId };
    return idempotent(this.db, actor, request, async (db) => {
      const read = async (id: string) => {
        const order = await db.order.findFirst({
          where: { ...scoped, id },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        if (!order) throw new BusinessError('NOT_FOUND', 404);
        return order;
      };
      return work({
        lockOrder: async (id) => {
          const rows = await db.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "Order" WHERE id = ${id}::uuid AND "tenantId" = ${actor.tenantId}::uuid AND "branchId" = ${actor.branchId}::uuid FOR UPDATE`;
          if (!rows.length) throw new BusinessError('NOT_FOUND', 404);
          return read(id);
        },
        lockTable: async (id) => {
          const rows = await db.$queryRaw<
            { id: string }[]
          >`SELECT id FROM "RestaurantTable" WHERE id = ${id}::uuid AND "tenantId" = ${actor.tenantId}::uuid AND "branchId" = ${actor.branchId}::uuid FOR UPDATE`;
          if (!rows.length) throw new BusinessError('NOT_FOUND', 404);
        },
        findActiveOrder: (tableId) =>
          db.order.findFirst({
            where: { ...scoped, tableId, status: 'OPEN' },
            include: { items: true },
          }),
        createOrder: async (tableId) => {
          const order = await db.order.create({
            data: { ...scoped, tableId },
            include: { items: true },
          });
          await db.orderEvent.create({
            data: {
              ...scoped,
              orderId: order.id,
              actorId: actor.userId,
              action: 'ORDER_CREATED',
            },
          });
          return order;
        },
        menu: async (id) => {
          const menu = await db.menuItem.findFirst({
            where: { tenantId: actor.tenantId, id },
          });
          if (!menu) throw new BusinessError('NOT_FOUND', 404);
          return menu;
        },
        append: async (order, menu, count) => {
          await db.orderItem.create({
            data: {
              ...scoped,
              orderId: order.id,
              menuItemId: menu.id,
              name: menu.name,
              priceRial: menu.priceRial,
              quantity: count,
            },
          });
        },
        updateItem: async (item, change) => {
          const updated = await db.orderItem.updateMany({
            where: { ...scoped, id: item.id, version: item.version },
            data: { ...change, version: { increment: 1 } },
          });
          if (!updated.count) throw new BusinessError('VERSION_CONFLICT');
        },
        touch: async (order, action, complete) => {
          await db.order.update({
            where: { tenantId_branchId_id: { ...scoped, id: order.id } },
            data: {
              version: { increment: 1 },
              ...(complete
                ? { status: 'COMPLETED', completedAt: new Date() }
                : {}),
            },
          });
          await db.orderEvent.create({
            data: {
              ...scoped,
              orderId: order.id,
              actorId: actor.userId,
              action,
            },
          });
          return read(order.id);
        },
      });
    });
  }
}
