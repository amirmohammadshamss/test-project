import {
  Prisma,
  PrismaClient,
  NotificationOutbox,
  Notification,
} from '@prisma/client';
import {
  notificationTypes,
  policies,
  preferenceAllows,
  eligibleTypes,
  NotificationPrincipal,
  NoticeType,
  Realm,
} from './domain';
export interface OutboxEventInput {
  dedupeKey: string;
  realm: Realm;
  type: NoticeType;
  tenantId?: string;
  branchId?: string;
  entityId: string;
  payload?: Prisma.InputJsonValue;
}
export function recordNotificationEvent(
  tx: Prisma.TransactionClient,
  event: OutboxEventInput,
) {
  return tx.notificationOutbox.upsert({
    where: { dedupeKey: event.dedupeKey },
    create: { ...event, payload: event.payload || {} },
    update: {},
  });
}
export function notificationWhere(
  p: NotificationPrincipal,
): Prisma.NotificationWhereInput {
  return {
    realm: p.realm,
    recipientId: p.userId,
    expiresAt: { gt: new Date() },
    type: { in: eligibleTypes(p) },
    ...(p.realm === 'PLATFORM'
      ? { platformAdminId: p.platformAdminId, tenantId: null, branchId: null }
      : {
          tenantId: p.tenantId,
          membershipId: p.membershipId,
          OR: [{ branchId: p.branchId }, { branchId: null }],
        }),
  };
}
export function subscriptionWhere(
  p: NotificationPrincipal,
): Prisma.PushSubscriptionWhereInput {
  return {
    realm: p.realm,
    userId: p.userId,
    ...(p.realm === 'PLATFORM'
      ? { platformAdminId: p.platformAdminId, tenantId: null }
      : {
          tenantId: p.tenantId,
          membershipId: p.membershipId,
          branchId: p.branchId,
        }),
  };
}
export async function recipients(
  tx: Prisma.TransactionClient,
  event: NotificationOutbox,
) {
  const policy = policies[event.type];
  if (
    event.type === 'NEW_ORDER' &&
    (event.payload as { actionable?: boolean }).actionable === false
  )
    return [];
  if (event.realm === 'PLATFORM')
    return (
      await tx.platformAdmin.findMany({
        where: { active: true, user: { active: true } },
        select: { id: true, userId: true },
      })
    ).map((a) => ({
      recipientId: a.userId,
      platformAdminId: a.id,
      membershipId: null,
    }));
  const payload = event.payload as { actorId?: string };
  const rows = await tx.membership.findMany({
    where: {
      tenantId: event.tenantId!,
      active: true,
      role: { in: policy.roles },
      user: { active: true },
      ...([
        'AI_FAILED',
        'AI_READY',
        'ANALYSIS_READY',
        'ANALYSIS_FAILED',
      ].includes(event.type)
        ? { userId: payload.actorId || '00000000-0000-0000-0000-000000000000' }
        : {}),
      ...(event.branchId
        ? {
            branches: {
              some: { branchId: event.branchId, branch: { active: true } },
            },
          }
        : {}),
      ...(event.type === 'TENANT_SUSPENDED'
        ? {}
        : { restaurant: { status: 'ACTIVE' } }),
    },
    select: { id: true, userId: true },
  });
  return rows.map((a) => ({
    recipientId: a.userId,
    membershipId: a.id,
    platformAdminId: null,
  }));
}
export async function processNotificationEvent(
  db: PrismaClient,
  id: string,
): Promise<Notification[]> {
  return db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT id FROM "NotificationOutbox" WHERE id=${id}::uuid FOR UPDATE`;
      const event = await tx.notificationOutbox.findUnique({ where: { id } });
      if (
        !event ||
        event.processedAt ||
        event.failedAt ||
        event.nextAttemptAt > new Date()
      )
        return [];
      if (event.createdAt.getTime() + 30 * 86400000 < Date.now()) {
        await tx.notificationOutbox.update({
          where: { id },
          data: { processedAt: new Date() },
        });
        return [];
      }
      const policy = policies[event.type],
        output: Notification[] = [];
      for (const recipient of await recipients(tx, event)) {
        const key =
          event.realm === 'PLATFORM'
            ? 'platform'
            : `restaurant:${event.tenantId}`;
        const pref = await tx.notificationPreference.findUnique({
          where: {
            userId_scopeKey: { userId: recipient.recipientId, scopeKey: key },
          },
        });
        if (!preferenceAllows(event.type, pref)) continue;
        const notification = await tx.notification.upsert({
          where: {
            eventId_realm_recipientId_type: {
              eventId: event.id,
              realm: event.realm,
              recipientId: recipient.recipientId,
              type: event.type,
            },
          },
          create: {
            ...recipient,
            realm: event.realm,
            tenantId: event.tenantId,
            branchId: event.branchId,
            eventId: event.id,
            type: event.type,
            priority: policy.priority,
            title: policy.title,
            message: policy.message,
            entityType: policy.entityType,
            entityId: event.entityId,
            createdAt: event.createdAt,
            expiresAt: new Date(event.createdAt.getTime() + 30 * 86400000),
          },
          update: {},
        });
        output.push(notification);
        if (pref?.pushEnabled && pref.categories.includes(event.type)) {
          const subscriptions = await tx.pushSubscription.findMany({
            where: {
              userId: recipient.recipientId,
              realm: event.realm,
              tenantId: event.tenantId,
              active: true,
              ...(event.branchId ? { branchId: event.branchId } : {}),
              ...(recipient.membershipId
                ? { membershipId: recipient.membershipId }
                : { platformAdminId: recipient.platformAdminId }),
            },
            select: { id: true },
          });
          for (const subscription of subscriptions)
            await tx.notificationDelivery.upsert({
              where: {
                notificationId_subscriptionId: {
                  notificationId: notification.id,
                  subscriptionId: subscription.id,
                },
              },
              create: {
                notificationId: notification.id,
                subscriptionId: subscription.id,
              },
              update: {},
            });
        }
      }
      await tx.notificationOutbox.update({
        where: { id },
        data: {
          processedAt: new Date(),
          attempts: { increment: 1 },
          errorCode: null,
        },
      });
      return output;
    },
    { maxWait: 3000, timeout: 15000 },
  );
}
export async function dispatchNotificationOutbox(db: PrismaClient, limit = 50) {
  const events = await db.notificationOutbox.findMany({
    where: {
      processedAt: null,
      failedAt: null,
      nextAttemptAt: { lte: new Date() },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    take: limit,
    select: { id: true },
  });
  const output: Notification[] = [];
  for (const event of events) {
    try {
      output.push(...(await processNotificationEvent(db, event.id)));
    } catch {
      await db.notificationOutbox.updateMany({
        where: { id: event.id, processedAt: null, attempts: { lt: 5 } },
        data: {
          attempts: { increment: 1 },
          nextAttemptAt: new Date(Date.now() + 30000),
          errorCode: 'NOTIFICATION_DISPATCH_FAILED',
        },
      });
      await db.notificationOutbox.updateMany({
        where: { id: event.id, processedAt: null, attempts: { gte: 5 } },
        data: { failedAt: new Date() },
      });
    }
  }
  return output;
}
export async function currentSubscriptionPrincipal(
  db: Pick<
    Prisma.TransactionClient,
    'platformSession' | 'restaurantSession' | 'membership'
  >,
  s: {
    realm: Realm;
    sessionId: string;
    userId: string;
    tenantId: string | null;
    branchId: string | null;
    membershipId: string | null;
    platformAdminId: string | null;
  },
): Promise<NotificationPrincipal | null> {
  if (s.realm === 'PLATFORM') {
    const session = await db.platformSession.findFirst({
      where: {
        id: s.sessionId,
        adminId: s.platformAdminId!,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        admin: { active: true, userId: s.userId, user: { active: true } },
      },
    });
    return session
      ? {
          realm: 'PLATFORM',
          userId: s.userId,
          sessionId: s.sessionId,
          platformAdminId: s.platformAdminId!,
        }
      : null;
  }
  const session = await db.restaurantSession.findFirst({
    where: {
      id: s.sessionId,
      userId: s.userId,
      membershipId: s.membershipId!,
      branchId: s.branchId!,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!session) return null;
  const member = await db.membership.findFirst({
    where: {
      id: s.membershipId!,
      tenantId: s.tenantId!,
      userId: s.userId,
      active: true,
      user: { active: true },
      branches: { some: { branchId: s.branchId!, branch: { active: true } } },
    },
    include: { restaurant: { select: { status: true } } },
  });
  if (!member) return null;
  return {
    realm: 'RESTAURANT',
    userId: s.userId,
    sessionId: s.sessionId,
    tenantId: s.tenantId!,
    branchId: s.branchId!,
    membershipId: member.id,
    role: member.role,
    tenantStatus: member.restaurant.status,
  };
}
export async function notificationMaintenance(
  db: PrismaClient,
  scopeTenant?: string,
) {
  const threshold = Number(process.env.NOTIFICATION_DELAY_MINUTES || 20);
  if (Number.isFinite(threshold) && threshold >= 1 && threshold <= 240) {
    const cutoff = new Date(Date.now() - threshold * 60000);
    const orders = await db.$queryRaw<
      { id: string; tenantId: string; branchId: string }[]
    >`SELECT o.id,o."tenantId",o."branchId" FROM "Order" o WHERE (${scopeTenant || null}::uuid IS NULL OR o."tenantId"=${scopeTenant || null}::uuid) AND o.status='OPEN' AND o."createdAt"<${cutoff} AND EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id AND i.status IN ('PENDING','PREPARING')) AND NOT EXISTS(SELECT 1 FROM "NotificationOutbox" e WHERE e."dedupeKey"='order-delayed:'||o.id::text) ORDER BY o."createdAt" LIMIT 100`;
    for (const order of orders)
      await db.$transaction((tx) =>
        recordNotificationEvent(tx, {
          dedupeKey: 'order-delayed:' + order.id,
          realm: 'RESTAURANT',
          type: 'ORDER_DELAYED',
          tenantId: order.tenantId,
          branchId: order.branchId,
          entityId: order.id,
        }),
      );
  }
  await db.notification.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await db.notificationOutbox.deleteMany({
    where: {
      OR: [{ processedAt: { not: null } }, { failedAt: { not: null } }],
      createdAt: { lt: new Date(Date.now() - 90 * 86400000) },
    },
  });
  await db.pushSubscription.updateMany({
    where: {
      active: true,
      updatedAt: { lt: new Date(Date.now() - 90 * 86400000) },
    },
    data: { active: false, encrypted: '', revokedAt: new Date() },
  });
  await db.pushSubscription.deleteMany({
    where: {
      active: false,
      revokedAt: { lt: new Date(Date.now() - 90 * 86400000) },
    },
  });
}
export { notificationTypes };
