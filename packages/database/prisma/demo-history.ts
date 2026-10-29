import { createHash } from 'node:crypto';
import type { PrismaClient, ItemStatus, OrderStatus } from '@prisma/client';
const uuid = (key: string) => {
  const h = createHash('sha256')
    .update('restaurantos-demo-v1:' + key)
    .digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
export async function seedDemoHistory(
  db: PrismaClient,
  tenants: string[],
  branches: string[],
) {
  const now = new Date();
  for (let index = 0; index < tenants.length; index++) {
    const tenantId = tenants[index],
      branchId = branches[index];
    const tables = await db.restaurantTable.findMany({
      where: { tenantId, branchId },
      orderBy: { number: 'asc' },
    });
    const menu = await db.menuItem.findMany({
      where: { tenantId },
      orderBy: { id: 'asc' },
    });
    const actor = await db.membership.findFirstOrThrow({
      where: { tenantId, role: 'MANAGER' },
    });
    for (let day = 0; day < 30; day++)
      for (let shift = 0; shift < 2; shift++) {
        const id = uuid(`${tenantId}:history:${day}:${shift}`);
        if (await db.order.findUnique({ where: { id } })) continue;
        const createdAt = new Date(
          now.getTime() - (day * 24 + 2 + shift) * 3600000,
        );
        const cancelled = day % 9 === 3 && shift === 0;
        const status: OrderStatus = cancelled ? 'CANCELLED' : 'COMPLETED';
        const completedAt = new Date(createdAt.getTime() + 35 * 60000);
        const lines = [0, 1, 2].map((_, n) => {
          const item = menu[(day + shift + n * 2) % menu.length];
          const isCancelled = cancelled || (n === 2 && day % 7 === 2);
          return {
            id: uuid(id + ':line:' + n),
            tenantId,
            branchId,
            menuItemId: item.id,
            name: item.name,
            priceRial: item.priceRial,
            quantity: 1 + ((day + shift + n) % 3),
            status: (isCancelled ? 'CANCELLED' : 'SERVED') as ItemStatus,
            version: 4,
            createdAt,
            ...(isCancelled
              ? {
                  cancelledAt: completedAt,
                  cancelledBy: actor.userId,
                  cancellationReason:
                    'نمونه نمایشی: تغییر نظر مهمان پیش از پخت',
                  cancellationPriorStatus: 'PENDING',
                }
              : {}),
          };
        });
        await db.$transaction(async (tx) => {
          await tx.order.create({
            data: {
              id,
              tenantId,
              branchId,
              tableId: tables[(day + shift) % tables.length].id,
              status,
              version: 6,
              createdAt,
              updatedAt: completedAt,
              ...(cancelled
                ? {
                    cancelledAt: completedAt,
                    cancelledBy: actor.userId,
                    cancellationReason: 'نمونه نمایشی: ثبت تکراری میز',
                    cancellationPriorStatus: 'OPEN',
                  }
                : { completedAt }),
            },
          });
          await tx.orderItem.createMany({
            data: lines.map((line) => ({ ...line, orderId: id })),
          });
          await tx.orderEvent.createMany({
            data: [
              { action: 'ORDER_CREATED', createdAt },
              {
                action: 'ITEM_ADDED',
                createdAt: new Date(createdAt.getTime() + 60000),
              },
              {
                action: cancelled ? 'ORDER_CANCELLED' : 'ORDER_COMPLETED',
                createdAt: completedAt,
              },
            ].map((e) => ({
              ...e,
              tenantId,
              branchId,
              orderId: id,
              actorId: actor.userId,
            })),
          });
        });
      }
    for (const [number, status] of [
      [1, 'PENDING'],
      [4, 'READY'],
    ] as const) {
      const id = uuid(`${tenantId}:active:${number}`),
        table = tables.find((t) => t.number === number)!;
      if (
        (await db.order.findUnique({ where: { id } })) ||
        (await db.order.findFirst({
          where: { tenantId, branchId, tableId: table.id, status: 'OPEN' },
        }))
      )
        continue;
      const item = menu[number % menu.length],
        createdAt = new Date(
          now.getTime() - (status === 'READY' ? 12 : 4) * 60000,
        );
      await db.$transaction(async (tx) => {
        await tx.order.create({
          data: {
            id,
            tenantId,
            branchId,
            tableId: table.id,
            createdAt,
            version: status === 'READY' ? 4 : 2,
          },
        });
        await tx.orderItem.create({
          data: {
            id: uuid(id + ':line'),
            tenantId,
            branchId,
            orderId: id,
            menuItemId: item.id,
            name: item.name,
            priceRial: item.priceRial,
            quantity: 2,
            status,
            version: status === 'READY' ? 3 : 1,
            notes:
              number === 1
                ? 'نمونه نمایشی: بدون سس؛ پیش از پخت با سالن هماهنگ شود.'
                : '',
          },
        });
        await tx.orderEvent.createMany({
          data: [
            { action: 'ORDER_CREATED', createdAt },
            {
              action: 'ITEM_ADDED',
              createdAt: new Date(createdAt.getTime() + 30000),
            },
          ].map((e) => ({
            ...e,
            tenantId,
            branchId,
            orderId: id,
            actorId: actor.userId,
          })),
        });
      });
    }
    const start = new Date(now.getTime() - 7 * 86400000);
    const rows = await db.$queryRaw<
      { count: string; value: string }[]
    >`SELECT COUNT(DISTINCT o.id)::text AS count,COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN i."priceRial"::bigint*i.quantity ELSE 0 END),0)::text AS value FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o.id AND i."tenantId"=o."tenantId" AND i."branchId"=o."branchId" WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND o."completedAt">=${start} AND o."completedAt"<${now}`;
    const analysisId = uuid(tenantId + ':analysis');
    await db.aiAnalysis.upsert({
      where: { id: analysisId },
      update: {},
      create: {
        id: analysisId,
        tenantId,
        branchId,
        actorId: actor.userId,
        membershipId: actor.id,
        question: 'نمونه نمایشی: ارزش سفارش‌های تکمیل‌شده در هفت روز گذشته',
        status: 'READY',
        provider: 'demo-fixture',
        model: 'not-live-inference',
        result: {
          title: 'گزارش نمایشی از سابقه ساختگی',
          explanation:
            'اعداد از سفارش‌های نمونه محاسبه شده‌اند؛ مدل زنده‌ای فراخوانی نشده است.',
          tool: 'SALES_SUMMARY',
          period: 'LAST_7_DAYS',
          start: start.toISOString(),
          end: now.toISOString(),
          generatedAt: now.toISOString(),
          facts: [
            { label: 'سفارش تکمیل‌شده', value: rows[0].count, unit: 'COUNT' },
            {
              label: 'ارزش سفارش تکمیل‌شده',
              value: rows[0].value,
              unit: 'IRR',
            },
          ],
          items: [],
          limitations: [
            'داده‌ها ساختگی و برای تمرین هستند.',
            'ارزش سفارش، پرداخت یا سود نیست.',
          ],
        },
      },
    });
    const recipients = await db.membership.findMany({
      where: { tenantId, active: true, branches: { some: { branchId } } },
    });
    for (const member of recipients) {
      const type =
        member.role === 'MANAGER'
          ? 'ANALYSIS_READY'
          : member.role === 'KITCHEN'
            ? 'NEW_ORDER'
            : 'ITEM_READY';
      const entityId =
        member.role === 'MANAGER'
          ? analysisId
          : uuid(`${tenantId}:active:${member.role === 'KITCHEN' ? 1 : 4}`);
      if (
        member.role !== 'MANAGER' &&
        !(await db.order.findUnique({ where: { id: entityId } }))
      )
        continue;
      const eventId = uuid(tenantId + ':notice:' + member.id);
      await db.$transaction(async (tx) => {
        await tx.notificationOutbox.upsert({
          where: { id: eventId },
          update: {},
          create: {
            id: eventId,
            dedupeKey: 'demo:' + eventId,
            realm: 'RESTAURANT',
            type,
            tenantId,
            branchId,
            entityId,
            payload: { demoFixture: true, actorId: member.userId },
            processedAt: now,
          },
        });
        await tx.notification.upsert({
          where: {
            eventId_realm_recipientId_type: {
              eventId,
              realm: 'RESTAURANT',
              recipientId: member.userId,
              type,
            },
          },
          update: {},
          create: {
            realm: 'RESTAURANT',
            tenantId,
            branchId,
            membershipId: member.id,
            recipientId: member.userId,
            type,
            priority: member.role === 'MANAGER' ? 'LOW' : 'HIGH',
            title:
              'نمونه نمایشی — ' +
              (member.role === 'MANAGER'
                ? 'گزارش آماده بررسی'
                : 'هماهنگی سالن و آشپزخانه'),
            message:
              'اعلان ساختگی برای آشنایی با محیط؛ هیچ مدل یا دستگاه Push فراخوانی نشده است.',
            entityType: member.role === 'MANAGER' ? 'ai-analysis' : 'order',
            entityId,
            eventId,
            expiresAt: new Date(now.getTime() + 30 * 86400000),
          },
        });
      });
    }
  }
}
