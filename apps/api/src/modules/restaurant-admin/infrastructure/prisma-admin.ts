import { Prisma, PrismaClient } from '@prisma/client';
import type { Actor } from '../../../../../../packages/shared/src/contracts';
import {
  RestaurantAdminRepository,
  PageQuery,
  MenuWrite,
  CategoryWrite,
  TableWrite,
  SettingsWrite,
} from '../application/admin';
import {
  BusinessError,
  assertVersion,
  tomanToRial,
} from '../../orders/domain/rules';
import { audit } from '../../../common/infrastructure/audit';
const scope = (a: Actor) => ({ tenantId: a.tenantId, branchId: a.branchId });
const includeOrder = {
  items: true,
  table: { select: { number: true } },
  events: { orderBy: { createdAt: 'asc' as const } },
};
function expected(actual: number, version?: number) {
  if (version === undefined) throw new BusinessError('VERSION_REQUIRED', 400);
  assertVersion(actual, version);
}
function page<T>(items: T[], total: number, q: PageQuery) {
  return {
    items,
    total,
    page: q.page,
    pageSize: q.pageSize,
    pages: Math.ceil(total / q.pageSize),
  };
}
export class PrismaRestaurantAdminRepository extends RestaurantAdminRepository {
  constructor(private readonly db: PrismaClient) {
    super();
  }
  async dashboard(a: Actor) {
    return this.db.$transaction(
      async (tx) => {
        const where = scope(a);
        const [activeOrders, occupiedTables, availableTables, states, recent] =
          await Promise.all([
            tx.order.count({ where: { ...where, status: 'OPEN' } }),
            tx.restaurantTable.count({
              where: { ...where, orders: { some: { status: 'OPEN' } } },
            }),
            tx.restaurantTable.count({
              where: {
                ...where,
                active: true,
                orders: { none: { status: 'OPEN' } },
              },
            }),
            tx.orderItem.groupBy({
              by: ['status'],
              where: { ...where, order: { status: 'OPEN' } },
              _count: { _all: true },
            }),
            tx.order.findMany({
              where,
              include: { items: true, table: { select: { number: true } } },
              orderBy: { createdAt: 'desc' },
              take: 10,
            }),
          ]);
        const [pendingOrders, preparingOrders, readyOrders] = await Promise.all(
          (['PENDING', 'PREPARING', 'READY'] as const).map((status) =>
            tx.order.count({
              where: { ...where, status: 'OPEN', items: { some: { status } } },
            }),
          ),
        );
        const count = (status: string) =>
          states.find((s) => s.status === status)?._count._all || 0;
        return {
          activeOrders,
          pendingOrders,
          preparingOrders,
          readyOrders,
          occupiedTables,
          availableTables,
          pendingItems: count('PENDING'),
          preparingItems: count('PREPARING'),
          readyItems: count('READY'),
          recentOrders: recent.map((o) => ({
            ...o,
            totalRial: o.items.reduce(
              (sum, i) => sum + i.quantity * i.priceRial,
              0,
            ),
          })),
          branchId: a.branchId,
          checkedAt: new Date(),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
  async orders(a: Actor, q: PageQuery) {
    const where: Prisma.OrderWhereInput = {
      ...scope(a),
      ...(q.status ? { status: q.status as 'OPEN' | 'COMPLETED' } : {}),
      ...(q.q
        ? {
            OR: [
              {
                id: {
                  equals:
                    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                      q.q,
                    )
                      ? q.q
                      : undefined,
                },
              },
              {
                table: {
                  number:
                    Number.isSafeInteger(Number(q.q)) &&
                    Number(q.q) > 0 &&
                    Number(q.q) <= 2147483647
                      ? Number(q.q)
                      : -1,
                },
              },
            ],
          }
        : {}),
    };
    if (
      q.q &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        q.q,
      )
    )
      where.OR = [
        {
          table: {
            number:
              Number.isSafeInteger(Number(q.q)) &&
              Number(q.q) > 0 &&
              Number(q.q) <= 2147483647
                ? Number(q.q)
                : -1,
          },
        },
      ];
    const [items, total] = await this.db.$transaction([
      this.db.order.findMany({
        where,
        include: includeOrder,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.order.count({ where }),
    ]);
    return page(
      items.map((o) => ({
        ...o,
        totalRial: o.items.reduce(
          (sum, i) => sum + i.quantity * i.priceRial,
          0,
        ),
      })),
      total,
      q,
    );
  }
  async order(a: Actor, id: string) {
    const value = await this.db.order.findFirst({
      where: { ...scope(a), id },
      include: includeOrder,
    });
    if (!value) throw new BusinessError('NOT_FOUND', 404);
    return value;
  }
  tables(a: Actor) {
    return this.db.restaurantTable.findMany({
      where: scope(a),
      orderBy: { number: 'asc' },
      include: {
        orders: { where: { status: 'OPEN' }, include: { items: true } },
      },
    });
  }
  createTable(a: Actor, x: TableWrite) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.restaurantTable.create({
        data: {
          ...scope(a),
          number: x.number,
          seats: x.seats,
          active: x.active,
        },
      });
      await audit(tx, a, 'TABLE_CREATED', 'table', result.id, a.tenantId);
      return result;
    });
  }
  updateTable(a: Actor, id: string, x: TableWrite) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "RestaurantTable" WHERE id=${id}::uuid AND "tenantId"=${a.tenantId}::uuid AND "branchId"=${a.branchId}::uuid FOR UPDATE`;
      const old = await tx.restaurantTable.findFirst({
        where: { ...scope(a), id },
      });
      if (!old) throw new BusinessError('NOT_FOUND', 404);
      expected(old.version, x.version);
      if (
        !x.active &&
        (await tx.order.count({
          where: { ...scope(a), tableId: id, status: 'OPEN' },
        }))
      )
        throw new BusinessError('TABLE_OCCUPIED');
      const result = await tx.restaurantTable.update({
        where: { id },
        data: {
          number: x.number,
          seats: x.seats,
          active: x.active,
          version: { increment: 1 },
        },
      });
      await audit(tx, a, 'TABLE_UPDATED', 'table', id, a.tenantId);
      return result;
    });
  }
  categories(a: Actor) {
    return this.db.category.findMany({
      where: { tenantId: a.tenantId },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }
  createCategory(a: Actor, x: CategoryWrite) {
    return this.db.$transaction(async (tx) => {
      const result = await tx.category.create({
        data: {
          tenantId: a.tenantId,
          name: x.name,
          active: x.active,
          displayOrder: x.displayOrder,
        },
      });
      await audit(tx, a, 'CATEGORY_CREATED', 'category', result.id, a.tenantId);
      return result;
    });
  }
  updateCategory(a: Actor, id: string, x: CategoryWrite) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Category" WHERE id=${id}::uuid AND "tenantId"=${a.tenantId}::uuid FOR UPDATE`;
      const old = await tx.category.findFirst({
        where: { tenantId: a.tenantId, id },
      });
      if (!old) throw new BusinessError('NOT_FOUND', 404);
      expected(old.version, x.version);
      const result = await tx.category.update({
        where: { id },
        data: {
          name: x.name,
          active: x.active,
          displayOrder: x.displayOrder,
          version: { increment: 1 },
        },
      });
      await audit(tx, a, 'CATEGORY_UPDATED', 'category', id, a.tenantId);
      return result;
    });
  }
  async items(a: Actor, q: PageQuery) {
    const where = {
      tenantId: a.tenantId,
      ...(q.q ? { name: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.menuItem.findMany({
        where,
        include: { category: { select: { name: true, active: true } } },
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.menuItem.count({ where }),
    ]);
    return page(items, total, q);
  }
  private async category(tx: Prisma.TransactionClient, a: Actor, id: string) {
    await tx.$queryRaw`SELECT id FROM "Category" WHERE id=${id}::uuid AND "tenantId"=${a.tenantId}::uuid FOR SHARE`;
    const category = await tx.category.findFirst({
      where: { tenantId: a.tenantId, id },
    });
    if (!category) throw new BusinessError('NOT_FOUND', 404);
    if (!category.active) throw new BusinessError('CATEGORY_INACTIVE');
  }
  createMenu(a: Actor, x: MenuWrite) {
    return this.db.$transaction(async (tx) => {
      await this.category(tx, a, x.categoryId);
      const result = await tx.menuItem.create({
        data: {
          tenantId: a.tenantId,
          name: x.name,
          description: x.description,
          categoryId: x.categoryId,
          priceRial: tomanToRial(x.priceToman),
          active: x.active,
          available: x.available,
        },
      });
      await audit(
        tx,
        a,
        'MENU_ITEM_CREATED',
        'menu-item',
        result.id,
        a.tenantId,
      );
      return result;
    });
  }
  updateMenu(a: Actor, id: string, x: MenuWrite) {
    return this.db.$transaction(async (tx) => {
      // Match ordering's category-then-menu lock order, including category moves.
      const original = await tx.menuItem.findFirst({
        where: { tenantId: a.tenantId, id },
      });
      if (!original) throw new BusinessError('NOT_FOUND', 404);
      for (const categoryId of [
        ...new Set([original.categoryId, x.categoryId]),
      ].sort())
        await tx.$queryRaw`SELECT id FROM "Category" WHERE id=${categoryId}::uuid AND "tenantId"=${a.tenantId}::uuid FOR SHARE`;
      await tx.$queryRaw`SELECT id FROM "MenuItem" WHERE id=${id}::uuid AND "tenantId"=${a.tenantId}::uuid FOR UPDATE`;
      const old = await tx.menuItem.findFirst({
        where: { tenantId: a.tenantId, id },
      });
      if (!old) throw new BusinessError('NOT_FOUND', 404);
      expected(old.version, x.version);
      await this.category(tx, a, x.categoryId);
      const result = await tx.menuItem.update({
        where: { id },
        data: {
          name: x.name,
          description: x.description,
          categoryId: x.categoryId,
          priceRial: tomanToRial(x.priceToman),
          active: x.active,
          available: x.available,
          version: { increment: 1 },
        },
      });
      await audit(tx, a, 'MENU_ITEM_UPDATED', 'menu-item', id, a.tenantId);
      return result;
    });
  }
  async staff(a: Actor, q: PageQuery) {
    const where = {
      tenantId: a.tenantId,
      branches: { some: { branchId: a.branchId } },
    };
    const [items, total] = await this.db.$transaction([
      this.db.membership.findMany({
        where,
        select: {
          id: true,
          role: true,
          active: true,
          user: { select: { name: true, email: true, active: true } },
          branches: {
            where: { branchId: a.branchId },
            select: {
              branch: { select: { id: true, name: true, active: true } },
            },
          },
        },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { id: 'asc' },
      }),
      this.db.membership.count({ where }),
    ]);
    return page(items, total, q);
  }
  async settings(a: Actor) {
    const restaurant = await this.db.restaurant.findUniqueOrThrow({
      where: { id: a.tenantId },
    });
    const branch = await this.db.branch.findFirstOrThrow({
      where: { id: a.branchId, tenantId: a.tenantId },
    });
    return {
      name: restaurant.name,
      branchName: branch.name,
      primaryContact: restaurant.primaryContact,
      contactEmail: restaurant.contactEmail,
      phone: restaurant.phone,
      address: restaurant.address,
      timezone: restaurant.timezone,
      currencyPresentation: restaurant.currencyPresentation,
      version: restaurant.version,
    };
  }
  updateSettings(a: Actor, x: SettingsWrite) {
    return this.db.$transaction(async (tx) => {
      const updated = await tx.restaurant.updateMany({
        where: { id: a.tenantId, version: x.version },
        data: {
          name: x.name,
          primaryContact: x.primaryContact,
          contactEmail: x.contactEmail,
          phone: x.phone,
          address: x.address,
          timezone: x.timezone,
          currencyPresentation: x.currencyPresentation,
          version: { increment: 1 },
        },
      });
      if (!updated.count) throw new BusinessError('VERSION_CONFLICT');
      await tx.branch.update({
        where: { tenantId_id: { tenantId: a.tenantId, id: a.branchId } },
        data: { name: x.branchName },
      });
      await audit(
        tx,
        a,
        'SETTINGS_UPDATED',
        'restaurant',
        a.tenantId,
        a.tenantId,
      );
      return { ok: true };
    });
  }
}
