import 'reflect-metadata';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
import { hashPassword } from '../../../packages/database/src/password';
import { processDraft, reconcile } from '../../worker/src/processor';
import { processNotificationEvent } from '../../../packages/notifications/src/persistence';
import { Queue } from 'bullmq';
import { redisConnection } from '../../worker/src/processor';
let app: INestApplication, cookie: string, tenantId: string, actorId: string;
const password = 'AI-Integration-2026!',
  email = randomUUID() + '@ai.test';
const result = {
  name: 'چلوکباب کوبیده',
  description: '',
  category: 'غذاهای ایرانی',
  priceToman: 380000,
};
function call(method: 'get' | 'post', path: string, key = randomUUID()) {
  const server = request(app.getHttpServer());
  return server[method]('/api/v1' + path)
    .set('Cookie', cookie)
    .set('X-CSRF-Protection', '1')
    .set('Idempotency-Key', key);
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Dedicated test database required');
  tenantId = (
    await prisma.restaurant.create({ data: { name: 'AI integration' } })
  ).id;
  const branch = await prisma.branch.create({
    data: { tenantId, name: 'Main' },
  });
  actorId = (
    await prisma.user.create({
      data: {
        email,
        name: 'Manager',
        passwordHash: await hashPassword(password),
      },
    })
  ).id;
  const m = await prisma.membership.create({
    data: { tenantId, userId: actorId, role: 'MANAGER' },
  });
  await prisma.branchMembership.create({
    data: { tenantId, membershipId: m.id, branchId: branch.id },
  });
  app = await createApp();
  await app.init();
  const r = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-CSRF-Protection', '1')
    .send({ email, password })
    .expect(200);
  cookie = r.headers['set-cookie'][0].split(';')[0];
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
test('durable request -> validated draft -> private completion -> explicit corrected approval, with concurrent daily cap and replay', async () => {
  const old = process.env.AI_DAILY_REQUEST_LIMIT;
  process.env.AI_DAILY_REQUEST_LIMIT = '1';
  try {
    const key = randomUUID();
    const payload = { input: 'چلوکباب کوبیده ۳۸۰ هزار تومان' };
    const created = await call('post', '/ai/menu-drafts', key)
      .send(payload)
      .expect(201);
    await call('post', '/ai/menu-drafts', key).send(payload).expect(201);
    const capped = await Promise.all([
      call('post', '/ai/menu-drafts').send(payload),
      call('post', '/ai/menu-drafts').send(payload),
    ]);
    expect(capped.map((r) => r.status)).toEqual([429, 429]);
    await processDraft(
      prisma,
      {
        parse: async (_input, usage) => {
          usage?.({
            provider: 'fixture',
            model: 'fixture',
            inputTokens: 40,
            outputTokens: 30,
          });
          return result;
        },
      },
      { tenantId, draftId: created.body.id },
    );
    const event = await prisma.notificationOutbox.findUniqueOrThrow({
      where: { dedupeKey: 'ai-ready:' + created.body.id },
    });
    await processNotificationEvent(prisma, event.id);
    await processNotificationEvent(prisma, event.id);
    const notices = await prisma.notification.findMany({
      where: { eventId: event.id },
    });
    expect(notices).toHaveLength(1);
    expect(notices[0].recipientId).toBe(actorId);
    const history = await call('get', '/ai/menu-drafts').expect(200);
    expect(history.body.map((d: { id: string }) => d.id)).toEqual([
      created.body.id,
    ]);
    expect(await prisma.menuItem.count({ where: { tenantId } })).toBe(0);
    const edits = { ...result, priceToman: 390000 };
    const approvals = await Promise.all([
      call('post', `/ai/menu-drafts/${created.body.id}/approve`).send(edits),
      call('post', `/ai/menu-drafts/${created.body.id}/approve`).send(edits),
    ]);
    expect(approvals.map((r) => r.status)).toEqual([201, 201]);
    expect(approvals[0].body.id).toBe(approvals[1].body.id);
    expect(approvals[0].body.priceRial).toBe(3900000);
    await call('post', `/ai/menu-drafts/${created.body.id}/approve`)
      .send({ ...edits, priceToman: 400000 })
      .expect(409);
    expect(await prisma.menuItem.count({ where: { tenantId } })).toBe(1);
    const metrics = await call('get', '/ai/menu-drafts/metrics').expect(200);
    expect(metrics.body.corrected).toBe(1);
    expect(metrics.body.totals.inputTokens).toBe(40);
    expect(metrics.body.currencyCost).toBeNull();
    await call('get', '/ai/menu-drafts/' + randomUUID()).expect(404);
  } finally {
    if (old === undefined) delete process.env.AI_DAILY_REQUEST_LIMIT;
    else process.env.AI_DAILY_REQUEST_LIMIT = old;
  }
});
test('retention removes expired drafts without deleting approved menu entries', async () => {
  const row = await prisma.aiDraft.create({
    data: {
      tenantId,
      actorId,
      input: 'منوی قدیمی',
      status: 'FAILED',
      createdAt: new Date(Date.now() - 31 * 86400000),
    },
  });
  const queue = new Queue('ai-retention-' + randomUUID(), {
    connection: { ...redisConnection(), maxRetriesPerRequest: 1 },
  });
  const count = await prisma.menuItem.count({ where: { tenantId } });
  try {
    await reconcile(prisma, queue);
    expect(
      await prisma.aiDraft.findUnique({ where: { id: row.id } }),
    ).toBeNull();
    expect(await prisma.menuItem.count({ where: { tenantId } })).toBe(count);
  } finally {
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
