import type { NotificationPrincipal } from '../../../../../packages/notifications/src/domain';
import type { ItemStatus } from '../../../../../packages/shared/src/contracts';
export interface CommittedOrderChange {
  tenantId: string;
  branchId: string;
  orderId: string;
  tableId: string;
  version: number;
  created: boolean;
  item?: { id: string; version: number; status: ItemStatus };
}
export abstract class RealtimeEventPublisher {
  abstract publishNotification(
    id: string,
    kind: 'created' | 'updated',
  ): Promise<void>;
  abstract publishInboxChanged(principal: NotificationPrincipal): Promise<void>;
  abstract publishOrderChanged(change: CommittedOrderChange): Promise<void>;
  abstract disconnectSession(sessionId: string): void;
}
