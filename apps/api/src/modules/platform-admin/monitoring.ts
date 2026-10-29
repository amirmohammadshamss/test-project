import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { prisma } from '../../../../../packages/database/src/client';
const timeout = <T>(promise: Promise<T>, ms = 1500) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('CHECK_TIMEOUT')), ms);
      timer.unref();
    }),
  ]);
@Injectable()
export class PlatformMonitoring {
  async health() {
    let database = 'unavailable';
    try {
      await timeout(prisma.$queryRaw`SELECT 1`);
      database = 'ready';
    } catch {
      // Report unavailable without failing unrelated operations.
    }
    const queues = await this.queues();
    return {
      api: 'ready',
      database,
      redis: queues.redis,
      worker: queues.worker,
      checkedAt: new Date(),
    };
  }
  async queues() {
    const checkedAt = new Date();
    const parsed = new URL(process.env.REDIS_URL || 'redis://127.0.0.1:6379');
    const queue = new Queue('ai-menu-processing', {
      connection: {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        username: parsed.username || undefined,
        password: parsed.password || undefined,
        ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
        connectTimeout: 1000,
        maxRetriesPerRequest: 1,
        retryStrategy: () => null,
        enableOfflineQueue: false,
      },
    });
    queue.on('error', () => {});
    try {
      const data = await timeout(
        (async () => {
          const client = await queue.client;
          const heartbeat = await client.get('restaurantos:worker:heartbeat');
          const counts = await queue.getJobCounts(
            'waiting',
            'active',
            'completed',
            'failed',
            'delayed',
          );
          const failed = await queue.getFailed(0, 4);
          return {
            redis: 'ready',
            worker: {
              available: Boolean(
                heartbeat && Date.now() - new Date(heartbeat).getTime() < 20000,
              ),
              lastSeen: heartbeat || null,
            },
            counts,
            failures: failed.map((job) => ({
              id: job.id,
              code: /^[A-Z_]+$/.test(job.failedReason)
                ? job.failedReason
                : 'JOB_FAILED',
              attempts: job.attemptsMade,
              finishedAt: job.finishedOn || null,
            })),
          };
        })(),
      );
      return { name: 'ai-menu-processing', ...data, checkedAt };
    } catch {
      return {
        name: 'ai-menu-processing',
        redis: 'unavailable',
        worker: { available: false, lastSeen: null },
        counts: null,
        failures: [],
        checkedAt,
      };
    } finally {
      await queue.disconnect();
    }
  }
}
