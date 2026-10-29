'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  AnalysisResult,
  ManagerPlan,
} from '../../../packages/shared/src/manager-analysis';
import { api, ApiError, errors, localDate } from '../lib/api';
type Analysis = {
  id: string;
  question: string;
  status: string;
  errorCode?: string;
  result: AnalysisResult | null;
  createdAt: string;
};
const labels: Record<string, string> = {
  PENDING: 'در صف',
  PROCESSING: 'در حال بررسی',
  READY: 'پاسخ آماده',
  FAILED: 'ناموفق',
};
function amount(value: string, unit: 'IRR' | 'COUNT') {
  try {
    const x = BigInt(value);
    return (
      new Intl.NumberFormat('fa-IR').format(
        unit === 'IRR' ? x / BigInt(10) : x,
      ) + (unit === 'IRR' ? ' تومان' : '')
    );
  } catch {
    return '—';
  }
}
type ReportTool =
  'SALES_TRENDS' | 'MENU_SUGGESTIONS' | 'DEMAND_FORECAST' | 'KITCHEN_DELAYS';
const reports: {
  tool: ReportTool;
  label: string;
  description: string;
  icon: 'trend' | 'menu' | 'calendar' | 'clock';
}[] = [
  {
    tool: 'SALES_TRENDS',
    label: 'تحلیل فروش و روندها',
    description: 'پرفروش‌ها و تغییرات فروش',
    icon: 'trend',
  },
  {
    tool: 'MENU_SUGGESTIONS',
    label: 'پیشنهاد منو و ترکیب غذاها',
    description: 'ترکیب‌ها و غذاهای قابل بررسی',
    icon: 'menu',
  },
  {
    tool: 'DEMAND_FORECAST',
    label: 'پیش‌بینی تقاضا',
    description: 'برآورد سفارش‌های روز و ساعت',
    icon: 'calendar',
  },
  {
    tool: 'KITCHEN_DELAYS',
    label: 'تحلیل تأخیر آشپزخانه',
    description: 'زمان انتظار و آماده‌سازی',
    icon: 'clock',
  },
];
function AssistantIcon({
  name,
  className = 'h-5 w-5',
}: {
  name: string;
  className?: string;
}) {
  const paths: Record<string, React.ReactNode> = {
    trend: (
      <>
        <path d="M4 17 10 11l4 3 6-9M15 5h5v5" />
        <path d="M4 4v16h16" />
      </>
    ),
    menu: (
      <>
        <rect x="5" y="3" width="14" height="18" rx="3" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4M17 3v4M3 11h18m-13 4h2m4 0h2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4L12 3Z" />
        <path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" />
      </>
    ),
    arrow: <path d="M19 12H5m6-6-6 6 6 6" />,
    history: (
      <>
        <path d="M3 10a9 9 0 1 1 1 7M3 4v6h6" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    document: (
      <>
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
        <path d="M14 3v5h5M9 12h6M9 16h4" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-10h.01" />
      </>
    ),
  };
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {paths[name] || paths.document}
    </svg>
  );
}
const focus =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2';
export function ManagerAssistant() {
  const [historyExpanded, setHistoryExpanded] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1280px)');
    const update = () => setHistoryExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [period, setPeriod] = useState<ManagerPlan['period']>('LAST_7_DAYS');
  const [question, setQuestion] = useState(''),
    [rows, setRows] = useState<Analysis[]>([]),
    [selected, setSelected] = useState<Analysis | null>(null),
    [error, setError] = useState('');
  const [busy, setBusy] = useState<ReportTool | 'question' | null>(null),
    [activeTool, setActiveTool] = useState<ReportTool | null>(null),
    [allHistory, setAllHistory] = useState(false);
  const resultPanel = useRef<HTMLElement | null>(null);
  const revealResult = () => {
    requestAnimationFrame(() =>
      resultPanel.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      }),
    );
  };
  const activeId = useRef<string | null>(null),
    generation = useRef(0),
    questionInput = useRef<HTMLTextAreaElement | null>(null);
  const pending = Boolean(
    selected && ['PENDING', 'PROCESSING'].includes(selected.status),
  );
  const open = useCallback(async (id: string) => {
    const token = ++generation.current;
    activeId.current = id;
    setError('');
    setActiveTool(null);
    try {
      const row = await api<Analysis>(
        '/admin/ai/analyses/' + encodeURIComponent(id),
      );
      if (token === generation.current) setSelected(row);
    } catch (e) {
      if (token === generation.current)
        setError(
          e instanceof ApiError
            ? errors[e.code] || 'پاسخ در دسترس نیست.'
            : 'خطای ارتباط',
        );
    }
  }, []);
  useEffect(() => {
    let active = true;
    const id = new URLSearchParams(window.location.search).get('analysis');
    if (id) void open(id);
    const load = async () => {
      try {
        const history = await api<Analysis[]>('/admin/ai/analyses');
        if (active) setRows(history);
        const id = activeId.current,
          token = generation.current;
        if (active && id) {
          const row = await api<Analysis>(
            '/admin/ai/analyses/' + encodeURIComponent(id),
          );
          if (active && id === activeId.current && token === generation.current)
            setSelected(row);
        }
      } catch {
        if (active) setError('دریافت اطلاعات ممکن نشد؛ ارتباط را بررسی کنید.');
      }
    };
    void load();
    const timer = setInterval(() => void load(), 3000);
    return () => {
      active = false;
      clearInterval(timer);
      generation.current++;
    };
  }, [open]);
  async function runReport(tool: ReportTool, label: string) {
    if (busy) return;
    revealResult();
    setBusy(tool);
    setActiveTool(tool);
    setError('');
    const token = ++generation.current;
    activeId.current = null;
    window.history.replaceState(null, '', window.location.pathname);
    try {
      const result = await api<AnalysisResult>(
        '/admin/ai/analyses/reports?' + new URLSearchParams({ tool, period }),
      );
      if (token === generation.current)
        setSelected({
          id: 'direct-report',
          question: label,
          status: 'READY',
          result,
          createdAt: result.generatedAt,
        });
    } catch {
      if (token === generation.current)
        setError('دریافت گزارش ممکن نشد؛ دوباره تلاش کنید.');
    } finally {
      setBusy(null);
    }
  }
  async function submitQuestion() {
    if (busy || pending || question.trim().length < 5) return;
    revealResult();
    setBusy('question');
    setError('');
    setActiveTool(null);
    const token = ++generation.current;
    activeId.current = null;
    try {
      const row = await api<Analysis>('/admin/ai/analyses', 'POST', {
        question: question.trim(),
      });
      if (token !== generation.current) return;
      activeId.current = row.id;
      setSelected(row);
      setRows((old) =>
        [row, ...old.filter((x) => x.id !== row.id)].slice(0, 30),
      );
      window.history.replaceState(null, '', '?analysis=' + row.id);
    } catch (e) {
      if (token === generation.current)
        setError(
          e instanceof ApiError
            ? errors[e.code] || 'ثبت پرسش ممکن نشد.'
            : 'خطای ارتباط',
        );
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="min-w-0 space-y-6 text-[#243e36]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs text-[#65756a]">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
          اطلاعات شعبه جاری · فقط برای مشاهده و بررسی
        </p>
        <a
          href="/dashboard/orders"
          className={
            'inline-flex items-center gap-2 text-xs font-medium text-[#426856] hover:text-emerald-900 ' +
            focus
          }
        >
          مشاهده سفارش‌ها
          <AssistantIcon name="arrow" className="h-4 w-4" />
        </a>
      </div>
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 space-y-5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitQuestion();
            }}
            className="overflow-hidden rounded-2xl border border-[#dfe5dc] bg-white shadow-[0_3px_18px_-10px_#254e4230]"
          >
            <div className="flex gap-3 px-5 pt-6 sm:px-6">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#edf4ed] text-[#32634d]">
                <AssistantIcon name="spark" className="h-6 w-6" />
              </span>
              <div>
                <h2 className="text-lg font-semibold tracking-tight sm:text-xl">
                  امروز چه چیزی را بررسی کنیم؟
                </h2>
                <p className="mt-1 text-xs leading-6 text-[#7b8580]">
                  از فروش تا عملکرد آشپزخانه؛ سؤال‌تان را به فارسی بنویسید.
                </p>
              </div>
            </div>
            <div className="px-5 pb-5 pt-5 sm:px-6">
              <label htmlFor="manager-question" className="sr-only">
                پرسش درباره شعبه جاری
              </label>
              <div className="rounded-xl border border-[#dce4da] bg-[#fafbf8] p-3 transition focus-within:border-[#6a977c] focus-within:ring-2 focus-within:ring-[#e6eee5]">
                <textarea
                  id="manager-question"
                  ref={questionInput}
                  required
                  minLength={5}
                  maxLength={1000}
                  rows={3}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="مثلاً: پرفروش‌ترین غذاهای این هفته کدام‌اند؟"
                  className="block min-h-20! w-full resize-y rounded-none! border-0! bg-transparent! p-1! text-sm leading-7 text-[#243e36] shadow-none! outline-none placeholder:text-[#72816d] sm:min-h-24!"
                />
                <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#e7ebe3] pt-3">
                  <span className="flex items-center gap-1.5 text-xs text-[#6d7c6b]">
                    <AssistantIcon name="info" className="h-3.5 w-3.5" />
                    پاسخ بر اساس داده‌های ثبت‌شده
                  </span>
                  <button
                    type="submit"
                    disabled={
                      Boolean(busy) || pending || question.trim().length < 5
                    }
                    className={
                      'inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#255a46] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#194532] disabled:cursor-not-allowed disabled:opacity-45 ' +
                      focus
                    }
                  >
                    {busy === 'question' ? 'در حال ارسال…' : 'ثبت پرسش'}
                    <AssistantIcon name="arrow" className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  'پرفروش‌ترین غذاهای امروز کدام‌اند؟',
                  'ارزش سفارش‌های این هفته چقدر است؟',
                  'چند سفارش هفته قبل لغو شد؟',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => {
                      setQuestion(q);
                      questionInput.current?.focus();
                    }}
                    className={
                      'rounded-lg border border-[#e7ebe3] px-2.5 py-2 text-xs text-[#67766c] transition hover:border-[#a9bba7] hover:bg-[#f5f8f1] ' +
                      focus
                    }
                  >
                    {q}
                  </button>
                ))}
              </div>
              <details className="mt-3 text-xs leading-6 text-[#6d7c6b]">
                <summary className="w-fit cursor-pointer hover:text-[#426856]">
                  بازه‌های قابل پرسش و نگهداری اطلاعات
                </summary>
                <p className="mt-1">
                  امروز، هفت روز اخیر، این هفته و هفته قبل؛ هفته از شنبه شروع
                  می‌شود. متن پرسش و پاسخ تا ۳۰ روز نگهداری می‌شود.
                </p>
              </details>
            </div>
          </form>
          <section aria-labelledby="quick-reports-title" className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 id="quick-reports-title" className="text-sm font-semibold">
                  گزارش‌های آماده
                </h3>
                <p className="mt-1 text-xs text-[#6d7c6b]">
                  موضوع را انتخاب کنید و گزارش را همین حالا ببینید.
                </p>
              </div>
              <label className="flex flex-row! items-center gap-2 text-xs text-[#65756a]">
                بازه گزارش
                <select
                  value={period}
                  disabled={Boolean(busy)}
                  onChange={(e) =>
                    setPeriod(e.target.value as ManagerPlan['period'])
                  }
                  className={
                    'min-h-10 w-auto! rounded-lg border border-[#dfe5dc] bg-white px-3! py-2! text-xs text-[#42604e] ' +
                    focus
                  }
                >
                  <option value="TODAY">امروز</option>
                  <option value="LAST_7_DAYS">هفت روز اخیر</option>
                  <option value="THIS_WEEK">این هفته</option>
                  <option value="LAST_WEEK">هفته قبل</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {reports.map((report) => (
                <button
                  key={report.tool}
                  type="button"
                  aria-label={report.label}
                  aria-pressed={activeTool === report.tool}
                  disabled={Boolean(busy)}
                  onClick={() => void runReport(report.tool, report.label)}
                  className={
                    'group flex min-w-0 items-center gap-3 rounded-xl border p-4 text-start transition disabled:cursor-wait disabled:opacity-60 ' +
                    (activeTool === report.tool
                      ? 'border-[#7b9d7d] bg-[#edf3e9]'
                      : 'border-[#e0e6dc] bg-white hover:border-[#a6bca0] hover:bg-[#fafcf8]') +
                    ' ' +
                    focus
                  }
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f0f4eb] text-[#53744c]">
                    <AssistantIcon name={report.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold leading-6">
                      {report.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[#6d7c6b]">
                      {busy === report.tool
                        ? 'در حال دریافت گزارش…'
                        : report.description}
                    </span>
                  </span>
                  <AssistantIcon
                    name="arrow"
                    className="h-4 w-4 shrink-0 text-[#9aa995] transition group-hover:-translate-x-0.5"
                  />
                </button>
              ))}
            </div>
            <p className="px-1 text-xs leading-6 text-[#6d7c6b]">
              پیش‌بینی تقاضا، مستقل از بازه انتخابی، ۵۶ روز کامل گذشته را بررسی
              می‌کند.
            </p>
          </section>
          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm leading-7 text-red-800"
            >
              {error}
            </p>
          )}
          <article
            ref={resultPanel}
            aria-live="polite"
            aria-busy={Boolean(busy) || pending}
            className="min-w-0 scroll-mt-5 overflow-hidden rounded-2xl border border-[#e0e6dc] bg-white"
          >
            <div className="flex items-center justify-between gap-3 border-b border-[#e9ede5] px-5 py-4 sm:px-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <AssistantIcon
                  name="document"
                  className="h-4 w-4 text-[#70876a]"
                />
                نتیجه بررسی
              </h3>
              {selected && !busy && (
                <span
                  className={
                    'rounded-full px-2.5 py-1 text-[10px] ' +
                    (selected.status === 'READY'
                      ? 'bg-[#edf5e9] text-[#507441]'
                      : selected.status === 'FAILED'
                        ? 'bg-red-50 text-red-700'
                        : 'bg-amber-50 text-amber-800')
                  }
                >
                  {labels[selected.status] || selected.status}
                </span>
              )}
            </div>
            {busy || pending ? (
              <div
                role="status"
                className="grid justify-items-center gap-3 px-6 py-12 text-center"
              >
                <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#dfe9d9] border-t-[#456b37] motion-reduce:animate-none" />
                <h4 className="text-sm font-medium">
                  {busy && busy !== 'question'
                    ? 'در حال دریافت گزارش'
                    : selected?.status === 'PENDING'
                      ? 'در صف'
                      : 'در حال بررسی'}
                </h4>
                <p className="text-xs leading-6 text-[#6d7c6b]">
                  {pending
                    ? 'پرسش شما ذخیره شده؛ پاسخ پس از آماده‌شدن همین‌جا نمایش داده می‌شود.'
                    : 'چند لحظه صبر کنید؛ اطلاعات شعبه در حال دریافت است.'}
                </p>
              </div>
            ) : !selected ? (
              <div className="grid justify-items-center gap-3 px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e8eddf] bg-[#f7f9f2] text-[#95a586]">
                  <AssistantIcon name="document" className="h-7 w-7" />
                </span>
                <h4 className="text-sm font-medium">
                  از یک سؤال یا گزارش آماده شروع کنید
                </h4>
                <p className="max-w-sm text-xs leading-7 text-[#6d7c6b]">
                  نتیجه انتخاب شما همراه با اعداد، بازه زمانی و نکات قابل بررسی
                  اینجا نمایش داده می‌شود.
                </p>
              </div>
            ) : (
              <div className="min-w-0 space-y-5 p-5 sm:p-6">
                <p className="text-xs leading-6 text-[#65756a]">
                  {selected.question}
                </p>
                {selected.status === 'FAILED' && (
                  <p
                    role="alert"
                    className="rounded-xl bg-red-50 p-4 text-sm leading-7 text-red-800"
                  >
                    {errors[selected.errorCode || ''] ||
                      'پاسخ آماده نشد؛ می‌توانید دوباره بپرسید یا از گزارش‌های آماده استفاده کنید.'}
                  </p>
                )}
                {selected.status === 'READY' && selected.result && (
                  <>
                    <div>
                      <h4 className="text-base font-semibold leading-8 sm:text-lg">
                        {selected.result.title}
                      </h4>
                      <p className="mt-2 text-xs leading-7 text-[#65756a]">
                        {selected.result.explanation}
                      </p>
                      <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] leading-6 text-[#697865]">
                        <span>
                          از {localDate(selected.result.start)} تا{' '}
                          {localDate(selected.result.end)}
                        </span>
                        <span>
                          به‌روزرسانی: {localDate(selected.result.generatedAt)}
                        </span>
                      </p>
                    </div>
                    {selected.result.facts.length > 0 && (
                      <dl className="grid gap-3 sm:grid-cols-2">
                        {selected.result.facts.map((f) => (
                          <div
                            key={f.label}
                            className="rounded-xl border border-[#e4eadf] bg-[#f8faf5] p-4"
                          >
                            <dt className="text-xs leading-6 text-[#65756a]">
                              {f.label}
                            </dt>
                            <dd className="mt-2 text-xl font-semibold tabular-nums tracking-tight text-[#2b5039]">
                              {amount(f.value, f.unit)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                    {selected.result.items.length > 0 && (
                      <ol className="divide-y divide-[#edf0e8] rounded-xl border border-[#e4eadf] px-4">
                        {selected.result.items.map((item, i) => (
                          <li
                            key={i}
                            className="flex flex-wrap items-center justify-between gap-3 py-4"
                          >
                            <span className="flex items-center gap-3">
                              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f1f5eb] text-xs text-[#728568]">
                                {new Intl.NumberFormat('fa-IR').format(i + 1)}
                              </span>
                              <strong className="text-sm font-medium">
                                {item.name}
                              </strong>
                            </span>
                            <span className="text-xs leading-6 text-[#65756a]">
                              {amount(String(item.quantity), 'COUNT')} عدد{' '}
                              <span className="mx-2 text-[#ccd5c7]">/</span>{' '}
                              {amount(item.valueRial, 'IRR')}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {selected.result.sections?.map((section) => (
                      <section
                        key={section.title}
                        className="min-w-0 space-y-3"
                      >
                        <h5 className="text-xs font-semibold leading-6">
                          {section.title}
                        </h5>
                        {section.rows.length ? (
                          <div className="max-w-full overflow-x-auto rounded-xl border border-[#e4eadf]">
                            <table className="w-full border-collapse text-start text-xs">
                              <caption className="sr-only">
                                {section.title}
                              </caption>
                              <thead>
                                <tr className="bg-[#f5f8ef] text-[#708366]">
                                  {section.columns.map((column) => (
                                    <th
                                      key={column}
                                      scope="col"
                                      className="whitespace-nowrap px-4 py-3 text-start font-medium"
                                    >
                                      {column}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#edf0e8]">
                                {section.rows.map((row, i) => (
                                  <tr
                                    key={i}
                                    className="transition hover:bg-[#fafcf7]"
                                  >
                                    {row.map((cell, j) => (
                                      <td
                                        key={j}
                                        className={
                                          'px-4 py-3 leading-6 ' +
                                          (j === 0
                                            ? 'font-medium'
                                            : 'text-[#65756a]')
                                        }
                                      >
                                        {cell}
                                      </td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <p className="rounded-xl border border-dashed border-[#e2e8da] bg-[#fafbf7] px-4 py-5 text-xs leading-7 text-[#6d7c6b]">
                            شواهد کافی برای نمایش ردیف وجود ندارد.
                          </p>
                        )}
                      </section>
                    ))}
                    <details className="rounded-xl border border-[#e5e9df] bg-[#fafbf8] p-4">
                      <summary
                        className={
                          'cursor-pointer text-xs font-medium text-[#677c5a] ' +
                          focus
                        }
                      >
                        نکات و محدودیت‌های این گزارش{' '}
                        <span className="text-[10px] font-normal text-[#687961]">
                          (
                          {new Intl.NumberFormat('fa-IR').format(
                            selected.result.limitations.length,
                          )}
                          )
                        </span>
                      </summary>
                      <ul className="mt-3 list-inside list-disc space-y-2 text-xs leading-7 text-[#7b8580]">
                        {selected.result.limitations.map((text) => (
                          <li key={text}>{text}</li>
                        ))}
                      </ul>
                    </details>
                  </>
                )}
              </div>
            )}
          </article>
        </div>
        <aside
          aria-labelledby="analysis-history-title"
          className="min-w-0 rounded-2xl border border-[#e0e6dc] bg-white xl:sticky xl:top-5"
        >
          <details
            open={historyExpanded}
            onToggle={(e) => setHistoryExpanded(e.currentTarget.open)}
            className="group"
          >
            <summary
              className={
                'flex cursor-pointer list-none items-center justify-between gap-3 p-5 [&::-webkit-details-marker]:hidden ' +
                focus
              }
            >
              <span
                id="analysis-history-title"
                className="flex items-center gap-2 text-sm font-semibold"
              >
                <AssistantIcon
                  name="history"
                  className="h-4 w-4 text-[#70876a]"
                />
                گزارش‌های اخیر
              </span>
              <span className="rounded-md bg-[#f1f5eb] px-2 py-0.5 text-xs text-[#7b8d70]">
                {new Intl.NumberFormat('fa-IR').format(rows.length)}
              </span>
            </summary>
            <div className="px-3 pb-3">
              <p className="px-2 pb-3 text-[10px] leading-6 text-[#687961]">
                پرسش‌های ذخیره‌شده شما در این شعبه
              </p>
              {rows.length ? (
                <ul className="space-y-1">
                  {(allHistory ? rows : rows.slice(0, 5)).map((row) => (
                    <li key={row.id}>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => {
                          window.history.replaceState(
                            null,
                            '',
                            '?analysis=' + row.id,
                          );
                          revealResult();
                          void open(row.id);
                        }}
                        className={
                          'w-full rounded-xl border p-3 text-start transition disabled:opacity-50 ' +
                          (selected?.id === row.id
                            ? 'border-[#d9e4ce] bg-[#f2f6ed]'
                            : 'border-transparent hover:border-[#e7ecdf] hover:bg-[#fafcf7]') +
                          ' ' +
                          focus
                        }
                      >
                        <span className="line-clamp-2 block text-xs leading-7">
                          {row.question}
                        </span>
                        <span className="mt-2 flex flex-wrap items-center justify-between gap-1 text-[10px] leading-5 text-[#687961]">
                          <span>{localDate(row.createdAt)}</span>
                          <span
                            className={
                              row.status === 'READY'
                                ? 'text-[#58743f]'
                                : row.status === 'FAILED'
                                  ? 'text-red-600'
                                  : 'text-amber-700'
                            }
                          >
                            {labels[row.status] || row.status}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3 py-5 text-center">
                  <AssistantIcon
                    name="history"
                    className="mx-auto mb-3 h-7 w-7 text-[#c1cdba]"
                  />
                  <p className="text-xs leading-7 text-[#687961]">
                    هنوز پرسشی ثبت نکرده‌اید.
                  </p>
                </div>
              )}
              {rows.length > 5 && (
                <button
                  type="button"
                  className={
                    'mt-3 w-full rounded-lg border border-[#e5eadd] py-2.5 text-xs text-[#75886a] ' +
                    focus
                  }
                  onClick={() => setAllHistory((v) => !v)}
                >
                  {allHistory ? 'نمایش کمتر' : 'نمایش همه پرسش‌ها'}
                </button>
              )}
              <p className="mt-4 border-t border-[#edf0e8] px-2 pt-3 text-[10px] leading-6 text-[#687961]">
                پرسش‌ها تا ۳۰ روز در دسترس‌اند. گزارش‌های آماده در تاریخچه ذخیره
                نمی‌شوند.
              </p>
            </div>
          </details>
        </aside>
      </div>
    </section>
  );
}
