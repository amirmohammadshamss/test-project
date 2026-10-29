import { PrismaClient } from '@prisma/client';
import {
  eligibleTypes,
  scopeKey,
  NotificationPrincipal,
} from '../../../../../../packages/notifications/src/domain';
import {
  notificationWhere,
  subscriptionWhere,
  currentSubscriptionPrincipal,
} from '../../../../../../packages/notifications/src/persistence';
import {
  validatePushSubscription,
  encryptSubscription,
  endpointHash,
  BrowserPushSubscription,
} from '../../../../../../packages/notifications/src/push';
import { BusinessError } from '../../orders/domain/rules';
import { RealtimeEventPublisher } from '../../../common/application/realtime';
import {
  NotificationRepository,
  InboxQuery,
  PreferencesInput,
} from '../application';
const devicesSelect = {
  id: true,
  deviceLabel: true,
  active: true,
  createdAt: true,
  updatedAt: true,
} as const;
export class PrismaNotificationRepository extends NotificationRepository {
  constructor(
    private readonly db: PrismaClient,
    private readonly events: RealtimeEventPublisher,
  ) {
    super();
  }
  async deliveryHealth(p: NotificationPrincipal) {
    if (p.realm !== 'PLATFORM') throw new BusinessError('FORBIDDEN', 403);
    const statuses = [
      'PENDING',
      'PROCESSING',
      'SENT',
      'FAILED',
      'SKIPPED',
    ] as const;
    const values = await this.db.$transaction([
      this.db.notificationOutbox.count({
        where: { processedAt: null, failedAt: null },
      }),
      this.db.notificationOutbox.count({ where: { failedAt: { not: null } } }),
      ...statuses.map((status) =>
        this.db.notificationDelivery.count({ where: { status } }),
      ),
    ]);
    return {
      outbox: { pending: values[0], failed: values[1] },
      deliveries: statuses.map((status, i) => ({
        status,
        count: values[i + 2],
      })),
      checkedAt: new Date(),
    };
  }
  private hint(p: NotificationPrincipal, id?: string) {
    void (
      id
        ? this.events.publishNotification(id, 'updated')
        : this.events.publishInboxChanged(p)
    ).catch(() => {});
  }
  async list(p: NotificationPrincipal, q: InboxQuery) {
    const where = {
      ...notificationWhere(p),
      ...(q.unread ? { readAt: null } : {}),
    };
    const [items, total] = await this.db.$transaction([
      this.db.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.db.notification.count({ where }),
    ]);
    return { items, total, page: q.page, pages: Math.ceil(total / q.pageSize) };
  }
  async count(p: NotificationPrincipal) {
    return {
      count: await this.db.notification.count({
        where: { ...notificationWhere(p), readAt: null },
      }),
    };
  }
  async mark(p: NotificationPrincipal, id: string, ack: boolean) {
    const where = { ...notificationWhere(p), id };
    const found = await this.db.notification.findFirst({ where });
    if (!found) throw new BusinessError('NOT_FOUND', 404);
    if (ack && found.priority !== 'HIGH')
      throw new BusinessError('ACKNOWLEDGMENT_NOT_REQUIRED', 400);
    await this.db.notification.updateMany({
      where: {
        ...where,
        ...(ack ? { acknowledgedAt: null } : { readAt: null }),
      },
      data: {
        ...(ack ? { acknowledgedAt: new Date() } : { readAt: new Date() }),
        version: { increment: 1 },
      },
    });
    this.hint(p, id);
    return this.db.notification.findFirst({ where });
  }
  async readAll(p: NotificationPrincipal) {
    const at = new Date();
    const updated = await this.db.notification.updateMany({
      where: { ...notificationWhere(p), readAt: null, createdAt: { lte: at } },
      data: { readAt: at, version: { increment: 1 } },
    });
    this.hint(p);
    return { updated: updated.count };
  }
  async preferences(p: NotificationPrincipal) {
    const pref = await this.db.notificationPreference.findUnique({
      where: { userId_scopeKey: { userId: p.userId, scopeKey: scopeKey(p) } },
    });
    const categories = eligibleTypes({ ...p, tenantStatus: 'ACTIVE' });
    return {
      pushEnabled: pref?.pushEnabled || false,
      soundEnabled: pref?.soundEnabled || false,
      includeLow: pref?.includeLow ?? true,
      categories: pref?.categories || categories,
      availableCategories: categories,
      pushAvailable:
        process.env.WEB_PUSH_ENABLED === 'true' &&
        Boolean(
          process.env.VAPID_PUBLIC_KEY && process.env.PUSH_ENCRYPTION_KEY,
        ),
      publicVapidKey:
        process.env.WEB_PUSH_ENABLED === 'true'
          ? process.env.VAPID_PUBLIC_KEY || null
          : null,
    };
  }
  async savePreferences(p: NotificationPrincipal, x: PreferencesInput) {
    if (
      x.categories.some(
        (t) => !eligibleTypes({ ...p, tenantStatus: 'ACTIVE' }).includes(t),
      )
    )
      throw new BusinessError('INVALID_NOTIFICATION_CATEGORY', 400);
    await this.db.notificationPreference.upsert({
      where: { userId_scopeKey: { userId: p.userId, scopeKey: scopeKey(p) } },
      create: { userId: p.userId, scopeKey: scopeKey(p), ...x },
      update: x,
    });
    return this.preferences(p);
  }
  async devices(p: NotificationPrincipal) {
    const rows = await this.db.pushSubscription.findMany({
      where: subscriptionWhere(p),
      select: { ...devicesSelect, sessionId: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return rows.map(({ sessionId, ...device }) => ({
      ...device,
      currentSession: sessionId === p.sessionId,
    }));
  }
  async register(
    p: NotificationPrincipal,
    x: BrowserPushSubscription,
    label: string,
  ) {
    if (
      process.env.WEB_PUSH_ENABLED !== 'true' ||
      !process.env.VAPID_PUBLIC_KEY ||
      !process.env.PUSH_ENCRYPTION_KEY
    )
      throw new BusinessError('PUSH_NOT_CONFIGURED', 503);
    let normalized: BrowserPushSubscription, encrypted: string;
    try {
      normalized = validatePushSubscription(x);
      encrypted = encryptSubscription(normalized);
    } catch {
      throw new BusinessError('INVALID_PUSH_SUBSCRIPTION', 400);
    }
    const hash = endpointHash(normalized.endpoint);
    return this.db.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${hash},0))`;
      const old = await tx.pushSubscription.findUnique({
        where: { endpointHash: hash },
      });
      if (
        old?.active &&
        (old.userId !== p.userId ||
          old.realm !== p.realm ||
          old.tenantId !== (p.tenantId || null) ||
          old.branchId !== (p.branchId || null)) &&
        (await currentSubscriptionPrincipal(tx, old))
      )
        throw new BusinessError('PUSH_SUBSCRIPTION_IN_USE');
      if (
        (await tx.pushSubscription.count({
          where: {
            ...subscriptionWhere(p),
            active: true,
            endpointHash: { not: hash },
          },
        })) >= 10
      )
        throw new BusinessError('PUSH_DEVICE_LIMIT');
      return tx.pushSubscription.upsert({
        where: { endpointHash: hash },
        create: {
          endpointHash: hash,
          encrypted,
          realm: p.realm,
          userId: p.userId,
          tenantId: p.tenantId,
          branchId: p.branchId,
          membershipId: p.membershipId,
          platformAdminId: p.platformAdminId,
          sessionId: p.sessionId,
          deviceLabel: label,
          active: true,
        },
        update: {
          encrypted,
          realm: p.realm,
          userId: p.userId,
          tenantId: p.tenantId || null,
          branchId: p.branchId || null,
          membershipId: p.membershipId || null,
          platformAdminId: p.platformAdminId || null,
          sessionId: p.sessionId,
          deviceLabel: label,
          active: true,
          revokedAt: null,
        },
        select: devicesSelect,
      });
    });
  }
  async remove(p: NotificationPrincipal, id: string) {
    const where = { ...subscriptionWhere(p), id };
    if (
      !(await this.db.pushSubscription.findFirst({
        where,
        select: { id: true },
      }))
    )
      throw new BusinessError('NOT_FOUND', 404);
    await this.db.pushSubscription.updateMany({
      where,
      data: { active: false, encrypted: '', revokedAt: new Date() },
    });
    return { ok: true };
  }
}
