import { PrismaClient } from '@prisma/client';
import type { Actor } from '../../../../../../packages/shared/src/contracts';
import { OrderQueries } from '../application/queries';
import { BusinessError } from '../domain/rules';
export class PrismaOrderQueries extends OrderQueries {
  constructor(private readonly db: PrismaClient) {
    super();
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
          ? { status: 'OPEN', items: { some: { status: { not: 'SERVED' } } } }
          : {}),
      },
      include: {
        items: {
          ...(kitchen ? { where: { status: { not: 'SERVED' } } } : {}),
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
