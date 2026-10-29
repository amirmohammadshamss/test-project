import { PrismaClient } from '@prisma/client';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomBytes, randomUUID } from 'node:crypto';
import webPush from 'web-push';
import { redisConnection } from '../src/processor';
import { deliverNotificationPush } from '../../../packages/notifications/src/delivery';
import { encryptSubscription } from '../../../packages/notifications/src/push';
const db = new PrismaClient(),
  name = 'notification-test-' + randomUUID();
const connection = redisConnection();
let queue: Queue<{ deliveryId: string }>,
  events: QueueEvents,
  worker: Worker<{ deliveryId: string }>;
const previous = process.env.PUSH_ENCRYPTION_KEY;
let deliveryId: string, notificationId: string;
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Isolated test DB required');
  process.env.PUSH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  const tenant = await db.restaurant.create({ data: { name: 'Queue test' } }),
    branch = await db.branch.create({
      data: { tenantId: tenant.id, name: 'Queue branch' },
    }),
    user = await db.user.create({
      data: {
        email: randomUUID() + '@queue.test',
        name: 'Waiter',
        passwordHash: 'not-a-login-account',
      },
    }),
    membership = await db.membership.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'WAITER' },
    });
  await db.branchMembership.create({
    data: {
      tenantId: tenant.id,
      membershipId: membership.id,
      branchId: branch.id,
    },
  });
  const session = await db.restaurantSession.create({
    data: {
      userId: user.id,
      membershipId: membership.id,
      branchId: branch.id,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });
  const table = await db.restaurantTable.create({
      data: { tenantId: tenant.id, branchId: branch.id, number: 1 },
    }),
    order = await db.order.create({
      data: { tenantId: tenant.id, branchId: branch.id, tableId: table.id },
    }),
    event = await db.notificationOutbox.create({
      data: {
        dedupeKey: randomUUID(),
        realm: 'RESTAURANT',
        type: 'ITEM_READY',
        tenantId: tenant.id,
        branchId: branch.id,
        entityId: order.id,
        payload: {},
      },
    });
  const notification = await db.notification.create({
    data: {
      realm: 'RESTAURANT',
      tenantId: tenant.id,
      branchId: branch.id,
      membershipId: membership.id,
      recipientId: user.id,
      eventId: event.id,
      type: 'ITEM_READY',
      priority: 'HIGH',
      title: 'خصوصی',
      message: 'محتوای خصوصی سفارش',
      entityType: 'order',
      entityId: order.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });
  notificationId = notification.id;
  await db.notificationPreference.create({
    data: {
      userId: user.id,
      scopeKey: 'restaurant:' + tenant.id,
      pushEnabled: true,
      categories: ['ITEM_READY'],
    },
  });
  const subscription = await db.pushSubscription.create({
    data: {
      endpointHash: randomUUID(),
      encrypted: encryptSubscription({
        endpoint: 'https://fcm.googleapis.com/send/' + randomUUID(),
        keys: {
          p256dh: webPush.generateVAPIDKeys().publicKey,
          auth: randomBytes(16).toString('base64url'),
        },
      }),
      realm: 'RESTAURANT',
      userId: user.id,
      tenantId: tenant.id,
      branchId: branch.id,
      membershipId: membership.id,
      sessionId: session.id,
      deviceLabel: 'Queue fixture',
    },
  });
  deliveryId = (
    await db.notificationDelivery.create({
      data: {
        notificationId: notification.id,
        subscriptionId: subscription.id,
        nextAttemptAt: new Date(0),
      },
    })
  ).id;
  queue = new Queue(name, { connection });
  events = new QueueEvents(name, { connection });
  await events.waitUntilReady();
});
afterAll(async () => {
  await worker?.close();
  await queue?.obliterate({ force: true });
  await events?.close();
  await queue?.close();
  await db.$disconnect();
  if (previous === undefined) delete process.env.PUSH_ENCRYPTION_KEY;
  else process.env.PUSH_ENCRYPTION_KEY = previous;
});
test('actual BullMQ retry is backed by persisted delivery attempts and never recreates inbox rows', async () => {
  const send = jest
    .fn()
    .mockRejectedValueOnce(
      Object.assign(new Error('temporary'), { statusCode: 503 }),
    )
    .mockResolvedValue(undefined);
  worker = new Worker(
    name,
    (job) => deliverNotificationPush(db, { send }, job.data.deliveryId),
    { connection },
  );
  worker.on('error', () => {});
  const job = await queue.add(
    'deliver-web-push',
    { deliveryId },
    {
      jobId: 'delivery-' + deliveryId,
      attempts: 3,
      backoff: { type: 'fixed', delay: 2200 },
    },
  );
  await job.waitUntilFinished(events, 15000);
  expect(send).toHaveBeenCalledTimes(2);
  expect(send.mock.calls[1].slice(1)).toEqual([notificationId, false]);
  expect(
    await db.notificationDelivery.findUnique({ where: { id: deliveryId } }),
  ).toMatchObject({ status: 'SENT', attempts: 2 });
  await queue.add(
    'deliver-web-push',
    { deliveryId },
    { jobId: 'delivery-' + deliveryId },
  );
  await deliverNotificationPush(db, { send }, deliveryId);
  expect(send).toHaveBeenCalledTimes(2);
  expect(await db.notification.count({ where: { id: notificationId } })).toBe(
    1,
  );
});
test('persisted max attempts stop retries even when queue jobs are recreated', async () => {
  const original = await db.notificationDelivery.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { subscription: true },
  });
  const sub = await db.pushSubscription.create({
    data: {
      ...original.subscription,
      id: undefined,
      endpointHash: randomUUID(),
    },
  });
  const delivery = await db.notificationDelivery.create({
    data: {
      notificationId,
      subscriptionId: sub.id,
      nextAttemptAt: new Date(0),
    },
  });
  const send = jest
    .fn()
    .mockRejectedValue(
      Object.assign(new Error('temporary'), { statusCode: 503 }),
    );
  for (let n = 0; n < 5; n++) {
    await db.notificationDelivery.update({
      where: { id: delivery.id },
      data: { nextAttemptAt: new Date(0) },
    });
    await expect(
      deliverNotificationPush(db, { send }, delivery.id),
    ).rejects.toThrow(n === 4 ? 'PUSH_DELIVERY_FAILED' : 'PUSH_TEMPORARY');
  }
  await deliverNotificationPush(db, { send }, delivery.id);
  expect(send).toHaveBeenCalledTimes(5);
  expect(
    await db.notificationDelivery.findUnique({ where: { id: delivery.id } }),
  ).toMatchObject({ status: 'FAILED', attempts: 5 });
});
