import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type {
  Actor,
  Role,
  PlatformPrincipal,
} from '../../../../packages/shared/src/contracts';
import { TrafficLimiter } from './traffic';
import { prisma } from '../../../../packages/database/src/client';
export interface AuthRequest extends Request {
  actor: Actor;
  platform?: PlatformPrincipal;
  requestId: string;
}
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
@Injectable()
export class RestaurantSessionAuthenticator {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}
  async authenticate(
    token: string,
    options: { allowSuspended?: boolean } = {},
  ): Promise<Actor> {
    let claims: {
      sub: string;
      membershipId: string;
      branchId: string;
      sid: string;
    };
    try {
      claims = await this.jwt.verifyAsync(token, {
        audience: 'restaurantos-restaurant',
      });
      if (
        ![claims.sub, claims.membershipId, claims.branchId, claims.sid].every(
          (x) =>
            typeof x === 'string' &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              x,
            ),
        )
      )
        throw new Error('INVALID_CLAIMS');
    } catch {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
    const session = await prisma.restaurantSession.findFirst({
      where: {
        id: claims.sid,
        userId: claims.sub,
        membershipId: claims.membershipId,
        branchId: claims.branchId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!session) throw new UnauthorizedException('AUTH_REQUIRED');
    const membership = await prisma.membership.findFirst({
      where: {
        id: claims.membershipId,
        userId: claims.sub,
        active: true,
        user: { active: true },
        branches: {
          some: { branchId: claims.branchId, branch: { active: true } },
        },
      },
      include: { restaurant: { select: { status: true } } },
    });
    if (!membership) throw new UnauthorizedException('AUTH_REQUIRED');
    if (
      membership.restaurant.status !== 'ACTIVE' &&
      !(options.allowSuspended && membership.role === 'MANAGER')
    )
      throw new ForbiddenException('TENANT_SUSPENDED');
    return {
      membershipId: membership.id,
      tenantStatus: membership.restaurant.status,
      sessionId: claims.sid,
      userId: claims.sub,
      tenantId: membership.tenantId,
      branchId: claims.branchId,
      role: membership.role,
    };
  }
}
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    @Inject(RestaurantSessionAuthenticator)
    private readonly auth: RestaurantSessionAuthenticator,
    @Inject(TrafficLimiter) private readonly limits: TrafficLimiter,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.actor = {
      ...(await this.auth.authenticate(req.cookies?.session || '')),
      requestId: req.requestId,
    };
    if (req.method === 'POST' && req.path.includes('/ai/'))
      this.limits.hit(`ai:${req.actor.tenantId}:${req.actor.userId}`, 15);
    return true;
  }
}
@Injectable()
export class NotificationSessionGuard implements CanActivate {
  constructor(
    @Inject(RestaurantSessionAuthenticator)
    private readonly auth: RestaurantSessionAuthenticator,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.actor = {
      ...(await this.auth.authenticate(req.cookies?.session || '', {
        allowSuspended: true,
      })),
      requestId: req.requestId,
    };
    return true;
  }
}
@Injectable()
export class RoleGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}
  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (
      roles &&
      !roles.includes(
        context.switchToHttp().getRequest<AuthRequest>().actor.role,
      )
    )
      throw new ForbiddenException('FORBIDDEN');
    return true;
  }
}
