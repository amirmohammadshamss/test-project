import type {
  Actor,
  ItemStatus,
} from '../../../../../../packages/shared/src/contracts';
import {
  assertCompletable,
  assertCancellation,
  assertOpen,
  assertTransition,
  assertVersion,
  BusinessError,
  quantity,
  requireRole,
} from '../domain/rules';
import { OrderUnitOfWork } from './ports';
export class Orders {
  constructor(private readonly uow: OrderUnitOfWork) {}
  cancel(
    actor: Actor,
    id: string,
    version: number,
    reason: string,
    key: string,
    itemId?: string,
  ) {
    requireRole(actor, ['MANAGER', 'WAITER']);
    if (!reason.trim() || reason.trim().length > 500)
      throw new BusinessError('REASON_REQUIRED', 400);
    return this.uow.run(
      actor,
      {
        operation: `order.cancel.${id}.${itemId || 'all'}`,
        key,
        payload: { version, reason, itemId: itemId || null },
      },
      async (tx) => {
        const order = await tx.lockOrder(id);
        const item = itemId
          ? order.items.find((i) => i.id === itemId)
          : undefined;
        if (itemId && !item) throw new BusinessError('NOT_FOUND', 404);
        assertVersion(item ? item.version : order.version, version);
        assertCancellation(actor, order, item);
        return tx.cancel(order, reason.trim(), item);
      },
    );
  }
  create(actor: Actor, tableId: string, key: string) {
    requireRole(actor, ['MANAGER', 'WAITER']);
    return this.uow.run(
      actor,
      { operation: 'order.create', key, payload: { tableId } },
      async (tx) => {
        await tx.lockTable(tableId);
        if (await tx.findActiveOrder(tableId))
          throw new BusinessError('TABLE_OCCUPIED');
        return tx.createOrder(tableId);
      },
    );
  }
  add(
    actor: Actor,
    id: string,
    menuItemId: string,
    count: number,
    key: string,
  ) {
    requireRole(actor, ['MANAGER', 'WAITER']);
    quantity(count);
    return this.uow.run(
      actor,
      { operation: `order.add.${id}`, key, payload: { menuItemId, count } },
      async (tx) => {
        const order = await tx.lockOrder(id);
        assertOpen(order);
        const menu = await tx.menu(menuItemId);
        if (!menu.active || !menu.available)
          throw new BusinessError('ITEM_UNAVAILABLE');
        await tx.append(order, menu, count);
        return tx.touch(order, 'ITEM_ADDED');
      },
    );
  }
  update(
    actor: Actor,
    id: string,
    itemId: string,
    version: number,
    change: { quantity?: number; status?: ItemStatus },
    key: string,
  ) {
    return this.uow.run(
      actor,
      {
        operation: `order.item.${id}.${itemId}`,
        key,
        payload: { version, change },
      },
      async (tx) => {
        const order = await tx.lockOrder(id);
        assertOpen(order);
        const item = order.items.find((i) => i.id === itemId);
        if (!item) throw new BusinessError('NOT_FOUND', 404);
        assertVersion(item.version, version);
        if (change.quantity !== undefined) {
          requireRole(actor, ['MANAGER', 'WAITER']);
          quantity(change.quantity);
          if (item.status !== 'PENDING' || change.status)
            throw new BusinessError('QUANTITY_LOCKED');
        } else if (change.status) assertTransition(actor, item, change.status);
        else throw new BusinessError('EMPTY_CHANGE', 400);
        await tx.updateItem(item, change);
        return tx.touch(order, 'ITEM_UPDATED');
      },
    );
  }
  complete(actor: Actor, id: string, version: number, key: string) {
    requireRole(actor, ['MANAGER', 'WAITER']);
    return this.uow.run(
      actor,
      { operation: `order.complete.${id}`, key, payload: { version } },
      async (tx) => {
        const order = await tx.lockOrder(id);
        assertVersion(order.version, version);
        assertCompletable(order);
        return tx.touch(order, 'ORDER_COMPLETED', true);
      },
    );
  }
}
