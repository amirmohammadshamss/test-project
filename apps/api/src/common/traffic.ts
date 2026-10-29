import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { Request } from 'express';
/** Single-instance burst protection. Persisted tenant AI budgets remain authoritative. */
@Injectable()
export class TrafficLimiter {
  private readonly buckets = new Map<
    string,
    { count: number; reset: number }
  >();
  hit(key: string, limit: number) {
    const now = Date.now();
    for (const [key, value] of this.buckets)
      if (value.reset <= now) this.buckets.delete(key);
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= 10000)
        throw new HttpException('RATE_LIMITED', 429);
      bucket = { count: 0, reset: now + 60000 };
      this.buckets.set(key, bucket);
    }
    if (++bucket.count > limit) throw new HttpException('RATE_LIMITED', 429);
  }
}
@Injectable()
export class LoginRateGuard implements CanActivate {
  constructor(
    @Inject(TrafficLimiter) private readonly limits: TrafficLimiter,
  ) {}
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    const realm = req.path.toLowerCase().includes('/platform/')
      ? 'platform'
      : 'restaurant';
    // Never trust caller-controlled X-Forwarded-For. A high coarse ceiling protects
    // capacity; ordinary account limits do not couple users behind the Next proxy.
    this.limits.hit('login-source:' + realm + ':' + req.ip, 600);
    const email = req.body?.email;
    if (typeof email === 'string' && email.length <= 254) {
      const identity = createHash('sha256')
        .update(email.trim().toLowerCase())
        .digest('hex');
      this.limits.hit('login-account:' + realm + ':' + identity, 30);
    }
    return true;
  }
}
