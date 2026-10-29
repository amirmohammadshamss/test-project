import 'reflect-metadata';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { createApp } from '../src/app';
import { prisma } from '../../../packages/database/src/client';
let app: INestApplication;
beforeAll(async () => {
  if (!process.env.DATABASE_URL?.includes('restaurantos_test'))
    throw new Error('Dedicated test database required');
  app = await createApp();
  await app.init();
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});
const login = (email: string, password: string) =>
  request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('X-CSRF-Protection', '1')
    .send({ email, password });
test('login throttling isolates accounts behind one proxy and ignores spoofed forwarded headers', async () => {
  const email = randomUUID() + '@invalid.test';
  for (let i = 0; i < 30; i++)
    await login(email, 'not-a-real-password').expect(401);
  await login(email, 'not-a-real-password')
    .set('X-Forwarded-For', '8.8.8.8')
    .expect(429);
  await login(
    'kitchen@demo.restaurantos.test',
    process.env.SEED_DEMO_PASSWORD!,
  ).expect(200);
});
test('authenticated AI burst limits do not couple separate tenant users on the same proxy', async () => {
  const manager = await login(
    'manager@demo.restaurantos.test',
    process.env.SEED_DEMO_PASSWORD!,
  ).expect(200);
  const other = await login(
    'other@demo.restaurantos.test',
    process.env.SEED_DEMO_PASSWORD!,
  ).expect(200);
  const post = (cookie: string) =>
    request(app.getHttpServer())
      .post('/api/v1/ai/analyses')
      .set('Cookie', cookie)
      .set('X-CSRF-Protection', '1')
      .set('Idempotency-Key', randomUUID())
      .send({ question: 'x' });
  const cookie = manager.headers['set-cookie'][0].split(';')[0];
  for (let i = 0; i < 15; i++) await post(cookie).expect(400);
  await post(cookie).expect(429);
  await post(other.headers['set-cookie'][0].split(';')[0]).expect(400);
});
