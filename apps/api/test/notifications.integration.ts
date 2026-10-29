import 'reflect-metadata';
import { randomUUID, randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import webPush from 'web-push';
import { processDraft } from '../../worker/src/processor';
import { PermanentFailure } from '../../worker/src/provider';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
import { hashPassword } from '../../../packages/database/src/password';
import {
  notificationMaintenance,
  processNotificationEvent,
  recordNotificationEvent,
} from '../../../packages/notifications/src/persistence';
import { deliverNotificationPush } from '../../../packages/notifications/src/delivery';
import {
  PushSender,
  encryptSubscription,
} from '../../../packages/notifications/src/push';
import { RestaurantEventsGateway } from '../src/modules/realtime/restaurant-events.gateway';
let app: INestApplication,
  tenantId: string,
  branchId: string,
  menuItemId: string,
  url: string,
  waiterId: string,
  kitchenId: string,
  managerId: string,
  platformId: string;
const cookies: Record<string, string> = {},
  password = 'Notifications-Test-2026!',
  emailPrefix = randomUUID(),
  sockets: Socket[] = [];
const encryption = process.env.PUSH_ENCRYPTION_KEY,
  pushEnabled = process.env.WEB_PUSH_ENABLED,
  publicKey = process.env.VAPID_PUBLIC_KEY;
function call(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  role = 'manager',
  key = randomUUID(),
) {
  const server = request(app.getHttpServer());
  return server[method]('/api/v1' + path)
    .set('Cookie', cookies[role] || '')
    .set('X-CSRF-Protection', '1')
    .set('Idempotency-Key', key);
}
async function open() {
  const table = await prisma.restaurantTable.create({
    data: {
      tenantId,
      branchId,
      number: 10000000 + Math.floor(Math.random() * 100000000),
    },
  });
  return (
    await call('post', '/orders', 'waiter')
      .send({ tableId: table.id })
      .expect(201)
  ).body;
}
async function add(id: string) {
  return (
    await call('post', `/orders/${id}/items`, 'waiter')
      .send({ menuItemId, quantity: 1 })
      .expect(201)
  ).body;
}
async function eventFor(
  id: string,
  type: 'NEW_ORDER' | 'ITEM_READY' | 'ORDER_CANCELLED' | 'PREPARATION_CHANGED',
) {
  return prisma.notificationOutbox.findFirstOrThrow({
    where: {
      entityId: id,
      type,
      ...(type === 'NEW_ORDER'
        ? { payload: { path: ['actionable'], equals: true } }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
  });
}
async function notify(id: string) {
  const notifications = await processNotificationEvent(prisma, id);
  for (const n of notifications)
    await app.get(RestaurantEventsGateway).publishNotification(n.id, 'created');
  return notifications;
}
async function connect(role: string, platform = false): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url + (platform ? '/platform-notifications' : ''), {
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: {
        Cookie: cookies[role],
        Origin: platform
          ? process.env.PLATFORM_ORIGIN || 'http://localhost:3001'
          : process.env.WEB_ORIGIN || 'http://localhost:3000',
      },
    });
    sockets.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', reject);
  });
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Isolated DB required');
  process.env.PUSH_ENCRYPTION_KEY = randomBytes(32).toString('base64');
  process.env.WEB_PUSH_ENABLED = 'true';
  process.env.VAPID_PUBLIC_KEY = webPush.generateVAPIDKeys().publicKey;
  const tenant = await prisma.restaurant.create({
    data: { name: 'Notifications ' + emailPrefix },
  });
  tenantId = tenant.id;
  const branch = await prisma.branch.create({
    data: { tenantId, name: 'Main' },
  });
  branchId = branch.id;
  const category = await prisma.category.create({
    data: { tenantId, name: 'نوشیدنی' },
  });
  menuItemId = (
    await prisma.menuItem.create({
      data: {
        tenantId,
        categoryId: category.id,
        name: 'لیموناد',
        description: 'نمونه',
        priceRial: 100000,
      },
    })
  ).id;
  for (const role of ['MANAGER', 'WAITER', 'KITCHEN'] as const) {
    const user = await prisma.user.create({
      data: {
        email: role.toLowerCase() + '-' + emailPrefix + '@test.example',
        name: role,
        passwordHash: await hashPassword(password),
      },
    });
    if (role === 'MANAGER') managerId = user.id;
    if (role === 'WAITER') waiterId = user.id;
    if (role === 'KITCHEN') kitchenId = user.id;
    const m = await prisma.membership.create({
      data: { tenantId, userId: user.id, role },
    });
    await prisma.branchMembership.create({
      data: { tenantId, membershipId: m.id, branchId },
    });
  }
  const operator = await prisma.user.create({
    data: {
      email: 'platform-' + emailPrefix + '@test.example',
      name: 'Platform',
      passwordHash: await hashPassword(password),
      platformAdmin: { create: {} },
    },
  });
  platformId = operator.id;
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  url = 'http://127.0.0.1:' + app.getHttpServer().address().port;
  for (const role of ['manager', 'waiter', 'kitchen']) {
    const r = await call('post', '/auth/login', role)
      .send({ email: role + '-' + emailPrefix + '@test.example', password })
      .expect(200);
    cookies[role] = r.headers['set-cookie'][0].split(';')[0];
  }
  const p = await call('post', '/platform/auth/login')
    .send({ email: 'platform-' + emailPrefix + '@test.example', password })
    .expect(200);
  cookies.platform = p.headers['set-cookie'][0].split(';')[0];
  const foreign = await call('post', '/auth/login')
    .send({
      email: 'other@demo.restaurantos.test',
      password: process.env.SEED_DEMO_PASSWORD,
    })
    .expect(200);
  cookies.foreign = foreign.headers['set-cookie'][0].split(';')[0];
});
afterAll(async () => {
  for (const s of sockets) s.disconnect();
  await app?.close();
  await prisma.$disconnect();
  for (const [key, value] of [
    ['PUSH_ENCRYPTION_KEY', encryption],
    ['WEB_PUSH_ENABLED', pushEnabled],
    ['VAPID_PUBLIC_KEY', publicKey],
  ]) {
    if (value === undefined) delete process.env[key!];
    else process.env[key!] = value;
  }
});
test('business state and outbox commit together, empty tables do not alert kitchen, replay deduplicates recipients', async () => {
  const o = await open();
  const opened = await prisma.notificationOutbox.findFirstOrThrow({
    where: { entityId: o.id, type: 'NEW_ORDER' },
  });
  expect(await notify(opened.id)).toEqual([]);
  await add(o.id);
  const event = await eventFor(o.id, 'NEW_ORDER');
  const rows = await Promise.all([notify(event.id), notify(event.id)]);
  expect(rows.flat()).toHaveLength(1);
  expect(
    await prisma.notification.count({ where: { eventId: event.id } }),
  ).toBe(1);
  expect(rows.flat()[0]).toMatchObject({
    recipientId: kitchenId,
    tenantId,
    branchId,
    priority: 'HIGH',
  });
  const failed = await call('post', `/orders/${o.id}/items`, 'waiter')
    .send({ menuItemId, quantity: 0 })
    .expect(400);
  expect(failed.status).toBe(400);
  expect(
    await prisma.notificationOutbox.count({
      where: { entityId: o.id, type: 'NEW_ORDER' },
    }),
  ).toBe(2);
});
test('history, read and acknowledgment require the recipient and never serve an order', async () => {
  const o = await add((await open()).id),
    event = await eventFor(o.id, 'NEW_ORDER'),
    [n] = await notify(event.id);
  await call('patch', `/notifications/${n.id}/read`, 'waiter').expect(404);
  await call('patch', `/notifications/${n.id}/read`, 'foreign').expect(404);
  await call('patch', `/notifications/${n.id}/read`, 'platform').expect(401);
  const first = await call(
    'patch',
    `/notifications/${n.id}/read`,
    'kitchen',
  ).expect(200);
  const second = await call(
    'patch',
    `/notifications/${n.id}/read`,
    'kitchen',
  ).expect(200);
  expect(second.body.readAt).toBe(first.body.readAt);
  expect(second.body.version).toBe(first.body.version);
  const ack = await call(
    'post',
    `/notifications/${n.id}/acknowledge`,
    'kitchen',
  ).expect(201);
  expect(ack.body.acknowledgedAt).toBeTruthy();
  expect(
    await prisma.orderItem.findFirst({ where: { orderId: o.id } }),
  ).toMatchObject({ status: 'PENDING' });
  const list = await call('get', '/notifications?pageSize=1', 'kitchen').expect(
    200,
  );
  expect(list.body.items).toHaveLength(1);
  const foreign = await call('get', '/notifications', 'foreign').expect(200);
  expect(foreign.body.items.some((x: { id: string }) => x.id === n.id)).toBe(
    false,
  );
});
test('ready events address hall staff while cancellation and preparation changes address kitchen', async () => {
  let o = await add((await open()).id);
  const item = o.items[0];
  await call('patch', `/kitchen/items/${item.id}/status`, 'kitchen')
    .send({ version: 1, status: 'PREPARING' })
    .expect(200);
  await add(o.id);
  const changed = await eventFor(o.id, 'PREPARATION_CHANGED');
  expect((await notify(changed.id))[0].recipientId).toBe(kitchenId);
  await call('patch', `/kitchen/items/${item.id}/status`, 'kitchen')
    .send({ version: 2, status: 'READY' })
    .expect(200);
  const ready = await eventFor(o.id, 'ITEM_READY');
  expect((await notify(ready.id))[0].recipientId).toBe(waiterId);
  const current = await call('get', `/orders/${o.id}`);
  o = current.body;
  await call('post', `/orders/${o.id}/cancel`)
    .send({ version: o.version, reason: 'Owner cancelled' })
    .expect(201);
  const cancel = await eventFor(o.id, 'ORDER_CANCELLED');
  expect((await notify(cancel.id))[0].recipientId).toBe(kitchenId);
});
test('private Socket.IO hints reach the recipient only and platform uses a separate namespace', async () => {
  const kitchen = await connect('kitchen'),
    waiter = await connect('waiter');
  const seen: string[] = [];
  waiter.on('notification:created', (x: { notificationId: string }) =>
    seen.push(x.notificationId),
  );
  const o = await add((await open()).id),
    e = await eventFor(o.id, 'NEW_ORDER');
  const waiting = new Promise<{ notificationId: string }>((resolve) =>
    kitchen.once('notification:created', resolve),
  );
  const [n] = await notify(e.id);
  expect((await waiting).notificationId).toBe(n.id);
  expect(seen).not.toContain(n.id);
  const platform = await connect('platform', true);
  const event = await prisma.$transaction((tx) =>
    recordNotificationEvent(tx, {
      dedupeKey: 'issue:' + randomUUID(),
      realm: 'PLATFORM',
      type: 'PLATFORM_ISSUE',
      entityId: randomUUID(),
    }),
  );
  const pWaiting = new Promise<{ notificationId: string }>((resolve) =>
    platform.once('notification:created', resolve),
  );
  const notices = await notify(event.id);
  const own = notices.find((x) => x.recipientId === platformId)!;
  expect((await pWaiting).notificationId).toBe(own.id);
  await call('get', '/platform/notifications', 'kitchen').expect(401);
  const list = await call('get', '/platform/notifications', 'platform').expect(
    200,
  );
  expect(
    list.body.items.every((x: { realm: string }) => x.realm === 'PLATFORM'),
  ).toBe(true);
});
test('preferences and encrypted device registration are scoped and private', async () => {
  const prefs = await call(
    'get',
    '/notifications/preferences',
    'kitchen',
  ).expect(200);
  await call('patch', '/notifications/preferences', 'kitchen')
    .send({
      pushEnabled: true,
      soundEnabled: false,
      includeLow: false,
      categories: prefs.body.availableCategories,
    })
    .expect(200);
  const keys = {
      p256dh: webPush.generateVAPIDKeys().publicKey,
      auth: randomBytes(16).toString('base64url'),
    },
    endpoint = 'https://fcm.googleapis.com/send/' + randomUUID();
  await call('post', '/push/subscriptions', 'kitchen')
    .send({ endpoint: 'https://127.0.0.1/push', keys, deviceLabel: 'Invalid' })
    .expect(400);
  const registered = await call('post', '/push/subscriptions', 'kitchen')
    .send({ endpoint, keys, deviceLabel: 'Kitchen tablet' })
    .expect(201);
  expect(JSON.stringify(registered.body)).not.toContain(endpoint);
  const saved = await prisma.pushSubscription.findUniqueOrThrow({
    where: { id: registered.body.id },
  });
  expect(saved.encrypted).not.toContain(endpoint);
  await call('delete', '/push/subscriptions/' + saved.id, 'waiter').expect(404);
  const devices = await call('get', '/push/subscriptions', 'kitchen').expect(
    200,
  );
  expect(JSON.stringify(devices.body)).not.toMatch(
    /endpointHash|encrypted|p256dh|auth/,
  );
  const o = await add((await open()).id),
    e = await eventFor(o.id, 'NEW_ORDER');
  await notify(e.id);
  expect(
    await prisma.notificationDelivery.count({
      where: { subscriptionId: saved.id },
    }),
  ).toBeGreaterThan(0);
  await call('delete', '/push/subscriptions/' + saved.id, 'kitchen').expect(
    200,
  );
  await call('delete', '/push/subscriptions/' + saved.id, 'kitchen').expect(
    200,
  );
});
test('push retries are bounded, expired subscriptions are disabled, payload boundary contains no order text', async () => {
  const ctx = await call('get', '/notifications/context', 'waiter').expect(200);
  await call('patch', '/notifications/preferences', 'waiter')
    .send({
      pushEnabled: true,
      soundEnabled: false,
      includeLow: true,
      categories: ['ITEM_READY'],
    })
    .expect(200);
  const o = await add((await open()).id),
    item = o.items[0];
  for (const [i, status] of ['PREPARING', 'READY'].entries())
    await call('patch', `/kitchen/items/${item.id}/status`, 'kitchen')
      .send({ version: i + 1, status })
      .expect(200);
  const keys = {
    p256dh: webPush.generateVAPIDKeys().publicKey,
    auth: randomBytes(16).toString('base64url'),
  };
  const sub = await prisma.pushSubscription.create({
    data: {
      endpointHash: randomUUID(),
      encrypted: encryptSubscription({
        endpoint: 'https://fcm.googleapis.com/send/' + randomUUID(),
        keys,
      }),
      realm: 'RESTAURANT',
      userId: waiterId,
      tenantId,
      branchId,
      membershipId: ctx.body.membershipId,
      sessionId: ctx.body.sessionId,
      deviceLabel: 'Retry device',
    },
  });
  const e = await eventFor(o.id, 'ITEM_READY');
  const [n] = await notify(e.id);
  const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
    where: {
      notificationId_subscriptionId: {
        notificationId: n.id,
        subscriptionId: sub.id,
      },
    },
  });
  const sender: PushSender = {
    send: jest
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('temporary private response'), {
          statusCode: 503,
        }),
      )
      .mockResolvedValue(undefined),
  };
  await expect(
    deliverNotificationPush(prisma, sender, delivery.id),
  ).rejects.toThrow('PUSH_TEMPORARY');
  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await deliverNotificationPush(prisma, sender, delivery.id);
  expect(
    await prisma.notificationDelivery.findUnique({
      where: { id: delivery.id },
    }),
  ).toMatchObject({ status: 'SENT', attempts: 2 });
  expect((sender.send as jest.Mock).mock.calls[1].slice(1)).toEqual([
    n.id,
    false,
  ]);
  const expired = await prisma.notificationDelivery.create({
    data: {
      notificationId: n.id,
      nextAttemptAt: new Date(0),
      subscriptionId: (
        await prisma.pushSubscription.create({
          data: {
            ...sub,
            id: undefined,
            endpointHash: randomUUID(),
            deviceLabel: 'Expired',
          },
        })
      ).id,
    },
  });
  await deliverNotificationPush(
    prisma,
    {
      send: async () => {
        throw Object.assign(new Error('gone'), { statusCode: 410 });
      },
    },
    expired.id,
  );
  expect(
    await prisma.pushSubscription.findUnique({
      where: { id: expired.subscriptionId },
    }),
  ).toMatchObject({ active: false });
});
test('suspended managers can read only their suspension notice while ordinary restaurant routes stay blocked', async () => {
  const tenant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: tenantId },
  });
  const suspended = await call(
    'post',
    `/platform/restaurants/${tenantId}/suspend`,
    'platform',
  )
    .send({ version: tenant.version, reason: 'Notification test suspension' })
    .expect(201);
  const event = await prisma.notificationOutbox.findFirstOrThrow({
    where: { tenantId, type: 'TENANT_SUSPENDED' },
    orderBy: { createdAt: 'desc' },
  });
  try {
    const limited = await connect('manager');
    const delivered = new Promise<{ notificationId: string }>((resolve) =>
      limited.once('notification:created', resolve),
    );
    const notices = await notify(event.id);
    expect((await delivered).notificationId).toBe(
      notices.find((n) => n.recipientId === managerId)!.id,
    );
    expect(notices.some((n) => n.recipientId === managerId)).toBe(true);
    await call('get', '/orders').expect(403);
    const list = await call('get', '/notifications').expect(200);
    expect(
      list.body.items.every(
        (n: { type: string }) => n.type === 'TENANT_SUSPENDED',
      ),
    ).toBe(true);
    await call('get', '/notifications', 'waiter').expect(403);
  } finally {
    await call('post', `/platform/restaurants/${tenantId}/activate`, 'platform')
      .send({ version: suspended.body.version, reason: 'Restored after test' })
      .expect(201);
  }
});

