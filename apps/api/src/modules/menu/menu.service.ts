import { PrismaRestaurantAdminRepository } from '../restaurant-admin/infrastructure/prisma-admin';
import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import { prisma } from '../../../../../packages/database/src/client';
import { MenuDto } from '../../common/dto';
import { requireRole } from '../orders/domain/rules';
@Injectable()
export class MenuService {
  categories(actor: Actor) {
    return prisma.category.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(actor.role === 'MANAGER' ? {} : { active: true }),
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });
  }
  items(actor: Actor) {
    return prisma.menuItem.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(actor.role === 'MANAGER'
          ? {}
          : { active: true, category: { active: true } }),
      },
      include: { category: { select: { name: true, active: true } } },
      orderBy: { name: 'asc' },
    });
  }
  create(actor: Actor, input: MenuDto) {
    requireRole(actor, ['MANAGER']);
    return new PrismaRestaurantAdminRepository(prisma).createMenu(actor, input);
  }
  update(actor: Actor, id: string, input: MenuDto) {
    requireRole(actor, ['MANAGER']);
    return new PrismaRestaurantAdminRepository(prisma).updateMenu(
      actor,
      id,
      input,
    );
  }
}
