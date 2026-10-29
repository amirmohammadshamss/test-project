import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AiWorkerRuntime } from '../src/worker.module';
import { randomUUID } from 'node:crypto';
import { Queue } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import {
  createWorker,
  DraftJob,
  processDraft,
  reconcile,
  redisConnection,
} from '../src/processor';
import { PermanentFailure } from '../src/provider';
const db = new PrismaClient();
const tenantId = '10000000-0000-4000-8000-000000000001';
const otherTenant = '10000000-0000-4000-8000-000000000002';
const result = {
  name: 'برگر تست',
  description: 'گوشت و پنیر',
  priceToman: 450000,
  category: 'برگر',
};
const connection = redisConnection();
const name = `restaurantos-test-${randomUUID()}`;
const queue = new Queue<DraftJob>(name, {
  connection: { ...connection, maxRetriesPerRequest: 1 },
});
let actorId: string;
async function draft(input = 'برگر با قیمت ۴۵۰ هزار تومان') {
  return db.aiDraft.create({ data: { tenantId, actorId, input } });
}
async function waitFor(id: string, status: string, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const row = await db.aiDraft.findUniqueOrThrow({ where: { id } });
    if (row.status === status) return row;
    await new Promise((r) => setTimeout(r, 30));
  }
  throw new Error(`Timed out waiting for ${status}`);
}
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Dedicated test database required');
  actorId = (
    await db.user.findUniqueOrThrow({
      where: { email: 'manager@demo.restaurantos.test' },
    })
  ).id;
});
afterAll(async () => {
  await queue.close();
  await db.$disconnect();
});
test('persist-before-enqueue recovers, transient provider failure retries through real Redis and duplicate delivery does not apply twice', async () => {
  const row = await draft();
  let calls = 0;
  const worker = createWorker(
    db,
    {
      parse: async () => {
        calls++;
        if (calls === 1) throw new Error('AI_PROVIDER_TEMPORARY');
        return result;
      },
    },
    connection,
    name,
  );
  try {
    await reconcile(db, queue);
    const ready = await waitFor(row.id, 'READY');
    expect(ready.result).toEqual(result);
    expect(ready.attempts).toBe(2);
    expect(
      await db.notificationOutbox.count({
        where: { dedupeKey: 'ai-ready:' + row.id, type: 'AI_READY' },
      }),
    ).toBe(1);
    const before = calls;
    await processDraft(
      db,
      {
        parse: async () => {
          calls++;
          return result;
        },
      },
      { tenantId, draftId: row.id },
    );
    expect(calls).toBe(before);
    const same = await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } });
    expect(same.result).toEqual(result);
    expect(same.menuItemId).toBeNull();
  } finally {
    await worker.close();
  }
});
test('permanent failures stop immediately and persist a visible failure state', async () => {
  const row = await draft();
  let calls = 0;
  const worker = createWorker(
    db,
    {
      parse: async () => {
        calls++;
        throw new PermanentFailure('AI_INVALID_OUTPUT');
      },
    },
    connection,
    name,
  );
  try {
    await reconcile(db, queue);
    const failed = await waitFor(row.id, 'FAILED');
    expect(failed.attempts).toBe(1);
    expect(failed.errorCode).toBe('AI_INVALID_OUTPUT');
    expect(
      await db.notificationOutbox.count({
        where: { dedupeKey: 'ai-failed:' + row.id, type: 'AI_FAILED' },
      }),
    ).toBe(1);
    expect(calls).toBe(1);
  } finally {
    await worker.close();
  }
});
test('invalid structured output is rejected by application schema', async () => {
  const row = await draft();
  await expect(
    processDraft(
      db,
      { parse: async () => ({ ...result, priceToman: -1 }) },
      { tenantId, draftId: row.id },
    ),
  ).rejects.toThrow('AI_INVALID_OUTPUT');
  expect(
    (await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } })).status,
  ).toBe('FAILED');
});
test('cross-tenant worker identity cannot claim a draft', async () => {
  const row = await draft();
  await expect(
    processDraft(
      db,
      { parse: async () => result },
      { tenantId: otherTenant, draftId: row.id },
    ),
  ).rejects.toThrow('DRAFT_NOT_FOUND');
  expect(
    (await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } })).attempts,
  ).toBe(0);
  await db.aiDraft.update({
    where: { id: row.id },
    data: { status: 'FAILED' },
  });
});
test('concurrent worker deliveries use one lease and persist one result', async () => {
  const row = await draft();
  let calls = 0;
  const parser = {
    parse: async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 30));
      return result;
    },
  };
  await Promise.all([
    processDraft(db, parser, { tenantId, draftId: row.id }),
    processDraft(db, parser, { tenantId, draftId: row.id }),
  ]);
  expect(calls).toBe(1);
  expect(
    (await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } })).status,
  ).toBe('READY');
});
test('killed worker lease recovers; exhausted killed attempt becomes a persisted terminal failure', async () => {
  const row = await draft();
  await db.aiDraft.update({
    where: { id: row.id },
    data: {
      status: 'PROCESSING',
      attempts: 1,
      leaseToken: randomUUID(),
      leaseUntil: new Date(Date.now() - 1000),
    },
  });
  await processDraft(
    db,
    { parse: async () => result },
    { tenantId, draftId: row.id },
  );
  expect(
    (await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } })).status,
  ).toBe('READY');
  const exhausted = await draft();
  await db.aiDraft.update({
    where: { id: exhausted.id },
    data: {
      status: 'PROCESSING',
      attempts: 3,
      leaseUntil: new Date(Date.now() - 1000),
    },
  });
  await reconcile(db, queue);
  expect(
    (await db.aiDraft.findUniqueOrThrow({ where: { id: exhausted.id } }))
      .errorCode,
  ).toBe('AI_ATTEMPTS_EXHAUSTED');
});
test('transient failures are bounded by persisted attempt count', async () => {
  const row = await draft();
  const parser = {
    parse: async () => {
      throw new Error('AI_PROVIDER_TEMPORARY');
    },
  };
  for (let attempt = 0; attempt < 3; attempt++)
    await expect(
      processDraft(db, parser, { tenantId, draftId: row.id }),
    ).rejects.toThrow('AI_PROVIDER_TEMPORARY');
  await processDraft(db, parser, { tenantId, draftId: row.id });
  const failed = await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } });
  expect(failed.status).toBe('FAILED');
  expect(failed.attempts).toBe(3);
});

