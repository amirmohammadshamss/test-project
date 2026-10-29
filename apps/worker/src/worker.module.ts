import { Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import { Queue, Worker } from 'bullmq';
import { prisma } from '../../../packages/database/src/client';
import {
  createWorker,
  DraftJob,
  queueName,
  reconcile,
  redisConnection,
} from './processor';
import { MenuParser, OpenAiMenuParser } from './provider';
export class AiWorkerRuntime implements OnModuleInit, OnModuleDestroy {
  private queue!: Queue<DraftJob>;
  private worker!: Worker<DraftJob>;
  private timer?: ReturnType<typeof setInterval>;
  private dispatching?: Promise<void>;
  constructor(
    private readonly db: PrismaClient,
    private readonly parser: MenuParser,
    private readonly name = queueName,
  ) {}
  onModuleInit() {
    const connection = redisConnection();
    this.queue = new Queue<DraftJob>(this.name, {
      connection: { ...connection, maxRetriesPerRequest: 1 },
    });
    this.queue.on('error', () =>
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          module: 'dispatcher',
          errorCode: 'QUEUE_UNAVAILABLE',
        }),
      ),
    );
    this.worker = createWorker(this.db, this.parser, connection, this.name);
    this.timer = setInterval(() => this.dispatch(), 5000);
    this.dispatch();
  }
  private dispatch() {
    if (this.dispatching) return;
    this.dispatching = reconcile(this.db, this.queue)
      .catch(() => {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            module: 'dispatcher',
            errorCode: 'DISPATCH_PENDING_RECOVERY',
          }),
        );
      })
      .finally(() => {
        this.dispatching = undefined;
      });
  }
  async onModuleDestroy() {
    clearInterval(this.timer);
    await this.dispatching;
    await this.worker.close();
    await this.queue.close();
    await this.db.$disconnect();
  }
}
@Module({
  providers: [
    {
      provide: AiWorkerRuntime,
      useFactory: () => new AiWorkerRuntime(prisma, new OpenAiMenuParser()),
    },
  ],
})
export class AiWorkerModule {}
