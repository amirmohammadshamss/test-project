import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { UnrecoverableError } from 'bullmq';
import { currentSubscriptionPrincipal, notificationWhere } from './persistence';
import { scopeKey } from './domain';
import { decryptSubscription, PushSender } from './push';
export async function deliverNotificationPush(
  db: PrismaClient,
  sender: PushSender,
  id: string,
) {
  const lease = randomUUID(),
    now = new Date();
  const claimed = await db.notificationDelivery.updateMany({
    where: {
      id,
      status: { in: ['PENDING', 'PROCESSING'] },
      attempts: { lt: 5 },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }],
      nextAttemptAt: { lte: now },
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
      leaseToken: lease,
      leaseUntil: new Date(Date.now() + 30000),
    },
  });
  if (!claimed.count) return;
  const row = await db.notificationDelivery.findUniqueOrThrow({
    where: { id },
    include: { notification: true, subscription: true },
  });
  const own = { id, leaseToken: lease, status: 'PROCESSING' as const };
  const skip = async (code: string) =>
    db.notificationDelivery.updateMany({
      where: own,
      data: {
        status: 'SKIPPED',
        errorCode: code,
        leaseToken: null,
        leaseUntil: null,
      },
    });
  try {
    const sub = row.subscription,
      n = row.notification;
    const p =
      sub.active &&
      sub.userId === n.recipientId &&
      sub.realm === n.realm &&
      sub.tenantId === n.tenantId
        ? await currentSubscriptionPrincipal(db, sub)
        : null;
    if (
      !p ||
      !(await db.notification.findFirst({
        where: { ...notificationWhere(p), id: n.id },
        select: { id: true },
      }))
    ) {
      await skip('RECIPIENT_INACTIVE');
      return;
    }
    const pref = await db.notificationPreference.findUnique({
      where: { userId_scopeKey: { userId: p.userId, scopeKey: scopeKey(p) } },
    });
    if (!pref?.pushEnabled || !pref.categories.includes(n.type)) {
      await skip('PREFERENCE_DISABLED');
      return;
    }
    if (Date.now() - n.createdAt.getTime() > 15 * 60000) {
      await skip('NOTIFICATION_STALE');
      return;
    }
    // Skip business alerts that no longer require an operational action.
    if (n.entityType === 'order' && n.type !== 'ORDER_CANCELLED') {
      const order = await db.order.findFirst({
        where: {
          id: n.entityId,
          tenantId: n.tenantId!,
          branchId: n.branchId!,
          status: 'OPEN',
        },
        select: { id: true },
      });
      if (!order) {
        await skip('ENTITY_NO_LONGER_ACTIONABLE');
        return;
      }
    }
    await sender.send(
      decryptSubscription(sub.encrypted),
      n.id,
      pref.soundEnabled,
    );
    await db.notificationDelivery.updateMany({
      where: own,
      data: {
        status: 'SENT',
        sentAt: new Date(),
        errorCode: null,
        leaseToken: null,
        leaseUntil: null,
      },
    });
  } catch (error) {
    const e = error as { statusCode?: number; permanent?: boolean };
    if (e.statusCode === 404 || e.statusCode === 410) {
      await db.pushSubscription.updateMany({
        where: { id: row.subscriptionId, active: true },
        data: { active: false, encrypted: '', revokedAt: new Date() },
      });
      await skip('SUBSCRIPTION_EXPIRED');
      return;
    }
    const permanent =
        e.permanent ||
        (typeof e.statusCode === 'number' &&
          e.statusCode !== 429 &&
          e.statusCode < 500),
      exhausted = row.attempts >= 5;
    await db.notificationDelivery.updateMany({
      where: own,
      data: {
        status: permanent || exhausted ? 'FAILED' : 'PENDING',
        errorCode: permanent ? 'PUSH_REJECTED' : 'PUSH_TEMPORARY',
        leaseToken: null,
        leaseUntil: null,
        nextAttemptAt: new Date(
          Date.now() + Math.min(60000, 2000 * 2 ** (row.attempts - 1)),
        ),
      },
    });
    if (permanent || exhausted)
      throw new UnrecoverableError('PUSH_DELIVERY_FAILED');
    throw new Error('PUSH_TEMPORARY');
  }
}
