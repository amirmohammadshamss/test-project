import { Injectable, UnauthorizedException } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import {
  hashPassword,
  verifyPassword,
} from '../../../../../packages/database/src/password';
const dummy = hashPassword('invalid-platform-user-password');
@Injectable()
export class PlatformAuthService {
  async login(email: string, password: string, requestId: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { platformAdmin: true },
    });
    const valid = await verifyPassword(
      password,
      user?.passwordHash || (await dummy),
    );
    if (!user?.active || !user.platformAdmin?.active || !valid) {
      await prisma.adminAuditLog.create({
        data: {
          actorType: 'ANONYMOUS',
          action: 'PLATFORM_LOGIN_FAILED',
          resourceType: 'platform-auth',
          resourceId: user?.platformAdmin?.id,
          requestId,
          outcome: 'FAILURE',
        },
      });
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    }
    const session = await prisma.platformSession.create({
      data: {
        adminId: user.platformAdmin.id,
        expiresAt: new Date(Date.now() + 3600000),
      },
    });
    return {
      userId: user.id,
      adminId: user.platformAdmin.id,
      sessionId: session.id,
      name: user.name,
    };
  }
  async logout(sessionId: string) {
    await prisma.platformSession.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }
  async me(userId: string) {
    return {
      ...(await prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      })),
      securityLevel: 'PROTOTYPE_PASSWORD_ONLY',
      productionReady: false,
    };
  }
}
