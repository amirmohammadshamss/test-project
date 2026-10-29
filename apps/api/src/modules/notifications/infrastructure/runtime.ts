import {
  Injectable,
  Inject,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { prisma } from '../../../../../../packages/database/src/client';
import {
  dispatchNotificationOutbox,
  notificationMaintenance,
  recordNotificationEvent,
} from '../../../../../../packages/notifications/src/persistence';
import { RealtimeEventPublisher } from '../../../common/application/realtime';
import { PlatformMonitoring } from '../../platform-admin/monitoring';
@Injectable()
export class NotificationRuntime implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  private lastMaintenance = Date.now();
  private lastMonitor = Date.now();
  constructor(
    @Inject(RealtimeEventPublisher)
    private readonly events: RealtimeEventPublisher,
  ) {}
  onModuleInit() {
    if (
      process.env.NODE_ENV === 'test' &&
      process.env.NOTIFICATIONS_RUN_IN_TEST !== 'true'
    )
      return;
    this.timer = setInterval(() => {
      if (!this.running)
        this.running = this.dispatchOnce()
          .catch(() =>
            console.error(
              JSON.stringify({
                level: 'warn',
                module: 'notifications',
                errorCode: 'DISPATCH_DEFERRED',
              }),
            ),
          )
          .finally(() => {
            this.running = undefined;
          });
    }, 1000);
    this.timer.unref();
  }
  async dispatchOnce() {
    const notifications = await dispatchNotificationOutbox(prisma);
    for (const n of notifications)
      try {
        await this.events.publishNotification(n.id, 'created');
      } catch {
        console.error(
          JSON.stringify({
            level: 'warn',
            module: 'notifications',
            errorCode: 'SOCKET_HINT_FAILED',
            notificationId: n.id,
          }),
        );
      }
    if (Date.now() - this.lastMaintenance > 60000) {
      this.lastMaintenance = Date.now();
      await notificationMaintenance(prisma);
    }
    if (Date.now() - this.lastMonitor > 30000) {
      this.lastMonitor = Date.now();
      await this.monitor();
    }
  }
  async monitor() {
    const health = await new PlatformMonitoring().health();
    if (health.database !== 'ready') return; // An unavailable database needs an independent external alerting channel.
    const unhealthy = health.redis !== 'ready' || !health.worker.available;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended('notification-platform-health',0))`;
      const old = await tx.notificationMonitorState.findUnique({
        where: { key: 'platform-health' },
      });
      await tx.notificationMonitorState.upsert({
        where: { key: 'platform-health' },
        create: { key: 'platform-health', unhealthy },
        update: { unhealthy },
      });
      if (unhealthy && !old?.unhealthy)
        await recordNotificationEvent(tx, {
          dedupeKey: 'platform-health:' + randomUUID(),
          realm: 'PLATFORM',
          type: 'PLATFORM_ISSUE',
          entityId: '00000000-0000-4000-8000-000000000001',
          payload: {
            redis: health.redis,
            workerAvailable: health.worker.available,
          },
        });
    });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
  }
}
