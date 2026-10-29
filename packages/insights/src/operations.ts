import type { Prisma } from '@prisma/client';
import type {
  AnalysisResult,
  ManagerPlan,
} from '../../shared/src/manager-analysis';
import { forecastDemand, hourlyDemand } from './forecast';

type Scope = { tenantId: string; branchId: string };
type Window = {
  start: Date;
  end: Date;
  previousStart: Date;
  previousEnd: Date;
};
const number = (n: string | number) =>
  new Intl.NumberFormat('fa-IR', { maximumFractionDigits: 1 }).format(
    Number(n),
  );
const date = (d: Date) =>
  new Intl.DateTimeFormat('fa-IR', {
    timeZone: 'Asia/Tehran',
    dateStyle: 'short',
  }).format(d);
const toman = (n: string) =>
  new Intl.NumberFormat('fa-IR').format(BigInt(n) / 10n);
export async function operationalReport(
  tx: Prisma.TransactionClient,
  scope: Scope,
  plan: ManagerPlan,
  window: Window,
  result: AnalysisResult,
  anchor: Date,
) {
  const { tenantId, branchId } = scope;
  result.sections = [];
  if (plan.tool === 'SALES_TRENDS') {
    const rows = await tx.$queryRaw<
      { day: string; orders: string; quantity: string; value: string }[]
    >`
      SELECT to_char(o."completedAt" AT TIME ZONE 'Asia/Tehran','YYYY-MM-DD') AS day,
      COUNT(DISTINCT o.id)::text AS orders, COALESCE(SUM(i.quantity),0)::text AS quantity,
      COALESCE(SUM(i."priceRial"::bigint*i.quantity),0)::text AS value
      FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o.id AND i."tenantId"=o."tenantId" AND i."branchId"=o."branchId" AND i.status<>'CANCELLED'
      WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED'
      AND o."completedAt">=${window.start} AND o."completedAt"<${window.end} GROUP BY day ORDER BY day`;
    const changes = await tx.$queryRaw<
      { name: string; current: string; previous: string }[]
    >`
      SELECT MAX(i.name) AS name,
      COALESCE(SUM(i.quantity) FILTER (WHERE o."completedAt">=${window.start} AND o."completedAt"<${window.end}),0)::text AS current,
      COALESCE(SUM(i.quantity) FILTER (WHERE o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd}),0)::text AS previous
      FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" AND o."tenantId"=i."tenantId" AND o."branchId"=i."branchId"
      WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND i.status<>'CANCELLED'
      AND ((o."completedAt">=${window.start} AND o."completedAt"<${window.end}) OR (o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd}))
      GROUP BY i."menuItemId" ORDER BY SUM(i.quantity) DESC,i."menuItemId" LIMIT 10`;
    result.title = 'روند فروش و تغییر غذاهای پرفروش';
    result.sections.push({
      title: 'ارزش روزانه سفارش‌های تکمیل‌شده',
      columns: ['روز', 'سفارش', 'تعداد اقلام', 'ارزش (تومان)'],
      rows: rows.map((r) => [
        date(new Date(r.day + 'T12:00:00+03:30')),
        number(r.orders),
        number(r.quantity),
        toman(r.value),
      ]),
    });
    result.sections.push({
      title: 'تغییر تعداد نسبت به بازه هم‌طول قبل',
      columns: ['غذا', 'بازه جاری', 'بازه قبل', 'تغییر تعداد'],
      rows: changes.map((r) => [
        r.name,
        number(r.current),
        number(r.previous),
        number(Number(r.current) - Number(r.previous)),
      ]),
    });
    result.limitations.push(
      'حداکثر ده قلم بر اساس مجموع تعداد دو بازه؛ اختلاف تعداد، دلیل تغییر یا سودآوری را اثبات نمی‌کند. نام تاریخی ممکن است با منوی فعلی تفاوت داشته باشد.',
      `بازه مقایسه: ${date(window.previousStart)} تا ${date(window.previousEnd)}؛ روزهای بدون سفارش در جدول روزانه نمایش داده نمی‌شوند.`,
    );
  } else if (plan.tool === 'MENU_SUGGESTIONS') {
    const total = await tx.order.count({
      where: {
        tenantId,
        branchId,
        status: 'COMPLETED',
        completedAt: { gte: window.start, lt: window.end },
      },
    });
    result.title = 'پیشنهادهای قابل بررسی برای منو';
    result.explanation =
      'پیشنهادهای قاعده‌محور از سفارش‌های واقعی؛ تغییر قیمت یا منو انجام نمی‌شود.';
    result.facts.push({
      label: 'تعداد سفارش مبنای بررسی',
      value: String(total),
      unit: 'COUNT',
    });
    if (total < 20) {
      result.explanation =
        'داده کافی نیست؛ برای پیشنهاد منو حداقل ۲۰ سفارش تکمیل‌شده در بازه لازم است.';
      return result;
    }
    const pairs = await tx.$queryRaw<
      { first: string; second: string; support: string }[]
    >`
      WITH lines AS (SELECT DISTINCT i."orderId",i."menuItemId",m.name FROM "OrderItem" i
      JOIN "Order" o ON o.id=i."orderId" AND o."tenantId"=i."tenantId" AND o."branchId"=i."branchId"
      JOIN "MenuItem" m ON m.id=i."menuItemId" AND m."tenantId"=i."tenantId" JOIN "Category" c ON c.id=m."categoryId" AND c."tenantId"=m."tenantId"
      WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND i.status<>'CANCELLED' AND m.active AND m.available AND c.active AND o."completedAt">=${window.start} AND o."completedAt"<${window.end})
      SELECT a.name AS first,b.name AS second,COUNT(*)::text AS support FROM lines a JOIN lines b ON a."orderId"=b."orderId" AND a."menuItemId"<b."menuItemId"
      GROUP BY a."menuItemId",b."menuItemId",a.name,b.name HAVING COUNT(*)>=5 ORDER BY COUNT(*) DESC,a."menuItemId",b."menuItemId" LIMIT 10`;
    result.sections.push({
      title: 'ترکیب‌هایی برای آزمایش کنار هم در منو',
      columns: ['غذا', 'همراه', 'سفارش مشترک', 'سهم از سفارش‌ها'],
      rows: pairs.map((r) => [
        r.first,
        r.second,
        number(r.support),
        number((Number(r.support) * 100) / total) + '٪',
      ]),
    });
    const review = await tx.$queryRaw<
      { name: string; current: string; previous: string }[]
    >`
      SELECT m.name,COUNT(DISTINCT o.id) FILTER (WHERE o."completedAt">=${window.start} AND o."completedAt"<${window.end})::text AS current,
      COUNT(DISTINCT o.id) FILTER (WHERE o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd})::text AS previous
      FROM "MenuItem" m JOIN "Category" c ON c.id=m."categoryId" AND c."tenantId"=m."tenantId"
      JOIN "OrderItem" i ON i."menuItemId"=m.id AND i."tenantId"=m."tenantId" AND i.status<>'CANCELLED'
      JOIN "Order" o ON o.id=i."orderId" AND o."tenantId"=i."tenantId" AND o."branchId"=i."branchId"
      WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND m.active AND c.active
      AND ((o."completedAt">=${window.start} AND o."completedAt"<${window.end}) OR (o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd}))
      GROUP BY m.id,m.name HAVING COUNT(DISTINCT o.id) FILTER (WHERE o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd})>=5
      AND COUNT(DISTINCT o.id) FILTER (WHERE o."completedAt">=${window.start} AND o."completedAt"<${window.end}) * 2 < COUNT(DISTINCT o.id) FILTER (WHERE o."completedAt">=${window.previousStart} AND o."completedAt"<${window.previousEnd})
      ORDER BY COUNT(DISTINCT o.id) DESC,m.id LIMIT 10`;
    result.sections.push({
      title: 'غذاهای نیازمند بررسی عرضه و توضیحات منو',
      columns: ['غذا', 'سفارش جاری', 'سفارش قبل'],
      rows: review.map((r) => [r.name, number(r.current), number(r.previous)]),
    });
    result.limitations.push(
      'ترکیب‌ها حداقل در پنج سفارش مشترک دیده شده‌اند؛ این هم‌وقوعی اثبات ترجیح یا سود نیست. پیش از تخفیف یا بسته‌سازی، هزینه و موجودی را بررسی کنید.',
      'افت بیش از ۵۰٪ با حداقل پنج سفارش در بازه قبل صرفاً نشانه بررسی است؛ کمبود موجودی، تغییر ساعت کار و حجم کل فروش می‌تواند علت باشد. هیچ غذایی خودکار حذف نمی‌شود. نبود ردیف یعنی شواهد کافی پیدا نشد.',
    );
  } else if (plan.tool === 'DEMAND_FORECAST') {
    // Always use complete days, never the partial day or future records.
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Tehran',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(anchor);
    const get = (key: string) => parts.find((p) => p.type === key)!.value;
    const today = new Date(
      `${get('year')}-${get('month')}-${get('day')}T00:00:00+03:30`,
    ).getTime();
    const start = new Date(today - 56 * 86400000),
      end = new Date(today);
    const rows = await tx.$queryRaw<
      { day: string; hour: number; count: string }[]
    >`
      SELECT to_char(o."createdAt" AT TIME ZONE 'Asia/Tehran','YYYY-MM-DD') AS day,
      EXTRACT(HOUR FROM o."createdAt" AT TIME ZONE 'Asia/Tehran')::int AS hour,COUNT(*)::text AS count
      FROM "Order" o WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o."createdAt">=${start} AND o."createdAt"<${end}
      AND EXISTS(SELECT 1 FROM "OrderItem" i WHERE i."orderId"=o.id AND i."tenantId"=o."tenantId" AND i."branchId"=o."branchId") GROUP BY day,hour ORDER BY day,hour`;
    const buckets = rows.map((r) => ({
      day: new Date(r.day + 'T00:00:00+03:30').getTime(),
      hour: r.hour,
      count: Number(r.count),
    }));
    const first = await tx.order.findFirst({
      where: {
        tenantId,
        branchId,
        createdAt: { lt: end },
        items: { some: {} },
      },
      orderBy: { createdAt: 'asc' },
      select: { createdAt: true },
    });
    const firstObservedDay = first
      ? Math.floor((first.createdAt.getTime() + 210 * 60000) / 86400000) *
          86400000 -
        210 * 60000
      : Infinity;
    const forecast = forecastDemand(buckets, today, firstObservedDay);
    result.title = 'پیش‌بینی تقاضای ثبت‌شده';
    result.start = start.toISOString();
    result.end = end.toISOString();
    result.facts.push(
      {
        label: 'سفارش‌های دارای قلم در ۵۶ روز کامل',
        value: String(forecast.orders),
        unit: 'COUNT',
      },
      {
        label: 'روزهای دارای سفارش',
        value: String(forecast.activeDays),
        unit: 'COUNT',
      },
    );
    result.limitations.push(
      'هدف، تعداد سفارش دارای قلم بر اساس زمان ایجاد است؛ لغوها نیز تقاضای ثبت‌شده محسوب می‌شوند. سفارش خالی حذف شده است. روز بدون ثبت، صفر فرض می‌شود و از تعطیلی یا قطعی قابل تفکیک نیست.',
      'تعطیلات، مناسبت‌ها، تبلیغات، آب‌وهوا و تغییر ساعت کار لحاظ نشده‌اند؛ برای خرید مواد اولیه یا تعهد مالی به‌تنهایی استفاده نشود.',
    );
    if (!forecast.sufficient) {
      result.explanation =
        'برای پیش‌بینی حداقل ۵۶ روز سابقه، ۱۰۰ سفارش دارای قلم و ۲۸ روز دارای سفارش لازم است. فعلاً داده کافی نیست.';
      return result;
    }
    result.explanation = `روش منتخب: ${forecast.method}. انتخاب بر اساس خطای مطلق میانگین روی ۱۴ روز پایانی، با استفاده از گذشته هر روز؛ مدل زبانی اعداد را تولید نکرده است.`;
    result.sections.push({
      title: 'سنجش روی روزهای کنارگذاشته‌شده',
      columns: ['خطای روش منتخب (سفارش در روز)', 'خطای مبنای هفته قبل'],
      rows: [[number(forecast.mae), number(forecast.baselineMae)]],
    });
    result.sections.push({
      title: 'هفت روز از امروز',
      columns: ['روز', 'تخمین سفارش', 'حد پایین راهنما', 'حد بالا راهنما'],
      rows: forecast.forecasts.map((r) => [
        date(new Date(r.day)),
        number(r.estimate),
        number(r.lower),
        number(r.upper),
      ]),
    });
    result.sections.push({
      title: '۲۴ ساعت کامل آینده — میانگین چهار هفته هم‌نام',
      columns: [
        'شروع ساعت تهران',
        'تخمین سفارش',
        'کمینه مشاهده',
        'بیشینه مشاهده',
      ],
      rows: hourlyDemand(buckets, today, anchor.getTime()).map((r) => [
        new Intl.DateTimeFormat('fa-IR', {
          timeZone: 'Asia/Tehran',
          dateStyle: 'short',
          timeStyle: 'short',
        }).format(new Date(r.at)),
        number(r.estimate),
        number(r.lower),
        number(r.upper),
      ]),
    });
    result.limitations.push(
      'بازه روزانه از صدک ۹۰ خطای مطلق آزمون گذشته ساخته شده؛ پوشش احتمالی تضمین‌شده ندارد. بازه ساعتی فقط کمینه و بیشینه چهار مشاهده است، فاصله اطمینان نیست. شمارش‌های کسری، میانگین‌اند.',
      'تخمین امروز برای کل روز است؛ با ۲۴ ساعت آینده جمع نشود. نتایج ساعتی کم‌داده‌اند و جداگانه اعتبارسنجی نشده‌اند.',
    );
  } else if (plan.tool === 'KITCHEN_DELAYS') {
    result.title = 'گلوگاه‌های ثبت‌شده آشپزخانه';
    const timings = await tx.$queryRaw<
      {
        name: string;
        samples: string;
        median: number;
        p90: number;
        queue: number;
        delayed: string;
      }[]
    >`
      SELECT MAX(i.name) AS name,COUNT(*)::text AS samples,
      percentile_cont(0.5) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(i."readyAt"-i."preparingAt"))/60) AS median,
      percentile_cont(0.9) WITHIN GROUP(ORDER BY EXTRACT(EPOCH FROM(i."readyAt"-i."preparingAt"))/60) AS p90,
      AVG(EXTRACT(EPOCH FROM(i."preparingAt"-i."createdAt"))/60)::float8 AS queue,
      COUNT(*) FILTER(WHERE i."readyAt"-i."preparingAt">interval '20 minutes')::text AS delayed
      FROM "OrderItem" i WHERE i."tenantId"=${tenantId}::uuid AND i."branchId"=${branchId}::uuid AND i.status<>'CANCELLED'
      AND i."preparingAt" IS NOT NULL AND i."readyAt">=${window.start} AND i."readyAt"<${window.end} AND i."readyAt">=i."preparingAt"
      GROUP BY i."menuItemId" HAVING COUNT(*)>=3 ORDER BY p90 DESC,i."menuItemId" LIMIT 10`;
    result.sections.push({
      title: 'زمان آماده‌سازی بر حسب دقیقه — حداقل سه نمونه',
      columns: [
        'غذا',
        'نمونه',
        'میانه آماده‌سازی',
        'صدک ۹۰',
        'میانگین انتظار شروع',
        'بیش از ۲۰ دقیقه',
      ],
      rows: timings.map((r) => [
        r.name,
        number(r.samples),
        number(r.median),
        number(r.p90),
        number(r.queue),
        number(r.delayed),
      ]),
    });
    const backlog = await tx.$queryRaw<
      { pending: string; preparing: string; unmeasured: string }[]
    >`
      SELECT COUNT(*) FILTER(WHERE i.status='PENDING' AND i."createdAt"<${anchor} - interval '20 minutes')::text AS pending,
      COUNT(*) FILTER(WHERE i.status='PREPARING' AND i."preparingAt"<${anchor} - interval '20 minutes')::text AS preparing,
      COUNT(*) FILTER(WHERE i.status='PREPARING' AND i."preparingAt" IS NULL)::text AS unmeasured
      FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" AND o."tenantId"=i."tenantId" AND o."branchId"=i."branchId"
      WHERE i."tenantId"=${tenantId}::uuid AND i."branchId"=${branchId}::uuid AND o.status='OPEN' AND i."createdAt"<=${anchor}`;
    result.sections.push({
      title: 'عقب‌ماندگی فعلی — مستقل از بازه گزارش',
      columns: [
        'در صف بیش از ۲۰ دقیقه',
        'در آماده‌سازی بیش از ۲۰ دقیقه',
        'آماده‌سازی بدون زمان شروع',
      ],
      rows: [
        [
          number(backlog[0].pending),
          number(backlog[0].preparing),
          number(backlog[0].unmeasured),
        ],
      ],
    });
    result.explanation = timings.length
      ? 'زمان‌ها از تغییر وضعیت ثبت‌شده محاسبه شده‌اند؛ جدول بیشترین صدک ۹۰ را نشان می‌دهد.'
      : 'نمونه زمان‌دار کافی نیست؛ هر غذا حداقل سه ردیف با زمان شروع و آماده‌شدن نیاز دارد. زمان‌های قدیمی بازسازی نمی‌شوند.';
    result.limitations.push(
      'ثبت زمان از نصب این نسخه آغاز می‌شود؛ داده قدیمی فاقد زمان دقیق از آمار مدت آماده‌سازی حذف شده است. هر ردیف یک نمونه است، مستقل از تعداد غذا در آن ردیف.',
      'آستانه ۲۰ دقیقه صرفاً علامت بررسی است؛ زمان استاندارد هر غذا، توقف عمدی و خطای ثبت وضعیت را لحاظ نمی‌کند و علت تأخیر را اثبات نمی‌کند.',
    );
  }
  return result;
}
