import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import { prisma } from '../../../../../packages/database/src/client';
import { MenuDto } from '../../common/dto';
import {
  BusinessError,
  requireRole,
  tomanToRial,
} from '../orders/domain/rules';
@Injectable()
export class MenuService {
  categories(actor: Actor) {
    return prisma.category.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: { name: 'asc' },
    });
  }
  items(actor: Actor) {
    return prisma.menuItem.findMany({
      where: {
        tenantId: actor.tenantId,
        ...(actor.role === 'MANAGER' ? {} : { active: true }),
      },
      include: { category: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });
  }
  private async data(actor: Actor, input: MenuDto) {
    requireRole(actor, ['MANAGER']);
    const category = await prisma.category.findFirst({
      where: { id: input.categoryId, tenantId: actor.tenantId },
    });
    if (!category) throw new BusinessError('NOT_FOUND', 404);
    const { priceToman, ...rest } = input;
    return { ...rest, priceRial: tomanToRial(priceToman) };
  }
  async create(actor: Actor, input: MenuDto) {
    return prisma.menuItem.create({
      data: { tenantId: actor.tenantId, ...(await this.data(actor, input)) },
    });
  }
  async update(actor: Actor, id: string, input: MenuDto) {
    const data = await this.data(actor, input);
    const result = await prisma.menuItem.updateMany({
      where: { tenantId: actor.tenantId, id },
      data,
    });
    if (!result.count) throw new BusinessError('NOT_FOUND', 404);
    return prisma.menuItem.findFirst({
      where: { tenantId: actor.tenantId, id },
    });
  }
}
