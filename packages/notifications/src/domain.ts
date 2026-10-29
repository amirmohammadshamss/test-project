export const notificationTypes = [
  'NEW_ORDER',
  'ITEM_READY',
  'ORDER_CANCELLED',
  'PREPARATION_CHANGED',
  'ORDER_DELAYED',
  'AI_FAILED',
  'AI_READY',
  'ANALYSIS_READY',
  'ANALYSIS_FAILED',
  'TENANT_SUSPENDED',
  'PLATFORM_ISSUE',
] as const;
export type NoticeType = (typeof notificationTypes)[number];
export type Realm = 'RESTAURANT' | 'PLATFORM';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
export interface NotificationPrincipal {
  realm: Realm;
  userId: string;
  sessionId: string;
  tenantId?: string;
  branchId?: string;
  membershipId?: string;
  platformAdminId?: string;
  role?: 'MANAGER' | 'WAITER' | 'KITCHEN';
  tenantStatus?: 'ACTIVE' | 'SUSPENDED';
}
export const policies: Record<
  NoticeType,
  {
    roles: ('MANAGER' | 'WAITER' | 'KITCHEN')[];
    priority: Priority;
    title: string;
    message: string;
    entityType: string;
  }
> = {
  NEW_ORDER: {
    roles: ['KITCHEN'],
    priority: 'HIGH',
    title: 'سفارش تازه',
    message: 'سفارش تازه‌ای باز شده است؛ جزئیات را در آشپزخانه بررسی کنید.',
    entityType: 'order',
  },
  ITEM_READY: {
    roles: ['WAITER'],
    priority: 'HIGH',
    title: 'غذا آماده سرو است',
    message: 'یکی از اقلام سفارش آماده است؛ برای تحویل به مهمان بررسی کنید.',
    entityType: 'order',
  },
  ORDER_CANCELLED: {
    roles: ['KITCHEN'],
    priority: 'HIGH',
    title: 'سفارش لغو شد',
    message:
      'لغو سفارش را بررسی کنید. وضعیت سامانه جایگزین هماهنگی مستقیم کارکنان نیست.',
    entityType: 'order',
  },
  PREPARATION_CHANGED: {
    roles: ['KITCHEN'],
    priority: 'HIGH',
    title: 'تغییر در سفارش در حال آماده‌سازی',
    message:
      'سفارش هنگام آماده‌سازی تغییر کرده است؛ جزئیات و هماهنگی سالن را بررسی کنید.',
    entityType: 'order',
  },
  ORDER_DELAYED: {
    roles: ['MANAGER'],
    priority: 'MEDIUM',
    title: 'سفارش نیاز به بررسی دارد',
    message:
      'زمان آماده‌سازی از آستانه تنظیم‌شده گذشته است؛ وضعیت سفارش را بررسی کنید.',
    entityType: 'order',
  },
  ANALYSIS_READY: {
    roles: ['MANAGER'],
    priority: 'LOW',
    title: 'پاسخ دستیار مدیر آماده است',
    message:
      'گزارش شعبه جاری آماده مشاهده است؛ بازه و محدودیت‌ها را بررسی کنید.',
    entityType: 'ai-analysis',
  },
  ANALYSIS_FAILED: {
    roles: ['MANAGER'],
    priority: 'LOW',
    title: 'پرسش مدیر پردازش نشد',
    message: 'پاسخ آماده نشد. گزارش‌ها و عملیات معمول همچنان در دسترس است.',
    entityType: 'ai-analysis',
  },
  AI_READY: {
    roles: ['MANAGER'],
    priority: 'LOW',
    title: 'پیش‌نویس منو آماده بررسی است',
    message:
      'قیمت و اطلاعات پیش‌نویس را بررسی کنید؛ انتشار فقط با تأیید شما انجام می‌شود.',
    entityType: 'ai-draft',
  },
  AI_FAILED: {
    roles: ['MANAGER'],
    priority: 'LOW',
    title: 'پیش‌نویس هوش مصنوعی آماده نشد',
    message: 'پردازش پیش‌نویس ناموفق بود. ثبت دستی منو همچنان در دسترس است.',
    entityType: 'ai-draft',
  },
  TENANT_SUSPENDED: {
    roles: ['MANAGER'],
    priority: 'HIGH',
    title: 'دسترسی رستوران تعلیق شده است',
    message:
      'برای بررسی وضعیت با مدیر سامانه تماس بگیرید. این اعلان دسترسی به سفارش‌ها را باز نمی‌کند.',
    entityType: 'restaurant',
  },
  PLATFORM_ISSUE: {
    roles: [],
    priority: 'HIGH',
    title: 'سرویس سامانه نیاز به بررسی دارد',
    message:
      'یک بررسی واقعی سلامت سرویس ناموفق بوده است؛ صفحه سلامت سامانه را بررسی کنید.',
    entityType: 'platform',
  },
};
export function eligibleTypes(p: NotificationPrincipal): NoticeType[] {
  if (p.realm === 'PLATFORM') return ['PLATFORM_ISSUE'];
  if (p.tenantStatus === 'SUSPENDED')
    return p.role === 'MANAGER' ? ['TENANT_SUSPENDED'] : [];
  return notificationTypes.filter(
    (t) =>
      t !== 'PLATFORM_ISSUE' && p.role && policies[t].roles.includes(p.role),
  );
}
export const scopeKey = (p: NotificationPrincipal) =>
  p.realm === 'PLATFORM' ? 'platform' : `restaurant:${p.tenantId}`;
export function preferenceAllows(
  type: NoticeType,
  pref: { includeLow: boolean; categories: NoticeType[] } | null,
) {
  return (
    policies[type].priority === 'HIGH' ||
    !pref ||
    (pref.categories.includes(type) &&
      (pref.includeLow || policies[type].priority !== 'LOW'))
  );
}
