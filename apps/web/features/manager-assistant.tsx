'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnalysisResult } from '../../../packages/shared/src/manager-analysis';
import { api, ApiError, errors, localDate } from '../lib/api';
type Analysis = {
  id: string;
  question: string;
  status: string;
  errorCode?: string;
  result: AnalysisResult | null;
  createdAt: string;
};
const button =
  'rounded-lg bg-emerald-800 px-4 py-3 text-sm text-white disabled:opacity-50';
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
export function ManagerAssistant() {
  const [question, setQuestion] = useState(''),
    [rows, setRows] = useState<Analysis[]>([]),
    [selected, setSelected] = useState<Analysis | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const activeId = useRef<string | null>(null),
    generation = useRef(0);
  const open = useCallback(async (id: string) => {
    const token = ++generation.current;
    activeId.current = id;
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
        const rows = await api<Analysis[]>('/admin/ai/analyses');
        if (active) setRows(rows);
        if (active && activeId.current) await open(activeId.current);
      } catch {
        if (active) setError('دریافت تاریخچه ممکن نشد.');
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
  return (
    <section className="grid gap-5 rounded-xl border bg-white p-5">
      <h2 className="text-xl font-bold">دستیار گزارش مدیر</h2>
      <p className="text-sm text-slate-600">
        فقط شعبه جاری و فقط خواندنی؛ مدل نوع گزارش را انتخاب می‌کند و اعداد از
        اطلاعات ثبت‌شده محاسبه می‌شوند. ارزش سفارش با دریافت وجه یا سود یکسان
        نیست.
      </p>
      <form
        className="grid gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          void api<Analysis>('/admin/ai/analyses', 'POST', { question })
            .then((row) => {
              activeId.current = row.id;
              setSelected(row);
              setRows((old) =>
                [row, ...old.filter((x) => x.id !== row.id)].slice(0, 30),
              );
              window.history.replaceState(null, '', '?analysis=' + row.id);
            })
            .catch((e) =>
              setError(
                e instanceof ApiError
                  ? errors[e.code] || 'ثبت پرسش ممکن نشد.'
                  : 'خطای ارتباط',
              ),
            )
            .finally(() => setBusy(false));
        }}
      >
        <label className="grid gap-2">
          پرسش درباره شعبه جاری
          <textarea
            required
            minLength={5}
            maxLength={1000}
            className="min-h-24 rounded-lg border p-3"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="پرفروش‌ترین غذاهای این هفته کدام‌اند؟"
          />
        </label>
        <p className="text-sm text-slate-600">
          بازه‌های پشتیبانی‌شده: امروز، هفت روز اخیر، این هفته و هفته قبل. هفته
          از شنبه شروع می‌شود. متن و پاسخ تا ۳۰ روز نگهداری می‌شود.
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            'پرفروش‌ترین غذاهای امروز کدام‌اند؟',
            'ارزش سفارش‌های این هفته چقدر است؟',
            'چند سفارش هفته قبل لغو شد؟',
          ].map((q) => (
            <button
              key={q}
              type="button"
              className="rounded-lg border px-3 py-2 text-sm"
              onClick={() => setQuestion(q)}
            >
              {q}
            </button>
          ))}
        </div>
        <button
          className={button}
          disabled={
            busy ||
            Boolean(
              selected && ['PENDING', 'PROCESSING'].includes(selected.status),
            )
          }
        >
          ثبت پرسش
        </button>
      </form>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {selected && (
        <article
          className="grid gap-3 rounded-lg bg-slate-50 p-4"
          aria-live="polite"
        >
          <h3 className="font-bold">{selected.question}</h3>
          <p>{labels[selected.status] || selected.status}</p>
          {selected.status === 'FAILED' && (
            <p role="alert">
              {errors[selected.errorCode || ''] ||
                'پاسخ آماده نشد؛ گزارش‌های معمول و عملیات رستوران همچنان در دسترس هستند.'}
            </p>
          )}
          {selected.status === 'READY' && selected.result && (
            <>
              <h4 className="text-lg font-bold">{selected.result.title}</h4>
              <p>{selected.result.explanation}</p>
              <p className="text-sm">
                از {localDate(selected.result.start)} تا{' '}
                {localDate(selected.result.end)} — محاسبه در{' '}
                {localDate(selected.result.generatedAt)}
              </p>
              <dl className="grid gap-2 sm:grid-cols-2">
                {selected.result.facts.map((f) => (
                  <div key={f.label} className="rounded border bg-white p-3">
                    <dt>{f.label}</dt>
                    <dd className="font-bold">{amount(f.value, f.unit)}</dd>
                  </div>
                ))}
              </dl>
              <ol className="grid gap-2">
                {selected.result.items.map((item, i) => (
                  <li key={i} className="rounded border bg-white p-3">
                    <strong>{item.name}</strong> — تعداد{' '}
                    {amount(String(item.quantity), 'COUNT')} — ارزش{' '}
                    {amount(item.valueRial, 'IRR')}
                  </li>
                ))}
              </ol>
              <ul className="list-inside list-disc space-y-2 text-sm text-slate-600">
                {selected.result.limitations.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </>
          )}
        </article>
      )}
      <a className="text-emerald-800 underline" href="/dashboard/orders">
        مشاهده مستقیم سفارش‌ها و استفاده از گزارش‌های معمول
      </a>
      <h3 className="font-bold">پرسش‌های اخیر شما در این شعبه (حداکثر ۳۰)</h3>
      <ul className="grid gap-2">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              className="w-full rounded-lg border p-3 text-start text-sm"
              onClick={() => {
                window.history.replaceState(null, '', '?analysis=' + row.id);
                void open(row.id);
              }}
            >
              {row.question} — {labels[row.status]} — {localDate(row.createdAt)}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