test('outbox rollback is atomic and an unavailable Redis address does not prevent committed inbox history', async () => {
  const key = 'rollback:' + randomUUID();
  await expect(
    prisma.$transaction(async (tx) => {
      await recordNotificationEvent(tx, {
        dedupeKey: key,
        realm: 'RESTAURANT',
        type: 'AI_FAILED',
        tenantId,
        entityId: randomUUID(),
        payload: { actorId: managerId },
      });
      throw new Error('ABORT');
    }),
  ).rejects.toThrow('ABORT');
  expect(
    await prisma.notificationOutbox.count({ where: { dedupeKey: key } }),
  ).toBe(0);
  const previous = process.env.REDIS_URL;
  try {
    process.env.REDIS_URL = 'redis://127.0.0.1:1';
    const o = await add((await open()).id),
      e = await eventFor(o.id, 'NEW_ORDER');
    expect((await notify(e.id))[0].recipientId).toBe(kitchenId);
    expect(await prisma.order.count({ where: { id: o.id } })).toBe(1);
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});
test('session logout deactivates push devices and revoked recipients are skipped by delivery', async () => {
  const login = await call('post', '/auth/login', 'waiter')
    .send({ email: 'waiter-' + emailPrefix + '@test.example', password })
    .expect(200);
  cookies.device = login.headers['set-cookie'][0].split(';')[0];
  const ctx = await call('get', '/notifications/context', 'device');
  const o = await add((await open()).id),
    item = o.items[0];
  for (const [i, status] of ['PREPARING', 'READY'].entries())
    await call('patch', `/kitchen/items/${item.id}/status`, 'kitchen')
      .send({ version: i + 1, status })
      .expect(200);
  const keys = {
    p256dh: webPush.generateVAPIDKeys().publicKey,
    auth: randomBytes(16).toString('base64url'),
  };
  const sub = await call('post', '/push/subscriptions', 'device')
    .send({
      endpoint: 'https://fcm.googleapis.com/send/' + randomUUID(),
      keys,
      deviceLabel: 'Logout device',
    })
    .expect(201);
  const e = await eventFor(o.id, 'ITEM_READY'),
    [notice] = await notify(e.id);
  const delivery = await prisma.notificationDelivery.findUniqueOrThrow({
    where: {
      notificationId_subscriptionId: {
        notificationId: notice.id,
        subscriptionId: sub.body.id,
      },
    },
  });
  await call('post', '/auth/logout', 'device').expect(200);
  expect(
    await prisma.pushSubscription.findUnique({ where: { id: sub.body.id } }),
  ).toMatchObject({ active: false });
  const sender = { send: jest.fn().mockResolvedValue(undefined) };
  await prisma.notificationDelivery.update({
    where: { id: delivery.id },
    data: { nextAttemptAt: new Date(0) },
  });
  await deliverNotificationPush(prisma, sender, delivery.id);
  expect(sender.send).not.toHaveBeenCalled();
  expect(
    (
      await prisma.notificationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).status,
  ).toBe('SKIPPED');
  expect(ctx.body.sessionId).toBeTruthy();
});

test('platform delivery monitoring exposes aggregates only', async () => {
  const health = await call(
    'get',
    '/platform/notifications/delivery-health',
    'platform',
  ).expect(200);
  expect(health.body.outbox).toHaveProperty('pending');
  expect(Array.isArray(health.body.deliveries)).toBe(true);
  expect(JSON.stringify(health.body)).not.toMatch(
    /encrypted|endpoint|recipientId|message/,
  );
  await call(
    'get',
    '/platform/notifications/delivery-health',
    'manager',
  ).expect(401);
});

test('terminal AI failures notify only the requesting manager, not other managers', async () => {
  const second = await prisma.user.create({
    data: {
      email: randomUUID() + '@manager.test',
      name: 'Second manager',
      passwordHash: 'not-a-login',
    },
  });
  const membership = await prisma.membership.create({
    data: { tenantId, userId: second.id, role: 'MANAGER' },
  });
  await prisma.branchMembership.create({
    data: { tenantId, membershipId: membership.id, branchId },
  });
  const draft = await call('post', '/ai/menu-drafts')
    .send({ input: 'پیش‌نویس آزمایشی با قیمت مشخص' })
    .expect(201);
  await expect(
    processDraft(
      prisma,
      {
        parse: async () => {
          throw new PermanentFailure('AI_INVALID_OUTPUT');
        },
      },
      { tenantId, draftId: draft.body.id },
    ),
  ).rejects.toThrow();
  const source = await prisma.notificationOutbox.findUniqueOrThrow({
    where: { dedupeKey: 'ai-failed:' + draft.body.id },
  });
  const notices = await notify(source.id);
  expect(notices.map((n) => n.recipientId)).toEqual([managerId]);
  expect(await notify(source.id)).toEqual([]);
});
test('delayed-order scheduling is stable per order and retention removes expired inbox records', async () => {
  const order = await add((await open()).id);
  await prisma.order.update({
    where: { id: order.id },
    data: { createdAt: new Date(Date.now() - 31 * 60000) },
  });
  await notificationMaintenance(prisma, tenantId);
  const source = await prisma.notificationOutbox.findUniqueOrThrow({
    where: { dedupeKey: 'order-delayed:' + order.id },
  });
  const notices = await notify(source.id);
  expect(
    notices.some(
      (n) => n.recipientId === managerId && n.type === 'ORDER_DELAYED',
    ),
  ).toBe(true);
  await notificationMaintenance(prisma, tenantId);
  expect(
    await prisma.notificationOutbox.count({
      where: { dedupeKey: 'order-delayed:' + order.id },
    }),
  ).toBe(1);
  await prisma.notification.update({
    where: { id: notices[0].id },
    data: { expiresAt: new Date(0) },
  });
  await notificationMaintenance(prisma, tenantId);
  expect(
    await prisma.notification.findUnique({ where: { id: notices[0].id } }),
  ).toBeNull();
});
