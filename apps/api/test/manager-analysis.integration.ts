import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
import { hashPassword } from '../../../packages/database/src/password';
import {
  processAnalysis,
  reconcileAnalyses,
  AnalysisJob,
} from '../../worker/src/analysis';
import { redisConnection } from '../../worker/src/processor';
import { executeManagerReport } from '../../../packages/insights/src/report';
import { processNotificationEvent } from '../../../packages/notifications/src/persistence';
import type { ManagerPlan } from '../../../packages/shared/src/manager-analysis';
let app: INestApplication,
  tenantId: string,
  branchId: string,
  actorId: string,
  membershipId: string;
const cookies: Record<string, string> = {},
  password = 'Manager-Analysis-Test-2026!';
function call(
  method: 'get' | 'post',
  path: string,
  role = 'MANAGER',
  key = randomUUID(),
) {
  const s = request(app.getHttpServer());
  return s[method]('/api/v1' + path)
    .set('Cookie', cookies[role])
    .set('X-CSRF-Protection', '1')
    .set('Idempotency-Key', key);
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Dedicated test database required');
  tenantId = (
    await prisma.restaurant.create({ data: { name: 'Analysis fixture' } })
  ).id;
  branchId = (await prisma.branch.create({ data: { tenantId, name: 'Main' } }))
    .id;
  app = await createApp();
  await app.init();
  for (const role of ['MANAGER', 'WAITER', 'OTHER', 'PEER'] as const) {
    const email = randomUUID() + '@analysis.test';
    const user = await prisma.user.create({
      data: { email, name: role, passwordHash: await hashPassword(password) },
    });
    const tenant =
      role === 'OTHER'
        ? (await prisma.restaurant.create({ data: { name: 'Other fixture' } }))
            .id
        : tenantId;
    const branch =
      role === 'OTHER'
        ? (
            await prisma.branch.create({
              data: { tenantId: tenant, name: 'Other' },
            })
          ).id
        : branchId;
    const member = await prisma.membership.create({
      data: {
        tenantId: tenant,
        userId: user.id,
        role: role === 'WAITER' ? 'WAITER' : 'MANAGER',
      },
    });
    await prisma.branchMembership.create({
      data: { tenantId: tenant, membershipId: member.id, branchId: branch },
    });
    if (role === 'MANAGER') {
      actorId = user.id;
      membershipId = member.id;
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
async function waitReady(id: string) {
  for (let i = 0; i < 150; i++) {
    const row = await prisma.aiAnalysis.findUniqueOrThrow({ where: { id } });
    if (row.status === 'READY') return row;
    await new Promise((r) => setTimeout(r, 40));
  }
  throw new Error('Analysis did not finish');
}
async function salesFixture(tenant: string, branch: string, value = 3800000) {
  const category = await prisma.category.create({
    data: { tenantId: tenant, name: randomUUID() },
  });
  const item = await prisma.menuItem.create({
    data: {
      tenantId: tenant,
      categoryId: category.id,
      name: 'کباب آزمون',
      description: '',
      priceRial: value,
    },
  });
  const table = await prisma.restaurantTable.create({
    data: {
      tenantId: tenant,
      branchId: branch,
      number: Math.floor(Math.random() * 100000000),
    },
  });
  return prisma.order.create({
    data: {
      tenantId: tenant,
      branchId: branch,
      tableId: table.id,
      status: 'COMPLETED',
      completedAt: new Date(Date.now() - 60000),
      items: {
        create: {
          menuItemId: item.id,
          name: item.name,
          priceRial: value,
          quantity: 2,
          status: 'SERVED',
        },
      },
    },
  });
}
test('durable analysis retries through Redis, scopes facts, emits one private completion, and never mutates orders', async () => {
  const order = await salesFixture(tenantId, branchId);
  const line = await prisma.orderItem.findFirstOrThrow({
    where: { orderId: order.id },
  });
  await prisma.orderItem.create({
    data: {
      tenantId,
      branchId,
      orderId: order.id,
      menuItemId: line.menuItemId,
      name: line.name,
      priceRial: line.priceRial,
      quantity: 1,
      status: 'CANCELLED',
      cancelledAt: new Date(Date.now() - 30000),
    },
  });
  const otherBranch = await prisma.branch.create({
    data: { tenantId, name: 'Different branch' },
  });
  await salesFixture(tenantId, otherBranch.id, 99000000);
  const otherTenant = await prisma.restaurant.create({
    data: { name: 'Foreign tenant' },
  });
  const foreignBranch = await prisma.branch.create({
    data: { tenantId: otherTenant.id, name: 'Foreign' },
  });
  await salesFixture(otherTenant.id, foreignBranch.id, 88000000);
  const input = { question: 'پرفروش‌ترین غذاهای هفت روز اخیر کدام‌اند؟' },
    key = randomUUID();
  const created = await call('post', '/ai/analyses', 'MANAGER', key)
    .send(input)
    .expect(201);
  const replay = await call('post', '/ai/analyses', 'MANAGER', key)
    .send(input)
    .expect(201);
  expect(replay.body.id).toBe(created.body.id);
  await call('get', '/ai/analyses/' + created.body.id, 'OTHER').expect(404);
  await call('get', '/ai/analyses/' + created.body.id, 'PEER').expect(404);
  const peerHistory = await call('get', '/ai/analyses', 'PEER').expect(200);
  expect(peerHistory.body).toEqual([]);
  await call('get', '/ai/analyses/' + created.body.id, 'WAITER').expect(403);
  await call('post', '/ai/analyses')
    .send({ ...input, tenantId: otherTenant.id })
    .expect(400);
  const name = 'analysis-integration-' + randomUUID(),
    connection = redisConnection(),
    queue = new Queue<AnalysisJob>(name, {
      connection: { ...connection, maxRetriesPerRequest: 1 },
    });
  let calls = 0;
  const worker = new Worker<AnalysisJob>(
    name,
    (job) =>
      processAnalysis(
        prisma,
        {
          plan: async () => {
            calls++;
            if (calls === 1) throw new Error('AI_PROVIDER_TEMPORARY');
            return { tool: 'TOP_SELLERS', period: 'LAST_7_DAYS' };
          },
        },
        job.data,
      ),
    { connection, concurrency: 1 },
  );
  try {
    await reconcileAnalyses(prisma, queue);
    const ready = await waitReady(created.body.id);
    expect(ready.attempts).toBe(2);
    const result = ready.result as unknown as {
      items: { quantity: number; valueRial: string }[];
    };
    expect(result.items).toHaveLength(1);
    expect(result.items[0].quantity).toBe(2);
    expect(result.items[0].valueRial).toBe('7600000');
    await processAnalysis(
      prisma,
      {
        plan: async () => {
          throw new Error('must not run');
        },
      },
      { tenantId, analysisId: ready.id },
    );
    const event = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { dedupeKey: 'analysis-ready:' + ready.id },
    });
    await processNotificationEvent(prisma, event.id);
    await processNotificationEvent(prisma, event.id);
    expect(
      await prisma.notification.count({
        where: { eventId: event.id, recipientId: actorId, branchId },
      }),
    ).toBe(1);
    const unchanged = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(unchanged.version).toBe(1);
    expect(unchanged.status).toBe('COMPLETED');
    expect(
      await prisma.notification.count({ where: { eventId: event.id } }),
    ).toBe(1);
    const history = await call('get', '/ai/analyses').expect(200);
    expect(history.body.some((x: { id: string }) => x.id === ready.id)).toBe(
      true,
    );
    const oldLimit = process.env.AI_DAILY_REQUEST_LIMIT;
    process.env.AI_DAILY_REQUEST_LIMIT = '1';
    try {
      await call('post', '/ai/analyses').send(input).expect(429);
      await call('post', '/ai/menu-drafts')
        .send({ input: 'کباب ۳۸۰ هزار تومان' })
        .expect(404);
      await call('post', '/ai/analyses', 'MANAGER', key)
        .send(input)
        .expect(201);
    } finally {
      if (oldLimit === undefined) delete process.env.AI_DAILY_REQUEST_LIMIT;
      else process.env.AI_DAILY_REQUEST_LIMIT = oldLimit;
    }
  } finally {
    await worker.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
test('report scope is reauthorized and arbitrary tool fields cannot reach a query', async () => {
  const scope = { tenantId, branchId, actorId, membershipId };
  const result = await executeManagerReport(
    prisma,
    scope,
    { tool: 'SALES_SUMMARY', period: 'LAST_7_DAYS' },
    new Date(),
  );
  expect(
    result.facts.find((x) => x.label === 'ارزش سفارش‌های تکمیل‌شده')?.value,
  ).toBe('7600000');
  const cancellations = await executeManagerReport(
    prisma,
    scope,
    { tool: 'CANCELLATIONS', period: 'LAST_7_DAYS' },
    new Date(),
  );
  expect(
    cancellations.facts.find((x) => x.label === 'تعداد اقلام لغوشده')?.value,
  ).toBe('1');
  await expect(
    executeManagerReport(
      prisma,
      scope,
      {
        tool: 'TOP_SELLERS',
        period: 'TODAY',
        tenantId: randomUUID(),
      } as unknown as ManagerPlan,
      new Date(),
    ),
  ).rejects.toThrow('AI_INVALID_TOOL');
  await expect(
    executeManagerReport(
      prisma,
      { ...scope, branchId: randomUUID() },
      { tool: 'TOP_SELLERS', period: 'TODAY' },
      new Date(),
    ),
  ).rejects.toThrow('AI_ACCESS_REVOKED');
  const row = await prisma.aiAnalysis.create({
    data: { ...scope, question: 'پرسش نامعتبر' },
  });
  let called = false;
  await prisma.membership.update({
    where: { id: membershipId },
    data: { active: false },
  });
  try {
    await expect(
      processAnalysis(
        prisma,
        {
          plan: async () => {
            called = true;
            return { tool: 'TOP_SELLERS', period: 'TODAY' };
          },
        },
        { tenantId, analysisId: row.id },
      ),
    ).rejects.toThrow('AI_ACCESS_REVOKED');
    expect(called).toBe(false);
  } finally {
    await prisma.membership.update({
      where: { id: membershipId },
      data: { active: true },
    });
  }
});

test('expired leases are fenced and exhausted attempts produce only one failure event', async () => {
  const row = await prisma.aiAnalysis.create({
    data: {
      tenantId,
      branchId,
      actorId,
      membershipId,
      question: 'فروش هفت روز اخیر چقدر است؟',
    },
  });
  let release!: (value: ManagerPlan) => void;
  const gate = new Promise<ManagerPlan>((resolve) => {
    release = resolve;
  });
  const first = processAnalysis(
    prisma,
    { plan: () => gate },
    { tenantId, analysisId: row.id },
  );
  try {
    for (let i = 0; i < 100; i++) {
      const state = await prisma.aiAnalysis.findUniqueOrThrow({
        where: { id: row.id },
      });
      if (state.status === 'PROCESSING') break;
      await new Promise((r) => setTimeout(r, 10));
    }
    await prisma.aiAnalysis.update({
      where: { id: row.id },
      data: { leaseUntil: new Date(0) },
    });
    await processAnalysis(
      prisma,
      { plan: async () => ({ tool: 'CANCELLATIONS', period: 'LAST_7_DAYS' }) },
      { tenantId, analysisId: row.id },
    );
    release({ tool: 'TOP_SELLERS', period: 'TODAY' });
    await first;
    const saved = await prisma.aiAnalysis.findUniqueOrThrow({
      where: { id: row.id },
    });
    expect((saved.result as { tool: string }).tool).toBe('CANCELLATIONS');
    expect(
      await prisma.notificationOutbox.count({
        where: { dedupeKey: 'analysis-ready:' + row.id },
      }),
    ).toBe(1);
  } finally {
    release({ tool: 'UNSUPPORTED', period: 'TODAY' });
    await first;
  }
  const exhausted = await prisma.aiAnalysis.create({
    data: {
      tenantId,
      branchId,
      actorId,
      membershipId,
      question: 'پرسش قدیمی مدیر',
      status: 'PROCESSING',
      attempts: 3,
      leaseToken: randomUUID(),
      leaseUntil: new Date(0),
    },
  });
  const queue = new Queue<AnalysisJob>('analysis-exhausted-' + randomUUID(), {
    connection: { ...redisConnection(), maxRetriesPerRequest: 1 },
  });
  try {
    await reconcileAnalyses(prisma, queue);
    await reconcileAnalyses(prisma, queue);
    expect(
      (
        await prisma.aiAnalysis.findUniqueOrThrow({
          where: { id: exhausted.id },
        })
      ).status,
    ).toBe('FAILED');
    expect(
      await prisma.notificationOutbox.count({
        where: { dedupeKey: 'analysis-failed:' + exhausted.id },
      }),
    ).toBe(1);
    const expired = await prisma.aiAnalysis.create({
      data: {
        tenantId,
        branchId,
        actorId,
        membershipId,
        question: 'پرسش منقضی مدیر',
        status: 'FAILED',
        createdAt: new Date(Date.now() - 31 * 86400000),
      },
    });
    await reconcileAnalyses(prisma, queue);
    expect(
      await prisma.aiAnalysis.findUnique({ where: { id: expired.id } }),
    ).toBeNull();
  } finally {
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
