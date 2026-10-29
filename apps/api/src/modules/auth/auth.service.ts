import {
  Injectable,
  Inject,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { RealtimeEventPublisher } from '../../common/application/realtime';
import { prisma } from '../../../../../packages/database/src/client';
import {
  hashPassword,
  verifyPassword,
} from '../../../../../packages/database/src/password';
import type { Actor } from '../../../../../packages/shared/src/contracts';
const dummyHash = hashPassword('invalid-user-timing-placeholder');
@Injectable()
export class AuthService {
  constructor(
    @Inject(RealtimeEventPublisher)
    private readonly events: RealtimeEventPublisher,
  ) {}
  async authenticate(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          orderBy: { id: 'asc' },
          include: {
            branches: {
              where: { branch: { active: true } },
              orderBy: [{ branch: { createdAt: 'asc' } }, { branchId: 'asc' }],
            },
            restaurant: { select: { status: true } },
          },
        },
      },
    });
    const valid = await verifyPassword(
      password,
      user?.passwordHash || (await dummyHash),
    );
    const membership =
      user?.memberships.find(
        (m) =>
          m.active && m.branches.length && m.restaurant.status === 'ACTIVE',
      ) || user?.memberships.find((m) => m.active && m.branches.length);
    if (!user || !user.active || !valid || !membership)
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    if (membership.restaurant.status !== 'ACTIVE')
      throw new ForbiddenException('TENANT_SUSPENDED');
    const session = await prisma.restaurantSession.create({
      data: {
        userId: user.id,
        membershipId: membership.id,
        branchId: membership.branches[0].branchId,
        expiresAt: new Date(Date.now() + 8 * 3600000),
      },
    });
    return {
      sessionId: session.id,
      userId: user.id,
      membershipId: membership.id,
      branchId: membership.branches[0].branchId,
      role: membership.role,
      name: user.name,
    };
  }
  async revoke(claims: { sid?: string; sub?: string } | null) {
    if (claims?.sid && claims.sub) {
      await prisma.$transaction(async (tx) => {
        await tx.restaurantSession.updateMany({
          where: { id: claims.sid, userId: claims.sub, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        await tx.pushSubscription.updateMany({
          where: {
            realm: 'RESTAURANT',
            sessionId: claims.sid,
            userId: claims.sub,
          },
          data: { active: false, encrypted: '', revokedAt: new Date() },
        });
      });
      this.events.disconnectSession(claims.sid);
    }
  }
  async me(actor: Actor) {
    const [user, restaurant, branch] = await Promise.all([
      prisma.user.findUnique({
        where: { id: actor.userId },
        select: { name: true, email: true },
      }),
      prisma.restaurant.findUnique({
        where: { id: actor.tenantId },
        select: { name: true },
      }),
      prisma.branch.findUnique({
        where: { id: actor.branchId },
        select: { name: true },
      }),
    ]);
    return {
      ...actor,
      ...user,
      restaurant: restaurant?.name,
      branch: branch?.name,
    };
  }
}
