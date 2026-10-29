import {
  managerPlanSchema,
  type ManagerPlan,
} from '../../../../../packages/shared/src/manager-analysis';
import { executeManagerReport } from '../../../../../packages/insights/src/report';
import {
  Inject,
  Injectable,
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseUUIDPipe,
  Headers,
  Req,
  Query,
  UseGuards,
} from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { AuthRequest, SessionGuard, RoleGuard, Roles } from '../../common/auth';
import type { Actor } from '../../../../../packages/shared/src/contracts';
import { prisma } from '../../../../../packages/database/src/client';
import { requireRole, BusinessError } from '../orders/domain/rules';
import { idempotent } from '../orders/infrastructure/prisma-uow';
export class AnalysisDto {
  @IsString() @Length(5, 1000) question!: string;
}
export abstract class AnalysisRepository {
  abstract report(actor: Actor, plan: ManagerPlan): Promise<unknown>;
  abstract request(
    actor: Actor,
    question: string,
    key: string,
  ): Promise<unknown>;
  abstract list(actor: Actor): Promise<unknown>;
  abstract get(actor: Actor, id: string): Promise<unknown>;
}
const owner = (actor: Actor) => ({
  tenantId: actor.tenantId,
  branchId: actor.branchId,
  actorId: actor.userId,
  membershipId: actor.membershipId,
});
@Injectable()
export class PrismaAnalysisRepository extends AnalysisRepository {
  async report(actor: Actor, plan: ManagerPlan) {
    requireRole(actor, ['MANAGER']);
    if (!actor.membershipId) throw new BusinessError('FORBIDDEN', 403);
    try {
      return await executeManagerReport(
        prisma,
        { ...owner(actor), membershipId: actor.membershipId },
        plan,
        new Date(),
      );
    } catch (e) {
      if (e instanceof Error && e.message === 'AI_ACCESS_REVOKED')
        throw new BusinessError('FORBIDDEN', 403);
      throw e;
    }
  }
  request(actor: Actor, question: string, key: string) {
    requireRole(actor, ['MANAGER']);
    if (!actor.membershipId) throw new BusinessError('FORBIDDEN', 403);
    return idempotent(
      prisma,
      actor,
      { operation: 'ai.analysis', key, payload: { question } },
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'ai-budget:' + actor.tenantId},0))`;
        const configured = Number(process.env.AI_DAILY_REQUEST_LIMIT || 20);
        const limit =
          Number.isInteger(configured) && configured >= 1 && configured <= 100
            ? configured
            : 20;
        const start = new Date();
        start.setUTCHours(0, 0, 0, 0);
        const analyses = await tx.aiAnalysis.count({
          where: { tenantId: actor.tenantId, createdAt: { gte: start } },
        });
        if (analyses >= limit) throw new BusinessError('AI_DAILY_LIMIT', 429);
        return tx.aiAnalysis.create({
          data: {
            ...owner(actor),
            membershipId: actor.membershipId!,
            question,
          },
        });
      },
    );
  }
  list(actor: Actor) {
    requireRole(actor, ['MANAGER']);
    return prisma.aiAnalysis.findMany({
      where: owner(actor),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
      select: {
        id: true,
        question: true,
        status: true,
        createdAt: true,
        errorCode: true,
      },
    });
  }
  async get(actor: Actor, id: string) {
    requireRole(actor, ['MANAGER']);
    const row = await prisma.aiAnalysis.findFirst({
      where: { ...owner(actor), id },
    });
    if (!row) throw new BusinessError('NOT_FOUND', 404);
    return row;
  }
}
@Injectable()
export class AnalysisService {
  constructor(
    @Inject(AnalysisRepository) private readonly repository: AnalysisRepository,
  ) {}
  report(actor: Actor, query: unknown) {
    const parsed = managerPlanSchema.safeParse(query);
    if (!parsed.success) throw new BusinessError('VALIDATION_ERROR', 400);
    return this.repository.report(actor, parsed.data);
  }
  request(actor: Actor, input: AnalysisDto, key: string) {
    return this.repository.request(actor, input.question, key);
  }
  list(actor: Actor) {
    return this.repository.list(actor);
  }
  get(actor: Actor, id: string) {
    return this.repository.get(actor, id);
  }
}
@Controller(['ai/analyses', 'admin/ai/analyses'])
@UseGuards(SessionGuard, RoleGuard)
@Roles('MANAGER')
export class AnalysisController {
  constructor(
    @Inject(AnalysisService) private readonly service: AnalysisService,
  ) {}
  @Post() request(
    @Req() r: AuthRequest,
    @Body() input: AnalysisDto,
    @Headers('idempotency-key') key: string,
  ) {
    return this.service.request(r.actor, input, key);
  }
  @Get() list(@Req() r: AuthRequest) {
    return this.service.list(r.actor);
  }
  @Get('reports') report(
    @Req() r: AuthRequest,
    @Query() query: Record<string, unknown>,
  ) {
    return this.service.report(r.actor, query);
  }
  @Get(':id') get(
    @Req() r: AuthRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.service.get(r.actor, id);
  }
}
