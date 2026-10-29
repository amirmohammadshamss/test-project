import type {
  Actor,
  Item,
  ItemStatus,
  MenuEntry,
  OrderView,
} from '../../../../../../packages/shared/src/contracts';
export interface RequestIdentity {
  operation: string;
  key: string;
  payload: unknown;
}
export interface OrderTransaction {
  cancel(order: OrderView, reason: string, item?: Item): Promise<OrderView>;
  lockOrder(id: string): Promise<OrderView>;
  lockTable(id: string): Promise<void>;
  findActiveOrder(tableId: string): Promise<OrderView | null>;
  createOrder(tableId: string): Promise<OrderView>;
  menu(id: string): Promise<MenuEntry>;
  append(
    order: OrderView,
    menu: MenuEntry,
    quantity: number,
    notes?: string,
  ): Promise<void>;
  updateItem(
    item: Item,
    change: { quantity?: number; status?: ItemStatus },
  ): Promise<void>;
  touch(
    order: OrderView,
    action: string,
    complete?: boolean,
  ): Promise<OrderView>;
}
export abstract class OrderUnitOfWork {
  abstract run(
    actor: Actor,
    request: RequestIdentity,
    work: (tx: OrderTransaction) => Promise<OrderView>,
  ): Promise<OrderView>;
}
