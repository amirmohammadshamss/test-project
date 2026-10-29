import 'reflect-metadata';
import { Controller, Get, Module, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { prisma } from '../../../packages/database/src/client';
import { AuthRequest } from './common/auth';
import { ErrorFilter } from './common/http';
import { SecurityModule } from './common/security.module';
import { OrdersModule } from './modules/orders/orders.module';
import { AuthModule } from './modules/auth/auth.module';
import { MenuModule } from './modules/menu/menu.module';
import { AiModule } from './modules/ai/ai.module';
@Controller('health')
class HealthController {
  @Get() live() {
    return { status: 'ok', kind: 'liveness' };
  }
  @Get('ready') async ready() {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: 'ok',
      database: 'ready',
      optionalServices: 'not-required',
    };
  }
}
@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (!secret || secret.length < 32)
          throw new Error('JWT_SECRET must be at least 32 characters');
        return {
          secret,
          signOptions: {
            expiresIn: '8h',
            issuer: 'restaurantos',
            audience: 'restaurantos-web',
          },
          verifyOptions: {
            issuer: 'restaurantos',
            audience: 'restaurantos-web',
            algorithms: ['HS256'],
          },
        };
      },
    }),
    SecurityModule,
    AuthModule,
    OrdersModule,
    MenuModule,
    AiModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
export async function createApp() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'test' ? false : ['error', 'warn', 'log'],
  });
  app.setGlobalPrefix('api/v1');
  app
    .getHttpAdapter()
    .get('/health', (_request: Request, response: Response) =>
      response.json({ status: 'ok', kind: 'liveness' }),
    );
  app.use(helmet());
  app.use(cookieParser());
  const allowedOrigin = process.env.WEB_ORIGIN || 'http://localhost:3000';
  app.enableCors({
    origin: allowedOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Idempotency-Key', 'X-CSRF-Protection'],
  });
  const limits = new Map<string, { count: number; reset: number }>();
  app.use((req: AuthRequest, res: Response, next: NextFunction) => {
    req.requestId = randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    const started = Date.now();
    res.on('finish', () => {
      if (process.env.NODE_ENV !== 'test')
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            module: 'http',
            requestId: req.requestId,
            tenantId: req.actor?.tenantId,
            userId: req.actor?.userId,
            operation: req.method + ' ' + req.path,
            status: res.statusCode,
            duration: Date.now() - started,
          }),
        );
    });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      // A non-simple header is mandatory: cross-origin forms cannot submit it.
      if (
        req.get('X-CSRF-Protection') !== '1' ||
        (req.get('Origin') && req.get('Origin') !== allowedOrigin) ||
        req.get('Sec-Fetch-Site') === 'cross-site'
      )
        return res
          .status(403)
          .json({ error: { code: 'CSRF_REJECTED', requestId: req.requestId } });
    }
    const isLogin = req.path.endsWith('/auth/login');
    const isAi = req.path.includes('/ai/') && req.method === 'POST';
    if (isLogin || isAi) {
      const now = Date.now();
      for (const [key, entry] of limits)
        if (entry.reset <= now) limits.delete(key);
      const key = `${req.ip}:${isLogin ? 'login' : 'ai'}`;
      const entry = limits.get(key) || { count: 0, reset: now + 60000 };
      entry.count++;
      limits.set(key, entry);
      if (entry.count > (isLogin ? 30 : 15))
        return res
          .status(429)
          .json({ error: { code: 'RATE_LIMITED', requestId: req.requestId } });
    }
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  app.enableShutdownHooks();
  return app;
}
