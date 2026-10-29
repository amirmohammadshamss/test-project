import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import type { PrismaClient } from '@prisma/client';
import { deliverNotificationPush } from '../../../packages/notifications/src/delivery';
import {
  WebPushSender,
  PushSender,
} from '../../../packages/notifications/src/push';
import { redisConnection } from './processor';
export const notificationQueue = 'notification-delivery';
export async function enqueueNotificationDeliveries(
  db: PrismaClient,
  queue: Queue<{ deliveryId: string }>,
) {
  await db.notificationDelivery.updateMany({
    where: {
      status: 'PROCESSING',
      attempts: { gte: 5 },
      leaseUntil: { lt: new Date() },
    },
    data: {
      status: 'FAILED',
      errorCode: 'DELIVERY_ATTEMPTS_EXHAUSTED',
      leaseUntil: null,
      leaseToken: null,
    },
  });
  const rows = await db.notificationDelivery.findMany({
    where: {
      status: { in: ['PENDING', 'PROCESSING'] },
      attempts: { lt: 5 },
      nextAttemptAt: { lte: new Date() },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: [
      { notification: { priority: 'desc' } },
      { createdAt: 'asc' },
      { id: 'asc' },
    ],
    take: 100,
    select: { id: true, notification: { select: { priority: true } } },
  });
  for (const row of rows) {
    const id = 'delivery-' + row.id,
      old = await queue.getJob(id);
    if (old) {
      const state = await old.getState();
      if (state === 'completed' || state === 'failed') await old.remove();
      else continue;
    }
    await queue.add(
      'deliver-web-push',
      { deliveryId: row.id },
      {
        jobId: id,
        priority:
          row.notification.priority === 'HIGH'
            ? 1
            : row.notification.priority === 'MEDIUM'
              ? 5
              : 10,
        attempts: 5,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    );
  }
}
export class NotificationWorkerRuntime
  implements OnModuleInit, OnModuleDestroy
{
  private queue!: Queue<{ deliveryId: string }>;
  private worker!: Worker<{ deliveryId: string }>;
  private timer?: ReturnType<typeof setInterval>;
  private dispatching?: Promise<void>;
  constructor(
    private readonly db: PrismaClient,
    private readonly sender: PushSender = new WebPushSender(),
    private readonly name = notificationQueue,
  ) {}
  onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(this.name, {
      connection: { ...connection, maxRetriesPerRequest: 1 },
    });
    this.queue.on('error', () => {});
    this.worker = new Worker(
      this.name,
      (job) =>
        deliverNotificationPush(this.db, this.sender, job.data.deliveryId),
      { connection, concurrency: 4, lockDuration: 30000 },
    );
    this.worker.on('error', () =>
      console.error(
        JSON.stringify({
          module: 'notification-worker',
          errorCode: 'QUEUE_UNAVAILABLE',
        }),
      ),
    );
    this.worker.on('failed', (job) =>
      console.error(
        JSON.stringify({
          module: 'notification-worker',
          errorCode: 'DELIVERY_ATTEMPT_FAILED',
          jobId: job?.id,
        }),
      ),
    );
    this.timer = setInterval(() => this.dispatch(), 2000);
    this.dispatch();
  }
  private dispatch() {
    if (this.dispatching) return;
    this.dispatching = enqueueNotificationDeliveries(this.db, this.queue)
      .catch(() =>
        console.error(
          JSON.stringify({
            module: 'notification-worker',
            errorCode: 'DISPATCH_DEFERRED',
          }),
        ),
      )
      .finally(() => {
        this.dispatching = undefined;
      });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.dispatching;
    await this.worker.close();
    await this.queue.close();
  }
}
