import { AiRepository } from './application';
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
export class PrismaAiRepository extends AiRepository {
  request(actor: Actor, input: DraftDto, key: string) {
    requireRole(actor, ['MANAGER']);
    return idempotent(
      prisma,
      actor,
      { operation: 'ai.request', key: key || '', payload: input },
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'ai-budget:' + actor.tenantId},0))`;
        const configured = Number(process.env.AI_DAILY_REQUEST_LIMIT || 20);
        const limit =
          Number.isInteger(configured) && configured >= 1 && configured <= 100
            ? configured
            : 20;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const [menus, analyses] = await Promise.all([
          tx.aiDraft.count({
            where: { tenantId: actor.tenantId, createdAt: { gte: start } },
          }),
          tx.aiAnalysis.count({
            where: { tenantId: actor.tenantId, createdAt: { gte: start } },
          }),
        ]);
        if (menus + analyses >= limit)
          throw new BusinessError('AI_DAILY_LIMIT', 429);
        return tx.aiDraft.create({
          data: {
            tenantId: actor.tenantId,
            actorId: actor.userId,
            input: input.input,
          },
        });
      },
    );
  }
  async list(actor: Actor) {
    requireRole(actor, ['MANAGER']);
    return prisma.aiDraft.findMany({
      where: { tenantId: actor.tenantId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true,
        status: true,
        errorCode: true,
        createdAt: true,
        approvedAt: true,
      },
    });
  }
  async metrics(actor: Actor) {
    requireRole(actor, ['MANAGER']);
    const where = {
      tenantId: actor.tenantId,
      createdAt: { gte: new Date(Date.now() - 30 * 86400000) },
    };
    const [counts, totals, corrected] = await Promise.all([
      prisma.aiDraft.groupBy({ by: ['status'], where, _count: { _all: true } }),
      prisma.aiDraft.aggregate({
        where,
        _sum: {
          inputTokens: true,
          outputTokens: true,
          usageSamples: true,
          processingMs: true,
          attempts: true,
        },
      }),
      prisma.aiDraft.count({ where: { ...where, corrected: true } }),
    ]);
    return {
      windowDays: 30,
      counts,
      totals: totals._sum,
      corrected,
      currencyCost: null,
    };
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
        if (draft.status === 'APPROVED') {
          if (
            Object.entries(result.data).some(
              ([k, v]) =>
                (draft.result as Record<string, unknown> | null)?.[k] !== v,
            )
          )
            throw new BusinessError('DRAFT_ALREADY_APPROVED');
          return tx.menuItem.findFirst({
            where: { id: draft.menuItemId!, tenantId: actor.tenantId },
          });
        }
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
        await tx.$queryRaw`SELECT id FROM "Category" WHERE id=${category.id}::uuid FOR SHARE`;
        const currentCategory = await tx.category.findUniqueOrThrow({
          where: { id: category.id },
        });
        if (!currentCategory.active)
          throw new BusinessError('CATEGORY_INACTIVE');
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
            approvedAt: new Date(),
            corrected: Object.entries(result.data).some(
              ([k, v]) =>
                (draft.result as Record<string, unknown> | null)?.[k] !== v,
            ),
            menuItemId: item.id,
            result: result.data,
          },
        });
        return item;
      },
    );
  }
}
