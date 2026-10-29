export interface NotificationEvents {
  'notification:created': {
    notificationId: string;
    type: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    createdAt: string;
    version: number;
  };
  'notification:updated': {
    notificationId: string;
    readAt: string | null;
    acknowledgedAt: string | null;
    version: number;
  };
  'notification:unread-count': { count: number };
}
export const notificationEventNames = [
  'notification:created',
  'notification:updated',
  'notification:unread-count',
] as const;
