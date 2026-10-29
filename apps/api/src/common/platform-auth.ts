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
import { prisma } from '../../../../packages/database/src/client';
export interface PlatformRequest extends Request {
  platform: PlatformPrincipal;
  requestId: string;
}
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<PlatformRequest>();
    let claims: { sub: string; sid: string; purpose: string };
    try {
      claims = await this.jwt.verifyAsync(req.cookies?.platform_session || '', {
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
    req.platform = {
      userId: session.admin.userId,
      adminId: session.adminId,
      sessionId: session.id,
      requestId: req.requestId,
    };
    return true;
  }
}
