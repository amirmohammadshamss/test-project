import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
import { hashPassword } from '../../../packages/database/src/password';
let app: INestApplication;
let platformCookie: string, managerCookie: string, waiterCookie: string;
const password = 'Admin-Integration-2026!';
const email = `platform-${randomUUID()}@example.test`;
function call(
  method: 'get' | 'post' | 'patch',
  path: string,
  cookie = platformCookie,
) {
  const server = request(app.getHttpServer());
  return server[method]('/api/v1' + path)
    .set('Cookie', cookie)
    .set('X-CSRF-Protection', '1')
    .set('Idempotency-Key', randomUUID());
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Isolated test DB required');
  await prisma.user.create({
    data: {
      email,
      name: 'Platform test',
      passwordHash: await hashPassword(password),
      platformAdmin: { create: {} },
    },
  });
  app = await createApp();
  await app.init();
  const login = await request(app.getHttpServer())
    .post('/api/v1/platform/auth/login')
    .set('X-CSRF-Protection', '1')
    .send({ email, password })
    .expect(200);
  platformCookie = login.headers['set-cookie'][0].split(';')[0];
  for (const role of ['manager', 'waiter']) {
    const r = await call('post', '/auth/login', '')
      .send({
        email: `${role}@demo.restaurantos.test`,
        password: process.env.SEED_DEMO_PASSWORD,
      })
      .expect(200);
    if (role === 'manager')
      managerCookie = r.headers['set-cookie'][0].split(';')[0];
    else waiterCookie = r.headers['set-cookie'][0].split(';')[0];
  }
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
test('separate credentials cannot cross management contexts and CSRF origins are exact', async () => {
  await call('get', '/platform/restaurants', managerCookie).expect(401);
  await call('get', '/admin/dashboard', platformCookie).expect(401);
  await call(
    'get',
    '/admin/dashboard',
    platformCookie.replace('platform_session=', 'session='),
  ).expect(401);
  await call(
    'get',
    '/platform/restaurants',
    managerCookie.replace('session=', 'platform_session='),
  ).expect(401);
  await call('get', '/admin/dashboard', waiterCookie).expect(403);
  await call('post', '/platform/restaurants')
    .set('Origin', 'http://localhost:3000')
    .send({})
    .expect(403);
  await call('get', '/platform/auth/me').expect(200);
});
test('provisioning replay, duplicate reference, suspension and activation preserve tenant data', async () => {
  const ref = 'test-' + randomUUID(),
    key = randomUUID();
  const body = {
    name: 'Integration tenant',
    provisioningKey: ref,
    primaryContact: 'Owner',
    contactEmail: 'owner@example.test',
    phone: '12345',
    branchName: 'Main',
    managerName: 'Manager',
    managerEmail: `${ref}@example.test`,
    managerPassword: password,
  };
  const r = await call('post', '/platform/restaurants')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(201);
  expect(JSON.stringify(r.body)).not.toMatch(/password|passwordHash/);
  const replay = await call('post', '/platform/restaurants')
    .set('Idempotency-Key', key)
    .send(body)
    .expect(201);
  expect(replay.body.id).toBe(r.body.id);
  await call('post', '/platform/restaurants')
    .set('Idempotency-Key', key)
    .send({ ...body, name: 'Changed' })
    .expect(409);
  await call('post', '/platform/restaurants')
    .send({ ...body, managerEmail: `other-${ref}@example.test` })
    .expect(409);
  const login = await call('post', '/auth/login', '')
    .send({ email: body.managerEmail, password })
    .expect(200);
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  await call('get', '/admin/dashboard', cookie).expect(200);
  const suspended = await call(
    'post',
    `/platform/restaurants/${r.body.id}/suspend`,
  )
    .send({ version: r.body.version, reason: 'Test suspension' })
    .expect(201);
  await call('get', '/admin/dashboard', cookie).expect(403);
  await call('post', '/auth/login', '')
    .send({ email: body.managerEmail, password })
    .expect(403);
  await call('post', `/platform/restaurants/${r.body.id}/activate`)
    .send({ version: r.body.version, reason: 'stale' })
    .expect(409);
  await call('post', `/platform/restaurants/${r.body.id}/activate`)
    .send({ version: suspended.body.version, reason: 'Restored' })
    .expect(201);
  await call('get', '/admin/dashboard', cookie).expect(200);
  const audits = await call(
    'get',
    `/platform/audit-logs?tenantId=${r.body.id}`,
  ).expect(200);
  expect(
    audits.body.items.map((x: { action: string }) => x.action).sort(),
  ).toEqual(['TENANT_ACTIVATED', 'TENANT_CREATED', 'TENANT_SUSPENDED']);
  expect(await prisma.category.count({ where: { tenantId: r.body.id } })).toBe(
    5,
  );
  const branches = await call(
    'get',
    `/platform/restaurants/${r.body.id}/branches`,
  ).expect(200);
  expect(branches.body).toHaveLength(1);
});
test('manager versions reject stale writes, inactive categories reject additions and staff is safe', async () => {
  const c = await call('post', '/admin/menu/categories', managerCookie)
    .send({ name: 'Test ' + randomUUID(), active: true, displayOrder: 100 })
    .expect(201);
  const menu = {
    name: 'Test item',
    description: '',
    categoryId: c.body.id,
    priceToman: 10000,
    active: true,
    available: true,
  };
  const m = await call('post', '/admin/menu/items', managerCookie)
    .send(menu)
    .expect(201);
  await call('patch', `/admin/menu/items/${m.body.id}`, managerCookie)
    .send({ ...menu, version: m.body.version, priceToman: 20000 })
    .expect(200);
  await call('patch', `/admin/menu/items/${m.body.id}`, managerCookie)
    .send({ ...menu, version: m.body.version })
    .expect(409);
  await call('patch', `/admin/menu/categories/${c.body.id}`, managerCookie)
    .send({
      name: c.body.name,
      active: false,
      displayOrder: 100,
      version: c.body.version,
    })
    .expect(200);
  await call('post', '/admin/menu/items', managerCookie).send(menu).expect(409);
  const staff = await call(
    'get',
    '/admin/staff?page=1&pageSize=1',
    managerCookie,
  ).expect(200);
  expect(staff.body.items).toHaveLength(1);
  expect(JSON.stringify(staff.body)).not.toMatch(/passwordHash/);
  const page = await call(
    'get',
    '/admin/orders?page=1&pageSize=1',
    managerCookie,
  ).expect(200);
  expect(page.body.items.length).toBeLessThanOrEqual(1);
});
test('simultaneous menu edits have one winner and table deactivation respects occupancy', async () => {
  const c = await call('post', '/admin/menu/categories', managerCookie)
    .send({ name: 'Race ' + randomUUID(), active: true, displayOrder: 0 })
    .expect(201);
  const body = {
    name: 'Race item',
    description: '',
    categoryId: c.body.id,
    priceToman: 1000,
    active: true,
    available: true,
  };
  const item = await call('post', '/admin/menu/items', managerCookie)
    .send(body)
    .expect(201);
  const results = await Promise.all(
    [1001, 1002].map((priceToman) =>
      call('patch', `/admin/menu/items/${item.body.id}`, managerCookie).send({
        ...body,
        priceToman,
        version: item.body.version,
      }),
    ),
  );
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const table = await prisma.restaurantTable.create({
    data: {
      tenantId: '10000000-0000-4000-8000-000000000001',
      branchId: '20000000-0000-4000-8000-000000000001',
      number: 100000000 + Math.floor(Math.random() * 100000000),
    },
  });
  const used = await prisma.restaurantTable.findMany({
    where: { branchId: table.branchId },
    select: { number: true },
  });
  const number = Array.from({ length: 9999 }, (_, i) => i + 1).find(
    (n) => !used.some((t) => t.number === n),
  )!;
  const order = await call('post', '/orders', managerCookie)
    .send({ tableId: table.id })
    .expect(201);
  await call('patch', `/admin/tables/${table.id}`, managerCookie)
    .send({ number, seats: 4, active: false, version: table.version })
    .expect(409);
  const added = await call(
    'post',
    `/orders/${order.body.id}/items`,
    managerCookie,
  )
    .send({ menuItemId: item.body.id, quantity: 1 })
    .expect(201);
  const orderItem = added.body.items[0];
  let version = added.body.version;
  for (const [index, status] of ['PREPARING', 'READY', 'SERVED'].entries()) {
    const changed = await call(
      'patch',
      `/orders/${order.body.id}/items/${orderItem.id}`,
      managerCookie,
    )
      .send({ version: index + 1, status })
      .expect(200);
    version = changed.body.version;
  }
  await call('post', `/orders/${order.body.id}/complete`, managerCookie)
    .send({ version })
    .expect(201);
  await call('patch', `/admin/tables/${table.id}`, managerCookie)
    .send({ number, seats: 4, active: false, version: table.version })
    .expect(200);
  await call('post', '/orders', managerCookie)
    .send({ tableId: table.id })
    .expect(409);
});
test('concurrent provisioning with one key commits one tenant and one audit', async () => {
  const key = randomUUID(),
    ref = 'race-' + randomUUID();
  const body = {
    name: 'Race tenant',
    provisioningKey: ref,
    primaryContact: 'Owner',
    contactEmail: 'owner@example.test',
    phone: '123',
    branchName: 'Main',
    managerName: 'Manager',
    managerEmail: ref + '@example.test',
    managerPassword: password,
  };
  const results = await Promise.all(
    [1, 2].map(() =>
      call('post', '/platform/restaurants')
        .set('Idempotency-Key', key)
        .send(body),
    ),
  );
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0].body.id).toBe(results[1].body.id);
  expect(
    await prisma.adminAuditLog.count({
      where: { tenantId: results[0].body.id, action: 'TENANT_CREATED' },
    }),
  ).toBe(1);
});
test('platform monitoring exposes measurements without queue payloads and logout revokes cookie', async () => {
  const health = await call('get', '/platform/health').expect(200);
  expect(health.body.database).toBe('ready');
  const queues = await call('get', '/platform/queues').expect(200);
  expect(['ready', 'unavailable']).toContain(queues.body.redis);
  expect(JSON.stringify(queues.body)).not.toMatch(
    /passwordHash|"input"|"data"/,
  );
  await call('post', '/platform/auth/logout').expect(200);
  await call('get', '/platform/auth/me').expect(401);
});
