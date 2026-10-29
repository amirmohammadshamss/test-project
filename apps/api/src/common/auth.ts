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
import type { Actor, Role } from '../../../../packages/shared/src/contracts';
import { prisma } from '../../../../packages/database/src/client';
export interface AuthRequest extends Request {
  actor: Actor;
  requestId: string;
}
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    try {
      const claims = await this.jwt.verifyAsync<{
        sub: string;
        membershipId: string;
        branchId: string;
      }>(req.cookies?.session || '');
      const membership = await prisma.membership.findFirst({
        where: {
          id: claims.membershipId,
          userId: claims.sub,
          branches: { some: { branchId: claims.branchId } },
        },
      });
      if (!membership) throw new Error('membership');
      req.actor = {
        userId: claims.sub,
        tenantId: membership.tenantId,
        branchId: claims.branchId,
        role: membership.role,
      };
      return true;
    } catch {
      throw new UnauthorizedException('AUTH_REQUIRED');
    }
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
