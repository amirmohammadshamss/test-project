'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { notificationEventNames } from '../../shared/src/notifications';
type Notice = {
  id: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  readAt: string | null;
  acknowledgedAt: string | null;
  version: number;
};
type Inbox = { items: Notice[]; total: number; page: number; pages: number };
type Preferences = {
  pushEnabled: boolean;
  soundEnabled: boolean;
  includeLow: boolean;
  categories: string[];
  availableCategories: string[];
  pushAvailable: boolean;
  publicVapidKey: string | null;
};
type Device = {
  id: string;
  deviceLabel: string;
  active: boolean;
  currentSession?: boolean;
};
const labels: Record<string, string> = {
  NEW_ORDER: 'سفارش تازه',
  ITEM_READY: 'آماده سرو',
  ORDER_CANCELLED: 'لغو سفارش',
  PREPARATION_CHANGED: 'تغییر هنگام آماده‌سازی',
  ORDER_DELAYED: 'تأخیر سفارش',
  AI_FAILED: 'خطای پیش‌نویس',
  AI_READY: 'پیش‌نویس آماده',
  ANALYSIS_READY: 'پاسخ مدیر آماده',
  ANALYSIS_FAILED: 'خطای دستیار مدیر',
  TENANT_SUSPENDED: 'تعلیق رستوران',
  PLATFORM_ISSUE: 'سلامت سامانه',
};
const button =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 disabled:opacity-40';
const number = (n: number) => new Intl.NumberFormat('fa-IR').format(n);
const date = (value: string) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
async function request<T>(
  base: string,
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(base + path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'X-CSRF-Protection': '1' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error?.code || 'REQUEST_FAILED');
  return data as T;
}
function appLink(
  n: Notice,
  platform: boolean,
  role?: string,
  restricted?: boolean,
) {
  if (platform) return '/system-health';
  if (restricted) return '/?notifications=1';
  if (n.entityType === 'order' && role === 'KITCHEN')
    return '/notifications/orders/' + n.entityId;
  if (n.entityType === 'order')
    return role === 'MANAGER'
      ? '/dashboard/orders/' + n.entityId
      : '/?order=' + n.entityId;
  if (n.entityType === 'ai-analysis')
    return (
      '/dashboard/ai-assistant?analysis=' + encodeURIComponent(n.entityId || '')
    );
  if (n.entityType === 'ai-draft')
    return (
      '/dashboard/menu/ai-drafts?draft=' + encodeURIComponent(n.entityId || '')
    );
  return '/?notifications=1';
}
function keyBytes(key: string) {
  const raw = atob(key.replace(/-/g, '+').replace(/_/g, '/'));
  const value = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) value[i] = raw.charCodeAt(i);
  return value;
}
export function NotificationCenter({
  scopeKey,
  platform = false,
  role,
  restricted = false,
}: {
  scopeKey: string;
  platform?: boolean;
  role?: string;
  restricted?: boolean;
}) {
  const base = platform ? '/api/v1/platform' : '/api/v1';
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [unreadOnly, setUnreadOnly] = useState(false),
    [inbox, setInbox] = useState<Inbox | null>(null),
    [count, setCount] = useState(0),
    [prefs, setPrefs] = useState<Preferences | null>(null),
    [devices, setDevices] = useState<Device[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [support, setSupport] = useState(false);
  const generation = useRef(0),
    alive = useRef(true),
    dialog = useRef<HTMLDivElement>(null),
    audio = useRef<AudioContext | null>(null),
    prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const load = useCallback(async () => {
    const seq = ++generation.current;
    const [list, unread, settings, registered] = await Promise.all([
      request<Inbox>(
        base,
        `/notifications?page=${page}&pageSize=10${unreadOnly ? '&unread=true' : ''}`,
      ),
      request<{ count: number }>(base, '/notifications/unread-count'),
      request<Preferences>(base, '/notifications/preferences'),
      request<Device[]>(base, '/push/subscriptions'),
    ]);
    if (!alive.current || seq !== generation.current) return;
    setInbox(list);
    setCount(unread.count);
    setPrefs(settings);
    setDevices(registered);
  }, [base, page, unreadOnly]);
  const loadRef = useRef(load);
  loadRef.current = load;
  const beep = useCallback(() => {
    const context = audio.current;
    if (!context || context.state !== 'running') return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.value = 0.07;
    oscillator.frequency.value = 660;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.15);
  }, []);
  useEffect(() => {
    alive.current = true;
    setSupport(
      window.isSecureContext &&
        'serviceWorker' in navigator &&
        'PushManager' in window &&
        'Notification' in window,
    );
    if (
      new URLSearchParams(window.location.search).get('notifications') === '1'
    )
      setOpen(true);
    return () => {
      alive.current = false;
      void audio.current?.close();
    };
  }, [scopeKey]);
  useEffect(() => {
    let active = true;
    const refresh = () =>
      void load().catch(() => {
        if (active) setError('دریافت اعلان‌ها ممکن نشد؛ دوباره تلاش کنید.');
      });
    refresh();
    const timer = setInterval(refresh, 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    let active = true,
      timer: ReturnType<typeof setTimeout> | undefined;
    let playSound = false;
    const heard = new Set<string>();
    const hint = (
      name: string,
      payload?: {
        priority?: string;
        createdAt?: string;
        notificationId?: string;
        version?: number;
      },
    ) => {
      if (!active) return;
      if (
        name === 'notification:created' &&
        payload?.priority === 'HIGH' &&
        payload.createdAt &&
        Date.now() - Date.parse(payload.createdAt) < 60000 &&
        prefsRef.current?.soundEnabled &&
        !heard.has(payload.notificationId + ':' + payload.version)
      ) {
        if (heard.size >= 500) heard.clear();
        heard.add(payload.notificationId + ':' + payload.version);
        playSound = true;
      }
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        if (playSound) {
          playSound = false;
          beep();
        }
        void loadRef.current().catch(() => {});
      }, 100);
    };
    const listener = (event: Event) => {
      const detail = (
        event as CustomEvent<{
          name: string;
          payload?: { priority?: string; createdAt?: string };
        }>
      ).detail;
      if (detail) hint(detail.name, detail.payload);
    };
    window.addEventListener('restaurantos-notification', listener);
    const socket =
      platform || restricted
        ? io(platform ? '/platform-notifications' : '/', {
            path: '/socket.io',
            withCredentials: true,
            transports: ['polling', 'websocket'],
            autoConnect: false,
          })
        : null;
    socket?.on('connect', () => hint('sync'));
    for (const name of notificationEventNames)
      socket?.on(name, (payload) => hint(name, payload));
    socket?.connect();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener('restaurantos-notification', listener);
      socket?.disconnect();
    };
  }, [scopeKey, platform, restricted, beep]);
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (e.key !== 'Tab') return;
      const controls = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary',
        ) || []),
      ].filter((element) => element.getClientRects().length > 0);
      if (!controls.length) return;
      const first = controls[0],
        last = controls.at(-1)!;
      if (
        e.shiftKey &&
        (document.activeElement === first ||
          document.activeElement === dialog.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      before?.focus();
    };
  }, [open]);
  async function act(work: () => Promise<unknown>) {
    setBusy(true);
    setError('');
    try {
      await work();
      await loadRef.current();
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'PUSH_NOT_CONFIGURED'
          ? 'Push روی سرور تنظیم نشده است.'
          : code === 'PUSH_SUBSCRIPTION_IN_USE'
            ? 'اشتراک این دستگاه متعلق به نشست دیگری است؛ اشتراک را دوباره فعال کنید.'
            : code === 'INVALID_PUSH_SUBSCRIPTION'
              ? 'اشتراک مرورگر معتبر یا پشتیبانی‌شده نیست.'
              : 'عملیات اعلان انجام نشد؛ دوباره بررسی کنید.',
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(next: Preferences) {
    await request(base, '/notifications/preferences', 'PATCH', {
      pushEnabled: next.pushEnabled,
      soundEnabled: next.soundEnabled,
      includeLow: next.includeLow,
      categories: next.categories,
    });
  }
  async function enablePush() {
    if (!support || !prefs?.pushAvailable || !prefs.publicVapidKey) {
      setError(
        'Push نیازمند مرورگر پشتیبانی‌شده، HTTPS و تنظیم سرور است. در iOS ممکن است نصب روی صفحه اصلی لازم باشد.',
      );
      return;
    }
    const permission = await Notification.requestPermission().catch(
      () => 'denied' as NotificationPermission,
    );
    if (permission !== 'granted') {
      setError('اجازه اعلان داده نشد. اعلان‌های درون برنامه همچنان فعال‌اند.');
      return;
    }
    await act(async () => {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });
      await navigator.serviceWorker.ready;
      let subscription =
        (await registration.pushManager.getSubscription()) ||
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(prefs.publicVapidKey!),
        }));
      const register = () => {
        const data = subscription.toJSON();
        return request(base, '/push/subscriptions', 'POST', {
          endpoint: data.endpoint,
          keys: data.keys,
          deviceLabel: 'این دستگاه',
        });
      };
      try {
        await register();
      } catch (e) {
        if (!(e instanceof Error) || e.message !== 'PUSH_SUBSCRIPTION_IN_USE')
          throw e;
        await subscription.unsubscribe();
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes(prefs.publicVapidKey!),
        });
        await register();
      }
      await save({ ...prefs, pushEnabled: true });
    });
  }
  return (
    <>
      <button
        type="button"
        aria-label="اعلان‌ها"
        aria-expanded={open}
        className={button + ' relative flex shrink-0 items-center gap-1'}
        onClick={() => setOpen((x) => !x)}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        <span aria-label="تعداد اعلان خوانده‌نشده">{number(count)}</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-[100] flex justify-end bg-black/30 p-2 sm:p-5">
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="مرکز اعلان‌ها"
            tabIndex={-1}
            className="flex h-full w-full max-w-xl flex-col overflow-y-auto rounded-xl bg-white p-4 text-right text-sm text-slate-900 shadow-none outline-none"
          >
            <header className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">
                اعلان‌ها{' '}
                <span className="text-sm text-slate-500">
                  ({number(count)} خوانده‌نشده)
                </span>
              </h2>
              <button
                type="button"
                aria-label="بستن اعلان‌ها"
                className={button}
                onClick={() => setOpen(false)}
              >
                بستن
              </button>
            </header>
            {error && (
              <p
                role="alert"
                className="mb-3 rounded-lg bg-red-50 p-3 text-red-800"
              >
                {error}
              </p>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button
                className={button}
                disabled={busy}
                onClick={() =>
                  void act(() =>
                    request(base, '/notifications/read-all', 'POST'),
                  )
                }
              >
                همه را خواندم
              </button>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={unreadOnly}
                  onChange={(e) => {
                    setPage(1);
                    setUnreadOnly(e.target.checked);
                  }}
                />
                فقط خوانده‌نشده‌ها
              </label>
              <button
                className={button}
                onClick={() =>
                  void load().catch(() => setError('دریافت ممکن نشد.'))
                }
              >
                تازه‌سازی
              </button>
            </div>
            <div className="grid gap-3">
              {inbox?.items.map((n) => (
                <article
                  key={n.id}
                  data-notification-id={n.id}
                  className={
                    'rounded-xl border p-4 ' +
                    (n.readAt
                      ? 'border-slate-200 bg-white'
                      : 'border-indigo-200 bg-indigo-50')
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <a
                      className="font-bold text-indigo-900 underline"
                      href={appLink(n, platform, role, restricted)}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                        e.preventDefault();
                        void act(async () => {
                          await request(
                            base,
                            `/notifications/${n.id}/read`,
                            'PATCH',
                          );
                          window.location.assign(
                            appLink(n, platform, role, restricted),
                          );
                        });
                      }}
                    >
                      {n.title}
                    </a>
                    <span className="shrink-0 text-[10px] text-slate-600">
                      {n.priority === 'HIGH'
                        ? 'مهم'
                        : n.priority === 'MEDIUM'
                          ? 'نیاز به بررسی'
                          : 'اطلاع'}
                    </span>
                  </div>
                  <p className="my-2 text-sm leading-7">{n.message}</p>
                  <time className="text-xs text-slate-500">
                    {date(n.createdAt)}
                  </time>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {!n.readAt && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            request(
                              base,
                              `/notifications/${n.id}/read`,
                              'PATCH',
                            ),
                          )
                        }
                      >
                        خواندم
                      </button>
                    )}
                    {n.priority === 'HIGH' && !n.acknowledgedAt && (
                      <button
                        className={button}
                        disabled={busy}
                        onClick={() =>
                          void act(() =>
                            request(
                              base,
                              `/notifications/${n.id}/acknowledge`,
                              'POST',
                            ),
                          )
                        }
                      >
                        دریافت را تأیید می‌کنم
                      </button>
                    )}
                    {n.acknowledgedAt && (
                      <span className="text-xs text-emerald-800">
                        دریافت تأیید شده است
                      </span>
                    )}
                  </div>
                </article>
              ))}
              {inbox && !inbox.items.length && (
                <p className="p-5 text-slate-500">اعلانی برای نمایش نیست.</p>
              )}
              {!inbox && <p>در حال دریافت اعلان‌ها…</p>}
            </div>
            <div className="my-4 flex items-center justify-between">
              <button
                className={button}
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                قبلی
              </button>
              <span className="text-xs">
                صفحه {number(page)} از {number(inbox?.pages || 1)}
              </span>
              <button
                className={button}
                disabled={page >= (inbox?.pages || 1)}
                onClick={() => setPage((p) => p + 1)}
              >
                بعدی
              </button>
            </div>
            <p className="mb-4 text-xs leading-6 text-slate-500">
              تأیید دریافت اعلان به معنی سرو غذا یا قبول تغییر مالی نیست. اعلان
              مهم درون برنامه باقی می‌ماند؛ Push و صدا اختیاری‌اند.
            </p>
            <details className="border-t border-slate-200 pt-4">
              <summary className="cursor-pointer font-bold">
                تنظیمات اعلان و دستگاه‌ها
              </summary>
              {prefs && (
                <div className="mt-4 grid gap-4">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.includeLow}
                      disabled={busy}
                      onChange={(e) =>
                        void act(() =>
                          save({ ...prefs, includeLow: e.target.checked }),
                        )
                      }
                    />
                    اعلان‌های کم‌اولویت
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={prefs.soundEnabled}
                      disabled={busy}
                      onChange={(e) => {
                        const enabled = e.target.checked;
                        if (enabled && 'AudioContext' in window) {
                          audio.current ||= new AudioContext();
                          void audio.current.resume().then(beep);
                        }
                        void act(() =>
                          save({ ...prefs, soundEnabled: enabled }),
                        );
                      }}
                    />
                    صدای اعلان (پس از تعامل با این صفحه)
                  </label>
                  <fieldset className="grid gap-2">
                    <legend className="mb-2 text-xs text-slate-500">
                      دسته‌های دلخواه؛ اعلان مهم درون برنامه قابل حذف نیست.
                    </legend>
                    {prefs.availableCategories.map((type) => (
                      <label key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={prefs.categories.includes(type)}
                          disabled={busy}
                          onChange={(e) =>
                            void act(() =>
                              save({
                                ...prefs,
                                categories: e.target.checked
                                  ? [...prefs.categories, type]
                                  : prefs.categories.filter((t) => t !== type),
                              }),
                            )
                          }
                        />
                        {labels[type] || type}
                      </label>
                    ))}
                  </fieldset>
                  <p className="text-xs text-slate-500">
                    در iOS، Push ممکن است فقط برای برنامه نصب‌شده روی صفحه اصلی
                    فعال باشد. تحویل یا پخش صدا توسط سیستم عامل تضمین نمی‌شود.
                  </p>
                  {prefs.pushEnabled &&
                  devices.some((d) => d.active && d.currentSession) ? (
                    <button
                      className={button}
                      disabled={busy}
                      onClick={() =>
                        void act(() => save({ ...prefs, pushEnabled: false }))
                      }
                    >
                      خاموش کردن Push برای این حساب
                    </button>
                  ) : (
                    <button
                      className={button}
                      disabled={busy || !support || !prefs.pushAvailable}
                      onClick={() => void enablePush()}
                    >
                      فعال‌سازی Push برای این دستگاه
                    </button>
                  )}
                  {(!support || !prefs.pushAvailable) && (
                    <p className="text-xs text-amber-900">
                      Push در این مرورگر یا تنظیم سرور فعلی آماده نیست؛ اعلان
                      درون برنامه فعال است.
                    </p>
                  )}
                  <div className="grid gap-2">
                    {devices.map((device) => (
                      <div
                        key={device.id}
                        className="flex items-center justify-between rounded border border-slate-200 p-2 text-xs"
                      >
                        <span>
                          {device.deviceLabel} —{' '}
                          {device.active ? 'فعال' : 'غیرفعال'}
                        </span>
                        {device.active && (
                          <button
                            className={button}
                            disabled={busy}
                            onClick={() =>
                              void act(async () => {
                                await request(
                                  base,
                                  '/push/subscriptions/' + device.id,
                                  'DELETE',
                                );
                                if (
                                  device.currentSession &&
                                  'serviceWorker' in navigator
                                ) {
                                  const reg =
                                    await navigator.serviceWorker.getRegistration(
                                      '/',
                                    );
                                  await (
                                    await reg?.pushManager.getSubscription()
                                  )?.unsubscribe();
                                }
                              })
                            }
                          >
                            حذف دستگاه
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </details>
          </div>
        </div>
      )}
    </>
  );
}
