import type {
  NotificationPrincipal,
  NoticeType,
} from '../../../../../packages/notifications/src/domain';
import type { BrowserPushSubscription } from '../../../../../packages/notifications/src/push';
export interface InboxQuery {
  page: number;
  pageSize: number;
  unread?: boolean;
}
export interface PreferencesInput {
  pushEnabled: boolean;
  soundEnabled: boolean;
  includeLow: boolean;
  categories: NoticeType[];
}
export abstract class NotificationRepository {
  abstract deliveryHealth(p: NotificationPrincipal): Promise<unknown>;
  abstract list(p: NotificationPrincipal, q: InboxQuery): Promise<unknown>;
  abstract count(p: NotificationPrincipal): Promise<unknown>;
  abstract mark(
    p: NotificationPrincipal,
    id: string,
    ack: boolean,
  ): Promise<unknown>;
  abstract readAll(p: NotificationPrincipal): Promise<unknown>;
  abstract preferences(p: NotificationPrincipal): Promise<unknown>;
  abstract savePreferences(
    p: NotificationPrincipal,
    input: PreferencesInput,
  ): Promise<unknown>;
  abstract devices(p: NotificationPrincipal): Promise<unknown>;
  abstract register(
    p: NotificationPrincipal,
    input: BrowserPushSubscription,
    label: string,
  ): Promise<unknown>;
  abstract remove(p: NotificationPrincipal, id: string): Promise<unknown>;
}
export class Notifications {
  deliveryHealth(p: NotificationPrincipal) {
    return this.repo.deliveryHealth(p);
  }
  constructor(private readonly repo: NotificationRepository) {}
  list(p: NotificationPrincipal, q: InboxQuery) {
    return this.repo.list(p, q);
  }
  count(p: NotificationPrincipal) {
    return this.repo.count(p);
  }
  mark(p: NotificationPrincipal, id: string, ack = false) {
    return this.repo.mark(p, id, ack);
  }
  readAll(p: NotificationPrincipal) {
    return this.repo.readAll(p);
  }
  preferences(p: NotificationPrincipal) {
    return this.repo.preferences(p);
  }
  savePreferences(p: NotificationPrincipal, x: PreferencesInput) {
    return this.repo.savePreferences(p, x);
  }
  devices(p: NotificationPrincipal) {
    return this.repo.devices(p);
  }
  register(
    p: NotificationPrincipal,
    x: BrowserPushSubscription,
    label: string,
  ) {
    return this.repo.register(p, x, label);
  }
  remove(p: NotificationPrincipal, id: string) {
    return this.repo.remove(p, id);
  }
}
