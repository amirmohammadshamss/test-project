import { Injectable, UnauthorizedException } from '@nestjs/common';
import { prisma } from '../../../../../packages/database/src/client';
import {
  hashPassword,
  verifyPassword,
} from '../../../../../packages/database/src/password';
import type { Actor } from '../../../../../packages/shared/src/contracts';
const dummyHash = hashPassword('invalid-user-timing-placeholder');
@Injectable()
export class AuthService {
  async authenticate(email: string, password: string) {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        memberships: {
          orderBy: { id: 'asc' },
          include: { branches: { orderBy: { id: 'asc' } } },
        },
      },
    });
    const valid = await verifyPassword(
      password,
      user?.passwordHash || (await dummyHash),
    );
    const membership = user?.memberships.find((m) => m.branches.length);
    if (!user || !valid || !membership)
      throw new UnauthorizedException('INVALID_CREDENTIALS');
    return {
      userId: user.id,
      membershipId: membership.id,
      branchId: membership.branches[0].branchId,
      role: membership.role,
      name: user.name,
    };
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
