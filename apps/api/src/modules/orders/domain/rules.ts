import type {
  Actor,
  Item,
  ItemStatus,
  OrderView,
  Role,
} from '../../../../../../packages/shared/src/contracts';
export class BusinessError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(code);
  }
}
export function requireRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role)) throw new BusinessError('FORBIDDEN', 403);
}
export function quantity(value: number) {
  if (!Number.isInteger(value) || value < 1 || value > 99)
    throw new BusinessError('INVALID_QUANTITY', 400);
  return value;
}
export function tomanToRial(value: number) {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000_000)
    throw new BusinessError('INVALID_PRICE', 400);
  return value * 10;
}
export function assertOpen(order: OrderView) {
  if (order.status !== 'OPEN') throw new BusinessError('ORDER_CLOSED');
}
export function assertVersion(actual: number, expected: number) {
  if (actual !== expected) throw new BusinessError('VERSION_CONFLICT');
}
export function assertTransition(actor: Actor, item: Item, next: ItemStatus) {
  const transitions: Record<ItemStatus, ItemStatus | null> = {
    PENDING: 'PREPARING',
    PREPARING: 'READY',
    READY: 'SERVED',
    SERVED: null,
    CANCELLED: null,
  };
  requireRole(
    actor,
    next === 'SERVED' ? ['MANAGER', 'WAITER'] : ['MANAGER', 'KITCHEN'],
  );
  if (transitions[item.status] !== next)
    throw new BusinessError('INVALID_TRANSITION');
}
export function assertCompletable(order: OrderView) {
  assertOpen(order);
  if (
    !order.items.some((i) => i.status === 'SERVED') ||
    order.items.some((i) => !['SERVED', 'CANCELLED'].includes(i.status))
  )
    throw new BusinessError('ITEMS_NOT_SERVED');
}

export function assertCancellation(
  actor: Actor,
  order: OrderView,
  item?: Item,
) {
  requireRole(actor, ['MANAGER', 'WAITER']);
  assertOpen(order);
  if (item) {
    if (['SERVED', 'CANCELLED'].includes(item.status))
      throw new BusinessError('CANCELLATION_NOT_ALLOWED');
    if (item.status !== 'PENDING') requireRole(actor, ['MANAGER']);
  } else {
    if (order.items.some((i) => i.status === 'SERVED'))
      throw new BusinessError('CANCELLATION_NOT_ALLOWED');
    if (order.items.length) requireRole(actor, ['MANAGER']);
  }
}
