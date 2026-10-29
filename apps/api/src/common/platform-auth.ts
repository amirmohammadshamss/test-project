import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { PlatformPrincipal } from '../../../../packages/shared/src/contracts';
import { TrafficLimiter } from './traffic';
import { prisma } from '../../../../packages/database/src/client';
export interface PlatformRequest extends Request {
  platform: PlatformPrincipal;
  requestId: string;
}
@Injectable()
export class PlatformSessionAuthenticator {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}
  async authenticate(token: string): Promise<PlatformPrincipal> {
    let claims: { sub: string; sid: string; purpose: string };
    try {
      claims = await this.jwt.verifyAsync(token, {
        audience: 'restaurantos-platform',
      });
    } catch {
      throw new UnauthorizedException('PLATFORM_AUTH_REQUIRED');
    }
    if (
      claims.purpose !== 'platform' ||
      ![claims.sub, claims.sid].every(
        (x) =>
          typeof x === 'string' &&
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            x,
          ),
      )
    )
      throw new UnauthorizedException('PLATFORM_AUTH_REQUIRED');
    const session = await prisma.platformSession.findFirst({
      where: {
        id: claims.sid,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        admin: { active: true, userId: claims.sub, user: { active: true } },
      },
      include: { admin: true },
    });
    if (!session) throw new UnauthorizedException('PLATFORM_AUTH_REQUIRED');
    return {
      userId: session.admin.userId,
      adminId: session.adminId,
      sessionId: session.id,
    };
  }
}
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @Inject(PlatformSessionAuthenticator)
    private readonly auth: PlatformSessionAuthenticator,
    @Inject(TrafficLimiter) private readonly limits: TrafficLimiter,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<PlatformRequest>();
    req.platform = {
      ...(await this.auth.authenticate(req.cookies?.platform_session || '')),
      requestId: req.requestId,
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method))
      this.limits.hit(`platform:${req.platform.adminId}`, 60);
    return true;
  }
}
