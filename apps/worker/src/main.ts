import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AiWorkerModule } from './worker.module';
async function main() {
  const app = await NestFactory.createApplicationContext(AiWorkerModule);
  app.enableShutdownHooks(['SIGTERM', 'SIGINT']);
}
main().catch(() => {
  console.error('WORKER_START_FAILED');
  process.exit(1);
});
