export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
  ) {
    super(code);
  }
}
export async function api<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const critical =
    method !== 'GET' && /^\/(orders|kitchen|ai|admin\/ai)(\/|$)/.test(path);
  let key: string | undefined;
  let storageKey: string | undefined;
  if (critical) {
    const signature = `${method}:${path}:${JSON.stringify(body)}`;
    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(signature),
    );
    const fingerprint = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    storageKey = `restaurantos-pending:${sessionStorage.getItem('restaurantos-actor') || 'unknown'}:${fingerprint}`;
    key = sessionStorage.getItem(storageKey) || crypto.randomUUID();
    sessionStorage.setItem(storageKey, key);
  }
  let response: Response;
  try {
    response = await fetch('/api/v1' + path, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Protection': '1',
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('NETWORK_UNCERTAIN', 0);
  }
  const data = await response.json().catch(() => ({}));
  if (
    storageKey &&
    (response.ok || (response.status >= 400 && response.status < 500))
  )
    sessionStorage.removeItem(storageKey);
  if (!response.ok)
    throw new ApiError(data.error?.code || 'REQUEST_FAILED', response.status);
  return data as T;
}
export const errors: Record<string, string> = {
  TENANT_SUSPENDED:
    'دسترسی این رستوران موقتاً تعلیق شده است. با مدیر سامانه تماس بگیرید.',
  CATEGORY_INACTIVE: 'این دسته‌بندی غیرفعال است.',
  TABLE_INACTIVE: 'این میز غیرفعال است.',
  VERSION_REQUIRED: 'اطلاعات نسخه را تازه کنید و دوباره تلاش کنید.',
  BACKEND_UNAVAILABLE:
    'سرور فعلاً در دسترس نیست. برای تلاش دوباره همان دکمه را بزنید.',
  NETWORK_UNCERTAIN:
    'ارتباط برقرار نشد. نتیجه درخواست مشخص نیست؛ برای تلاش دوباره همان دکمه را بزنید.',
  VERSION_CONFLICT:
    'این سفارش توسط همکار شما تغییر کرده است. اطلاعات تازه دریافت شد؛ تغییرتان را بررسی و دوباره ثبت کنید.',
  TABLE_OCCUPIED: 'برای این میز سفارش باز وجود دارد. اطلاعات میزها تازه شد.',
  INVALID_CREDENTIALS: 'ایمیل یا رمز عبور درست نیست.',
  ITEMS_NOT_SERVED: 'پیش از بستن سفارش، تمام اقلام باید سرو شوند.',
  ORDER_CLOSED: 'این سفارش بسته شده و قابل تغییر نیست.',
  QUANTITY_LOCKED: 'تعداد فقط پیش از شروع آماده‌سازی قابل تغییر است.',
  FORBIDDEN: 'برای این کار دسترسی ندارید.',
  INVALID_INPUT: 'اطلاعات واردشده را بررسی کنید.',
  RATE_LIMITED: 'تعداد درخواست‌ها زیاد است. یک دقیقه دیگر تلاش کنید.',
  AI_NOT_CONFIGURED:
    'سرویس هوش مصنوعی هنوز تنظیم نشده است. از ثبت دستی استفاده کنید.',
};
export const money = (rial: number) =>
  new Intl.NumberFormat('fa-IR').format(rial / 10);
export const number = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
export const localDate = (date: string | Date) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
