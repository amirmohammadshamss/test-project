import type { PlatformPrincipal } from '../../../../../../packages/shared/src/contracts';
import type { PageQuery } from '../../restaurant-admin/application/admin';
export interface PlatformQuery extends PageQuery {
  actorId?: string;
  outcome?: string;
  resourceType?: string;
  from?: string;
  to?: string;
  action?: string;
  tenantId?: string;
}
export interface ProvisionRestaurant {
  name: string;
  provisioningKey: string;
  primaryContact: string;
  contactEmail: string;
  phone: string;
  branchName: string;
  managerName: string;
  managerEmail: string;
  managerPassword: string;
}
export interface LifecycleChange {
  version: number;
  reason: string;
}
export abstract class PlatformRepository {
  abstract dashboard(q: PlatformQuery): Promise<unknown>;
  abstract restaurants(q: PlatformQuery): Promise<unknown>;
  abstract restaurant(id: string): Promise<unknown>;
  abstract branches(id: string): Promise<unknown>;
  abstract create(
    a: PlatformPrincipal,
    x: ProvisionRestaurant,
    key: string,
  ): Promise<unknown>;
  abstract lifecycle(
    a: PlatformPrincipal,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    x: LifecycleChange,
    key: string,
  ): Promise<unknown>;
  abstract audits(q: PlatformQuery): Promise<unknown>;
}
export class Platform {
  constructor(private readonly repository: PlatformRepository) {}
  dashboard(q: PlatformQuery) {
    return this.repository.dashboard(q);
  }
  restaurants(q: PlatformQuery) {
    return this.repository.restaurants(q);
  }
  restaurant(id: string) {
    return this.repository.restaurant(id);
  }
  branches(id: string) {
    return this.repository.branches(id);
  }
  create(a: PlatformPrincipal, x: ProvisionRestaurant, key: string) {
    return this.repository.create(a, x, key);
  }
  lifecycle(
    a: PlatformPrincipal,
    id: string,
    status: 'ACTIVE' | 'SUSPENDED',
    x: LifecycleChange,
    key: string,
  ) {
    return this.repository.lifecycle(a, id, status, x, key);
  }
  audits(q: PlatformQuery) {
    return this.repository.audits(q);
  }
}
