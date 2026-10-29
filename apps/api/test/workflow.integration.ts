import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
const tenantA = '10000000-0000-4000-8000-000000000001';
const tenantB = '10000000-0000-4000-8000-000000000002';
const branchA = '20000000-0000-4000-8000-000000000001';
const branchA2 = '20000000-0000-4000-8000-000000000002';
const menuId = '30000000-0000-4000-8000-000000000001';
let app: INestApplication;
const cookies: Record<string, string> = {};
let tableId: string;
let tableNumber = 1000 + Math.floor(Math.random() * 100000000);
const key = () => randomUUID();
function api(role = 'waiter') {
  const server = request(app.getHttpServer());
  const decorate = (test: request.Test) =>
    test
      .set('Cookie', cookies[role] || '')
      .set('X-CSRF-Protection', '1')
      .set('Idempotency-Key', key());
  return {
    get: (path: string) => decorate(server.get('/api/v1' + path)),
    post: (path: string) => decorate(server.post('/api/v1' + path)),
    patch: (path: string) => decorate(server.patch('/api/v1' + path)),
  };
}
async function open() {
  const response = await api().post('/orders').send({ tableId }).expect(201);
  return response.body;
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Use an isolated restaurantos_test database');
  app = await createApp();
  await app.init();
  for (const role of ['manager', 'waiter', 'kitchen', 'other', 'branch']) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({
        email: `${role}@demo.restaurantos.test`,
        password: process.env.SEED_DEMO_PASSWORD,
      })
      .expect(200);
    cookies[role] = response.headers['set-cookie'][0].split(';')[0];
  }
});
beforeEach(async () => {
  tableId = (
    await prisma.restaurantTable.create({
      data: { tenantId: tenantA, branchId: branchA, number: tableNumber++ },
    })
  ).id;
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
describe('HTTP security and workflow with real PostgreSQL', () => {
  test('rejects anonymous, invalid login, forged tenant input and CSRF', async () => {
    await request(app.getHttpServer()).get('/api/v1/orders').expect(401);
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({ email: 'nobody@example.com', password: 'wrong-password' })
      .expect(401);
    await api()
      .post('/orders')
      .send({ tableId, tenantId: tenantB })
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', cookies.waiter)
      .send({ tableId })
      .expect(403);
    await api()
      .post('/orders')
      .set('Origin', 'https://attacker.example')
      .send({ tableId })
      .expect(403);
  });
  test('cross-tenant known IDs and branch-limited access fail closed', async () => {
    const order = await open();
    await api('other').get(`/orders/${order.id}`).expect(404);
    await api('branch').get(`/orders/${order.id}`).expect(404);
    await api('other')
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(404);
    const list = await api('other').get('/orders').expect(200);
    expect(list.body.some((o: { id: string }) => o.id === order.id)).toBe(
      false,
    );
    const category = await prisma.category.findFirstOrThrow({
      where: { tenantId: tenantB },
    });
    await api('other')
      .patch(`/menu/items/${menuId}`)
      .send({
        name: 'forbidden',
        description: '',
        categoryId: category.id,
        priceToman: 500000,
        active: true,
        available: true,
      })
      .expect(404);
    await api('waiter').post('/menu/items').send({}).expect(403);
  });
  test('membership is rechecked even with a valid signed branch claim', async () => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'waiter@demo.restaurantos.test' },
      include: { memberships: true },
    });
    const token = await app.get(JwtService).signAsync(
      {
        sub: user.id,
        membershipId: user.memberships[0].id,
        branchId: branchA2,
      },
      { audience: 'restaurantos-restaurant' },
    );
    await request(app.getHttpServer())
      .get('/api/v1/orders')
      .set('Cookie', `session=${token}`)
      .expect(401);
  });
  test('idempotent create and add replay; modified payload conflicts; application restart/client reconnect replay', async () => {
    const createKey = key();
    const first = await api()
      .post('/orders')
      .set('Idempotency-Key', createKey)
      .send({ tableId })
      .expect(201);
    const duplicate = await api()
      .post('/orders')
      .set('Idempotency-Key', createKey)
      .send({ tableId })
      .expect(201);
    expect(duplicate.body).toEqual(first.body);
    await api()
      .post('/orders')
      .set('Idempotency-Key', createKey)
      .send({ tableId: randomUUID() })
      .expect(409);
    const addKey = key();
    const path = `/orders/${first.body.id}/items`;
    const payload = { menuItemId: menuId, quantity: 2 };
    await api()
      .post(path)
      .set('Idempotency-Key', addKey)
      .send(payload)
      .expect(201);
    await api()
      .post(path)
      .set('Idempotency-Key', addKey)
      .send(payload)
      .expect(201);
    const anotherClient = new PrismaClient();
    expect(
      await anotherClient.orderItem.count({
        where: { orderId: first.body.id },
      }),
    ).toBe(1);
    await anotherClient.$disconnect();
    await app.close();
    app = await createApp();
    await app.init();
    const replay = await api()
      .post('/orders')
      .set('Idempotency-Key', createKey)
      .send({ tableId })
      .expect(201);
    expect(replay.body.id).toBe(first.body.id);
    await api()
      .post(path)
      .set('Idempotency-Key', addKey)
      .send({ ...payload, quantity: 3 })
      .expect(409);
  });
  test('simultaneous same key creates one result; separate creates cannot occupy table twice', async () => {
    const sharedKey = key();
    const responses = await Promise.all(
      [1, 2, 3].map(() =>
        api()
          .post('/orders')
          .set('Idempotency-Key', sharedKey)
          .send({ tableId }),
      ),
    );
    expect(responses.map((r) => r.status)).toEqual([201, 201, 201]);
    expect(new Set(responses.map((r) => r.body.id)).size).toBe(1);
    await api().post('/orders').send({ tableId }).expect(409);
    expect(
      await prisma.order.count({ where: { tableId, status: 'OPEN' } }),
    ).toBe(1);
  });
  test('two independent create attempts serialize at table invariant', async () => {
    const results = await Promise.all([
      api().post('/orders').send({ tableId }),
      api().post('/orders').send({ tableId }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  });
  test('concurrent additions and kitchen update preserve all accepted operations', async () => {
    const order = await open();
    const first = await api()
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(201);
    const item = first.body.items[0];
    const responses = await Promise.all([
      api()
        .post(`/orders/${order.id}/items`)
        .send({ menuItemId: menuId, quantity: 2 }),
      api()
        .post(`/orders/${order.id}/items`)
        .send({ menuItemId: menuId, quantity: 3 }),
      api('kitchen')
        .patch(`/kitchen/items/${item.id}/status`)
        .send({ version: 1, status: 'PREPARING' }),
    ]);
    expect(responses.every((r) => r.status < 300)).toBe(true);
    const persisted = await api().get(`/orders/${order.id}`).expect(200);
    expect(persisted.body.items).toHaveLength(3);
    expect(
      persisted.body.items.reduce(
        (s: number, i: { quantity: number }) => s + i.quantity,
        0,
      ),
    ).toBe(6);
    expect(
      persisted.body.items.find((i: { id: string }) => i.id === item.id).status,
    ).toBe('PREPARING');
  });
  test('stale edits conflict, preparation locks quantities and invalid transitions rollback', async () => {
    const order = await open();
    const added = await api()
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(201);
    const item = added.body.items[0];
    const path = `/orders/${order.id}/items/${item.id}`;
    const updates = await Promise.all([
      api().patch(path).send({ version: 1, quantity: 2 }),
      api().patch(path).send({ version: 1, quantity: 3 }),
    ]);
    expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
    await api('kitchen')
      .patch(path)
      .send({ version: 2, status: 'READY' })
      .expect(409);
    await api('kitchen')
      .patch(path)
      .send({ version: 2, status: 'PREPARING' })
      .expect(200);
    await api().patch(path).send({ version: 3, quantity: 4 }).expect(409);
    await api()
      .post(`/orders/${order.id}/complete`)
      .send({ version: 4 })
      .expect(409);
  });
  test('waiter → kitchen → ready → served → closed, price snapshots and historical reads', async () => {
    const order = await open();
    const added = await api()
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(201);
    const item = added.body.items[0];
    const originalPrice = item.priceRial;
    await prisma.menuItem.update({
      where: { id: menuId },
      data: { priceRial: originalPrice + 10000 },
    });
    const kitchen = await api('kitchen').get('/kitchen/orders').expect(200);
    expect(kitchen.body.some((o: { id: string }) => o.id === order.id)).toBe(
      true,
    );
    await api('kitchen')
      .patch(`/kitchen/items/${item.id}/status`)
      .send({ version: 1, status: 'PREPARING' })
      .expect(200);
    await api('kitchen')
      .patch(`/kitchen/items/${item.id}/status`)
      .send({ version: 2, status: 'READY' })
      .expect(200);
    const served = await api()
      .patch(`/orders/${order.id}/items/${item.id}`)
      .send({ version: 3, status: 'SERVED' })
      .expect(200);
    const closeKey = key();
    const payload = { version: served.body.version };
    await api()
      .post(`/orders/${order.id}/complete`)
      .set('Idempotency-Key', closeKey)
      .send(payload)
      .expect(201);
    await api()
      .post(`/orders/${order.id}/complete`)
      .set('Idempotency-Key', closeKey)
      .send(payload)
      .expect(201);
    await api()
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(409);
    const history = await api().get(`/orders/${order.id}`).expect(200);
    expect(history.body.status).toBe('COMPLETED');
    expect(history.body.items[0].priceRial).toBe(originalPrice);
    await prisma.menuItem.update({
      where: { id: menuId },
      data: { priceRial: originalPrice },
    });
  });
  test('AI requests/results are tenant scoped and approval creates one menu entry', async () => {
    const requestKey = key();
    const payload = { input: 'چیزبرگر مخصوص، قیمت ۴۵۰ هزار تومان' };
    const draft = await api('manager')
      .post('/ai/menu-drafts')
      .set('Idempotency-Key', requestKey)
      .send(payload)
      .expect(201);
    const replay = await api('manager')
      .post('/ai/menu-drafts')
      .set('Idempotency-Key', requestKey)
      .send(payload)
      .expect(201);
    expect(replay.body.id).toBe(draft.body.id);
    await api('other').get(`/ai/menu-drafts/${draft.body.id}`).expect(404);
    await api('waiter').get(`/ai/menu-drafts/${draft.body.id}`).expect(403);
    const approved = {
      name: 'برگر تست',
      description: 'توضیحات تست',
      category: 'برگر',
      priceToman: 450000,
    };
    await api('manager')
      .post(`/ai/menu-drafts/${draft.body.id}/approve`)
      .send(approved)
      .expect(409);
    await prisma.aiDraft.update({
      where: { id: draft.body.id },
      data: { status: 'READY', result: approved },
    });
    const a = await api('manager')
      .post(`/ai/menu-drafts/${draft.body.id}/approve`)
      .send(approved)
      .expect(201);
    const b = await api('manager')
      .post(`/ai/menu-drafts/${draft.body.id}/approve`)
      .send(approved)
      .expect(201);
    expect(a.body.id).toBe(b.body.id);
    expect(a.body.priceRial).toBe(4500000);
    await api('other')
      .post(`/ai/menu-drafts/${draft.body.id}/approve`)
      .send(approved)
      .expect(404);
  });
});

test('idempotency replay is branch-scoped even for a user with both branch memberships', async () => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email: 'waiter@demo.restaurantos.test' },
    include: { memberships: true },
  });
  const membership = user.memberships[0];
  const access = await prisma.branchMembership.create({
    data: {
      tenantId: tenantA,
      membershipId: membership.id,
      branchId: branchA2,
    },
  });
  try {
    const sharedKey = key();
    await api()
      .post('/orders')
      .set('Idempotency-Key', sharedKey)
      .send({ tableId })
      .expect(201);
    const token = await app.get(JwtService).signAsync(
      {
        sub: user.id,
        membershipId: membership.id,
        branchId: branchA2,
      },
      { audience: 'restaurantos-restaurant' },
    );
    await request(app.getHttpServer())
      .post('/api/v1/orders')
      .set('Cookie', `session=${token}`)
      .set('X-CSRF-Protection', '1')
      .set('Idempotency-Key', sharedKey)
      .send({ tableId })
      .expect(404);
  } finally {
    await prisma.branchMembership.delete({ where: { id: access.id } });
  }
});
test('orders remain available with an unreachable optional Redis dependency', async () => {
  const previous = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://127.0.0.1:1';
  try {
    const order = await open();
    await api()
      .post(`/orders/${order.id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(201);
    await api('kitchen').get('/kitchen/orders').expect(200);
  } finally {
    process.env.REDIS_URL = previous;
  }
});
