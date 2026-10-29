import { Injectable } from '@nestjs/common';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import { prisma } from '../../../../../packages/database/src/client';
import { menuDraftSchema } from '../../../../../packages/shared/src/menu-draft';
import { ApproveDto, DraftDto } from '../../common/dto';
import {
  BusinessError,
  requireRole,
  tomanToRial,
} from '../orders/domain/rules';
import { idempotent } from '../orders/infrastructure/prisma-uow';
@Injectable()
export class AiService {
  request(actor: Actor, input: DraftDto, key: string) {
    requireRole(actor, ['MANAGER']);
    return idempotent(
      prisma,
      actor,
      { operation: 'ai.request', key: key || '', payload: input },
      (tx) =>
        tx.aiDraft.create({
          data: {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            input: input.input,
          },
        }),
    );
  }
  async get(actor: Actor, id: string) {
    requireRole(actor, ['MANAGER']);
    const draft = await prisma.aiDraft.findFirst({
      where: { id, tenantId: actor.tenantId },
    });
    if (!draft) throw new BusinessError('NOT_FOUND', 404);
    return draft;
  }
  approve(actor: Actor, id: string, input: ApproveDto, key: string) {
    requireRole(actor, ['MANAGER']);
    const result = menuDraftSchema.safeParse(input);
    if (!result.success) throw new BusinessError('INVALID_DRAFT', 400);
    return idempotent(
      prisma,
      actor,
      { operation: `ai.approve.${id}`, key: key || '', payload: input },
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "AiDraft" WHERE id = ${id}::uuid AND "tenantId" = ${actor.tenantId}::uuid FOR UPDATE`;
        const draft = await tx.aiDraft.findFirst({
          where: { id, tenantId: actor.tenantId },
        });
        if (!draft) throw new BusinessError('NOT_FOUND', 404);
        if (draft.status === 'APPROVED')
          return tx.menuItem.findFirst({
            where: { id: draft.menuItemId!, tenantId: actor.tenantId },
          });
        if (draft.status !== 'READY')
          throw new BusinessError('DRAFT_NOT_READY');
        const category = await tx.category.upsert({
          where: {
            tenantId_name: {
              tenantId: actor.tenantId,
              name: result.data.category,
            },
          },
          create: { tenantId: actor.tenantId, name: result.data.category },
          update: {},
        });
        const item = await tx.menuItem.create({
          data: {
            tenantId: actor.tenantId,
            categoryId: category.id,
            name: result.data.name,
            description: result.data.description,
            priceRial: tomanToRial(result.data.priceToman),
          },
        });
        await tx.aiDraft.update({
          where: { id },
          data: {
            status: 'APPROVED',
            menuItemId: item.id,
            result: result.data,
          },
        });
        return item;
      },
    );
  }
}