test('dispatcher cleans expired idempotency records', async () => {
  const record = await db.idempotencyRecord.create({
    data: {
      tenantId,
      actorId,
      operation: 'test.expired',
      key: randomUUID(),
      fingerprint: 'test',
      response: { ok: true },
      expiresAt: new Date(Date.now() - 1000),
    },
  });
  await reconcile(db, queue);
  expect(
    await db.idempotencyRecord.findUnique({ where: { id: record.id } }),
  ).toBeNull();
});

@Module({})
class TestWorkerModule {}
test('Nest module lifecycle starts dispatch/processing and closes worker resources', async () => {
  const row = await draft();
  const context = await NestFactory.createApplicationContext(
    {
      module: TestWorkerModule,
      providers: [
        {
          provide: AiWorkerRuntime,
          useFactory: () =>
            new AiWorkerRuntime(db, { parse: async () => result }, name),
        },
      ],
    },
    { logger: false },
  );
  try {
    expect((await waitFor(row.id, 'READY')).result).toEqual(result);
  } finally {
    await context.close();
  }
});

test('usage is persisted with the result and lost authorization prevents provider access', async () => {
  const row = await draft();
  await processDraft(
    db,
    {
      parse: async (_input, usage) => {
        usage?.({
          provider: 'test',
          model: 'test',
          inputTokens: 12,
          outputTokens: 8,
        });
        return result;
      },
    },
    { tenantId, draftId: row.id },
  );
  const ready = await db.aiDraft.findUniqueOrThrow({ where: { id: row.id } });
  expect(ready.inputTokens).toBe(12);
  expect(ready.outputTokens).toBe(8);
  expect(ready.usageSamples).toBe(1);
  const noActor = await db.aiDraft.create({
    data: { tenantId, actorId: randomUUID(), input: 'برگر ۴۵۰ هزار تومان' },
  });
  const parser = { parse: jest.fn(async () => result) };
  await expect(
    processDraft(db, parser, { tenantId, draftId: noActor.id }),
  ).rejects.toThrow('AI_ACCESS_REVOKED');
  expect(parser.parse).not.toHaveBeenCalled();
});
