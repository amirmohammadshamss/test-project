import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { io, Socket } from 'socket.io-client';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
import { RestaurantEventsGateway } from '../src/modules/realtime/restaurant-events.gateway';
const tenantId = '10000000-0000-4000-8000-000000000001',
  branchId = '20000000-0000-4000-8000-000000000001',
  menuItemId = '30000000-0000-4000-8000-000000000001';
let app: INestApplication, url: string;
const cookies: Record<string, string> = {},
  clients: Socket[] = [];
let waiter: Socket, kitchen: Socket, other: Socket, branch: Socket;
function api(
  method: 'get' | 'post' | 'patch',
  path: string,
  role = 'waiter',
  key = randomUUID(),
) {
  const server = request(app.getHttpServer());
  return server[method]('/api/v1' + path)
    .set('Cookie', cookies[role] || '')
    .set('X-CSRF-Protection', '1')
    .set('Idempotency-Key', key);
}
function connect(
  cookie: string,
  origin = process.env.WEB_ORIGIN || 'http://localhost:3000',
  transport: 'websocket' | 'polling' = 'websocket',
): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const s = io(url, {
      transports: [transport],
      reconnection: false,
      forceNew: true,
      timeout: 3000,
      extraHeaders: { Cookie: cookie, Origin: origin },
    });
    clients.push(s);
    s.once('connect', () => resolve(s));
    s.once('connect_error', (e) => {
      s.disconnect();
      reject(e);
    });
  });
}
function event<T>(
  s: Socket,
  name: string,
  match: (value: T) => boolean = () => true,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      s.off(name, handler);
      reject(new Error('Missing event ' + name));
    }, 4000);
    const handler = (x: T) => {
      if (match(x)) {
        clearTimeout(timer);
        s.off(name, handler);
        resolve(x);
      }
    };
    s.on(name, handler);
  });
}
function disconnected(s: Socket, timeout = 4000): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(
      () => reject(new Error('Socket stayed authorized')),
      timeout,
    );
    s.once('disconnect', () => {
      clearTimeout(t);
      resolve();
    });
  });
}
async function table() {
  return prisma.restaurantTable.create({
    data: {
      tenantId,
      branchId,
      number: 100000000 + Math.floor(Math.random() * 1000000000),
    },
  });
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Isolated test DB required');
  app = await createApp();
  await app.listen(0, '127.0.0.1');
  const address = app.getHttpServer().address();
  url = `http://127.0.0.1:${address.port}`;
  for (const role of ['waiter', 'kitchen', 'other', 'branch']) {
    const r = await api('post', '/auth/login', role)
      .send({
        email: role + '@demo.restaurantos.test',
        password: process.env.SEED_DEMO_PASSWORD,
      })
      .expect(200);
    cookies[role] = r.headers['set-cookie'][0].split(';')[0];
  }
  waiter = await connect(cookies.waiter);
  kitchen = await connect(cookies.kitchen);
  other = await connect(cookies.other);
  branch = await connect(cookies.branch);
});
afterAll(async () => {
  for (const s of clients) s.disconnect();
  await app?.close();
  await prisma.$disconnect();
});
test('valid sessions connect over WebSocket and polling; invalid cookies/origins fail closed', async () => {
  expect(waiter.connected).toBe(true);
  const polling = await connect(cookies.waiter, undefined, 'polling');
  expect(polling.connected).toBe(true);
  const hijack = await fetch(
    url + '/socket.io/?EIO=4&transport=polling&sid=' + polling.io.engine.id,
    { headers: { Cookie: cookies.waiter, Origin: 'https://attacker.example' } },
  );
  expect([400, 403]).toContain(hijack.status);
  polling.disconnect();
  await expect(connect('')).rejects.toBeDefined();
  await expect(connect('session=forged')).rejects.toBeDefined();
  await expect(
    connect(cookies.waiter, 'https://attacker.example'),
  ).rejects.toBeDefined();
});
test('committed order notifications reach only the correct tenant/branch and replay emits nothing new', async () => {
  const target = await table(),
    seenOther: string[] = [],
    seenBranch: string[] = [];
  const a = (x: { orderId: string }) => seenOther.push(x.orderId),
    b = (x: { orderId: string }) => seenBranch.push(x.orderId);
  other.on('order:created', a);
  branch.on('order:created', b);
  const received = event<{ orderId: string; version: number; tableId: string }>(
    waiter,
    'order:created',
    (x) => x.tableId === target.id,
  );
  const inKitchen = event<{ tableId: string }>(
    kitchen,
    'order:created',
    (x) => x.tableId === target.id,
  );
  const publish = jest.spyOn(
    app.get(RestaurantEventsGateway),
    'publishOrderChanged',
  );
  publish.mockClear();
  const key = randomUUID();
  const r = await api('post', '/orders', 'waiter', key)
    .send({ tableId: target.id })
    .expect(201);
  const notification = await received;
  await inKitchen;
  expect(notification.orderId).toBe(r.body.id);
  expect(
    await prisma.order.findUnique({ where: { id: notification.orderId } }),
  ).toMatchObject({ version: notification.version, status: 'OPEN' });
  expect(seenOther).not.toContain(r.body.id);
  expect(seenBranch).not.toContain(r.body.id);
  const count = publish.mock.calls.length;
  await api('post', '/orders', 'waiter', key)
    .send({ tableId: target.id })
    .expect(201);
  expect(publish.mock.calls.length).toBe(count);
  await api('post', '/orders').send({ tableId: target.id }).expect(409);
  expect(publish.mock.calls.length).toBe(count);
  other.off('order:created', a);
  branch.off('order:created', b);
  publish.mockRestore();
});
test('concurrent additions survive and kitchen status sends a versioned invalidation after commit', async () => {
  const target = await table(),
    o = (await api('post', '/orders').send({ tableId: target.id }).expect(201))
      .body;
  const added = await Promise.all(
    [1, 2].map(() =>
      api('post', `/orders/${o.id}/items`)
        .send({ menuItemId, quantity: 1 })
        .expect(201),
    ),
  );
  const persisted = await prisma.order.findUniqueOrThrow({
    where: { id: o.id },
    include: { items: true },
  });
  expect(persisted.items).toHaveLength(2);
  expect(persisted.version).toBe(3);
  const item = persisted.items[0],
    notice = event<{
      orderId: string;
      itemId: string;
      status: string;
      itemVersion: number;
    }>(
      waiter,
      'kitchen:item-updated',
      (x) => x.itemId === item.id && x.status === 'PREPARING',
    );
  await api('patch', `/kitchen/items/${item.id}/status`, 'kitchen')
    .send({ version: item.version, status: 'PREPARING' })
    .expect(200);
  expect(await notice).toMatchObject({
    orderId: o.id,
    status: 'PREPARING',
    itemVersion: item.version + 1,
  });
  const key = randomUUID(),
    count = added[0].body.items.length;
  await api('post', `/orders/${o.id}/items`, 'waiter', key)
    .send({ menuItemId, quantity: 1 })
    .expect(201);
  await api('post', `/orders/${o.id}/items`, 'waiter', key)
    .send({ menuItemId, quantity: 1 })
    .expect(201);
  expect(count).toBeGreaterThan(0);
  expect(await prisma.orderItem.count({ where: { orderId: o.id } })).toBe(3);
});
test('clients cannot choose tenant/branch rooms or issue socket commands', async () => {
  const s = await connect(cookies.waiter),
    gone = disconnected(s);
  s.emit(
    'join',
    `tenant:10000000-0000-4000-8000-000000000002:branch:foreign:hall`,
  );
  await gone;
  expect(s.connected).toBe(false);
});
test('failed notification delivery never rolls back an accepted REST command', async () => {
  const gateway = app.get(RestaurantEventsGateway),
    spy = jest
      .spyOn(gateway, 'publishOrderChanged')
      .mockRejectedValueOnce(new Error('Delivery unavailable'));
  const target = await table();
  const r = await api('post', '/orders')
    .send({ tableId: target.id })
    .expect(201);
  expect(await prisma.order.count({ where: { id: r.body.id } })).toBe(1);
  expect(spy).toHaveBeenCalledTimes(1);
  spy.mockRestore();
});
test('logout disconnects that session immediately and copied credentials cannot reconnect', async () => {
  const r = await api('post', '/auth/login')
    .send({
      email: 'waiter@demo.restaurantos.test',
      password: process.env.SEED_DEMO_PASSWORD,
    })
    .expect(200);
  cookies.logout = r.headers['set-cookie'][0].split(';')[0];
  const s = await connect(cookies.logout),
    gone = disconnected(s);
  await api('post', '/auth/logout', 'logout').expect(200);
  await gone;
  await expect(connect(cookies.logout)).rejects.toBeDefined();
  expect(waiter.connected).toBe(true);
});
test('database revocation blocks subsequent deliveries even before the periodic sweep', async () => {
  const r = await api('post', '/auth/login')
    .send({
      email: 'waiter@demo.restaurantos.test',
      password: process.env.SEED_DEMO_PASSWORD,
    })
    .expect(200);
  const cookie = r.headers['set-cookie'][0].split(';')[0],
    s = await connect(cookie);
  const { JwtService } = await import('@nestjs/jwt');
  const claims = await app
    .get(JwtService)
    .verifyAsync(cookie.slice('session='.length), {
      audience: 'restaurantos-restaurant',
    });
  const seen: string[] = [];
  s.on('order:created', (x: { orderId: string }) => seen.push(x.orderId));
  const gone = disconnected(s);
  await prisma.restaurantSession.update({
    where: { id: claims.sid },
    data: { revokedAt: new Date() },
  });
  const target = await table(),
    made = await api('post', '/orders')
      .send({ tableId: target.id })
      .expect(201);
  await gone;
  expect(seen).not.toContain(made.body.id);
});

test('idle connections lose access after tenant suspension or membership role change', async () => {
  const tenantB = '10000000-0000-4000-8000-000000000002';
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'branch@demo.restaurantos.test' },
  });
  const membership = await prisma.membership.findUniqueOrThrow({
    where: { tenantId_userId: { tenantId, userId: user.id } },
  });
  const oldTenant = await prisma.restaurant.findUniqueOrThrow({
    where: { id: tenantB },
  });
  const leftOther = disconnected(other, 9000),
    leftBranch = disconnected(branch, 9000);
  try {
    await prisma.restaurant.update({
      where: { id: tenantB },
      data: { status: 'SUSPENDED' },
    });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { role: 'KITCHEN' },
    });
    await Promise.all([leftOther, leftBranch]);
  } finally {
    await prisma.restaurant.update({
      where: { id: tenantB },
      data: { status: oldTenant.status },
    });
    await prisma.membership.update({
      where: { id: membership.id },
      data: { role: membership.role },
    });
  }
}, 15000);
