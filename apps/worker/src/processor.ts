import { recordNotificationEvent } from '../../../packages/notifications/src/persistence';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { Job, Queue, UnrecoverableError, Worker } from 'bullmq';
import { menuDraftSchema } from '../../../packages/shared/src/menu-draft';
import {
  MenuParser,
  PermanentFailure,
  AiUsage,
} from '../../../packages/shared/src/ai';
export const queueName = 'ai-menu-processing';
export function redisConnection(
  url = process.env.REDIS_URL || 'redis://127.0.0.1:6379',
) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    maxRetriesPerRequest: null,
  };
}
export interface DraftJob {
  tenantId: string;
  draftId: string;
}
export async function processDraft(
  db: PrismaClient,
  parser: MenuParser,
  data: DraftJob,
) {
  const draft = await db.aiDraft.findFirst({
    where: { id: data.draftId, tenantId: data.tenantId },
  });
  if (!draft) throw new UnrecoverableError('DRAFT_NOT_FOUND');
  if (['READY', 'APPROVED', 'FAILED'].includes(draft.status)) return;
  const leaseToken = randomUUID();
  const claimed = await db.aiDraft.updateMany({
    where: {
      id: draft.id,
      tenantId: draft.tenantId,
      attempts: { lt: 3 },
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', leaseUntil: { lt: new Date() } },
      ],
    },
    data: {
      status: 'PROCESSING',
      attempts: { increment: 1 },
      leaseToken,
      leaseUntil: new Date(Date.now() + 60000),
    },
  });
  if (!claimed.count) return;
  const current = await db.aiDraft.findUniqueOrThrow({
    where: { id: draft.id },
  });
  const ownLease = {
    id: draft.id,
    tenantId: draft.tenantId,
    status: 'PROCESSING' as const,
    leaseToken,
  };
  const started = Date.now();
  let usage: AiUsage | undefined;
  const measurements = () => ({
    processingMs: { increment: Math.min(Date.now() - started, 2147483647) },
    ...(usage
      ? {
          provider: usage.provider.slice(0, 80),
          model: usage.model.slice(0, 160),
          inputTokens: { increment: Math.min(usage.inputTokens || 0, 1000000) },
          outputTokens: {
            increment: Math.min(usage.outputTokens || 0, 1000000),
          },
          usageSamples: { increment: 1 },
        }
      : {}),
  });
  try {
    // Recheck live tenant/actor rights before sending data to any provider.
    const eligible = await db.membership.findFirst({
      where: {
        tenantId: draft.tenantId,
        userId: draft.actorId,
        active: true,
        role: 'MANAGER',
        user: { active: true },
        restaurant: { status: 'ACTIVE' },
      },
    });
    if (!eligible) throw new PermanentFailure('AI_ACCESS_REVOKED');
    const parsed = menuDraftSchema.safeParse(
      await parser.parse(draft.input, (value) => {
        usage = value;
      }),
    );
    if (!parsed.success) throw new PermanentFailure('AI_INVALID_OUTPUT');
    await db.$transaction(async (tx) => {
      const updated = await tx.aiDraft.updateMany({
        where: ownLease,
        data: {
          status: 'READY',
          result: parsed.data,
          errorCode: null,
          leaseUntil: null,
          leaseToken: null,
          ...measurements(),
        },
      });
      if (updated.count)
        await recordNotificationEvent(tx, {
          dedupeKey: 'ai-ready:' + draft.id,
          realm: 'RESTAURANT',
          type: 'AI_READY',
          tenantId: draft.tenantId,
          entityId: draft.id,
          payload: { actorId: draft.actorId },
        });
    });
  } catch (error) {
    const permanent = error instanceof PermanentFailure;
    const exhausted = current.attempts >= 3;
    const code =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : 'AI_PROCESSING_FAILED';
    await db.$transaction(async (tx) => {
      const updated = await tx.aiDraft.updateMany({
        where: ownLease,
        data: {
          ...measurements(),
          status: permanent || exhausted ? 'FAILED' : 'PENDING',
          errorCode: code,
          leaseUntil: null,
          leaseToken: null,
        },
      });
      if (updated.count && (permanent || exhausted))
        await recordNotificationEvent(tx, {
          dedupeKey: 'ai-failed:' + draft.id,
          realm: 'RESTAURANT',
          type: 'AI_FAILED',
          tenantId: draft.tenantId,
          entityId: draft.id,
          payload: { actorId: draft.actorId },
        });
    });
    if (permanent || exhausted) throw new UnrecoverableError(code);
    throw new Error(code);
  }
}
export async function reconcile(db: PrismaClient, queue: Queue<DraftJob>) {
  // A killed last attempt must also reach a terminal, persisted failure state.
  await db.$transaction(async (tx) => {
    const stale = await tx.aiDraft.findMany({
      where: {
        status: 'PROCESSING',
        attempts: { gte: 3 },
        leaseUntil: { lt: new Date() },
      },
    });
    for (const draft of stale) {
      const updated = await tx.aiDraft.updateMany({
        where: {
          id: draft.id,
          status: 'PROCESSING',
          leaseToken: draft.leaseToken,
          leaseUntil: { lt: new Date() },
        },
        data: {
          status: 'FAILED',
          errorCode: 'AI_ATTEMPTS_EXHAUSTED',
          leaseUntil: null,
          leaseToken: null,
        },
      });
      if (updated.count)
        await recordNotificationEvent(tx, {
          dedupeKey: 'ai-failed:' + draft.id,
          realm: 'RESTAURANT',
          type: 'AI_FAILED',
          tenantId: draft.tenantId,
          entityId: draft.id,
          payload: { actorId: draft.actorId },
        });
    }
  });
  await db.idempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await db.platformIdempotencyRecord.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  // Terminal/abandoned requests retain original text and results for 30 days only.
  await db.aiDraft.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
      OR: [
        { status: { not: 'PROCESSING' } },
        { leaseUntil: { lt: new Date() } },
      ],
    },
  });
  const drafts = await db.aiDraft.findMany({
    where: {
      attempts: { lt: 3 },
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', leaseUntil: { lt: new Date() } },
      ],
    },
    take: 100,
    orderBy: { createdAt: 'asc' },
  });
  for (const draft of drafts) {
    const jobId = `menu-${draft.tenantId}-${draft.id}`;
    const existing = await queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (state === 'completed' || state === 'failed') await existing.remove();
      else continue;
    }
    await queue.add(
      'generate-menu-draft',
      { tenantId: draft.tenantId, draftId: draft.id },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { age: 86400, count: 1000 },
        removeOnFail: { age: 604800, count: 1000 },
      },
    );
  }
}
export function createWorker(
  db: PrismaClient,
  parser: MenuParser,
  connection = redisConnection(),
  name = queueName,
) {
  const worker = new Worker<DraftJob>(
    name,
    (job: Job<DraftJob>) => processDraft(db, parser, job.data),
    { connection, concurrency: 2, maxStalledCount: 1 },
  );
  worker.on('failed', (job, error) =>
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'error',
        module: 'ai-worker',
        operation: 'generate-menu-draft',
        jobId: job?.id,
        tenantId: job?.data.tenantId,
        errorCode: /^[A-Z_]+$/.test(error.message)
          ? error.message
          : 'QUEUE_JOB_FAILED',
        duration: job?.processedOn ? Date.now() - job.processedOn : undefined,
      }),
    ),
  );
  worker.on('completed', (job) =>
    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        module: 'ai-worker',
        operation: 'generate-menu-draft',
        jobId: job.id,
        tenantId: job.data.tenantId,
        duration: job.processedOn ? Date.now() - job.processedOn : undefined,
      }),
    ),
  );
  worker.on('error', () =>
    console.error(
      JSON.stringify({
        level: 'error',
        module: 'ai-worker',
        errorCode: 'QUEUE_CONNECTION_FAILED',
      }),
    ),
  );
  return worker;
}
