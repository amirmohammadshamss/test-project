import type { Prisma } from '@prisma/client';
import type {
  Actor,
  PlatformPrincipal,
} from '../../../../../packages/shared/src/contracts';
export function audit(
  tx: Prisma.TransactionClient,
  principal: Actor | PlatformPrincipal,
  action: string,
  resourceType: string,
  resourceId: string,
  tenantId?: string,
  reason?: string,
  metadata?: Prisma.InputJsonValue,
) {
  return tx.adminAuditLog.create({
    data: {
      actorId: principal.userId,
      actorType: 'adminId' in principal ? 'PLATFORM_ADMIN' : 'RESTAURANT_USER',
      tenantId,
      action,
      resourceType,
      resourceId,
      requestId: principal.requestId || 'internal',
      reason,
      ...(metadata ? { metadata } : {}),
    },
  });
}
