import type { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Queue, Worker, UnrecoverableError, Job } from 'bullmq';
import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { ManagerPlanner } from '../../../packages/shared/src/manager-analysis';
import { managerPlanSchema } from '../../../packages/shared/src/manager-analysis';
import { PermanentFailure, AiUsage } from '../../../packages/shared/src/ai';
import { executeManagerReport } from '../../../packages/insights/src/report';
import { recordNotificationEvent } from '../../../packages/notifications/src/persistence';
import { redisConnection } from './processor';
export const analysisQueue = 'ai-manager-analysis';
export interface AnalysisJob {
  tenantId: string;
  analysisId: string;
}
async function access(
  db: PrismaClient,
  row: {
    tenantId: string;
    branchId: string;
    actorId: string;
    membershipId: string;
  },
) {
  return db.membership.findFirst({
    where: {
      id: row.membershipId,
      tenantId: row.tenantId,
      userId: row.actorId,
      role: 'MANAGER',
      active: true,
      user: { active: true },
      restaurant: { status: 'ACTIVE' },
      branches: { some: { branchId: row.branchId, branch: { active: true } } },
    },
  });
}
export async function processAnalysis(
  db: PrismaClient,
  planner: ManagerPlanner,
  data: AnalysisJob,
) {
  const row = await db.aiAnalysis.findFirst({
    where: { id: data.analysisId, tenantId: data.tenantId },
  });
  if (!row) throw new UnrecoverableError('ANALYSIS_NOT_FOUND');
  if (['READY', 'FAILED'].includes(row.status)) return;
  const leaseToken = randomUUID();
  const claimed = await db.aiAnalysis.updateMany({
    where: {
      id: row.id,
      tenantId: row.tenantId,
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
  const current = await db.aiAnalysis.findUniqueOrThrow({
    where: { id: row.id },
  });
  const own = {
    id: row.id,
    tenantId: row.tenantId,
    status: 'PROCESSING' as const,
    leaseToken,
  };
  const started = Date.now();
  let usage: AiUsage | undefined;
  const measurements = () => ({
    processingMs: { increment: Date.now() - started },
    ...(usage
      ? {
          provider: usage.provider.slice(0, 80),
          model: usage.model.slice(0, 160),
          inputTokens: { increment: Math.min(usage.inputTokens || 0, 1000000) },
          outputTokens: {
            increment: Math.min(usage.outputTokens || 0, 1000000),
          },
        }
      : {}),
  });
  try {
    if (!(await access(db, row)))
      throw new PermanentFailure('AI_ACCESS_REVOKED');
    const plan = managerPlanSchema.safeParse(
      await planner.plan(row.question, (u) => {
        usage = u;
      }),
    );
    if (!plan.success) throw new PermanentFailure('AI_INVALID_TOOL');
    const result = await executeManagerReport(
      db,
      row,
      plan.data,
      row.createdAt,
    );
    await db.$transaction(async (tx) => {
      const updated = await tx.aiAnalysis.updateMany({
        where: own,
        data: {
          ...measurements(),
          status: 'READY',
          result: result as unknown as Prisma.InputJsonValue,
          errorCode: null,
          leaseToken: null,
          leaseUntil: null,
        },
      });
      if (updated.count)
        await recordNotificationEvent(tx, {
          dedupeKey: 'analysis-ready:' + row.id,
          realm: 'RESTAURANT',
          type: 'ANALYSIS_READY',
          tenantId: row.tenantId,
          branchId: row.branchId,
          entityId: row.id,
          payload: { actorId: row.actorId },
        });
    });
  } catch (error) {
    const terminal = error instanceof PermanentFailure || current.attempts >= 3;
    const code =
      error instanceof Error && /^[A-Z_]+$/.test(error.message)
        ? error.message
        : 'AI_ANALYSIS_FAILED';
    await db.$transaction(async (tx) => {
      const updated = await tx.aiAnalysis.updateMany({
        where: own,
        data: {
          ...measurements(),
          status: terminal ? 'FAILED' : 'PENDING',
          errorCode: code,
          leaseUntil: null,
          leaseToken: null,
        },
      });
      if (updated.count && terminal)
        await recordNotificationEvent(tx, {
          dedupeKey: 'analysis-failed:' + row.id,
          realm: 'RESTAURANT',
          type: 'ANALYSIS_FAILED',
          tenantId: row.tenantId,
          branchId: row.branchId,
          entityId: row.id,
          payload: { actorId: row.actorId },
        });
    });
    if (terminal) throw new UnrecoverableError(code);
    throw new Error(code);
  }
}
export async function reconcileAnalyses(
  db: PrismaClient,
  queue: Queue<AnalysisJob>,
) {
  const stale = await db.aiAnalysis.findMany({
    where: {
      status: 'PROCESSING',
      attempts: { gte: 3 },
      leaseUntil: { lt: new Date() },
    },
    take: 100,
  });
  for (const row of stale)
    await db.$transaction(async (tx) => {
      const updated = await tx.aiAnalysis.updateMany({
        where: {
          id: row.id,
          status: 'PROCESSING',
          leaseToken: row.leaseToken,
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
          dedupeKey: 'analysis-failed:' + row.id,
          realm: 'RESTAURANT',
          type: 'ANALYSIS_FAILED',
          tenantId: row.tenantId,
          branchId: row.branchId,
          entityId: row.id,
          payload: { actorId: row.actorId },
        });
    });
  await db.aiAnalysis.deleteMany({
    where: {
      createdAt: { lt: new Date(Date.now() - 30 * 86400000) },
      OR: [
        { status: { not: 'PROCESSING' } },
        { leaseUntil: { lt: new Date() } },
      ],
    },
  });
  const rows = await db.aiAnalysis.findMany({
    where: {
      attempts: { lt: 3 },
      OR: [
        { status: 'PENDING' },
        { status: 'PROCESSING', leaseUntil: { lt: new Date() } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });
  for (const row of rows) {
    const jobId = 'analysis-' + row.id,
      old = await queue.getJob(jobId);
    if (old) {
      const state = await old.getState();
      if (['failed', 'completed'].includes(state)) await old.remove();
      else continue;
    }
    await queue.add(
      'analyze',
      { tenantId: row.tenantId, analysisId: row.id },
      {
        jobId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 1000 },
      },
    );
  }
}
export class AnalysisWorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<AnalysisJob>;
  private worker!: Worker<AnalysisJob>;
  private timer?: ReturnType<typeof setInterval>;
  private running?: Promise<void>;
  constructor(
    private readonly db: PrismaClient,
    private readonly planner: ManagerPlanner,
    private readonly name = analysisQueue,
  ) {}
  onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue(this.name, {
      connection: { ...connection, maxRetriesPerRequest: 1 },
    });
    this.queue.on('error', () => this.log('ANALYSIS_QUEUE_UNAVAILABLE'));
    this.worker = new Worker<AnalysisJob>(
      this.name,
      (job) => processAnalysis(this.db, this.planner, job.data),
      { connection, concurrency: 2, maxStalledCount: 1 },
    );
    this.worker.on('error', () => this.log('ANALYSIS_WORKER_UNAVAILABLE'));
    this.worker.on('failed', (job, error) =>
      this.log(
        /^[A-Z_]+$/.test(error.message) ? error.message : 'AI_ANALYSIS_FAILED',
        job,
      ),
    );
    this.timer = setInterval(() => this.dispatch(), 5000);
    this.dispatch();
  }
  private log(errorCode: string, job?: Job<AnalysisJob>) {
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'warn',
        module: 'ai-analysis',
        errorCode,
        jobId: job?.id,
        analysisId: job?.data.analysisId,
        tenantId: job?.data.tenantId,
      }),
    );
  }
  private dispatch() {
    if (!this.running)
      this.running = reconcileAnalyses(this.db, this.queue)
        .then(async () => {
          const client = await this.queue.client;
          await client.set(
            'restaurantos:worker:heartbeat',
            new Date().toISOString(),
            { EX: 20 },
          );
        })
        .catch(() => this.log('ANALYSIS_DISPATCH_DEFERRED'))
        .finally(() => {
          this.running = undefined;
        });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.running;
    await this.worker.close();
    await this.queue.close();
  }
}
