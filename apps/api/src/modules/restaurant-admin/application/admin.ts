import type { Actor } from '../../../../../../packages/shared/src/contracts';
import { requireRole } from '../../orders/domain/rules';
export interface PageQuery {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
}
export interface MenuWrite {
  name: string;
  description: string;
  categoryId: string;
  priceToman: number;
  active: boolean;
  available: boolean;
  version?: number;
}
export interface CategoryWrite {
  name: string;
  active: boolean;
  displayOrder: number;
  version?: number;
}
export interface TableWrite {
  number: number;
  seats: number;
  active: boolean;
  version?: number;
}
export interface SettingsWrite {
  name: string;
  branchName: string;
  primaryContact: string;
  contactEmail: string;
  phone: string;
  address: string;
  timezone: string;
  currencyPresentation: string;
  version: number;
}
export abstract class RestaurantAdminRepository {
  abstract dashboard(actor: Actor): Promise<unknown>;
  abstract orders(actor: Actor, query: PageQuery): Promise<unknown>;
  abstract order(actor: Actor, id: string): Promise<unknown>;
  abstract tables(actor: Actor): Promise<unknown>;
  abstract createTable(actor: Actor, input: TableWrite): Promise<unknown>;
  abstract updateTable(
    actor: Actor,
    id: string,
    input: TableWrite,
  ): Promise<unknown>;
  abstract categories(actor: Actor): Promise<unknown>;
  abstract createCategory(actor: Actor, input: CategoryWrite): Promise<unknown>;
  abstract updateCategory(
    actor: Actor,
    id: string,
    input: CategoryWrite,
  ): Promise<unknown>;
  abstract items(actor: Actor, query: PageQuery): Promise<unknown>;
  abstract createMenu(actor: Actor, input: MenuWrite): Promise<unknown>;
  abstract updateMenu(
    actor: Actor,
    id: string,
    input: MenuWrite,
  ): Promise<unknown>;
  abstract staff(actor: Actor, query: PageQuery): Promise<unknown>;
  abstract settings(actor: Actor): Promise<unknown>;
  abstract updateSettings(actor: Actor, input: SettingsWrite): Promise<unknown>;
}
export class RestaurantAdmin {
  constructor(private readonly repository: RestaurantAdminRepository) {}
  private run(actor: Actor, operation: () => Promise<unknown>) {
    requireRole(actor, ['MANAGER']);
    return operation();
  }
  dashboard(a: Actor) {
    return this.run(a, () => this.repository.dashboard(a));
  }
  orders(a: Actor, q: PageQuery) {
    return this.run(a, () => this.repository.orders(a, q));
  }
  order(a: Actor, id: string) {
    return this.run(a, () => this.repository.order(a, id));
  }
  tables(a: Actor) {
    return this.run(a, () => this.repository.tables(a));
  }
  createTable(a: Actor, x: TableWrite) {
    return this.run(a, () => this.repository.createTable(a, x));
  }
  updateTable(a: Actor, id: string, x: TableWrite) {
    return this.run(a, () => this.repository.updateTable(a, id, x));
  }
  categories(a: Actor) {
    return this.run(a, () => this.repository.categories(a));
  }
  createCategory(a: Actor, x: CategoryWrite) {
    return this.run(a, () => this.repository.createCategory(a, x));
  }
  updateCategory(a: Actor, id: string, x: CategoryWrite) {
    return this.run(a, () => this.repository.updateCategory(a, id, x));
  }
  items(a: Actor, q: PageQuery) {
    return this.run(a, () => this.repository.items(a, q));
  }
  createMenu(a: Actor, x: MenuWrite) {
    return this.run(a, () => this.repository.createMenu(a, x));
  }
  updateMenu(a: Actor, id: string, x: MenuWrite) {
    return this.run(a, () => this.repository.updateMenu(a, id, x));
  }
  staff(a: Actor, q: PageQuery) {
    return this.run(a, () => this.repository.staff(a, q));
  }
  settings(a: Actor) {
    return this.run(a, () => this.repository.settings(a));
  }
  updateSettings(a: Actor, x: SettingsWrite) {
    return this.run(a, () => this.repository.updateSettings(a, x));
  }
}
