import type { ItemStatus } from './contracts';
export interface OrderNotification {
  eventId: string;
  orderId: string;
  tableId: string;
  version: number;
}
export interface RestaurantEvents {
  'table:updated': OrderNotification;
  'order:created': OrderNotification;
  'order:updated': OrderNotification;
  'kitchen:item-updated': OrderNotification & {
    itemId: string;
    itemVersion: number;
    status: ItemStatus;
  };
}
export const restaurantEventNames = [
  'table:updated',
  'order:created',
  'order:updated',
  'kitchen:item-updated',
] as const;
