import type {
  Actor,
  OrderView,
  KitchenPage,
} from '../../../../../../packages/shared/src/contracts';
export interface TableView {
  id: string;
  number: number;
  seats: number;
  orders: { id: string }[];
}
export abstract class OrderQueries {
  abstract kitchen(
    actor: Actor,
    limit: number,
    cursor?: string,
  ): Promise<KitchenPage>;
  abstract tables(actor: Actor): Promise<TableView[]>;
  abstract table(actor: Actor, id: string): Promise<TableView>;
  abstract list(actor: Actor, kitchen?: boolean): Promise<OrderView[]>;
  abstract get(actor: Actor, id: string): Promise<OrderView>;
  abstract orderForItem(actor: Actor, id: string): Promise<string>;
}
