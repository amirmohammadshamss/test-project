'use client';
import { NotificationCenter } from '../../../packages/ui/src/notification-center';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError, errors, localDate } from './api';
type Row = { id?: string; [key: string]: unknown };
type Page = { items: Row[]; total: number; pages: number };
const input =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900';
const button =
  'rounded-xl bg-indigo-700 px-4 py-2 font-semibold text-white disabled:opacity-50';
const box = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm';
const nav = [
  ['/dashboard', 'نمای کلی'],
  ['/restaurants', 'رستوران‌ها'],
  ['/restaurants/new', 'ثبت رستوران'],
  ['/audit-logs', 'گزارش رویدادها'],
  ['/queues', 'صف پردازش'],
  ['/system-health', 'سلامت سامانه'],
];
function Fields({ names }: { names: [string, string, string?][] }) {
  return (
    <>
      {names.map(([name, label, type]) => (
        <label key={name} className="grid gap-2 text-sm">
          {label}
          <input
            className={input}
            name={name}
            type={type || 'text'}
            required
            minLength={type === 'password' ? 12 : undefined}
            autoComplete={type === 'password' ? 'new-password' : undefined}
          />
        </label>
      ))}
    </>
  );
}
function Records({
  rows,
  columns,
}: {
  rows: Row[];
  columns: [string, string][];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-right text-sm">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th className="border-b p-3" key={key}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.id || i}>
              {columns.map(([key]) => (
                <td className="border-b border-slate-100 p-3" key={key}>
                  {key === 'name' && row.id ? (
                    <Link
                      className="text-indigo-700 underline"
                      href={'/restaurants/' + row.id}
                    >
                      {String(row[key] ?? '—')}
                    </Link>
                  ) : key === 'createdAt' ? (
                    localDate(String(row[key]))
                  ) : (
                    String(row[key] ?? '—')
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="p-4 text-slate-500">نتیجه‌ای یافت نشد.</p>}
    </div>
  );
}
export function PlatformPanel() {
  const path = usePathname(),
    router = useRouter();
  const [me, setMe] = useState<Row | null>(null),
    [data, setData] = useState<Row | null>(null),
    [branches, setBranches] = useState<Row[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [page, setPage] = useState(1),
    [q, setQ] = useState(''),
    [status, setStatus] = useState('');
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [action, setAction] = useState(''),
    [tenantId, setTenantId] = useState('');
  const report = useCallback(
    (e: unknown) => {
      if (e instanceof ApiError && e.status === 401) {
        setMe(null);
        router.replace('/login');
      }
      setError(
        e instanceof ApiError
          ? errors[e.code] || e.code
          : 'خطا در دریافت اطلاعات',
      );
    },
    [router],
  );
  useEffect(() => {
    api<Row>('/auth/me')
      .then((x) => {
        setMe(x);
        sessionStorage.setItem('platform-actor', String(x.id));
        if (path === '/' || path === '/login')
          router.replace(
            '/dashboard' +
              (new URLSearchParams(window.location.search).get(
                'notifications',
              ) === '1'
                ? '?notifications=1'
                : ''),
          );
      })
      .catch((e) => {
        if (path !== '/login') report(e);
      })
      .finally(() => setReady(true));
  }, [path, report, router]);
  useEffect(() => {
    setPage(1);
    setData(null);
    setError('');
  }, [path, q, status, from, to, action, tenantId]);
  const load = useCallback(async () => {
    if (!me || path === '/login' || path === '/restaurants/new') return;
    const route = path === '/system-health' ? '/health' : path;
    const query = ['/restaurants', '/audit-logs'].includes(path)
      ? `?page=${page}&pageSize=20&q=${encodeURIComponent(q)}${status ? '&status=' + status : ''}`
      : '';
    const filters = new URLSearchParams();
    if (from && ['/dashboard', '/audit-logs'].includes(path))
      filters.set('from', new Date(from).toISOString());
    if (to && ['/dashboard', '/audit-logs'].includes(path))
      filters.set('to', new Date(to).toISOString());
    if (path === '/audit-logs' && action) filters.set('action', action);
    if (path === '/audit-logs' && tenantId) filters.set('tenantId', tenantId);
    const suffix = filters.size ? (query ? '&' : '?') + filters.toString() : '';
    const x = await api<Row>(route + query + suffix);
    setData(x);
    if (/^\/restaurants\/[^/]+$/.test(path))
      setBranches(await api<Row[]>(path + '/branches'));
  }, [me, path, page, q, status, from, to, action, tenantId]);
  useEffect(() => {
    load().catch(report);
    const timer = setInterval(() => load().catch(report), 10000);
    return () => clearInterval(timer);
  }, [load, report]);
  async function submit(e: FormEvent<HTMLFormElement>, endpoint: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      const result = await api<Row>(endpoint, 'POST', body);
      if (endpoint === '/auth/login') {
        sessionStorage.setItem('platform-actor', String(result.id));
        setMe(result);
        router.replace(
          '/dashboard' +
            (new URLSearchParams(window.location.search).get(
              'notifications',
            ) === '1'
              ? '?notifications=1'
              : ''),
        );
      } else router.push('/restaurants/' + result.id);
    } catch (e) {
      report(e);
    } finally {
      setBusy(false);
    }
  }
  async function lifecycle(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!data) return;
    const reason = String(new FormData(e.currentTarget).get('reason') || '');
    const action = data.status === 'ACTIVE' ? 'suspend' : 'activate';
    if (
      !window.confirm(
        `تأیید ${action === 'suspend' ? 'تعلیق' : 'فعال‌سازی'} رستوران «${data.name}»؟`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(path + '/' + action, 'POST', { version: data.version, reason });
      await load();
      setError('');
    } catch (e) {
      report(e);
      await load().catch(report);
    } finally {
      setBusy(false);
    }
  }
  if (!ready) return <p className="p-10">در حال بررسی نشست…</p>;
  const warning = (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
      نسخه آزمایشی: ورود فقط با رمز عبور انجام می‌شود. احراز هویت چندمرحله‌ای
      پیاده‌سازی نشده؛ این پنل آماده انتشار عمومی نیست.
    </div>
  );
  if (path === '/login' || !me)
    return (
      <main className="mx-auto grid max-w-lg gap-5 p-6 pt-16">
        {warning}
        <form
          onSubmit={(e) => submit(e, '/auth/login')}
          className={box + ' grid gap-5'}
        >
          <h1 className="text-2xl font-bold">ورود مدیر پلتفرم</h1>
          <Fields
            names={[
              ['email', 'ایمیل', 'email'],
              ['password', 'رمز عبور', 'password'],
            ]}
          />
          {error && (
            <p role="alert" className="text-red-700">
              {error}
            </p>
          )}
          <button className={button} disabled={busy}>
            ورود
          </button>
        </form>
      </main>
    );
  const paginated = data as unknown as Page | null;
  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-8">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">مدیریت پلتفرم RestaurantOS</h1>
        <NotificationCenter
          key={JSON.stringify(me)}
          scopeKey={JSON.stringify(me)}
          platform
        />
        <button
          className={button}
          onClick={async () => {
            try {
              await api('/auth/logout', 'POST');
              setMe(null);
              sessionStorage.removeItem('platform-actor');
              router.replace('/login');
            } catch (e) {
              report(e);
            }
          }}
        >
          خروج
        </button>
      </header>
      {warning}
      <nav className="my-5 flex flex-wrap gap-2">
        {nav.map(([href, title]) => (
          <Link
            key={href}
            href={href}
            className={
              'rounded-xl px-4 py-2 ' +
              (path === href
                ? 'bg-indigo-700 text-white'
                : 'border bg-white text-slate-700')
            }
          >
            {title}
          </Link>
        ))}
      </nav>
      {['/dashboard', '/audit-logs'].includes(path) && (
        <div className="my-4 flex flex-wrap gap-3">
          <label>
            از
            <input
              type="datetime-local"
              className={input}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            تا
            <input
              type="datetime-local"
              className={input}
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          {path === '/audit-logs' && (
            <>
              <label>
                رویداد
                <input
                  className={input}
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                />
              </label>
              <label>
                شناسه رستوران
                <input
                  className={input}
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {path === '/restaurants/new' ? (
        <form
          className={box + ' grid max-w-3xl gap-5 md:grid-cols-2'}
          onSubmit={(e) => submit(e, '/restaurants')}
        >
          <h2 className="text-xl font-bold md:col-span-2">
            ثبت رستوران و مدیر اولیه
          </h2>
          <Fields
            names={[
              ['name', 'نام رستوران'],
              ['provisioningKey', 'شناسه ثبت یکتا (لاتین)'],
              ['primaryContact', 'نام مسئول'],
              ['contactEmail', 'ایمیل تماس', 'email'],
              ['phone', 'تلفن'],
              ['branchName', 'نام شعبه اولیه'],
              ['managerName', 'نام مدیر'],
              ['managerEmail', 'ایمیل مدیر جدید', 'email'],
              [
                'managerPassword',
                'رمز اولیه مدیر (حداقل ۱۲ نویسه)',
                'password',
              ],
            ]}
          />
          <p className="text-sm text-slate-600 md:col-span-2">
            رمز اولیه را از مسیر امن در اختیار مدیر قرار دهید. استفاده از ایمیل
            حساب موجود مجاز نیست.
          </p>
          <button className={button} disabled={busy}>
            ثبت رستوران
          </button>
        </form>
      ) : !data ? (
        <p>در حال دریافت…</p>
      ) : path === '/dashboard' ? (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['restaurants', 'رستوران‌ها'],
            ['active', 'فعال'],
            ['suspended', 'تعلیق‌شده'],
            ['branches', 'شعبه‌ها'],
            ['staff', 'کاربران رستوران'],
            ['orders', 'سفارش‌ها در بازه انتخابی (پیش‌فرض ۲۴ ساعت)'],
            ['aiPending', 'درخواست هوش مصنوعی در جریان'],
            ['aiFailed', 'درخواست ناموفق'],
          ].map(([key, label]) => (
            <article className={box} key={key}>
              <p className="text-sm text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-bold">{String(data[key])}</p>
            </article>
          ))}
        </section>
      ) : path === '/restaurants' || path === '/audit-logs' ? (
        <section className={box}>
          <div className="mb-4 flex flex-wrap gap-3">
            {path === '/restaurants' && (
              <>
                <input
                  aria-label="جستجو"
                  placeholder="جستجوی نام یا شناسه ثبت"
                  className={input + ' max-w-sm'}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <select
                  aria-label="وضعیت"
                  className={input + ' max-w-48'}
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="">همه وضعیت‌ها</option>
                  <option>ACTIVE</option>
                  <option>SUSPENDED</option>
                </select>
              </>
            )}
          </div>
          <Records
            rows={paginated?.items || []}
            columns={
              path === '/restaurants'
                ? [
                    ['name', 'نام'],
                    ['provisioningKey', 'شناسه ثبت'],
                    ['status', 'وضعیت'],
                    ['createdAt', 'تاریخ ثبت'],
                  ]
                : [
                    ['action', 'رویداد'],
                    ['actorType', 'نوع عامل'],
                    ['tenantId', 'رستوران'],
                    ['reason', 'دلیل'],
                    ['createdAt', 'زمان'],
                  ]
            }
          />
          <div className="mt-4 flex items-center gap-4">
            <button
              disabled={page === 1}
              className={button}
              onClick={() => setPage((p) => p - 1)}
            >
              قبلی
            </button>
            <span>
              {page} / {paginated?.pages || 1} — {paginated?.total} نتیجه
            </span>
            <button
              disabled={page >= (paginated?.pages || 1)}
              className={button}
              onClick={() => setPage((p) => p + 1)}
            >
              بعدی
            </button>
          </div>
        </section>
      ) : path.startsWith('/restaurants/') ? (
        <section className="grid gap-5">
          <article className={box}>
            <h2 className="mb-4 text-xl font-bold">{String(data.name)}</h2>
            <dl className="grid gap-3 sm:grid-cols-2">
              {[
                'provisioningKey',
                'status',
                'primaryContact',
                'contactEmail',
                'phone',
                'address',
              ].map((key) => (
                <div key={key}>
                  <dt className="text-sm text-slate-500">{key}</dt>
                  <dd>{String(data[key] || '—')}</dd>
                </div>
              ))}
            </dl>
          </article>
          <article className={box}>
            <h2 className="mb-3 font-bold">شعبه‌ها</h2>
            <Records
              rows={branches}
              columns={[
                ['id', 'شناسه شعبه'],
                ['name', 'نام'],
                ['active', 'فعال'],
              ]}
            />
          </article>
          <form className={box + ' grid max-w-xl gap-4'} onSubmit={lifecycle}>
            <h2 className="font-bold">
              {data.status === 'ACTIVE' ? 'تعلیق رستوران' : 'فعال‌سازی رستوران'}
            </h2>
            <label>
              دلیل تغییر وضعیت
              <textarea
                className={input}
                name="reason"
                required={data.status === 'ACTIVE'}
                maxLength={500}
              />
            </label>
            <p className="text-sm text-slate-600">
              تعلیق، دسترسی اعضای رستوران را متوقف می‌کند. سابقه اطلاعات حفظ
              می‌شود.
            </p>
            <button disabled={busy} className={button}>
              تأیید تغییر وضعیت
            </button>
          </form>
        </section>
      ) : (
        <section className={box}>
          <h2 className="mb-4 text-xl font-bold">
            {path === '/queues'
              ? 'صف هوش مصنوعی — فقط مشاهده'
              : 'سلامت سرویس‌ها'}
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            آخرین بررسی: {localDate(String(data.checkedAt))}
          </p>
          {path === '/queues' ? (
            <>
              <p>
                Redis: {String(data.redis)} — پردازشگر:{' '}
                {(data.worker as { available: boolean })?.available
                  ? 'در دسترس'
                  : 'در دسترس نیست / نامشخص'}
              </p>
              {data.counts ? (
                <dl className="my-4 flex flex-wrap gap-6">
                  {Object.entries(data.counts as Row).map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd className="text-2xl">{String(v)}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="my-4 text-amber-800">آمار صف در دسترس نیست.</p>
              )}
              <Records
                rows={(data.failures as Row[]) || []}
                columns={[
                  ['id', 'شناسه کار'],
                  ['code', 'کد خطای امن'],
                  ['attempts', 'تلاش‌ها'],
                ]}
              />
            </>
          ) : (
            <dl className="grid gap-4">
              {['api', 'database', 'redis', 'worker'].map((key) => (
                <div key={key}>
                  <dt className="font-bold">{key}</dt>
                  <dd>
                    {key === 'worker'
                      ? (data.worker as { available: boolean })?.available
                        ? 'در دسترس'
                        : 'در دسترس نیست / نامشخص'
                      : String(data[key])}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      )}
    </main>
  );
}
