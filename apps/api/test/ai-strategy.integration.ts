import 'reflect-metadata';
import request from 'supertest';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
let app: INestApplication;
beforeAll(async () => {
  app = await createApp();
  await app.init();
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
test('retired menu draft routes cannot create, retrieve or publish menu entries', async () => {
  for (const prefix of [
    '/api/v1/ai/menu-drafts',
    '/api/v1/admin/ai/menu-drafts',
  ]) {
    await request(app.getHttpServer()).get(prefix).expect(404);
    await request(app.getHttpServer())
      .post(prefix)
      .set('X-CSRF-Protection', '1')
      .send({ input: 'غذای آزمایشی' })
      .expect(404);
    await request(app.getHttpServer())
      .post(prefix + '/10000000-0000-4000-8000-000000000001/approve')
      .set('X-CSRF-Protection', '1')
      .send({ name: 'غذا', priceToman: 1000 })
      .expect(404);
  }
});
