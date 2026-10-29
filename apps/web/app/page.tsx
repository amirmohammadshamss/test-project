'use client';
import { NotificationCenter } from '../../../packages/ui/src/notification-center';
import { useRestaurantRealtime } from '../lib/realtime';
import { ui } from '../lib/ui';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, ApiError, errors, localDate, money, number } from '../lib/api';
import type {
  Actor,
  KitchenPage,
  MenuEntry,
  OrderView,
} from '../../../packages/shared/src/contracts';
type Me = Actor & {
  name: string;
  restaurant: string;
  branch: string;
  email: string;
};
type Table = {
  id: string;
  number: number;
  seats: number;
  orders: {
    id: string;
  }[];
};
type Menu = MenuEntry & {
  category: {
    name: string;
  };
};
type Order = OrderView & {
  table?: {
    number: number;
  };
};
type Category = {
  id: string;
  name: string;
};
type View = 'tables' | 'kitchen' | 'menu' | 'history';
const statusLabels = {
  PENDING: 'در انتظار',
  PREPARING: 'در حال آماده‌سازی',
  READY: 'آماده سرو',
  SERVED: 'سرو شده',
  CANCELLED: 'لغو شده',
};
const roleLabels = {
  MANAGER: 'مدیر رستوران',
  WAITER: 'سالن و سفارش‌ها',
  KITCHEN: 'آشپزخانه',
};
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    kitchen: (
      <>
        <path d="M4 15h16M3 19h18M6 15a6 6 0 0 1 12 0M12 7V4M9 4h6" />
      </>
    ),
    menu: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="3" />
        <path d="M8 8h8M8 12h8M8 16h5" />
      </>
    ),
    history: (
      <>
        <path d="M3 11a9 9 0 1 1 2 7M3 4v7h7M12 7v5l3 2" />
      </>
    ),
    arrow: <path d="m9 5 7 7-7 7" />,
    plus: <path d="M12 5v14M5 12h14" />,
    exit: (
      <>
        <path d="M9 5H4v14h5M13 8l4 4-4 4M8 12h12" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 8a8 8 0 0 0-14-3L3 8m0-5v5h5M4 16a8 8 0 0 0 14 3l3-3m0 5v-5h-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.7 6.3L21 12l-6.3 2.7L12 21l-2.7-6.3L3 12l6.3-2.7L12 3Z" />
        <path d="m21 1 .7 1.3L23 3l-1.3.7L21 5l-.7-1.3L19 3l1.3-.7Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.menu}
    </svg>
  );
}
function Brand() {
  return (
    <div {...ui('brand')}>
      <span {...ui('brand-mark')}>ن</span>
      <div>
        <strong>نارنج</strong>
        <small>RESTAURANT OS</small>
      </div>
    </div>
  );
}
function Badge({ status }: { status: keyof typeof statusLabels }) {
  return (
    <span {...ui(`badge ${status.toLowerCase()}`)}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div {...ui('empty')}>
      <span {...ui('empty-icon')}>
        <Icon name="menu" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}
export default function RestaurantApp() {
  const [suspended, setSuspended] = useState<{
    userId: string;
    tenantId: string;
    branchId: string;
    sessionId: string;
  } | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>('tables');
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [kitchenCursor, setKitchenCursor] = useState('');
  const [kitchenPage, setKitchenPage] = useState<KitchenPage | null>(null);
  const [kitchenTrail, setKitchenTrail] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [cancelTarget, setCancelTarget] = useState<{
    id: string;
    itemId?: string;
    version: number;
  } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<Menu | 'new' | null>(null);
  const scope = `${me?.userId || ''}:${me?.tenantId || ''}:${me?.branchId || ''}:${view}:${selected || ''}:${kitchenCursor}`;
  const refreshSequence = useRef(0);
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  useEffect(() => {
    setKitchenCursor('');
    setKitchenTrail([]);
    setCancelTarget(null);
  }, [me?.userId, me?.branchId, view]);
  useEffect(() => setCancelTarget(null), [selected]);
  const refresh = useCallback(async () => {
    if (!me) return;
    const sequence = ++refreshSequence.current;
    const [nextMenu, nextCategories, nextOrders, nextTables, nextOrder] =
      await Promise.all([
        api<Menu[]>('/menu/items'),
        api<Category[]>('/menu/categories'),
        me.role === 'KITCHEN' || view === 'kitchen'
          ? api<KitchenPage>(
              '/kitchen/orders?limit=50' +
                (kitchenCursor
                  ? '&cursor=' + encodeURIComponent(kitchenCursor)
                  : ''),
            )
          : api<Order[]>('/orders'),
        me.role === 'KITCHEN' ? Promise.resolve([]) : api<Table[]>('/tables'),
        selected ? api<Order>(`/orders/${selected}`) : Promise.resolve(null),
      ]);
    return {
      sequence,
      nextMenu,
      nextCategories,
      nextOrders: Array.isArray(nextOrders) ? nextOrders : nextOrders.items,
      nextKitchenPage: Array.isArray(nextOrders) ? null : nextOrders,
      nextTables,
      nextOrder,
      scope,
    };
  }, [me, view, selected, scope, kitchenCursor]);
  const apply = useCallback((data: Awaited<ReturnType<typeof refresh>>) => {
    if (
      !data ||
      data.scope !== scopeRef.current ||
      data.sequence !== refreshSequence.current
    )
      return;
    setMenu(data.nextMenu);
    setCategories(data.nextCategories);
    setOrders(data.nextOrders);
    setKitchenPage(data.nextKitchenPage);
    setTables(data.nextTables);
    setOrder(data.nextOrder);
    setUpdated(new Date());
    setOnline(true);
  }, []);
  useEffect(() => {
    api<Me>('/auth/me')
      .then((user) => {
        sessionStorage.setItem(
          'restaurantos-actor',
          `${user.userId}:${user.tenantId}:${user.branchId}`,
        );
        setMe(user);
        const deepOrder = new URLSearchParams(window.location.search).get(
          'order',
        );
        if (
          deepOrder &&
          /^[0-9a-f-]{36}$/i.test(deepOrder) &&
          user.role !== 'KITCHEN'
        )
          setSelected(deepOrder);
        setView(user.role === 'KITCHEN' ? 'kitchen' : 'tables');
      })
      .catch((e) => {
        if (e instanceof ApiError && e.code === 'TENANT_SUSPENDED')
          void api<{
            userId: string;
            tenantId: string;
            branchId: string;
            sessionId: string;
          }>('/notifications/context')
            .then(setSuspended)
            .catch(() => {});
      })
      .finally(() => setBooting(false));
  }, []);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await refresh();
        if (active) apply(data);
      } catch (e) {
        if (!active) return;
        setOnline(false);
        if (e instanceof ApiError && e.code === 'TENANT_SUSPENDED')
          void api<{
            userId: string;
            tenantId: string;
            branchId: string;
            sessionId: string;
          }>('/notifications/context')
            .then(setSuspended)
            .catch(() => {});
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          setMe(null);
          setError('نشست شما تمام شده است. دوباره وارد شوید.');
        }
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refresh, apply]);
  const realtimeConnected = useRestaurantRealtime(
    me
      ? `${me.userId}:${me.tenantId}:${me.branchId}:${me.sessionId}`
      : undefined,
    () => {
      void refresh()
        .then(apply)
        .catch((e) => {
          setOnline(false);
          if (e instanceof ApiError && e.code === 'TENANT_SUSPENDED')
            void api<{
              userId: string;
              tenantId: string;
              branchId: string;
              sessionId: string;
            }>('/notifications/context')
              .then(setSuspended)
              .catch(() => {});
          if (e instanceof ApiError && (e.status === 401 || e.status === 403))
            setMe(null);
        });
    },
  );
  async function act<T>(
    action: () => Promise<T>,
    success?: (value: T) => void,
    refreshAfter = true,
  ) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const value = await action();
      success?.(value);
      if (refreshAfter) {
        try {
          apply(await refresh());
        } catch {
          setOnline(false);
          setNotice('درخواست ثبت شد؛ دریافت اطلاعات تازه فعلاً ممکن نیست.');
        }
      }
      return value;
    } catch (e) {
      setError(
        e instanceof ApiError
          ? errors[e.code] ||
              'انجام درخواست ممکن نشد. اطلاعات را بررسی و دوباره تلاش کنید.'
          : 'خطایی پیش آمد. دوباره تلاش کنید.',
      );
      try {
        apply(await refresh());
      } catch {
        setOnline(false);
      }
    } finally {
      setBusy(false);
    }
  }
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    await act(
      async () => {
        await api('/auth/login', 'POST', {
          email: data.get('email'),
          password: data.get('password'),
        });
        return api<Me>('/auth/me');
      },
      (user) => {
        setTables([]);
        setMenu([]);
        setOrders([]);
        setCategories([]);
        setEditor(null);
        sessionStorage.setItem(
          'restaurantos-actor',
          `${user.userId}:${user.tenantId}:${user.branchId}`,
        );
        setMe(user);
        const deepOrder = new URLSearchParams(window.location.search).get(
          'order',
        );
        if (
          deepOrder &&
          /^[0-9a-f-]{36}$/i.test(deepOrder) &&
          user.role !== 'KITCHEN'
        )
          setSelected(deepOrder);
        setView(user.role === 'KITCHEN' ? 'kitchen' : 'tables');
        setSelected(null);
      },
    );
  }
  const logout = () =>
    act(
      () => api('/auth/logout', 'POST'),
      () => {
        setMe(null);
        setSelected(null);
        setOrder(null);
        setTables([]);
        setMenu([]);
        setOrders([]);
        setCategories([]);
        setEditor(null);
        sessionStorage.removeItem('restaurantos-actor');
      },
      false,
    );
  const occupied = tables.filter((t) => t.orders.length).length;
  const visibleMenu = menu.filter(
    (m) =>
      (!search || m.name.includes(search) || m.description.includes(search)) &&
      (category === 'all' || m.categoryId === category),
  );
  const selectedTable = tables.find((t) => t.id === order?.tableId);
  const total =
    order?.items
      .filter((i) => i.status !== 'CANCELLED')
      .reduce((sum, item) => sum + item.quantity * item.priceRial, 0) || 0;
  const navigate = (next: View) => {
    setView(next);
    setSelected(null);
    setOrder(null);
    setSearch('');
    setLineNotes({});
    setCategory('all');
    setError('');
  };
  useEffect(() => setLineNotes({}), [selected]);
  const add = (item: Menu) =>
    act(
      () =>
        api<Order>(`/orders/${selected}/items`, 'POST', {
          menuItemId: item.id,
          quantity: 1,
          ...(lineNotes[item.id]?.trim()
            ? { notes: lineNotes[item.id].trim() }
            : {}),
        }),
      () => setLineNotes((current) => ({ ...current, [item.id]: '' })),
    );
  const updateItem = (
    item: Order['items'][number],
    change: {
      quantity?: number;
      status?: string;
    },
    id = selected,
  ) =>
    act(() =>
      api<Order>(`/orders/${id}/items/${item.id}`, 'PATCH', {
        version: item.version,
        ...change,
      }),
    );
  if (booting)
    return (
      <div {...ui('loading-screen')}>
        <Brand />
        <p>در حال آماده‌سازی محیط کار…</p>
      </div>
    );
  if (suspended)
    return (
      <main className="mx-auto grid max-w-lg gap-5 p-8">
        <h1 className="text-xl font-bold">دسترسی رستوران تعلیق شده است</h1>
        <p>
          فقط اعلان مربوط به تعلیق در دسترس است؛ برای بررسی با مدیر سامانه تماس
          بگیرید.
        </p>
        <button
          className="rounded border p-3"
          onClick={() => window.location.reload()}
        >
          بررسی دوباره دسترسی
        </button>
        <NotificationCenter
          key={JSON.stringify(suspended)}
          scopeKey={JSON.stringify(suspended)}
          role="MANAGER"
          restricted
        />
        <button
          className="rounded border p-3"
          onClick={() =>
            void api('/auth/logout', 'POST').then(() => {
              setSuspended(null);
              setMe(null);
            })
          }
        >
          خروج
        </button>
      </main>
    );
  if (!me)
    return (
      <div {...ui('login-page')}>
        <section {...ui('login-form')}>
          <Brand />
          <div {...ui('login-heading')}>
            <span {...ui('eyebrow')}>یک شیفتِ منظم‌تر</span>
            <h1>به نارنج خوش آمدید.</h1>
            <p>همه‌چیز، از اولین سفارش تا آخرین سرو، در یک‌جا.</p>
          </div>
          <form onSubmit={login}>
            <label>
              ایمیل کاری
              <input
                name="email"
                type="email"
                autoComplete="username"
                defaultValue="waiter@demo.restaurantos.test"
                required
                dir="ltr"
              />
            </label>
            <label>
              رمز عبور
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={8}
              />
            </label>
            {error && (
              <p {...ui('form-error')} role="alert">
                {error}
              </p>
            )}
            <button {...ui('primary login-submit')} disabled={busy}>
              {busy ? 'در حال ورود…' : 'ورود به محیط کار'}
              <Icon name="arrow" />
            </button>
          </form>
          <div {...ui('demo-note')}>
            <strong>محیط نمایشی رستوران</strong>
            <p>
              حساب‌های مدیر، سالن و آشپزخانه در راهنمای پروژه قرار دارند. از رمز
              نمایشی تنظیم‌شده استفاده کنید.
            </p>
          </div>
          <footer>نارنج · همراهِ هر روز رستوران شما</footer>
        </section>
        <section {...ui('login-art')}>
          <div {...ui('art-caption')}>
            <span {...ui('eyebrow')}>از سالن تا آشپزخانه</span>
            <h2>
              سفارش‌ها روشن.
              <br />
              همکاری، روان.
            </h2>
            <p>
              تمرکز تیم شما روی مهمان‌ها،
              <br />
              نظم کارها با نارنج.
            </p>
          </div>
          <div {...ui('art-board')}>
            <div {...ui('art-board-title')}>
              <span>نمای سالن</span>
              <span {...ui('live-label')}>
                <i />
                در حال سرویس
              </span>
            </div>
            <div {...ui('art-tables')}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  {...ui(
                    'art-table ' + ([2, 3, 5].includes(n) ? 'active' : ''),
                  )}
                  key={n}
                >
                  <span>{number(n)}</span>
                </div>
              ))}
            </div>
            <div {...ui('art-ticket')}>
              <span {...ui('ticket-icon')}>
                <Icon name="check" />
              </span>
              <div>
                <strong>سفارش میز ۳ آماده است</strong>
                <small>همه باخبرند. بدون صدا زدن.</small>
              </div>
              <span>همین حالا</span>
            </div>
          </div>
          <div {...ui('art-bottom')}>
            <span>سالن هماهنگ</span>
            <i />
            <span>آشپزخانه منظم</span>
            <i />
            <span>مهمان راضی</span>
          </div>
        </section>
      </div>
    );
  return (
    <div {...ui('app-shell')}>
      <aside {...ui('sidebar')}>
        <Brand />
        <div {...ui('restaurant-switch')}>
          <span {...ui('restaurant-avatar')}>ن</span>
          <div>
            <strong>{me.restaurant}</strong>
            <small>{me.branch}</small>
          </div>
          <span {...ui('switch-dots')}>•••</span>
        </div>
        <span {...ui('nav-label')}>محیط کار</span>
        <nav>
          {(me.role === 'KITCHEN'
            ? [{ id: 'kitchen', title: 'آشپزخانه', icon: 'kitchen' }]
            : [
                { id: 'tables', title: 'سالن و میزها', icon: 'grid' },
                ...(me.role === 'MANAGER'
                  ? [
                      { id: 'kitchen', title: 'آشپزخانه', icon: 'kitchen' },
                      { id: 'menu', title: 'مدیریت منو', icon: 'menu' },
                    ]
                  : []),
                { id: 'history', title: 'سفارش‌ها', icon: 'history' },
              ]
          ).map((link) => (
            <button
              key={link.id}
              {...ui(view === link.id ? 'nav-item active' : 'nav-item')}
              onClick={() => navigate(link.id as View)}
            >
              <Icon name={link.icon} />
              <span>{link.title}</span>
              {link.id === 'tables' && <small>{number(occupied)}</small>}
            </button>
          ))}
        </nav>
        <div {...ui('sidebar-bottom')}>
          <div {...ui('shift-note')}>
            <i />
            <div>
              <strong>یک تیم، یک جریان</strong>
              <p>تغییرات همکاران هر ۵ ثانیه نمایش داده می‌شود.</p>
            </div>
          </div>
          <div {...ui('profile')}>
            <span {...ui('profile-avatar')}>{me.name?.slice(0, 1)}</span>
            <div>
              <strong>{me.name}</strong>
              <small>{roleLabels[me.role]}</small>
            </div>
            <button aria-label="خروج" title="خروج" onClick={logout}>
              <Icon name="exit" />
            </button>
          </div>
        </div>
      </aside>
      <main {...ui('main')}>
        <header {...ui('topbar')}>
          <NotificationCenter
            key={`${me.userId}:${me.tenantId}:${me.branchId}:${me.sessionId}`}
            scopeKey={`${me.userId}:${me.tenantId}:${me.branchId}:${me.sessionId}`}
            role={me.role}
          />
          <span
            role="status"
            data-realtime-state={
              realtimeConnected ? 'connected' : 'disconnected'
            }
            className="max-w-40 text-[10px] text-slate-600"
          >
            {realtimeConnected
              ? 'ارتباط زنده برقرار است'
              : 'ارتباط زنده قطع است؛ تازه‌سازی دوره‌ای فعال است'}
          </span>
          {me.role === 'MANAGER' && (
            <a
              href="/dashboard"
              className="rounded-lg bg-[#edf4ee] px-3 py-2 text-xs text-[#255a46]"
            >
              پنل مدیریت
            </a>
          )}
          <span>
            فضای کاری <span {...ui('topbar-separator')}>/</span> {me.restaurant}
          </span>
          <div>
            <span {...ui('connection ' + (!online ? 'offline' : ''))}>
              <i />
              {online ? 'متصل' : 'ارتباط قطع است'}
            </span>
            <button
              {...ui('mobile-logout')}
              aria-label="خروج از حساب"
              title="خروج"
              onClick={logout}
            >
              <Icon name="exit" size={17} />
            </button>
            <span {...ui('topbar-date')}>
              {updated ? localDate(updated) : 'در حال دریافت…'}
            </span>
          </div>
        </header>
        <div {...ui('workspace')}>
          {error && (
            <div {...ui('alert error')} role="alert">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="بستن پیام">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div {...ui('alert success')} role="status">
              {notice}
            </div>
          )}
          {!online && (
            <div {...ui('alert error')}>
              ارتباط با سرور برقرار نیست. آخرین اطلاعات دریافتی نمایش داده
              می‌شود.
              <button onClick={() => act(refresh, apply)}>تلاش دوباره</button>
            </div>
          )}
          <div {...ui('page-heading')}>
            <div>
              <div {...ui('eyebrow')}>
                {view === 'tables'
                  ? 'پیشخوان سالن'
                  : view === 'kitchen'
                    ? 'از سفارش تا آماده‌سازی'
                    : view === 'menu'
                      ? 'طعم‌های رستوران شما'
                      : 'مرور جریان سفارش‌ها'}
              </div>
              <h1>
                {selected
                  ? `سفارش میز ${number(selectedTable?.number || order?.table?.number || 0)}`
                  : view === 'tables'
                    ? 'سالن و میزها'
                    : view === 'kitchen'
                      ? 'آشپزخانه'
                      : view === 'menu'
                        ? 'مدیریت منو'
                        : 'سفارش‌ها'}
              </h1>
              <p>
                {selected
                  ? 'اقلام را انتخاب کنید؛ آشپزخانه بلافاصله در جریان قرار می‌گیرد.'
                  : view === 'tables'
                    ? 'یک نگاه به سالن، یک شروع سریع برای سفارش بعدی.'
                    : view === 'kitchen'
                      ? 'هر سفارش، در زمان درست. وضعیت آماده‌سازی را به‌روز نگه دارید.'
                      : view === 'menu'
                        ? 'منویی به‌روز، برای یک تجربه بهتر.'
                        : 'سفارش‌های باز و تاریخچه سرویس رستوران.'}
              </p>
            </div>
            <div {...ui('heading-actions')}>
              {selected ? (
                <button
                  {...ui('secondary')}
                  onClick={() => {
                    setSelected(null);
                    setOrder(null);
                  }}
                >
                  <Icon name="arrow" />
                  بازگشت به سالن
                </button>
              ) : view === 'menu' ? (
                <>
                  <button {...ui('primary')} onClick={() => setEditor('new')}>
                    <Icon name="plus" />
                    افزودن غذا
                  </button>
                </>
              ) : (
                <button
                  {...ui('secondary icon-button')}
                  title="تازه‌سازی"
                  aria-label="تازه‌سازی"
                  disabled={busy}
                  onClick={() => act(refresh, apply)}
                >
                  <Icon name="refresh" />
                </button>
              )}
            </div>
          </div>
          {view === 'tables' && !selected && (
            <>
              <section {...ui('stats')}>
                <div>
                  <span {...ui('stat-icon green')}>
                    <Icon name="grid" />
                  </span>
                  <div>
                    <span>میزهای آزاد</span>
                    <strong>
                      {number(tables.length - occupied)}
                      <small>میز</small>
                    </strong>
                  </div>
                </div>
                <div>
                  <span {...ui('stat-icon orange')}>
                    <Icon name="menu" />
                  </span>
                  <div>
                    <span>در حال سرویس</span>
                    <strong>
                      {number(occupied)}
                      <small>میز</small>
                    </strong>
                  </div>
                </div>
                <div>
                  <span {...ui('stat-icon neutral')}>
                    <Icon name="kitchen" />
                  </span>
                  <div>
                    <span>آماده سرو</span>
                    <strong>
                      {number(
                        orders
                          .flatMap((o) => o.items)
                          .filter((i) => i.status === 'READY').length,
                      )}
                      <small>قلم</small>
                    </strong>
                  </div>
                </div>
              </section>
              <div {...ui('section-toolbar')}>
                <div {...ui('tabs')}>
                  {[
                    ['all', 'همه میزها'],
                    ['free', 'آزاد'],
                    ['occupied', 'در حال سرویس'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      {...ui(filter === id ? 'active' : '')}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div {...ui('legend')}>
                  <i {...ui('free-dot')} />
                  آزاد <i {...ui('occupied-dot')} />
                  در حال سرویس
                </div>
              </div>
              <div {...ui('table-grid')}>
                {tables
                  .filter(
                    (t) =>
                      filter === 'all' ||
                      (filter === 'free' ? !t.orders.length : t.orders.length),
                  )
                  .map((table) => {
                    const activeOrder = orders.find(
                      (o) => o.id === table.orders[0]?.id,
                    );
                    const ready = activeOrder?.items.some(
                      (i) => i.status === 'READY',
                    );
                    return (
                      <button
                        key={table.id}
                        {...ui(
                          `table-card ${table.orders.length ? 'occupied' : 'available'}`,
                        )}
                        disabled={busy}
                        onClick={() =>
                          table.orders.length
                            ? setSelected(table.orders[0].id)
                            : act(
                                () =>
                                  api<Order>('/orders', 'POST', {
                                    tableId: table.id,
                                  }),
                                (value) => {
                                  setSelected(value.id);
                                  setOrder(value);
                                },
                              )
                        }
                      >
                        <div {...ui('table-card-top')}>
                          <span
                            {...ui(
                              'table-status ' +
                                (table.orders.length ? 'in-service' : ''),
                            )}
                          >
                            <i />
                            {table.orders.length ? 'در حال سرویس' : 'آزاد'}
                          </span>
                          <small>{number(table.seats)} نفره</small>
                        </div>
                        <div {...ui('table-illustration')}>
                          <span {...ui('chair c1')} />
                          <span {...ui('chair c2')} />
                          <span {...ui('chair c3')} />
                          <span {...ui('chair c4')} />
                          <span {...ui('table-surface')}>
                            {number(table.number)}
                          </span>
                        </div>
                        <h3>میز {number(table.number)}</h3>
                        <div {...ui('table-card-bottom')}>
                          {table.orders.length ? (
                            <>
                              <span>
                                {number(activeOrder?.items.length || 0)} قلم
                                سفارش
                              </span>
                              {ready ? (
                                <span {...ui('ready-label')}>آماده سرو</span>
                              ) : (
                                <span>
                                  {money(
                                    activeOrder?.items
                                      .filter((i) => i.status !== 'CANCELLED')
                                      .reduce(
                                        (s, i) => s + i.quantity * i.priceRial,
                                        0,
                                      ) || 0,
                                  )}{' '}
                                  <small>تومان</small>
                                </span>
                              )}
                            </>
                          ) : (
                            <span>
                              <Icon name="plus" size={15} />
                              شروع سفارش
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
              </div>
              <div {...ui('section-footnote')}>
                <Icon name="clock" size={16} />
                آخرین تغییرات سالن به‌صورت خودکار دریافت می‌شود.
                <span role="status">
                  {realtimeConnected
                    ? 'ارتباط زنده برقرار است'
                    : 'ارتباط زنده قطع است؛ تازه‌سازی دوره‌ای فعال است'}
                </span>
              </div>
            </>
          )}
          {selected && (
            <div {...ui('order-layout')}>
              <section {...ui('menu-browser')}>
                <div {...ui('search-box')}>
                  <Icon name="search" />
                  <input
                    aria-label="جستجوی غذا"
                    placeholder="جستجو در نام غذا و توضیحات…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div {...ui('category-tabs')}>
                  <button
                    {...ui(category === 'all' ? 'active' : '')}
                    onClick={() => setCategory('all')}
                  >
                    همه
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      {...ui(category === c.id ? 'active' : '')}
                      onClick={() => setCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div {...ui('food-grid')}>
                  {visibleMenu
                    .filter((m) => m.active)
                    .map((item) => (
                      <article {...ui('food-card')} key={item.id}>
                        <div
                          {...ui(
                            'food-symbol category-' +
                              categories.findIndex(
                                (c) => c.id === item.categoryId,
                              ),
                          )}
                        >
                          <Icon
                            name={
                              item.category.name === 'نوشیدنی'
                                ? 'kitchen'
                                : 'menu'
                            }
                            size={30}
                          />
                          <small>{item.category.name}</small>
                        </div>
                        <div {...ui('food-details')}>
                          <span {...ui('food-category')}>
                            {item.category.name}
                          </span>
                          <h3>{item.name}</h3>
                          <p>{item.description}</p>
                          <div>
                            <strong>
                              {money(item.priceRial)} <small>تومان</small>
                            </strong>
                            <button
                              aria-label={`افزودن ${item.name}`}
                              title="افزودن به سفارش"
                              disabled={
                                busy ||
                                !item.available ||
                                order?.status !== 'OPEN'
                              }
                              onClick={() => add(item)}
                            >
                              <Icon name="plus" />
                            </button>
                          </div>
                          <label className="mt-2 grid gap-1 text-xs text-slate-600">
                            توضیح آشپزخانه برای {item.name}
                            <input
                              className="min-h-10 rounded border bg-white p-2"
                              maxLength={200}
                              disabled={busy || order?.status !== 'OPEN'}
                              value={lineNotes[item.id] || ''}
                              onChange={(e) =>
                                setLineNotes((current) => ({
                                  ...current,
                                  [item.id]: e.target.value,
                                }))
                              }
                              placeholder="مثلاً بدون قارچ؛ برای هر ردیف جدا ثبت کنید"
                            />
                          </label>
                          {!item.available && (
                            <span {...ui('unavailable')}>ناموجود</span>
                          )}
                        </div>
                      </article>
                    ))}
                </div>
                {!visibleMenu.length && (
                  <Empty
                    title="غذایی پیدا نشد"
                    description="عبارت جستجو یا دسته‌بندی را تغییر دهید."
                  />
                )}
              </section>
              <aside {...ui('order-ticket')}>
                <div {...ui('ticket-heading')}>
                  <div>
                    <h2>سفارش جاری</h2>
                    <span>
                      میز{' '}
                      {number(
                        selectedTable?.number || order?.table?.number || 0,
                      )}{' '}
                      ·{' '}
                      {order?.createdAt
                        ? localDate(order.createdAt)
                        : 'در حال دریافت'}
                    </span>
                  </div>
                  <Icon name="menu" />
                </div>
                <div {...ui('ticket-items')}>
                  {order?.items.map((item) => (
                    <div {...ui('ticket-item')} key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        {item.notes && (
                          <p className="mt-1 rounded bg-amber-50 p-2 text-sm text-amber-950">
                            توضیح آشپزخانه: {item.notes}
                          </p>
                        )}
                        <span>
                          {money(item.priceRial * item.quantity)}{' '}
                          <small>تومان</small>
                        </span>
                      </div>
                      <div>
                        <Badge status={item.status} />
                        {order.status === 'OPEN' &&
                          !['SERVED', 'CANCELLED'].includes(item.status) &&
                          (item.status === 'PENDING' ||
                            me.role === 'MANAGER') && (
                            <button
                              type="button"
                              {...ui('secondary')}
                              disabled={busy}
                              onClick={() => {
                                setCancelTarget({
                                  id: order.id,
                                  itemId: item.id,
                                  version: item.version,
                                });
                                setCancelReason('');
                              }}
                            >
                              لغو قلم
                            </button>
                          )}
                        {item.status === 'PENDING' &&
                        order.status === 'OPEN' ? (
                          <div {...ui('quantity')}>
                            <button
                              aria-label={`کاهش تعداد ${item.name}`}
                              disabled={busy || item.quantity <= 1}
                              onClick={() =>
                                updateItem(item, {
                                  quantity: item.quantity - 1,
                                })
                              }
                            >
                              −
                            </button>
                            <span>{number(item.quantity)}</span>
                            <button
                              aria-label={`افزایش تعداد ${item.name}`}
                              disabled={busy || item.quantity >= 99}
                              onClick={() =>
                                updateItem(item, {
                                  quantity: item.quantity + 1,
                                })
                              }
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <span {...ui('item-count')}>
                            × {number(item.quantity)}
                          </span>
                        )}
                      </div>
                      {item.status === 'READY' && order.status === 'OPEN' && (
                        <button
                          {...ui('serve-button')}
                          disabled={busy}
                          onClick={() => updateItem(item, { status: 'SERVED' })}
                        >
                          <Icon name="check" size={16} />
                          تحویل به مهمان
                        </button>
                      )}
                    </div>
                  ))}
                  {order && !order.items.length && (
                    <Empty
                      title="اولین انتخاب مهمان؟"
                      description="غذا یا نوشیدنی را از منو به سفارش اضافه کنید."
                    />
                  )}
                </div>
                <div {...ui('ticket-total')}>
                  <span>مجموع سفارش</span>
                  <strong>
                    {money(total)} <small>تومان</small>
                  </strong>
                </div>
                <button
                  {...ui('primary complete-button')}
                  disabled={
                    busy ||
                    !order?.items.length ||
                    !order?.items.some((i) => i.status === 'SERVED') ||
                    order?.items.some(
                      (i) => !['SERVED', 'CANCELLED'].includes(i.status),
                    ) ||
                    order?.status !== 'OPEN'
                  }
                  onClick={() =>
                    act(
                      () =>
                        api(`/orders/${selected}/complete`, 'POST', {
                          version: order?.version,
                        }),
                      () => {
                        setSelected(null);
                        setOrder(null);
                        setNotice('سفارش با موفقیت بسته شد و میز آزاد است.');
                      },
                    )
                  }
                >
                  <Icon name="check" />
                  {order?.status !== 'OPEN'
                    ? 'سفارش بسته شده'
                    : 'تکمیل سفارش و آزاد کردن میز'}
                </button>
                {order?.status === 'OPEN' &&
                  (me.role === 'MANAGER' || !order.items.length) &&
                  !order.items.some((i) => i.status === 'SERVED') && (
                    <button
                      {...ui('secondary')}
                      disabled={busy}
                      onClick={() => {
                        setCancelTarget({
                          id: order.id,
                          version: order.version,
                        });
                        setCancelReason('');
                      }}
                    >
                      لغو سفارش و آزاد کردن میز
                    </button>
                  )}
                {cancelTarget && (
                  <form
                    className="mt-3 grid gap-3 rounded-lg border border-red-200 bg-red-50 p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void act(
                        () =>
                          api(
                            `/orders/${cancelTarget.id}${cancelTarget.itemId ? '/items/' + cancelTarget.itemId : ''}/cancel`,
                            'POST',
                            {
                              version: cancelTarget.version,
                              reason: cancelReason,
                            },
                          ),
                        () => {
                          setCancelTarget(null);
                          setNotice(
                            'لغو ثبت شد؛ تغییر غذای در حال پخت را به آشپزخانه اطلاع دهید.',
                          );
                        },
                      );
                    }}
                  >
                    <label>
                      دلیل لغو
                      <textarea
                        aria-label="دلیل لغو"
                        className="w-full rounded border bg-white p-2"
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        required
                        maxLength={500}
                      />
                    </label>
                    <p>
                      لغو به معنی بازپرداخت نیست. لغو غذای در حال آماده‌سازی یا
                      آماده را به آشپزخانه اطلاع دهید.
                    </p>
                    <button
                      {...ui('secondary')}
                      disabled={busy || !cancelReason.trim()}
                    >
                      تأیید لغو
                    </button>
                    <button
                      type="button"
                      {...ui('secondary')}
                      onClick={() => setCancelTarget(null)}
                    >
                      انصراف
                    </button>
                    {error && <p role="alert">{error}</p>}
                    <button
                      type="button"
                      {...ui('secondary')}
                      onClick={() => {
                        if (!order) return;
                        const target = cancelTarget.itemId
                          ? order.items.find(
                              (i) => i.id === cancelTarget.itemId,
                            )
                          : order;
                        if (
                          target &&
                          window.confirm('وضعیت تازه را بررسی کرده‌اید؟')
                        )
                          setCancelTarget({
                            ...cancelTarget,
                            version: target.version,
                          });
                      }}
                    >
                      استفاده از نسخه تازه با حفظ دلیل
                    </button>
                  </form>
                )}
                <p {...ui('ticket-note')}>
                  بستن سفارش پس از سرو تمام اقلام ممکن است.
                  <br />
                  این بخش شامل پرداخت یا تسویه مالی نیست.
                </p>
              </aside>
            </div>
          )}
          {view === 'kitchen' && !selected && (
            <div {...ui('kitchen-board')}>
              <div className="col-span-full flex flex-wrap items-center gap-3 rounded-lg border bg-white p-3">
                <span>
                  نمایش {number(orders.length)} سفارش از{' '}
                  {number(kitchenPage?.total || 0)} سفارش فعال؛ این صفحه تمام صف
                  نیست.
                </span>
                <button
                  {...ui('secondary')}
                  disabled={!kitchenTrail.length || busy}
                  onClick={() => {
                    setKitchenCursor(kitchenTrail.at(-1) || '');
                    setKitchenTrail((x) => x.slice(0, -1));
                  }}
                >
                  قبلی
                </button>
                <button
                  {...ui('secondary')}
                  disabled={!kitchenPage?.hasMore || busy}
                  onClick={() => {
                    if (kitchenPage?.nextCursor) {
                      setKitchenTrail((x) => [...x, kitchenCursor]);
                      setKitchenCursor(kitchenPage.nextCursor);
                    }
                  }}
                >
                  ادامه صف
                </button>
                <button
                  {...ui('secondary')}
                  onClick={() => {
                    setKitchenCursor('');
                    setKitchenTrail([]);
                  }}
                >
                  اول صف / بررسی سفارش تازه
                </button>
                <span>
                  {updated
                    ? 'آخرین دریافت: ' + localDate(updated)
                    : 'در حال دریافت'}
                  {!online ? ' — اطلاعات قدیمی است؛ ارتباط قطع شده' : ''}
                </span>
              </div>
              <p role="status" className="col-span-full text-xs text-slate-600">
                {realtimeConnected
                  ? 'ارتباط زنده برقرار است'
                  : 'ارتباط زنده قطع است؛ تازه‌سازی دوره‌ای فعال است'}
              </p>
              {(['PENDING', 'PREPARING', 'READY'] as const).map((status) => {
                const items = orders.flatMap((o) =>
                  o.items
                    .filter((i) => i.status === status)
                    .map((i) => ({ item: i, order: o })),
                );
                return (
                  <section {...ui('kitchen-column')} key={status}>
                    <div {...ui('column-heading')}>
                      <Badge status={status} />
                      <span>{number(items.length)}</span>
                    </div>
                    {items.map(({ item, order: o }) => (
                      <article {...ui('kitchen-card')} key={item.id}>
                        <div {...ui('kitchen-card-top')}>
                          <strong>میز {number(o.table?.number || 0)}</strong>
                          <span>
                            <Icon name="clock" size={13} />
                            {new Intl.DateTimeFormat('fa-IR', {
                              timeZone: 'Asia/Tehran',
                              hour: '2-digit',
                              minute: '2-digit',
                            }).format(new Date(o.createdAt))}
                          </span>
                        </div>
                        <h3>
                          <span>{number(item.quantity)}×</span> {item.name}
                        </h3>
                        {item.notes && (
                          <p className="my-2 rounded bg-amber-50 p-2 text-sm text-amber-950">
                            توضیح آشپزخانه: {item.notes}
                          </p>
                        )}
                        <small>سفارش #{o.id.slice(-5)}</small>
                        {status !== 'READY' ? (
                          <button
                            {...ui(
                              status === 'PENDING' ? 'secondary' : 'primary',
                            )}
                            disabled={busy}
                            onClick={() =>
                              updateItem(
                                item,
                                {
                                  status:
                                    status === 'PENDING'
                                      ? 'PREPARING'
                                      : 'READY',
                                },
                                o.id,
                              )
                            }
                          >
                            {status === 'PENDING'
                              ? 'شروع آماده‌سازی'
                              : 'آماده سرو است'}
                            <Icon
                              name={status === 'PENDING' ? 'kitchen' : 'check'}
                              size={16}
                            />
                          </button>
                        ) : (
                          <div {...ui('waiting-serve')}>
                            منتظر تحویل توسط سالن
                          </div>
                        )}
                      </article>
                    ))}
                    {!items.length && (
                      <div {...ui('column-empty')}>
                        {status === 'PENDING'
                          ? 'سفارش تازه‌ای در انتظار نیست.'
                          : status === 'PREPARING'
                            ? 'همه‌چیز مرتب است.'
                            : 'هنوز غذایی در این بخش نیست.'}
                      </div>
                    )}
                  </section>
                );
              })}
            </div>
          )}
          {view === 'menu' && !selected && (
            <>
              <div {...ui('menu-toolbar')}>
                <div {...ui('search-box')}>
                  <Icon name="search" />
                  <input
                    placeholder="جستجو در منو…"
                    aria-label="جستجوی منو"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <span>{number(menu.length)} قلم در منوی رستوران</span>
              </div>
              <div {...ui('menu-list')}>
                <div {...ui('menu-list-header')}>
                  <span>نام و توضیحات</span>
                  <span>دسته‌بندی</span>
                  <span>قیمت (تومان)</span>
                  <span>وضعیت</span>
                  <span />
                </div>
                {visibleMenu.map((item) => (
                  <div {...ui('menu-row')} key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                    </div>
                    <span>{item.category.name}</span>
                    <strong>{money(item.priceRial)}</strong>
                    <span
                      {...ui(
                        'badge ' +
                          (item.active && item.available
                            ? 'served'
                            : 'pending'),
                      )}
                    >
                      <i />
                      {!item.active
                        ? 'غیرفعال'
                        : item.available
                          ? 'موجود'
                          : 'ناموجود'}
                    </span>
                    <button
                      {...ui('text-button')}
                      onClick={() => setEditor(item)}
                    >
                      ویرایش
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
          {view === 'history' && !selected && (
            <div {...ui('history-list')}>
              {!orders.length && (
                <Empty
                  title="هنوز سفارشی ثبت نشده"
                  description="اولین سفارش را از بخش سالن ثبت کنید."
                />
              )}
              {orders.map((o) => (
                <button
                  key={o.id}
                  {...ui('history-row')}
                  onClick={() => {
                    setSelected(o.id);
                    setOrder(o);
                  }}
                >
                  <span {...ui('history-icon')}>
                    <Icon name="menu" />
                  </span>
                  <div>
                    <strong>میز {number(o.table?.number || 0)}</strong>
                    <small>{localDate(o.createdAt)}</small>
                  </div>
                  <span>{number(o.items.length)} قلم</span>
                  <strong>
                    {money(
                      o.items
                        .filter((i) => i.status !== 'CANCELLED')
                        .reduce((s, i) => s + i.quantity * i.priceRial, 0),
                    )}{' '}
                    <small>تومان</small>
                  </strong>
                  <span
                    {...ui(
                      'badge ' + (o.status === 'OPEN' ? 'preparing' : 'served'),
                    )}
                  >
                    {o.status === 'OPEN' ? 'در حال سرویس' : 'تکمیل شده'}
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>
          )}
          <footer {...ui('workspace-footer')}>
            <span>نارنج، همراه تیم رستوران شما</span>
            <span>RestaurantOS · نسخه اولیه</span>
          </footer>
        </div>
      </main>
      {editor && (
        <MenuEditor
          item={editor}
          categories={categories}
          busy={busy}
          onClose={() => setEditor(null)}
          onSave={(data) =>
            act(
              () =>
                api(
                  editor === 'new' ? '/menu/items' : `/menu/items/${editor.id}`,
                  editor === 'new' ? 'POST' : 'PATCH',
                  data,
                ),
              () => {
                setEditor(null);
                setNotice('اطلاعات منو ذخیره شد.');
              },
            )
          }
        />
      )}
    </div>
  );
}
function MenuEditor({
  item,
  categories,
  busy,
  onClose,
  onSave,
}: {
  item: Menu | 'new';
  categories: Category[];
  busy: boolean;
  onClose: () => void;
  onSave: (data: unknown) => void;
}) {
  const initial = item === 'new' ? null : item;
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    onSave({
      name: data.get('name'),
      ...(initial ? { version: initial.version } : {}),
      description: data.get('description'),
      categoryId: data.get('categoryId'),
      priceToman: Number(data.get('priceToman')),
      active: data.get('active') === 'on',
      available: data.get('available') === 'on',
    });
  }
  return (
    <div {...ui('modal-backdrop')}>
      <section
        {...ui('modal')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header>
          <div>
            <span {...ui('eyebrow')}>منوی رستوران</span>
            <h2 id="editor-title">
              {initial ? 'ویرایش غذا' : 'افزودن غذای تازه'}
            </h2>
          </div>
          <button aria-label="بستن" onClick={onClose}>
            ×
          </button>
        </header>
        <form onSubmit={submit}>
          <label>
            نام غذا
            <input
              name="name"
              defaultValue={initial?.name}
              required
              maxLength={100}
            />
          </label>
          <label>
            توضیحات
            <textarea
              name="description"
              defaultValue={initial?.description}
              maxLength={1000}
            />
          </label>
          <div {...ui('form-grid')}>
            <label>
              دسته‌بندی
              <select
                name="categoryId"
                defaultValue={initial?.categoryId}
                required
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              قیمت (تومان)
              <input
                name="priceToman"
                type="number"
                min="1"
                max="100000000"
                step="1"
                defaultValue={initial ? initial.priceRial / 10 : undefined}
                required
              />
            </label>
          </div>
          <div {...ui('check-row')}>
            <label>
              <input
                type="checkbox"
                name="active"
                defaultChecked={initial?.active ?? true}
              />
              نمایش در منو
            </label>
            <label>
              <input
                type="checkbox"
                name="available"
                defaultChecked={initial?.available ?? true}
              />
              موجود و قابل سفارش
            </label>
          </div>
          <button {...ui('primary')} disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
          </button>
        </form>
      </section>
    </div>
  );
}
