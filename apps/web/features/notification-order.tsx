'use client';
import { useEffect, useState } from 'react';
import { api, ApiError, localDate, number } from '../lib/api';
type Order = {
  id: string;
  status: string;
  createdAt: string;
  cancellationReason?: string;
  table: { number: number };
  items: {
    id: string;
    name: string;
    notes?: string;
    quantity: number;
    status: string;
    cancellationReason?: string;
  }[];
};
const labels: Record<string, string> = {
  OPEN: 'باز',
  COMPLETED: 'تکمیل شده',
  CANCELLED: 'لغو شده',
  PENDING: 'در انتظار',
  PREPARING: 'در حال آماده‌سازی',
  READY: 'آماده سرو',
  SERVED: 'سرو شده',
};
export function NotificationOrder({ id }: { id: string }) {
  const [order, setOrder] = useState<Order | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    api<Order>('/orders/' + encodeURIComponent(id))
      .then((x) => {
        if (active) setOrder(x);
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401)
          window.location.assign('/');
        else if (active)
          setError('سفارش در دسترس نیست یا اجازه مشاهده آن را ندارید.');
      });
    return () => {
      active = false;
    };
  }, [id]);
  return (
    <main className="mx-auto grid max-w-2xl gap-5 p-5">
      <a className="text-emerald-800 underline" href="/?notifications=1">
        بازگشت به اعلان‌ها و محیط کار
      </a>
      <h1 className="text-2xl font-bold">جزئیات سفارش — فقط مشاهده</h1>
      {error && (
        <p role="alert" className="rounded bg-red-50 p-3 text-red-800">
          {error}
        </p>
      )}
      {order ? (
        <>
          <p>
            میز {number(order.table.number)} — {labels[order.status]} —{' '}
            {localDate(order.createdAt)}
          </p>
          {order.cancellationReason && (
            <p className="rounded bg-amber-50 p-3">
              دلیل لغو: {order.cancellationReason}
            </p>
          )}
          <ul className="grid gap-3">
            {order.items.map((item) => (
              <li key={item.id} className="rounded-xl border bg-white p-4">
                <strong>
                  {number(item.quantity)} × {item.name}
                </strong>
                <p>{labels[item.status]}</p>
                {item.notes && (
                  <p className="rounded bg-amber-50 p-2 text-amber-950">
                    توضیح آشپزخانه: {item.notes}
                  </p>
                )}
                {item.cancellationReason && (
                  <p>دلیل لغو: {item.cancellationReason}</p>
                )}
              </li>
            ))}
          </ul>
          <p className="text-sm text-slate-600">
            خواندن یا تأیید اعلان، وضعیت غذا یا سفارش را تغییر نمی‌دهد. تغییرات
            پخت را مستقیم با سالن هماهنگ کنید.
          </p>
        </>
      ) : (
        !error && <p>در حال دریافت…</p>
      )}
    </main>
  );
}
