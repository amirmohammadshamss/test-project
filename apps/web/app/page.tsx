'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, ApiError, errors, localDate, money, number } from '../lib/api';
import type {
  Actor,
  DraftValue,
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
  orders: { id: string }[];
};
type Menu = MenuEntry & { category: { name: string } };
type Order = OrderView & { table?: { number: number } };
type Category = { id: string; name: string };
type Draft = {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED' | 'APPROVED';
  result: DraftValue | null;
  errorCode?: string;
};
type View = 'tables' | 'kitchen' | 'menu' | 'history';
const statusLabels = {
  PENDING: 'در انتظار',
  PREPARING: 'در حال آماده‌سازی',
  READY: 'آماده سرو',
  SERVED: 'سرو شده',
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
    <div className="brand">
      <span className="brand-mark">ن</span>
      <div>
        <strong>نارنج</strong>
        <small>RESTAURANT OS</small>
      </div>
    </div>
  );
}
function Badge({ status }: { status: keyof typeof statusLabels }) {
  return (
    <span className={`badge ${status.toLowerCase()}`}>
      <i />
      {statusLabels[status]}
    </span>
  );
}
function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="menu" size={28} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

export default function RestaurantApp() {
  const [me, setMe] = useState<Me | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<View>('tables');
  const [tables, setTables] = useState<Table[]>([]);
  const [menu, setMenu] = useState<Menu[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState<Menu | 'new' | null>(null);
  const [aiOpen, setAiOpen] = useState(false);
  const scope = `${me?.userId || ''}:${me?.tenantId || ''}:${view}:${selected || ''}`;
  const scopeRef = useRef(scope);
  scopeRef.current = scope;
  const refresh = useCallback(async () => {
    if (!me) return;
    const [nextMenu, nextCategories, nextOrders, nextTables, nextOrder] =
      await Promise.all([
        api<Menu[]>('/menu/items'),
        api<Category[]>('/menu/categories'),
        api<Order[]>(
          me.role === 'KITCHEN' || view === 'kitchen'
            ? '/kitchen/orders'
            : '/orders',
        ),
        me.role === 'KITCHEN' ? Promise.resolve([]) : api<Table[]>('/tables'),
        selected ? api<Order>(`/orders/${selected}`) : Promise.resolve(null),
      ]);
    return {
      nextMenu,
      nextCategories,
      nextOrders,
      nextTables,
      nextOrder,
      scope,
    };
  }, [me, view, selected, scope]);
  const apply = useCallback((data: Awaited<ReturnType<typeof refresh>>) => {
    if (!data || data.scope !== scopeRef.current) return;
    setMenu(data.nextMenu);
    setCategories(data.nextCategories);
    setOrders(data.nextOrders);
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
        setView(user.role === 'KITCHEN' ? 'kitchen' : 'tables');
      })
      .catch(() => {})
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
        if (e instanceof ApiError && e.status === 401) {
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
        setAiOpen(false);
        sessionStorage.setItem(
          'restaurantos-actor',
          `${user.userId}:${user.tenantId}:${user.branchId}`,
        );
        setMe(user);
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
        setAiOpen(false);
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
    order?.items.reduce(
      (sum, item) => sum + item.quantity * item.priceRial,
      0,
    ) || 0;
  const navigate = (next: View) => {
    setView(next);
    setSelected(null);
    setOrder(null);
    setSearch('');
    setCategory('all');
    setError('');
  };
  const add = (item: Menu) =>
    act(() =>
      api<Order>(`/orders/${selected}/items`, 'POST', {
        menuItemId: item.id,
        quantity: 1,
      }),
    );
  const updateItem = (
    item: Order['items'][number],
    change: { quantity?: number; status?: string },
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
      <div className="loading-screen">
        <Brand />
        <p>در حال آماده‌سازی محیط کار…</p>
      </div>
    );
  if (!me)
    return (
      <div className="login-page">
        <section className="login-form">
          <Brand />
          <div className="login-heading">
            <span className="eyebrow">یک شیفتِ منظم‌تر</span>
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
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="primary login-submit" disabled={busy}>
              {busy ? 'در حال ورود…' : 'ورود به محیط کار'}
              <Icon name="arrow" />
            </button>
          </form>
          <div className="demo-note">
            <strong>محیط نمایشی رستوران</strong>
            <p>
              حساب‌های مدیر، سالن و آشپزخانه در راهنمای پروژه قرار دارند. از رمز
              نمایشی تنظیم‌شده استفاده کنید.
            </p>
          </div>
          <footer>نارنج · همراهِ هر روز رستوران شما</footer>
        </section>
        <section className="login-art">
          <div className="art-caption">
            <span className="eyebrow">از سالن تا آشپزخانه</span>
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
          <div className="art-board">
            <div className="art-board-title">
              <span>نمای سالن</span>
              <span className="live-label">
                <i />
                در حال سرویس
              </span>
            </div>
            <div className="art-tables">
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <div
                  className={
                    'art-table ' + ([2, 3, 5].includes(n) ? 'active' : '')
                  }
                  key={n}
                >
                  <span>{number(n)}</span>
                </div>
              ))}
            </div>
            <div className="art-ticket">
              <span className="ticket-icon">
                <Icon name="check" />
              </span>
              <div>
                <strong>سفارش میز ۳ آماده است</strong>
                <small>همه باخبرند. بدون صدا زدن.</small>
              </div>
              <span>همین حالا</span>
            </div>
          </div>
          <div className="art-bottom">
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
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <div className="restaurant-switch">
          <span className="restaurant-avatar">ن</span>
          <div>
            <strong>{me.restaurant}</strong>
            <small>{me.branch}</small>
          </div>
          <span className="switch-dots">•••</span>
        </div>
        <span className="nav-label">محیط کار</span>
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
              className={view === link.id ? 'nav-item active' : 'nav-item'}
              onClick={() => navigate(link.id as View)}
            >
              <Icon name={link.icon} />
              <span>{link.title}</span>
              {link.id === 'tables' && <small>{number(occupied)}</small>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="shift-note">
            <i />
            <div>
              <strong>یک تیم، یک جریان</strong>
              <p>تغییرات همکاران هر ۵ ثانیه نمایش داده می‌شود.</p>
            </div>
          </div>
          <div className="profile">
            <span className="profile-avatar">{me.name?.slice(0, 1)}</span>
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
      <main className="main">
        <header className="topbar">
          <span>
            فضای کاری <span className="topbar-separator">/</span>{' '}
            {me.restaurant}
          </span>
          <div>
            <span className={'connection ' + (!online ? 'offline' : '')}>
              <i />
              {online ? 'متصل' : 'ارتباط قطع است'}
            </span>
            <button
              className="mobile-logout"
              aria-label="خروج از حساب"
              title="خروج"
              onClick={logout}
            >
              <Icon name="exit" size={17} />
            </button>
            <span className="topbar-date">
              {updated ? localDate(updated) : 'در حال دریافت…'}
            </span>
          </div>
        </header>
        <div className="workspace">
          {error && (
            <div className="alert error" role="alert">
              <span>{error}</span>
              <button onClick={() => setError('')} aria-label="بستن پیام">
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              {notice}
            </div>
          )}
          {!online && (
            <div className="alert error">
              ارتباط با سرور برقرار نیست. آخرین اطلاعات دریافتی نمایش داده
              می‌شود.
              <button onClick={() => act(refresh, apply)}>تلاش دوباره</button>
            </div>
          )}
          <div className="page-heading">
            <div>
              <div className="eyebrow">
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
            <div className="heading-actions">
              {selected ? (
                <button
                  className="secondary"
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
                  <button
                    className="secondary ai-button"
                    onClick={() => setAiOpen(true)}
                  >
                    <Icon name="spark" />
                    دستیار منو
                  </button>
                  <button className="primary" onClick={() => setEditor('new')}>
                    <Icon name="plus" />
                    افزودن غذا
                  </button>
                </>
              ) : (
                <button
                  className="secondary icon-button"
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
              <section className="stats">
                <div>
                  <span className="stat-icon green">
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
                  <span className="stat-icon orange">
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
                  <span className="stat-icon neutral">
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
              <div className="section-toolbar">
                <div className="tabs">
                  {[
                    ['all', 'همه میزها'],
                    ['free', 'آزاد'],
                    ['occupied', 'در حال سرویس'],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      className={filter === id ? 'active' : ''}
                      onClick={() => setFilter(id)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="legend">
                  <i className="free-dot" />
                  آزاد <i className="occupied-dot" />
                  در حال سرویس
                </div>
              </div>
              <div className="table-grid">
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
                        className={`table-card ${table.orders.length ? 'occupied' : 'available'}`}
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
                        <div className="table-card-top">
                          <span
                            className={
                              'table-status ' +
                              (table.orders.length ? 'in-service' : '')
                            }
                          >
                            <i />
                            {table.orders.length ? 'در حال سرویس' : 'آزاد'}
                          </span>
                          <small>{number(table.seats)} نفره</small>
                        </div>
                        <div className="table-illustration">
                          <span className="chair c1" />
                          <span className="chair c2" />
                          <span className="chair c3" />
                          <span className="chair c4" />
                          <span className="table-surface">
                            {number(table.number)}
                          </span>
                        </div>
                        <h3>میز {number(table.number)}</h3>
                        <div className="table-card-bottom">
                          {table.orders.length ? (
                            <>
                              <span>
                                {number(activeOrder?.items.length || 0)} قلم
                                سفارش
                              </span>
                              {ready ? (
                                <span className="ready-label">آماده سرو</span>
                              ) : (
                                <span>
                                  {money(
                                    activeOrder?.items.reduce(
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
              <div className="section-footnote">
                <Icon name="clock" size={16} />
                آخرین تغییرات سالن به‌صورت خودکار دریافت می‌شود.
              </div>
            </>
          )}
          {selected && (
            <div className="order-layout">
              <section className="menu-browser">
                <div className="search-box">
                  <Icon name="search" />
                  <input
                    aria-label="جستجوی غذا"
                    placeholder="جستجو در نام غذا و توضیحات…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="category-tabs">
                  <button
                    className={category === 'all' ? 'active' : ''}
                    onClick={() => setCategory('all')}
                  >
                    همه
                  </button>
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      className={category === c.id ? 'active' : ''}
                      onClick={() => setCategory(c.id)}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
                <div className="food-grid">
                  {visibleMenu
                    .filter((m) => m.active)
                    .map((item) => (
                      <article className="food-card" key={item.id}>
                        <div
                          className={
                            'food-symbol category-' +
                            categories.findIndex(
                              (c) => c.id === item.categoryId,
                            )
                          }
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
                        <div className="food-details">
                          <span className="food-category">
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
                                order?.status === 'COMPLETED'
                              }
                              onClick={() => add(item)}
                            >
                              <Icon name="plus" />
                            </button>
                          </div>
                          {!item.available && (
                            <span className="unavailable">ناموجود</span>
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
              <aside className="order-ticket">
                <div className="ticket-heading">
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
                <div className="ticket-items">
                  {order?.items.map((item) => (
                    <div className="ticket-item" key={item.id}>
                      <div>
                        <strong>{item.name}</strong>
                        <span>
                          {money(item.priceRial * item.quantity)}{' '}
                          <small>تومان</small>
                        </span>
                      </div>
                      <div>
                        <Badge status={item.status} />
                        {item.status === 'PENDING' &&
                        order.status === 'OPEN' ? (
                          <div className="quantity">
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
                          <span className="item-count">
                            × {number(item.quantity)}
                          </span>
                        )}
                      </div>
                      {item.status === 'READY' && order.status === 'OPEN' && (
                        <button
                          className="serve-button"
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
                <div className="ticket-total">
                  <span>مجموع سفارش</span>
                  <strong>
                    {money(total)} <small>تومان</small>
                  </strong>
                </div>
                <button
                  className="primary complete-button"
                  disabled={
                    busy ||
                    !order?.items.length ||
                    order?.items.some((i) => i.status !== 'SERVED') ||
                    order?.status === 'COMPLETED'
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
                  {order?.status === 'COMPLETED'
                    ? 'سفارش بسته شده'
                    : 'تکمیل سفارش و آزاد کردن میز'}
                </button>
                <p className="ticket-note">
                  بستن سفارش پس از سرو تمام اقلام ممکن است.
                  <br />
                  این بخش شامل پرداخت یا تسویه مالی نیست.
                </p>
              </aside>
            </div>
          )}
          {view === 'kitchen' && !selected && (
            <div className="kitchen-board">
              {(['PENDING', 'PREPARING', 'READY'] as const).map((status) => {
                const items = orders.flatMap((o) =>
                  o.items
                    .filter((i) => i.status === status)
                    .map((i) => ({ item: i, order: o })),
                );
                return (
                  <section className="kitchen-column" key={status}>
                    <div className="column-heading">
                      <Badge status={status} />
                      <span>{number(items.length)}</span>
                    </div>
                    {items.map(({ item, order: o }) => (
                      <article className="kitchen-card" key={item.id}>
                        <div className="kitchen-card-top">
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
                        <small>سفارش #{o.id.slice(-5)}</small>
                        {status !== 'READY' ? (
                          <button
                            className={
                              status === 'PENDING' ? 'secondary' : 'primary'
                            }
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
                          <div className="waiting-serve">
                            منتظر تحویل توسط سالن
                          </div>
                        )}
                      </article>
                    ))}
                    {!items.length && (
                      <div className="column-empty">
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
              <div className="menu-toolbar">
                <div className="search-box">
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
              <div className="menu-list">
                <div className="menu-list-header">
                  <span>نام و توضیحات</span>
                  <span>دسته‌بندی</span>
                  <span>قیمت (تومان)</span>
                  <span>وضعیت</span>
                  <span />
                </div>
                {visibleMenu.map((item) => (
                  <div className="menu-row" key={item.id}>
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.description}</p>
                    </div>
                    <span>{item.category.name}</span>
                    <strong>{money(item.priceRial)}</strong>
                    <span
                      className={
                        'badge ' +
                        (item.active && item.available ? 'served' : 'pending')
                      }
                    >
                      <i />
                      {!item.active
                        ? 'غیرفعال'
                        : item.available
                          ? 'موجود'
                          : 'ناموجود'}
                    </span>
                    <button
                      className="text-button"
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
            <div className="history-list">
              {!orders.length && (
                <Empty
                  title="هنوز سفارشی ثبت نشده"
                  description="اولین سفارش را از بخش سالن ثبت کنید."
                />
              )}
              {orders.map((o) => (
                <button
                  key={o.id}
                  className="history-row"
                  onClick={() => {
                    setSelected(o.id);
                    setOrder(o);
                  }}
                >
                  <span className="history-icon">
                    <Icon name="menu" />
                  </span>
                  <div>
                    <strong>میز {number(o.table?.number || 0)}</strong>
                    <small>{localDate(o.createdAt)}</small>
                  </div>
                  <span>{number(o.items.length)} قلم</span>
                  <strong>
                    {money(
                      o.items.reduce((s, i) => s + i.quantity * i.priceRial, 0),
                    )}{' '}
                    <small>تومان</small>
                  </strong>
                  <span
                    className={
                      'badge ' + (o.status === 'OPEN' ? 'preparing' : 'served')
                    }
                  >
                    {o.status === 'OPEN' ? 'در حال سرویس' : 'تکمیل شده'}
                  </span>
                  <Icon name="arrow" size={16} />
                </button>
              ))}
            </div>
          )}
          <footer className="workspace-footer">
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
      {aiOpen && (
        <AiPanel
          onClose={() => setAiOpen(false)}
          onPublished={() => {
            void act(refresh, apply);
            setNotice('غذای تأییدشده به منو اضافه شد.');
          }}
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
      description: data.get('description'),
      categoryId: data.get('categoryId'),
      priceToman: Number(data.get('priceToman')),
      active: data.get('active') === 'on',
      available: data.get('available') === 'on',
    });
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-title"
      >
        <header>
          <div>
            <span className="eyebrow">منوی رستوران</span>
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
          <div className="form-grid">
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
          <div className="check-row">
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
          <button className="primary" disabled={busy}>
            {busy ? 'در حال ذخیره…' : 'ذخیره اطلاعات'}
          </button>
        </form>
      </section>
    </div>
  );
}
function AiPanel({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const [input, setInput] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [value, setValue] = useState<DraftValue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!draft || !['PENDING', 'PROCESSING'].includes(draft.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const next = await api<Draft>(`/ai/menu-drafts/${draft.id}`);
        if (active) {
          setDraft(next);
          if (next.result) setValue(next.result);
        }
      } catch {
        if (active) setError('دریافت وضعیت ممکن نشد. ارتباط را بررسی کنید.');
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [draft]);
  async function generate(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const next = await api<Draft>('/ai/menu-drafts', 'POST', { input });
      setDraft(next);
      setValue(next.result);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? errors[e.code] || 'ارسال درخواست ممکن نشد.'
          : 'خطای ارتباط',
      );
    } finally {
      setBusy(false);
    }
  }
  async function approve(e: FormEvent) {
    e.preventDefault();
    if (!draft || !value) return;
    setBusy(true);
    setError('');
    try {
      await api(`/ai/menu-drafts/${draft.id}/approve`, 'POST', value);
      setDraft({ ...draft, status: 'APPROVED' });
      onPublished();
    } catch (e) {
      setError(
        e instanceof ApiError
          ? errors[e.code] || 'تأیید پیش‌نویس ممکن نشد.'
          : 'خطای ارتباط',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="modal-backdrop">
      <section
        className="modal ai-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-title"
      >
        <header>
          <div>
            <span className="eyebrow">
              <Icon name="spark" size={16} />
              دستیار هوشمند
            </span>
            <h2 id="ai-title">از توضیح شما تا پیش‌نویس منو</h2>
          </div>
          <button aria-label="بستن" onClick={onClose}>
            ×
          </button>
        </header>
        <p className="muted">
          غذا را به زبان خودتان توضیح دهید. نام، توضیحات و قیمت پیشنهادی را پیش
          از انتشار بررسی کنید.
        </p>
        {(!draft || draft.status === 'FAILED') && (
          <form onSubmit={generate}>
            <label>
              توضیحات غذا
              <textarea
                placeholder="چیزبرگر مخصوص با ۲۰۰ گرم گوشت و پنیر گودا، قیمت ۴۵۰ هزار تومان"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                minLength={5}
                maxLength={2000}
                required
              />
            </label>
            <button className="primary" disabled={busy}>
              {busy ? 'در حال ارسال…' : 'ساخت پیش‌نویس'}
              <Icon name="spark" size={16} />
            </button>
          </form>
        )}
        {draft && ['PENDING', 'PROCESSING'].includes(draft.status) && (
          <div className="ai-processing">
            <span className="spinner" />
            <h3>در حال ساخت پیش‌نویس</h3>
            <p>
              درخواست ذخیره شده است. پس از پردازش، نتیجه اینجا نمایش داده
              می‌شود.
            </p>
          </div>
        )}
        {draft?.status === 'FAILED' && (
          <p className="form-error">
            {errors[draft.errorCode || ''] ||
              'ساخت پیش‌نویس انجام نشد. دوباره تلاش کنید یا غذا را دستی وارد کنید.'}
          </p>
        )}
        {draft?.status === 'READY' && value && (
          <form onSubmit={approve}>
            <div className="review-note">
              این اطلاعات هنوز منتشر نشده‌اند. قیمت و جزئیات را بررسی و اصلاح
              کنید.
            </div>
            <label>
              نام غذا
              <input
                value={value.name}
                onChange={(e) => setValue({ ...value, name: e.target.value })}
                required
                maxLength={100}
              />
            </label>
            <label>
              توضیحات
              <textarea
                value={value.description}
                onChange={(e) =>
                  setValue({ ...value, description: e.target.value })
                }
                maxLength={1000}
              />
            </label>
            <div className="form-grid">
              <label>
                قیمت (تومان)
                <input
                  type="number"
                  min="1"
                  max="100000000"
                  step="1"
                  value={value.priceToman}
                  onChange={(e) =>
                    setValue({ ...value, priceToman: Number(e.target.value) })
                  }
                  required
                />
              </label>
              <label>
                دسته‌بندی
                <select
                  value={value.category}
                  onChange={(e) =>
                    setValue({ ...value, category: e.target.value })
                  }
                >
                  {['برگر', 'پیتزا', 'نوشیدنی', 'پیش‌غذا', 'دسر'].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="primary" disabled={busy}>
              تأیید قیمت و انتشار در منو
            </button>
          </form>
        )}
        {draft?.status === 'APPROVED' && (
          <div className="ai-processing">
            <Icon name="check" size={36} />
            <h3>به منو اضافه شد</h3>
            <button className="secondary" onClick={onClose}>
              بازگشت به منو
            </button>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </section>
    </div>
  );
}
