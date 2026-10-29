import 'reflect-metadata';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
const tenantId = '10000000-0000-4000-8000-000000000001',
  branchId = '20000000-0000-4000-8000-000000000001',
  menuId = '30000000-0000-4000-8000-000000000001';
let app: INestApplication;
const cookies: Record<string, string> = {};
function call(
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
async function open() {
  const table = await prisma.restaurantTable.create({
    data: {
      tenantId,
      branchId,
      number: 100000000 + Math.floor(Math.random() * 1000000000),
    },
  });
  return (await call('post', '/orders').send({ tableId: table.id }).expect(201))
    .body;
}
async function add(id: string) {
  return (
    await call('post', `/orders/${id}/items`)
      .send({ menuItemId: menuId, quantity: 1 })
      .expect(201)
  ).body;
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Isolated DB required');
  app = await createApp();
  await app.init();
  for (const role of ['manager', 'waiter', 'kitchen', 'other']) {
    const r = await call('post', '/auth/login', role)
      .send({
        email: role + '@demo.restaurantos.test',
        password: process.env.SEED_DEMO_PASSWORD,
      })
      .expect(200);
    cookies[role] = r.headers['set-cookie'][0].split(';')[0];
  }
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
test('empty cancellation releases table, replays once, and preserves terminal history', async () => {
  const order = await open(),
    key = randomUUID(),
    body = { version: order.version, reason: 'Wrong table' };
  const cancelled = await call(
    'post',
    `/orders/${order.id}/cancel`,
    'waiter',
    key,
  )
    .send(body)
    .expect(201);
  expect(cancelled.body.status).toBe('CANCELLED');
  await call('post', `/orders/${order.id}/cancel`, 'waiter', key)
    .send(body)
    .expect(201);
  expect(
    await prisma.adminAuditLog.count({
      where: { resourceId: order.id, action: 'ORDER_CANCELLED' },
    }),
  ).toBe(1);
  await call('post', '/orders').send({ tableId: order.tableId }).expect(201);
  await call('post', `/orders/${order.id}/items`)
    .send({ menuItemId: menuId, quantity: 1 })
    .expect(409);
  await call('post', `/orders/${order.id}/cancel`, 'waiter', key)
    .send({ ...body, reason: 'changed' })
    .expect(409);
});
test('item cancellation is role scoped, reasons required, served history is immutable', async () => {
  const order = await add((await open()).id),
    item = order.items[0];
  await call('post', `/orders/${order.id}/items/${item.id}/cancel`, 'other')
    .send({ version: 1, reason: 'no' })
    .expect(404);
  await call('post', `/orders/${order.id}/items/${item.id}/cancel`, 'kitchen')
    .send({ version: 1, reason: 'no' })
    .expect(403);
  await call('post', `/orders/${order.id}/items/${item.id}/cancel`)
    .send({ version: 1, reason: '   ' })
    .expect(400);
  await call('patch', `/orders/${order.id}/items/${item.id}`, 'kitchen')
    .send({ version: 1, status: 'PREPARING' })
    .expect(200);
  await call('post', `/orders/${order.id}/items/${item.id}/cancel`)
    .send({ version: 2, reason: 'Wrong dish' })
    .expect(403);
  const r = await call(
    'post',
    `/orders/${order.id}/items/${item.id}/cancel`,
    'manager',
  )
    .send({ version: 2, reason: 'Owner correction' })
    .expect(201);
  expect(r.body.status).toBe('CANCELLED');
  expect(r.body.items[0]).toMatchObject({
    status: 'CANCELLED',
    cancellationPriorStatus: 'PREPARING',
    priceRial: item.priceRial,
    quantity: 1,
  });
});
test('cancelled lines are excluded from total and mixed served/cancelled orders can complete', async () => {
  let o = await add((await open()).id);
  o = await add(o.id);
  const a = o.items[0],
    b = o.items[1];
  await call('post', `/orders/${o.id}/items/${a.id}/cancel`)
    .send({ version: 1, reason: 'Duplicate' })
    .expect(201);
  let version = o.version;
  for (const [index, status] of ['PREPARING', 'READY', 'SERVED'].entries()) {
    const r = await call(
      'patch',
      `/orders/${o.id}/items/${b.id}`,
      status === 'SERVED' ? 'waiter' : 'kitchen',
    )
      .send({ version: index + 1, status })
      .expect(200);
    version = r.body.version;
  }
  await call('post', `/orders/${o.id}/items/${b.id}/cancel`, 'manager')
    .send({ version: 4, reason: 'Too late' })
    .expect(409);
  await call('post', `/orders/${o.id}/complete`).send({ version }).expect(201);
  const listing = await call(
    'get',
    `/admin/orders?q=${o.id}`,
    'manager',
  ).expect(200);
  expect(listing.body.items[0].totalRial).toBe(b.priceRial);
});
test('cancel versus add/prepare serializes without corrupting accepted changes', async () => {
  const order = await open();
  const race = await Promise.all([
    call('post', `/orders/${order.id}/cancel`).send({
      version: 1,
      reason: 'Accidental',
    }),
    call('post', `/orders/${order.id}/items`).send({
      menuItemId: menuId,
      quantity: 1,
    }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
  const o = await add((await open()).id),
    item = o.items[0];
  const transitions = await Promise.all([
    call('post', `/orders/${o.id}/items/${item.id}/cancel`).send({
      version: 1,
      reason: 'Mistake',
    }),
    call('patch', `/orders/${o.id}/items/${item.id}`, 'kitchen').send({
      version: 1,
      status: 'PREPARING',
    }),
  ]);
  expect(transitions.filter((r) => r.status === 409)).toHaveLength(1);
  expect(
    transitions.filter((r) => r.status === 200 || r.status === 201),
  ).toHaveLength(1);
});
test('serve versus cancellation has one winner and completion never loses served history', async () => {
  const o = await add((await open()).id),
    item = o.items[0];
  for (const [index, status] of ['PREPARING', 'READY'].entries())
    await call('patch', `/orders/${o.id}/items/${item.id}`, 'kitchen')
      .send({ version: index + 1, status })
      .expect(200);
  const race = await Promise.all([
    call('post', `/orders/${o.id}/items/${item.id}/cancel`, 'manager').send({
      version: 3,
      reason: 'Kitchen correction',
    }),
    call('patch', `/orders/${o.id}/items/${item.id}`, 'waiter').send({
      version: 3,
      status: 'SERVED',
    }),
  ]);
  expect(race.filter((r) => r.status === 409)).toHaveLength(1);
  expect(race.filter((r) => r.status === 200 || r.status === 201)).toHaveLength(
    1,
  );
  const current = await call('get', `/orders/${o.id}`);
  expect(['SERVED', 'CANCELLED']).toContain(current.body.items[0].status);
  const served = await add((await open()).id),
    servedItem = served.items[0];
  let version = served.version;
  for (const [index, status] of ['PREPARING', 'READY', 'SERVED'].entries()) {
    const r = await call(
      'patch',
      `/orders/${served.id}/items/${servedItem.id}`,
      status === 'SERVED' ? 'waiter' : 'kitchen',
    )
      .send({ version: index + 1, status })
      .expect(200);
    version = r.body.version;
  }
  const terminal = await Promise.all([
    call('post', `/orders/${served.id}/complete`).send({ version }),
    call('post', `/orders/${served.id}/cancel`, 'manager').send({
      version,
      reason: 'Too late',
    }),
  ]);
  expect(terminal.map((r) => r.status).sort()).toEqual([201, 409]);
  const final = await call('get', `/orders/${served.id}`);
  expect(final.body.status).toBe('COMPLETED');
  expect(final.body.items[0].status).toBe('SERVED');
});
test('kitchen pagination reaches 101+ orders even if the cursor anchor stops matching', async () => {
  const fixtureBranch = await prisma.branch.create({
    data: { tenantId, name: 'Backlog ' + randomUUID() },
  });
  const user = await prisma.user.findUniqueOrThrow({
      where: { email: 'kitchen@demo.restaurantos.test' },
    }),
    membership = await prisma.membership.findUniqueOrThrow({
      where: { tenantId_userId: { tenantId, userId: user.id } },
    });
  await prisma.branchMembership.create({
    data: { tenantId, membershipId: membership.id, branchId: fixtureBranch.id },
  });
  const session = await prisma.restaurantSession.create({
    data: {
      userId: user.id,
      membershipId: membership.id,
      branchId: fixtureBranch.id,
      expiresAt: new Date(Date.now() + 60000),
    },
  });
  const { JwtService } = await import('@nestjs/jwt');
  const token = await app.get(JwtService).signAsync(
    {
      sub: user.id,
      membershipId: membership.id,
      branchId: fixtureBranch.id,
      sid: session.id,
    },
    { audience: 'restaurantos-restaurant' },
  );
  cookies.backlog = 'session=' + token;
  const ids: string[] = [];
  for (let n = 1; n <= 105; n++) {
    const table = await prisma.restaurantTable.create({
      data: { tenantId, branchId: fixtureBranch.id, number: n },
    });
    const o = await prisma.order.create({
      data: {
        tenantId,
        branchId: fixtureBranch.id,
        tableId: table.id,
        createdAt: new Date('2026-01-01'),
        items: {
          create: {
            menuItemId: menuId,
            name: 'Backlog',
            quantity: 1,
            priceRial: 1000,
          },
        },
      },
    });
    ids.push(o.id);
  }
  const first = await call('get', '/kitchen/orders?limit=50', 'backlog').expect(
    200,
  );
  expect(first.body.total).toBe(105);
  expect(first.body.items).toHaveLength(50);
  const anchor = first.body.items.at(-1);
  await prisma.order.update({
    where: { id: anchor.id },
    data: { status: 'CANCELLED' },
  });
  let cursor = first.body.nextCursor;
  const seen = first.body.items.map((x: { id: string }) => x.id);
  while (cursor) {
    const r = await call(
      'get',
      '/kitchen/orders?limit=50&cursor=' + cursor,
      'backlog',
    ).expect(200);
    seen.push(...r.body.items.map((x: { id: string }) => x.id));
    cursor = r.body.nextCursor;
  }
  expect(new Set(seen).size).toBe(105);
  expect(seen.sort()).toEqual(ids.sort());
  const foreign = await call(
    'get',
    '/kitchen/orders?cursor=' + first.body.nextCursor,
    'other',
  ).expect(200);
  expect(
    foreign.body.items.every(
      (o: { tenantId: string }) => o.tenantId !== tenantId,
    ),
  ).toBe(true);
  await call('get', '/kitchen/orders?limit=101', 'backlog').expect(400);
  await call('get', '/kitchen/orders?cursor=invalid', 'backlog').expect(400);
});
test('logout revokes copied cookies but not independent sessions; repeated logout is safe', async () => {
  const a = await call('post', '/auth/login')
    .send({
      email: 'waiter@demo.restaurantos.test',
      password: process.env.SEED_DEMO_PASSWORD,
    })
    .expect(200);
  const original = cookies.waiter;
  cookies.logout = a.headers['set-cookie'][0].split(';')[0];
  await call('post', '/auth/logout', 'logout').expect(200);
  await call('post', '/auth/logout', 'logout').expect(200);
  await call('get', '/auth/me', 'logout').expect(401);
  expect(cookies.waiter).toBe(original);
  await call('get', '/auth/me').expect(200);
});

test('disabled platform routes fail closed regardless of route capitalization', async () => {
  const previous = process.env.PLATFORM_ADMIN_ENABLED;
  try {
    process.env.PLATFORM_ADMIN_ENABLED = 'false';
    await call('get', '/platform/auth/me').expect(404);
    await call('get', '/PLATFORM/auth/me').expect(404);
    await call('post', '/PLATFORM/auth/login')
      .send({ email: 'nobody@example.test', password: 'invalid-password' })
      .expect(404);
  } finally {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_ENABLED;
    else process.env.PLATFORM_ADMIN_ENABLED = previous;
  }
});
