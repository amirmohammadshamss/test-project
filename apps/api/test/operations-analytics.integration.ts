import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { prisma } from '../../../packages/database/src/client';
import { hashPassword } from '../../../packages/database/src/password';
import {
  executeManagerReport,
  reportWindow,
} from '../../../packages/insights/src/report';
import { createApp } from '../src/app';
import type { ManagerPlan } from '../../../packages/shared/src/manager-analysis';
let app: INestApplication,
  tenantId: string,
  branchId: string,
  actorId: string,
  membershipId: string,
  tableId: string,
  menuId: string;
const cookies: Record<string, string> = {},
  anchor = new Date(),
  day = 86400000;
const password = 'Analytics-Fixture-2026!';
const scope = () => ({ tenantId, branchId, actorId, membershipId });
const report = (tool: ManagerPlan['tool']) =>
  executeManagerReport(
    prisma,
    scope(),
    { tool, period: 'LAST_7_DAYS' },
    anchor,
  );
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Dedicated database required');
  tenantId = (
    await prisma.restaurant.create({ data: { name: 'Analytics fixture' } })
  ).id;
  branchId = (await prisma.branch.create({ data: { tenantId, name: 'Main' } }))
    .id;
  tableId = (
    await prisma.restaurantTable.create({
      data: { tenantId, branchId, number: 1 },
    })
  ).id;
  const category = await prisma.category.create({
    data: { tenantId, name: 'غذا' },
  });
  const menus = await Promise.all(
    ['کباب نمونه', 'دوغ نمونه'].map((name) =>
      prisma.menuItem.create({
        data: {
          tenantId,
          categoryId: category.id,
          name,
          description: '',
          priceRial: 1000000,
        },
      }),
    ),
  );
  menuId = menus[0].id;
  const today = reportWindow('TODAY', anchor).start.getTime();
  // More than 56 complete days and both recurring co-orders and timed preparation.
  for (let d = 1; d <= 56; d++)
    for (let j = 0; j < 4; j++) {
      const createdAt = new Date(today - d * day + (12 + j) * 3600000);
      await prisma.order.create({
        data: {
          tenantId,
          branchId,
          tableId,
          status: 'COMPLETED',
          createdAt,
          completedAt: new Date(createdAt.getTime() + 45 * 60000),
          items: {
            create: menus.map((m, i) => ({
              menuItemId: m.id,
              name: m.name,
              priceRial: m.priceRial,
              quantity: i ? 1 : 2,
              status: 'SERVED',
              createdAt,
              preparingAt: new Date(createdAt.getTime() + 5 * 60000),
              readyAt: new Date(createdAt.getTime() + (i ? 15 : 30) * 60000),
              servedAt: new Date(createdAt.getTime() + 40 * 60000),
            })),
          },
        },
      });
    }
  const foreignTenant = (
    await prisma.restaurant.create({ data: { name: 'Private foreign tenant' } })
  ).id;
  const foreignBranch = (
    await prisma.branch.create({
      data: { tenantId: foreignTenant, name: 'Foreign' },
    })
  ).id;
  const foreignTable = await prisma.restaurantTable.create({
    data: { tenantId: foreignTenant, branchId: foreignBranch, number: 1 },
  });
  const foreignCategory = await prisma.category.create({
    data: { tenantId: foreignTenant, name: 'Private' },
  });
  const foreignMenu = await prisma.menuItem.create({
    data: {
      tenantId: foreignTenant,
      categoryId: foreignCategory.id,
      name: 'FOREIGN_SECRET_DISH',
      priceRial: 99999990,
      description: '',
    },
  });
  await prisma.order.create({
    data: {
      tenantId: foreignTenant,
      branchId: foreignBranch,
      tableId: foreignTable.id,
      status: 'COMPLETED',
      completedAt: new Date(anchor.getTime() - 1000),
      items: {
        create: {
          menuItemId: foreignMenu.id,
          name: foreignMenu.name,
          priceRial: foreignMenu.priceRial,
          quantity: 99,
          status: 'SERVED',
        },
      },
    },
  });
  const peerBranch = await prisma.branch.create({
    data: { tenantId, name: 'Same restaurant, private branch' },
  });
  const peerTable = await prisma.restaurantTable.create({
    data: { tenantId, branchId: peerBranch.id, number: 1 },
  });
  await prisma.order.create({
    data: {
      tenantId,
      branchId: peerBranch.id,
      tableId: peerTable.id,
      status: 'COMPLETED',
      createdAt: new Date(today - day + 12 * 3600000),
      completedAt: new Date(anchor.getTime() - 1000),
      items: {
        create: {
          menuItemId: menuId,
          name: 'OTHER_BRANCH_SECRET',
          priceRial: 1000000,
          quantity: 99,
          status: 'SERVED',
        },
      },
    },
  });
  app = await createApp();
  await app.init();
  for (const role of ['MANAGER', 'WAITER', 'KITCHEN'] as const) {
    const email = randomUUID() + '@analytics.test',
      user = await prisma.user.create({
        data: { email, name: role, passwordHash: await hashPassword(password) },
      });
    const membership = await prisma.membership.create({
      data: { tenantId, userId: user.id, role },
    });
    await prisma.branchMembership.create({
      data: { tenantId, membershipId: membership.id, branchId },
    });
    if (role === 'MANAGER') {
      actorId = user.id;
      membershipId = membership.id;
    }
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-CSRF-Protection', '1')
      .send({ email, password })
      .expect(200);
    cookies[role] = login.headers['set-cookie'][0].split(';')[0];
  }
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
test('sales, menu co-orders, forecasting and timings use only the authorized branch', async () => {
  const sales = await report('SALES_TRENDS');
  expect(JSON.stringify(sales)).not.toContain('FOREIGN_SECRET_DISH');
  expect(JSON.stringify(sales)).not.toContain('OTHER_BRANCH_SECRET');
  expect(sales.sections?.[0].rows.length).toBeGreaterThan(0);
  expect(sales.sections?.[1].rows.some((r) => r[0] === 'کباب نمونه')).toBe(
    true,
  );
  const menu = await report('MENU_SUGGESTIONS');
  expect(menu.sections?.[0].rows).toHaveLength(1);
  expect(menu.sections?.[0].rows[0].slice(0, 2).sort()).toEqual(
    ['دوغ نمونه', 'کباب نمونه'].sort(),
  );
  const forecast = await report('DEMAND_FORECAST');
  expect(
    forecast.sections?.find((s) => s.title === 'هفت روز از امروز')?.rows,
  ).toHaveLength(7);
  expect(
    forecast.sections?.find((s) => s.title.startsWith('۲۴ ساعت'))?.rows,
  ).toHaveLength(24);
  expect(
    forecast.facts.find((f) => f.label.startsWith('سفارش‌های دارای'))?.value,
  ).toBe('224');
  const kitchen = await report('KITCHEN_DELAYS');
  expect(kitchen.sections?.[0].rows[0][0]).toBe('کباب نمونه');
  expect(kitchen.sections?.[0].rows[0][2]).toBe(
    new Intl.NumberFormat('fa-IR').format(25),
  );
  expect(kitchen.sections?.[0].rows[0][4]).toBe(
    new Intl.NumberFormat('fa-IR').format(5),
  );
  for (const tool of [
    'SALES_TRENDS',
    'MENU_SUGGESTIONS',
    'DEMAND_FORECAST',
    'KITCHEN_DELAYS',
  ] as const) {
    await expect(
      executeManagerReport(
        prisma,
        { ...scope(), branchId: randomUUID() },
        { tool, period: 'LAST_7_DAYS' },
        anchor,
      ),
    ).rejects.toThrow('AI_ACCESS_REVOKED');
  }
});
test('direct report endpoint validates scope and rejects non-manager and supplied tenant fields', async () => {
  const url =
    '/api/v1/admin/ai/analyses/reports?tool=SALES_TRENDS&period=LAST_7_DAYS';
  await request(app.getHttpServer()).get(url).expect(401);
  await request(app.getHttpServer())
    .get(url)
    .set('Cookie', cookies.WAITER)
    .expect(403);
  const response = await request(app.getHttpServer())
    .get(url)
    .set('Cookie', cookies.MANAGER)
    .expect(200);
  expect(response.body.tool).toBe('SALES_TRENDS');
  expect(JSON.stringify(response.body)).not.toContain('FOREIGN_SECRET_DISH');
  await request(app.getHttpServer())
    .get(url + '&tenantId=' + randomUUID())
    .set('Cookie', cookies.MANAGER)
    .expect(400);
  await request(app.getHttpServer())
    .get(url.replace('SALES_TRENDS', 'DROP_TABLE'))
    .set('Cookie', cookies.MANAGER)
    .expect(400);
});
test('actual kitchen lifecycle records ordered timestamps and idempotent retries preserve them', async () => {
  const call = (
    role: string,
    method: 'post' | 'patch',
    path: string,
    body: object,
    key = randomUUID(),
  ) => {
    const agent = request(app.getHttpServer());
    return agent[method]('/api/v1' + path)
      .set('Cookie', cookies[role])
      .set('X-CSRF-Protection', '1')
      .set('Idempotency-Key', key)
      .send(body);
  };
  const order = (
    await call('WAITER', 'post', '/orders', { tableId }).expect(201)
  ).body;
  const added = (
    await call('WAITER', 'post', `/orders/${order.id}/items`, {
      menuItemId: menuId,
      quantity: 1,
    }).expect(201)
  ).body;
  const id = added.items[0].id,
    key = randomUUID();
  await call(
    'KITCHEN',
    'patch',
    `/kitchen/items/${id}/status`,
    { status: 'PREPARING', version: 1 },
    key,
  ).expect(200);
  const first = await prisma.orderItem.findUniqueOrThrow({ where: { id } });
  await call(
    'KITCHEN',
    'patch',
    `/kitchen/items/${id}/status`,
    { status: 'PREPARING', version: 1 },
    key,
  ).expect(200);
  expect(
    (await prisma.orderItem.findUniqueOrThrow({ where: { id } })).preparingAt,
  ).toEqual(first.preparingAt);
  await call('KITCHEN', 'patch', `/kitchen/items/${id}/status`, {
    status: 'READY',
    version: 2,
  }).expect(200);
  await call('WAITER', 'patch', `/orders/${order.id}/items/${id}`, {
    status: 'SERVED',
    version: 3,
  }).expect(200);
  const timed = await prisma.orderItem.findUniqueOrThrow({ where: { id } });
  expect(timed.preparingAt!.getTime()).toBeGreaterThanOrEqual(
    timed.createdAt.getTime(),
  );
  expect(timed.readyAt!.getTime()).toBeGreaterThanOrEqual(
    timed.preparingAt!.getTime(),
  );
  expect(timed.servedAt!.getTime()).toBeGreaterThanOrEqual(
    timed.readyAt!.getTime(),
  );
});

test('empty authorized branch reports insufficient evidence instead of invented recommendations', async () => {
  const branch = await prisma.branch.create({
    data: { tenantId, name: 'Empty authorized branch' },
  });
  await prisma.branchMembership.create({
    data: { tenantId, membershipId, branchId: branch.id },
  });
  for (const tool of [
    'MENU_SUGGESTIONS',
    'DEMAND_FORECAST',
    'KITCHEN_DELAYS',
  ] as const) {
    const result = await executeManagerReport(
      prisma,
      { ...scope(), branchId: branch.id },
      { tool, period: 'LAST_7_DAYS' },
      anchor,
    );
    expect(result.explanation).toMatch(/کافی نیست/);
    expect(result.sections?.flatMap((s) => s.rows).length || 0).toBe(
      tool === 'KITCHEN_DELAYS' ? 1 : 0,
    );
  }
});
