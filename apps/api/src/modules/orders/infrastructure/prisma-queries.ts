import { Prisma, PrismaClient } from '@prisma/client';
import type { Actor } from '../../../../../../packages/shared/src/contracts';
import { OrderQueries } from '../application/queries';
import { BusinessError } from '../domain/rules';
export class PrismaOrderQueries extends OrderQueries {
  constructor(private readonly db: PrismaClient) {
    super();
  }
  async kitchen(actor: Actor, limit: number, cursor?: string) {
    let boundary: { createdAt: Date; id: string } | undefined;
    if (cursor) {
      try {
        const parsed = JSON.parse(
          Buffer.from(cursor, 'base64url').toString('utf8'),
        );
        if (
          typeof parsed.id !== 'string' ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            parsed.id,
          ) ||
          typeof parsed.at !== 'string' ||
          !Number.isFinite(Date.parse(parsed.at))
        )
          throw new Error('invalid');
        boundary = { id: parsed.id, createdAt: new Date(parsed.at) };
      } catch {
        throw new BusinessError('INVALID_CURSOR', 400);
      }
    }
    const where: Prisma.OrderWhereInput = {
      tenantId: actor.tenantId,
      branchId: actor.branchId,
      status: 'OPEN',
      items: { some: { status: { in: ['PENDING', 'PREPARING', 'READY'] } } },
    };
    return this.db.$transaction(
      async (tx) => {
        const total = await tx.order.count({ where });
        const rows = await tx.order.findMany({
          where: {
            ...where,
            ...(boundary
              ? {
                  OR: [
                    { createdAt: { gt: boundary.createdAt } },
                    { createdAt: boundary.createdAt, id: { gt: boundary.id } },
                  ],
                }
              : {}),
          },
          include: {
            items: {
              where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } },
              orderBy: { createdAt: 'asc' },
            },
            table: { select: { number: true } },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          take: limit + 1,
        });
        const hasMore = rows.length > limit,
          items = rows.slice(0, limit),
          last = items.at(-1);
        return {
          items,
          total,
          hasMore,
          nextCursor:
            hasMore && last
              ? Buffer.from(
                  JSON.stringify({
                    at: last.createdAt.toISOString(),
                    id: last.id,
                  }),
                ).toString('base64url')
              : null,
          checkedAt: new Date(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  tables(actor: Actor) {
    return this.db.restaurantTable.findMany({
      where: { tenantId: actor.tenantId, branchId: actor.branchId },
      orderBy: { number: 'asc' },
      include: { orders: { where: { status: 'OPEN' }, select: { id: true } } },
    });
  }
  async table(actor: Actor, id: string) {
    const table = await this.db.restaurantTable.findFirst({
      where: { id, tenantId: actor.tenantId, branchId: actor.branchId },
      include: { orders: { where: { status: 'OPEN' }, select: { id: true } } },
    });
    if (!table) throw new BusinessError('NOT_FOUND', 404);
    return table;
  }
  list(actor: Actor, kitchen = false) {
    return this.db.order.findMany({
      where: {
        tenantId: actor.tenantId,
        branchId: actor.branchId,
        ...(kitchen
          ? {
              status: 'OPEN',
              items: {
                some: { status: { in: ['PENDING', 'PREPARING', 'READY'] } },
              },
            }
          : {}),
      },
      include: {
        items: {
          ...(kitchen
            ? { where: { status: { in: ['PENDING', 'PREPARING', 'READY'] } } }
            : {}),
          orderBy: { createdAt: 'asc' },
        },
        table: { select: { number: true } },
      },
      orderBy: { createdAt: kitchen ? 'asc' : 'desc' },
      take: 100,
    });
  }
  async get(actor: Actor, id: string) {
    const order = await this.db.order.findFirst({
      where: { tenantId: actor.tenantId, branchId: actor.branchId, id },
      include: {
        items: { orderBy: { createdAt: 'asc' } },
        table: { select: { number: true } },
      },
    });
    if (!order) throw new BusinessError('NOT_FOUND', 404);
    return order;
  }
  async orderForItem(actor: Actor, id: string) {
    const item = await this.db.orderItem.findFirst({
      where: { tenantId: actor.tenantId, branchId: actor.branchId, id },
      select: { orderId: true },
    });
    if (!item) throw new BusinessError('NOT_FOUND', 404);
    return item.orderId;
  }
}
