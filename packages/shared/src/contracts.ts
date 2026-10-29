export type Role = 'MANAGER' | 'WAITER' | 'KITCHEN';
export type ItemStatus = 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
export interface Actor {
  userId: string;
  tenantId: string;
  branchId: string;
  role: Role;
  requestId?: string;
}
export interface MenuEntry {
  id: string;
  tenantId: string;
  categoryId: string;
  name: string;
  description: string;
  priceRial: number;
  active: boolean;
  available: boolean;
  version: number;
}
export interface Item {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  priceRial: number;
  status: ItemStatus;
  version: number;
}
export interface OrderView {
  id: string;
  tenantId: string;
  branchId: string;
  tableId: string;
  status: 'OPEN' | 'COMPLETED';
  version: number;
  items: Item[];
  createdAt: Date | string;
}
export interface DraftValue {
  name: string;
  description: string;
  priceToman: number;
  category: string;
}

export interface PlatformPrincipal {
  userId: string;
  adminId: string;
  sessionId: string;
  requestId?: string;
}
