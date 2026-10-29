'use client';
import { useRestaurantRealtime } from '../lib/realtime';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { api, ApiError, errors, localDate, money, number } from '../lib/api';

type Row = { id: string; version: number; [key: string]: unknown };
type Page<T> = { items: T[]; total: number; page: number; pages: number };
type Category = Row & { name: string; active: boolean; displayOrder: number };
type Menu = Row & {
  name: string;
  description: string;
  priceRial: number;
  categoryId: string;
  active: boolean;
  available: boolean;
  category: { name: string; active: boolean };
};
type Item = {
  id: string;
  name: string;
  quantity: number;
  priceRial: number;
  status: string;
  version: number;
};
type Order = Row & {
  tableId: string;
  table: { number: number };
  status: string;
  createdAt: string;
  updatedAt: string;
  items: Item[];
  events: { id: string; action: string; createdAt: string }[];
};
type Table = Row & {
  number: number;
  seats: number;
  active: boolean;
  orders: Order[];
};
type Staff = {
  id: string;
  role: string;
  active: boolean;
  user: { name: string; email: string; active: boolean };
  branches: { branch: { name: string } }[];
};
type Settings = {
  name: string;
  branchName: string;
  primaryContact: string;
  contactEmail: string;
  phone: string;
  address: string;
  timezone: string;
  currencyPresentation: string;
  version: number;
};
type Dashboard = {
  activeOrders: number;
  pendingOrders: number;
  preparingOrders: number;
  readyOrders: number;
  occupiedTables: number;
  availableTables: number;
  pendingItems: number;
  preparingItems: number;
  readyItems: number;
  recentOrders: Order[];
  checkedAt: string;
};
type Draft = {
  id: string;
  status: string;
  errorCode?: string;
  result: {
    name: string;
    description: string;
    category: string;
    priceToman: number;
  } | null;
};
const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#255a46] px-4 py-2 text-xs text-white disabled:cursor-not-allowed disabled:opacity-50';
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-[#dce2db] bg-white px-3 py-2 text-xs text-[#255a46] disabled:opacity-50';
const card = 'rounded-xl border border-[#e5e9e2] bg-white p-5';
const labels: Record<string, string> = {
  PENDING: 'در انتظار',
  PREPARING: 'در حال آماده‌سازی',
  READY: 'آماده سرو',
  SERVED: 'سرو شده',
  CANCELLED: 'لغو شده',
  OPEN: 'باز',
  COMPLETED: 'تکمیل شده',
  MANAGER: 'مدیر',
  WAITER: 'سالن',
  KITCHEN: 'آشپزخانه',
};
function Field({
  name,
  label,
  value,
  type = 'text',
  required = true,
}: {
  name: string;
  label: string;
  value?: string | number;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-2 text-xs">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={value}
        required={required}
        maxLength={type === 'number' ? undefined : 500}
        min={type === 'number' ? 1 : undefined}
        step={type === 'number' ? 1 : undefined}
        className="w-full rounded-lg border border-[#dce2db] bg-white p-3"
      />
    </label>
  );
}
function GridTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[550px] text-right text-xs [&_td]:border-t [&_td]:border-[#edf0e7] [&_td]:px-4 [&_td]:py-4 [&_th]:bg-[#f0f3eb] [&_th]:px-4 [&_th]:py-3 [&_th]:font-medium">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, i) => (
                  <td key={i}>{cell}</td>
                ))}
              </tr>
            ))
          ) : (
            <tr>
              <td
                colSpan={headers.length}
                className="text-center text-[#7b8580]"
              >
                موردی یافت نشد.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex rounded-md bg-[#edf4ee] px-2 py-1 text-[10px] text-[#255a46]">
      {children}
    </span>
  );
}
const nav = [
  ['', 'نمای کلی'],
  ['orders', 'سفارش‌ها'],
  ['tables', 'میزها'],
  ['menu', 'منو و دسته‌بندی'],
  ['menu/ai-drafts', 'دستیار منو'],
  ['staff', 'کارکنان'],
  ['settings', 'تنظیمات'],
];
export default function RestaurantAdminPanel() {
  const pathname = usePathname();
  const section = pathname.slice('/dashboard'.length).replace(/^\//, '');
  const [me, setMe] = useState<{
    name: string;
    restaurant: string;
    branch: string;
    role: string;
  } | null>(null);
  const [denied, setDenied] = useState(false);
  const [snapshot, setSnapshot] = useState<{
    path: string;
    value: unknown;
  } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [menu, setMenu] = useState<Menu[]>([]);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editor, setEditor] = useState<{
    kind: 'item' | 'category' | 'table';
    record?: Row;
  } | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftInput, setDraftInput] = useState('');
  const data = snapshot?.path === pathname ? snapshot.value : null;
  useEffect(() => {
    api<
      typeof me & {
        role: string;
        userId: string;
        tenantId: string;
        branchId: string;
      }
    >('/auth/me')
      .then((user) => {
        if (!user || user.role !== 'MANAGER') {
          setDenied(true);
          return;
        }
        sessionStorage.setItem(
          'restaurantos-actor',
          `${user.userId}:${user.tenantId}:${user.branchId}`,
        );
        setMe(user);
      })
      .catch(() => window.location.assign('/'));
  }, []);
  useEffect(() => {
    setPage(1);
    setSearch('');
    setStatus('');
    setError('');
    setSnapshot(null);
  }, [pathname]);
  const refreshSequence = useRef(0);
  const load = useCallback(async () => {
    if (!me) return;
    const sequence = ++refreshSequence.current;
    let value: unknown;
    const query = new URLSearchParams({
      page: String(page),
      pageSize: '20',
      ...(search ? { q: search } : {}),
      ...(status ? { status } : {}),
    });
    if (section === '') value = await api('/admin/dashboard');
    else if (section === 'menu')
      value = await api(`/admin/menu/items?${query}`);
    else if (section === 'tables') value = await api('/admin/tables');
    else if (section === 'staff') value = await api(`/admin/staff?${query}`);
    else if (section === 'settings') value = await api('/admin/settings');
    else if (section === 'orders') value = await api(`/admin/orders?${query}`);
    else if (section.startsWith('orders/'))
      value = await api(`/admin/orders/${section.split('/')[1]}`);
    else if (section === 'menu/ai-drafts') value = { ready: true };
    const [nextCategories, nextMenu] = await Promise.all([
      api<Category[]>('/admin/menu/categories'),
      api<Page<Menu>>('/admin/menu/items?pageSize=100'),
    ]);
    return {
      sequence,
      path: pathname,
      value,
      categories: nextCategories,
      menu: nextMenu.items,
    };
  }, [me, page, search, status, section, pathname]);
  const apply = useCallback((next: Awaited<ReturnType<typeof load>>) => {
    if (!next || next.sequence !== refreshSequence.current) return;
    setSnapshot({ path: next.path, value: next.value });
    setCategories(next.categories);
    setMenu(next.menu);
  }, []);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const next = await load();
        if (active) apply(next);
      } catch (e) {
        if (active)
          setError(
            e instanceof ApiError
              ? errors[e.code] || 'دریافت اطلاعات ممکن نشد.'
              : 'خطای ارتباط',
          );
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 5000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [load, apply]);
  const realtimeConnected = useRestaurantRealtime(
    me ? JSON.stringify(me) : undefined,
    () => {
      void load()
        .then(apply)
        .catch((e) => {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403))
            window.location.assign('/');
          else setError('ارتباط زنده قطع شد؛ اطلاعات را دوباره دریافت کنید.');
        });
    },
  );
  useEffect(() => {
    if (!draft || !['PENDING', 'PROCESSING'].includes(draft.status)) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const next = await api<Draft>(`/admin/ai/menu-drafts/${draft.id}`);
        if (active) setDraft(next);
      } catch {
        if (active) setError('دریافت وضعیت پیش‌نویس ممکن نشد.');
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [draft]);
  async function mutate(action: () => Promise<unknown>, success?: () => void) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await action();
      success?.();
      setNotice('تغییر با موفقیت ثبت شد.');
      try {
        apply(await load());
      } catch {
        setError('تغییر ذخیره شد؛ دریافت اطلاعات تازه ممکن نیست.');
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? errors[e.code] ||
              'درخواست انجام نشد. اطلاعات را تازه و دوباره بررسی کنید.'
          : 'خطای ارتباط',
      );
      try {
        apply(await load());
      } catch {
        // Preserve the original mutation error when refresh also fails.
      }
    } finally {
      setBusy(false);
    }
  }
  async function saveEditor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editor) return;
    const form = new FormData(e.currentTarget);
    if (
      editor.record &&
      form.get('active') !== 'on' &&
      !window.confirm('غیرفعال‌سازی این رکورد تأیید شود؟')
    )
      return;
    const common = {
      active: form.get('active') === 'on',
      ...(editor.record ? { version: editor.record.version } : {}),
    };
    const body =
      editor.kind === 'item'
        ? {
            ...common,
            name: form.get('name'),
            description: form.get('description'),
            categoryId: form.get('categoryId'),
            priceToman: Number(form.get('priceToman')),
            available: form.get('available') === 'on',
          }
        : editor.kind === 'category'
          ? {
              ...common,
              name: form.get('name'),
              displayOrder: Number(form.get('displayOrder')),
            }
          : {
              ...common,
              number: Number(form.get('number')),
              seats: Number(form.get('seats')),
            };
    const resource =
      editor.kind === 'item'
        ? 'menu/items'
        : editor.kind === 'category'
          ? 'menu/categories'
          : 'tables';
    await mutate(
      () =>
        api(
          `/admin/${resource}${editor.record ? '/' + editor.record.id : ''}`,
          editor.record ? 'PATCH' : 'POST',
          body,
        ),
      () => setEditor(null),
    );
  }
  const pager = (value: Page<unknown>) => (
    <div className="flex items-center justify-between p-4 text-xs">
      <span>
        {number(value.total)} نتیجه · صفحه {number(value.page)}
      </span>
      <div className="flex gap-2">
        <button
          className={secondary}
          disabled={page <= 1}
          onClick={() => setPage((p) => p - 1)}
        >
          قبلی
        </button>
        <button
          className={secondary}
          disabled={!value.pages || page >= value.pages}
          onClick={() => setPage((p) => p + 1)}
        >
          بعدی
        </button>
      </div>
    </div>
  );
  const orderRows = (items: Order[]) =>
    items.map((o) => [
      <Link
        className="font-semibold text-[#255a46] underline"
        href={`/dashboard/orders/${o.id}`}
      >
        #{o.id.slice(-7)}
      </Link>,
      `میز ${number(o.table.number)}`,
      localDate(o.createdAt),
      <Badge>{labels[o.status]}</Badge>,
      `${money(o.items.filter((i) => i.status !== 'CANCELLED').reduce((s, i) => s + i.quantity * i.priceRial, 0))} تومان`,
    ]);
  if (denied)
    return (
      <main className="mx-auto max-w-xl p-10">
        <h1>دسترسی مجاز نیست</h1>
        <p>این پنل ویژه مدیر رستوران است.</p>
        <a href="/" className={secondary}>
          بازگشت
        </a>
      </main>
    );
  if (!me)
    return <main className="p-10 text-center">در حال بررسی دسترسی…</main>;
  const title = section.startsWith('orders/')
    ? 'جزئیات سفارش'
    : nav.find(([key]) => key === section)?.[1] || 'مدیریت رستوران';
  return (
    <div className="min-h-screen bg-[#f6f7f4] text-[#243e36]">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e5e9e2] bg-white px-5 py-4">
        <div>
          <strong className="text-xl">نارنج · مدیریت رستوران</strong>
          <p className="text-xs text-[#7b8580]">
            {me.restaurant} · {me.branch} · {me.name}
          </p>
        </div>
        <div className="flex gap-2">
          <a href="/" className={secondary}>
            سالن و سفارش‌گیری
          </a>
          <button
            className={secondary}
            onClick={() =>
              mutate(
                () => api('/auth/logout', 'POST'),
                () => window.location.assign('/'),
              )
            }
          >
            خروج
          </button>
        </div>
      </header>
      <div className="mx-auto grid max-w-[1500px] gap-6 p-4 md:grid-cols-[190px_minmax(0,1fr)] md:p-7">
        <nav className="flex flex-wrap gap-2 self-start md:sticky md:top-5 md:flex-col">
          {nav.map(([key, label]) => (
            <Link
              key={key}
              href={`/dashboard${key ? '/' + key : ''}`}
              className={`rounded-lg px-4 py-3 text-xs ${section === key ? 'bg-[#255a46] text-white' : 'bg-white text-[#4d6258]'}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <main className="min-w-0">
          <p role="status" className="mb-3 text-xs text-slate-600">
            {realtimeConnected
              ? 'ارتباط زنده برقرار است'
              : 'ارتباط زنده قطع است؛ تازه‌سازی دوره‌ای فعال است'}
          </p>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1>{title}</h1>
              <p className="text-xs text-[#7b8580]">
                اطلاعات همین رستوران و شعبه مجاز شما
              </p>
            </div>
            <div className="flex gap-2">
              {section === 'menu' && (
                <>
                  <button
                    className={secondary}
                    onClick={() => setEditor({ kind: 'category' })}
                  >
                    دسته‌بندی تازه
                  </button>
                  <button
                    className={button}
                    onClick={() => setEditor({ kind: 'item' })}
                  >
                    غذای تازه
                  </button>
                </>
              )}
              {section === 'tables' && (
                <button
                  className={button}
                  onClick={() => setEditor({ kind: 'table' })}
                >
                  میز تازه
                </button>
              )}
            </div>
          </div>
          {error && (
            <p
              role="alert"
              className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-800"
            >
              {error}
            </p>
          )}
          {notice && (
            <p
              role="status"
              className="mb-4 rounded-lg bg-green-50 p-3 text-xs text-green-800"
            >
              {notice}
            </p>
          )}
          {!data ? (
            <div className={card}>در حال دریافت اطلاعات…</div>
          ) : section === '' ? (
            (() => {
              const d = data as Dashboard;
              return (
                <>
                  <section className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-3">
                    {[
                      ['سفارش‌های باز', d.activeOrders],
                      ['میز اشغال', d.occupiedTables],
                      ['میز آزاد', d.availableTables],
                      ['سفارش در انتظار آماده‌سازی', d.pendingOrders],
                      ['سفارش در حال آماده‌سازی', d.preparingOrders],
                      ['سفارش آماده سرو', d.readyOrders],
                      ['قلم در انتظار آماده‌سازی', d.pendingItems],
                      ['در حال آماده‌سازی', d.preparingItems],
                      ['آماده سرو', d.readyItems],
                    ].map(([label, count]) => (
                      <div className={card} key={label}>
                        <p className="text-xs text-[#7b8580]">{label}</p>
                        <strong className="text-3xl">
                          {number(Number(count))}
                        </strong>
                      </div>
                    ))}
                  </section>
                  <div className="mb-5 flex flex-wrap gap-2">
                    {['orders', 'menu', 'tables', 'menu/ai-drafts'].map(
                      (key) => (
                        <Link
                          className={secondary}
                          key={key}
                          href={`/dashboard/${key}`}
                        >
                          {nav.find((n) => n[0] === key)?.[1]}
                        </Link>
                      ),
                    )}
                  </div>
                  <section className="overflow-hidden rounded-xl border border-[#e5e9e2] bg-white">
                    <h2 className="p-5">سفارش‌های اخیر</h2>
                    <GridTable
                      headers={['سفارش', 'میز', 'زمان', 'وضعیت', 'مجموع']}
                      rows={orderRows(d.recentOrders)}
                    />
                  </section>
                  <p className="mt-3 text-[10px] text-[#7b8580]">
                    دریافت خودکار هر ۵ ثانیه · {localDate(d.checkedAt)}
                  </p>
                </>
              );
            })()
          ) : section === 'orders' ? (
            <section className="overflow-hidden rounded-xl border border-[#e5e9e2] bg-white">
              <div className="flex gap-3 p-4">
                <input
                  placeholder="شماره میز یا شناسه سفارش"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  aria-label="جستجوی سفارش"
                />
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value);
                    setPage(1);
                  }}
                  aria-label="وضعیت سفارش"
                >
                  <option value="">همه وضعیت‌ها</option>
                  <option value="OPEN">باز</option>
                  <option value="COMPLETED">تکمیل شده</option>
                  <option value="CANCELLED">لغو شده</option>
                </select>
              </div>
              <GridTable
                headers={['سفارش', 'میز', 'زمان', 'وضعیت', 'مجموع']}
                rows={orderRows((data as Page<Order>).items)}
              />
              {pager(data as Page<Order>)}
            </section>
          ) : section.startsWith('orders/') ? (
            (() => {
              const o = data as Order;
              return (
                <div className="space-y-5">
                  <section className={card}>
                    <div className="mb-4 flex justify-between">
                      <h2>میز {number(o.table.number)}</h2>
                      <Badge>{labels[o.status]}</Badge>
                    </div>
                    <p className="text-xs">
                      ثبت: {localDate(o.createdAt)} · آخرین تغییر:{' '}
                      {localDate(o.updatedAt)}
                    </p>
                    {o.status === 'OPEN' && (
                      <a className={secondary} href={'/?order=' + o.id}>
                        اصلاح یا لغو سفارش در سالن
                      </a>
                    )}
                    <GridTable
                      headers={[
                        'غذا',
                        'تعداد',
                        'قیمت تاریخی',
                        'وضعیت',
                        'عملیات',
                      ]}
                      rows={o.items.map((item) => [
                        item.name,
                        number(item.quantity),
                        `${money(item.priceRial)} تومان`,
                        labels[item.status],
                        o.status === 'OPEN' ? (
                          <div className="flex flex-wrap gap-1">
                            {item.status === 'PENDING' && (
                              <button
                                className={secondary}
                                disabled={busy}
                                onClick={() =>
                                  mutate(() =>
                                    api(
                                      `/orders/${o.id}/items/${item.id}`,
                                      'PATCH',
                                      {
                                        version: item.version,
                                        status: 'PREPARING',
                                      },
                                    ),
                                  )
                                }
                              >
                                شروع
                              </button>
                            )}
                            {item.status === 'PREPARING' && (
                              <button
                                className={secondary}
                                disabled={busy}
                                onClick={() =>
                                  mutate(() =>
                                    api(
                                      `/orders/${o.id}/items/${item.id}`,
                                      'PATCH',
                                      {
                                        version: item.version,
                                        status: 'READY',
                                      },
                                    ),
                                  )
                                }
                              >
                                آماده
                              </button>
                            )}
                            {item.status === 'READY' && (
                              <button
                                className={secondary}
                                disabled={busy}
                                onClick={() =>
                                  mutate(() =>
                                    api(
                                      `/orders/${o.id}/items/${item.id}`,
                                      'PATCH',
                                      {
                                        version: item.version,
                                        status: 'SERVED',
                                      },
                                    ),
                                  )
                                }
                              >
                                سرو شد
                              </button>
                            )}
                          </div>
                        ) : (
                          '—'
                        ),
                      ])}
                    />
                    {o.status === 'OPEN' && (
                      <form
                        className="mt-5 flex flex-wrap gap-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.currentTarget);
                          void mutate(() =>
                            api(`/orders/${o.id}/items`, 'POST', {
                              menuItemId: f.get('menuItemId'),
                              quantity: Number(f.get('quantity')),
                            }),
                          );
                        }}
                      >
                        <select
                          name="menuItemId"
                          className="flex-1"
                          required
                          aria-label="غذا"
                        >
                          {menu
                            .filter(
                              (m) =>
                                m.active && m.available && m.category.active,
                            )
                            .map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} · {money(m.priceRial)} تومان
                              </option>
                            ))}
                        </select>
                        <input
                          className="max-w-24"
                          name="quantity"
                          type="number"
                          min="1"
                          max="99"
                          defaultValue="1"
                          aria-label="تعداد"
                        />
                        <button className={button} disabled={busy}>
                          افزودن
                        </button>
                      </form>
                    )}
                    <p className="my-4 font-semibold">
                      مجموع:{' '}
                      {money(
                        o.items
                          .filter((i) => i.status !== 'CANCELLED')
                          .reduce((s, i) => s + i.quantity * i.priceRial, 0),
                      )}{' '}
                      تومان
                    </p>
                    <button
                      className={button}
                      disabled={
                        busy ||
                        o.status !== 'OPEN' ||
                        !o.items.length ||
                        !o.items.some((i) => i.status === 'SERVED') ||
                        o.items.some(
                          (i) => !['SERVED', 'CANCELLED'].includes(i.status),
                        )
                      }
                      onClick={() =>
                        mutate(() =>
                          api(`/orders/${o.id}/complete`, 'POST', {
                            version: o.version,
                          }),
                        )
                      }
                    >
                      تکمیل سفارش
                    </button>
                  </section>
                  <section className={card}>
                    <h2>سابقه سفارش</h2>
                    {o.events.map((event) => (
                      <p
                        key={event.id}
                        className="border-b border-[#edf0e7] py-3 text-xs"
                      >
                        <span dir="ltr">{event.action}</span> ·{' '}
                        {localDate(event.createdAt)}
                      </p>
                    ))}
                  </section>
                </div>
              );
            })()
          ) : section === 'tables' ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {(data as Table[]).map((t) => (
                <section className={card} key={t.id}>
                  <div className="flex justify-between">
                    <h2>میز {number(t.number)}</h2>
                    <Badge>
                      {!t.active
                        ? 'غیرفعال'
                        : t.orders.length
                          ? 'اشغال'
                          : 'آزاد'}
                    </Badge>
                  </div>
                  <p className="my-3 text-xs">
                    {number(t.seats)} نفره · {me.branch}
                  </p>
                  {t.orders[0] ? (
                    <Link
                      className="text-xs underline"
                      href={`/dashboard/orders/${t.orders[0].id}`}
                    >
                      سفارش جاری ·{' '}
                      {money(
                        t.orders[0].items
                          .filter((i) => i.status !== 'CANCELLED')
                          .reduce((s, i) => s + i.quantity * i.priceRial, 0),
                      )}{' '}
                      تومان
                    </Link>
                  ) : (
                    <button
                      className={secondary}
                      disabled={busy || !t.active}
                      onClick={() =>
                        mutate(async () => {
                          const created = await api<Order>('/orders', 'POST', {
                            tableId: t.id,
                          });
                          window.location.assign(
                            `/dashboard/orders/${created.id}`,
                          );
                        })
                      }
                    >
                      شروع سفارش
                    </button>
                  )}
                  <button
                    className="mt-3 block text-xs underline"
                    onClick={() => setEditor({ kind: 'table', record: t })}
                  >
                    ویرایش میز
                  </button>
                </section>
              ))}
            </div>
          ) : section === 'menu' ? (
            <div className="space-y-5">
              <section className={card}>
                <h2>دسته‌بندی‌ها</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {categories.map((c) => (
                    <button
                      className={secondary}
                      key={c.id}
                      onClick={() => setEditor({ kind: 'category', record: c })}
                    >
                      {number(c.displayOrder)} · {c.name}
                      {!c.active ? ' (غیرفعال)' : ''}
                    </button>
                  ))}
                </div>
              </section>
              <section className="overflow-hidden rounded-xl border border-[#e5e9e2] bg-white">
                <div className="p-4">
                  <input
                    placeholder="جستجوی غذا"
                    value={search}
                    aria-label="جستجوی غذا"
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <GridTable
                  headers={[
                    'غذا',
                    'دسته‌بندی',
                    'قیمت (تومان)',
                    'وضعیت',
                    'عملیات',
                  ]}
                  rows={(data as Page<Menu>).items.map((m) => [
                    <div>
                      <strong>{m.name}</strong>
                      <p className="text-[10px] text-[#7b8580]">
                        {m.description}
                      </p>
                    </div>,
                    m.category.name,
                    money(m.priceRial),
                    !m.active ? 'غیرفعال' : m.available ? 'موجود' : 'ناموجود',
                    <button
                      className={secondary}
                      onClick={() => setEditor({ kind: 'item', record: m })}
                    >
                      ویرایش
                    </button>,
                  ])}
                />
                {pager(data as Page<Menu>)}
              </section>
            </div>
          ) : section === 'staff' ? (
            <section className="overflow-hidden rounded-xl border border-[#e5e9e2] bg-white">
              <p className="p-4 text-xs text-[#7b8580]">
                فهرست کارکنان شعبه مجاز شما. دعوت و تغییر دسترسی در این نسخه
                فعال نیست.
              </p>
              <GridTable
                headers={['نام', 'ایمیل', 'نقش', 'شعبه', 'وضعیت']}
                rows={(data as Page<Staff>).items.map((s) => [
                  s.user.name,
                  <span dir="ltr">{s.user.email}</span>,
                  labels[s.role],
                  s.branches.map((b) => b.branch.name).join('،'),
                  s.active && s.user.active ? 'فعال' : 'غیرفعال',
                ])}
              />
              {pager(data as Page<Staff>)}
            </section>
          ) : section === 'settings' ? (
            <section className={card}>
              <SettingsForm
                key={(data as Settings).version}
                value={data as Settings}
                busy={busy}
                save={(body) =>
                  mutate(() => api('/admin/settings', 'PATCH', body))
                }
              />
            </section>
          ) : section === 'menu/ai-drafts' ? (
            <section className={card}>
              <h2>دستیار منوی فارسی</h2>
              <p className="mb-5 text-xs text-[#7b8580]">
                پیش‌نویس منتشر نمی‌شود تا قیمت و دسته‌بندی را بررسی و تأیید
                کنید.
              </p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate(async () =>
                    setDraft(
                      await api<Draft>('/admin/ai/menu-drafts', 'POST', {
                        input: draftInput,
                      }),
                    ),
                  );
                }}
              >
                <label>
                  توضیحات غذا
                  <textarea
                    required
                    minLength={5}
                    maxLength={2000}
                    value={draftInput}
                    onChange={(e) => setDraftInput(e.target.value)}
                    placeholder="چیزبرگر مخصوص، قیمت ۴۵۰ هزار تومان"
                  />
                </label>
                <button
                  className={button}
                  disabled={
                    busy ||
                    Boolean(
                      draft && ['PENDING', 'PROCESSING'].includes(draft.status),
                    )
                  }
                >
                  ساخت پیش‌نویس
                </button>
              </form>
              {draft && (
                <div className="mt-5 rounded-lg bg-[#f6f7f4] p-4">
                  <p>
                    {draft.status === 'FAILED'
                      ? errors[draft.errorCode || ''] ||
                        'ساخت پیش‌نویس انجام نشد. از ثبت دستی استفاده کنید.'
                      : draft.status === 'APPROVED'
                        ? 'با تأیید شما به منو اضافه شد.'
                        : draft.status === 'READY'
                          ? 'پیش‌نویس آماده بررسی است.'
                          : 'درخواست ذخیره شده و در انتظار پردازش است.'}
                  </p>
                  {draft.status === 'READY' && draft.result && (
                    <form
                      key={draft.id}
                      className="mt-4 grid gap-4 sm:grid-cols-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void mutate(
                          () =>
                            api(
                              `/admin/ai/menu-drafts/${draft.id}/approve`,
                              'POST',
                              {
                                name: f.get('name'),
                                description: f.get('description'),
                                category: f.get('category'),
                                priceToman: Number(f.get('priceToman')),
                              },
                            ),
                          () => setDraft({ ...draft, status: 'APPROVED' }),
                        );
                      }}
                    >
                      <Field
                        name="name"
                        label="نام غذا"
                        value={draft.result.name}
                      />
                      <Field
                        name="priceToman"
                        label="قیمت (تومان)"
                        type="number"
                        value={draft.result.priceToman}
                      />
                      <Field
                        name="description"
                        label="توضیحات"
                        value={draft.result.description}
                        required={false}
                      />
                      <label>
                        دسته‌بندی
                        <select
                          name="category"
                          defaultValue={draft.result.category}
                        >
                          {['برگر', 'پیتزا', 'نوشیدنی', 'پیش‌غذا', 'دسر'].map(
                            (c) => (
                              <option key={c}>{c}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <button className={button} disabled={busy}>
                        تأیید قیمت و انتشار
                      </button>
                    </form>
                  )}
                </div>
              )}
            </section>
          ) : (
            <div className={card}>صفحه پیدا نشد.</div>
          )}
        </main>
      </div>
      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label="ویرایش اطلاعات"
            className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl bg-white p-6"
          >
            <div className="mb-5 flex justify-between">
              <h2>
                {editor.kind === 'item'
                  ? 'اطلاعات غذا'
                  : editor.kind === 'category'
                    ? 'دسته‌بندی'
                    : 'اطلاعات میز'}
              </h2>
              <button aria-label="بستن" onClick={() => setEditor(null)}>
                ×
              </button>
            </div>
            {error && (
              <div
                role="alert"
                className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800"
              >
                {error}
                {editor.record && (
                  <button
                    type="button"
                    className={secondary + ' mt-2'}
                    onClick={async () => {
                      try {
                        const rows =
                          editor.kind === 'item'
                            ? (
                                await api<Page<Menu>>(
                                  '/admin/menu/items?pageSize=100&q=' +
                                    encodeURIComponent(
                                      String(editor.record?.name),
                                    ),
                                )
                              ).items
                            : await api<Row[]>(
                                editor.kind === 'category'
                                  ? '/admin/menu/categories'
                                  : '/admin/tables',
                              );
                        const current = rows.find(
                          (x) => x.id === editor.record?.id,
                        );
                        if (
                          current &&
                          window.confirm(
                            'اطلاعات فعلی را بررسی کرده‌اید؟ نسخه تازه برای ثبت دوباره تغییرات واردشده استفاده شود؟',
                          )
                        ) {
                          setEditor({
                            ...editor,
                            record: {
                              ...editor.record,
                              id: current.id,
                              version: current.version,
                            },
                          });
                          setError('');
                        }
                      } catch {
                        setError('دریافت نسخه تازه ممکن نشد.');
                      }
                    }}
                  >
                    دریافت نسخه تازه و حفظ فرم
                  </button>
                )}
              </div>
            )}
            <form className="space-y-4" onSubmit={saveEditor}>
              {editor.kind === 'table' ? (
                <>
                  <Field
                    name="number"
                    label="شماره میز"
                    type="number"
                    value={Number(editor.record?.number || 1)}
                  />
                  <Field
                    name="seats"
                    label="ظرفیت"
                    type="number"
                    value={Number(editor.record?.seats || 4)}
                  />
                </>
              ) : (
                <Field
                  name="name"
                  label="نام"
                  value={String(editor.record?.name || '')}
                />
              )}
              {editor.kind === 'item' && (
                <>
                  <Field
                    name="description"
                    label="توضیحات"
                    value={String(editor.record?.description || '')}
                    required={false}
                  />
                  <Field
                    name="priceToman"
                    label="قیمت (تومان)"
                    type="number"
                    value={
                      editor.record
                        ? Number(editor.record.priceRial) / 10
                        : undefined
                    }
                  />
                  <label>
                    دسته‌بندی
                    <select
                      name="categoryId"
                      defaultValue={String(editor.record?.categoryId || '')}
                      required
                    >
                      {categories
                        .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </label>
                  <label className="flex-row items-center">
                    <input
                      className="w-auto!"
                      type="checkbox"
                      name="available"
                      defaultChecked={
                        editor.record ? Boolean(editor.record.available) : true
                      }
                    />
                    موجود و قابل سفارش
                  </label>
                </>
              )}
              {editor.kind === 'category' && (
                <label>
                  ترتیب نمایش
                  <input
                    name="displayOrder"
                    type="number"
                    min="0"
                    max="10000"
                    defaultValue={Number(editor.record?.displayOrder || 0)}
                  />
                </label>
              )}
              <label className="flex-row items-center">
                <input
                  className="w-auto!"
                  type="checkbox"
                  name="active"
                  defaultChecked={
                    editor.record ? Boolean(editor.record.active) : true
                  }
                />
                فعال
              </label>
              <p className="text-xs text-[#7b8580]">
                غیرفعال‌سازی سوابق سفارش را حذف نمی‌کند.
              </p>
              <button className={button} disabled={busy}>
                ذخیره
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
function SettingsForm({
  value,
  busy,
  save,
}: {
  value: Settings;
  busy: boolean;
  save: (body: Settings) => void;
}) {
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        save({
          ...value,
          name: String(f.get('name')),
          branchName: String(f.get('branchName')),
          primaryContact: String(f.get('primaryContact')),
          contactEmail: String(f.get('contactEmail')),
          phone: String(f.get('phone')),
          address: String(f.get('address')),
        });
      }}
    >
      {[
        ['name', 'نام رستوران'],
        ['branchName', 'نام شعبه'],
        ['primaryContact', 'مسئول تماس'],
        ['contactEmail', 'ایمیل تماس'],
        ['phone', 'تلفن'],
        ['address', 'نشانی'],
      ].map(([name, label]) => (
        <Field
          key={name}
          name={name}
          label={label}
          value={String(value[name as keyof Settings])}
          required={['name', 'branchName'].includes(name)}
        />
      ))}
      <p className="text-xs text-[#7b8580]">
        ارز نمایشی: تومان · منطقه زمانی: تهران
      </p>
      <button className={button} disabled={busy}>
        ذخیره تنظیمات
      </button>
    </form>
  );
}
