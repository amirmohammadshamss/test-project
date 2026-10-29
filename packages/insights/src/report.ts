import { operationalReport } from './operations';
import type { PrismaClient } from '@prisma/client';
import type {
  AnalysisResult,
  ManagerPlan,
} from '../../shared/src/manager-analysis';
import { managerPlanSchema } from '../../shared/src/manager-analysis';
import { PermanentFailure } from '../../shared/src/ai';
export interface AnalysisScope {
  tenantId: string;
  branchId: string;
  actorId: string;
  membershipId: string;
}
const dayMs = 86400000;
export function reportWindow(period: ManagerPlan['period'], anchor: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tehran',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(anchor);
  const part = (type: string) =>
    Number(parts.find((p) => p.type === type)!.value);
  const localMidnight = Date.UTC(part('year'), part('month') - 1, part('day'));
  // Current Iranian reporting windows are after the abolition of DST (2023+).
  if (anchor.getUTCFullYear() < 2023)
    throw new PermanentFailure('AI_INVALID_PERIOD');
  const today = localMidnight - 210 * 60000;
  const daysSinceSaturday = (new Date(localMidnight).getUTCDay() + 1) % 7;
  const saturday = today - daysSinceSaturday * dayMs;
  const start =
    period === 'TODAY'
      ? today
      : period === 'LAST_7_DAYS'
        ? today - 6 * dayMs
        : period === 'THIS_WEEK'
          ? saturday
          : saturday - 7 * dayMs;
  const end = period === 'LAST_WEEK' ? saturday : anchor.getTime();
  const shift = period === 'TODAY' ? dayMs : 7 * dayMs;
  return {
    start: new Date(start),
    end: new Date(end),
    previousStart: new Date(start - shift),
    previousEnd: new Date(end - shift),
  };
}
export async function executeManagerReport(
  db: PrismaClient,
  scope: AnalysisScope,
  supplied: ManagerPlan,
  anchor: Date,
): Promise<AnalysisResult> {
  const parsed = managerPlanSchema.safeParse(supplied);
  if (!parsed.success) throw new PermanentFailure('AI_INVALID_TOOL');
  const plan = parsed.data,
    window = reportWindow(plan.period, anchor);
  const result: AnalysisResult = {
    title: 'گزارش شعبه جاری',
    explanation:
      'این اعداد از داده‌های ثبت‌شده محاسبه شده‌اند؛ تفسیر یا پیش‌بینی مدل نیستند.',
    generatedAt: new Date().toISOString(),
    start: window.start.toISOString(),
    end: window.end.toISOString(),
    ...plan,
    facts: [],
    items: [],
    limitations: [
      'فقط شعبه و دسترسی فعلی شما؛ بازه زمانی به وقت تهران است.',
      'ارزش سفارش تکمیل‌شده، دریافت وجه یا سود نیست. اطلاعات پرداخت و هزینه مواد در این سامانه موجود نیست.',
      'نتیجه یک تصویر از زمان اجرای گزارش است؛ روز و هفته جاری هنوز کامل نیستند.',
    ],
  };
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SELECT set_config('statement_timeout','3000',true)`;
      const membership = await tx.membership.findFirst({
        where: {
          id: scope.membershipId,
          tenantId: scope.tenantId,
          userId: scope.actorId,
          role: 'MANAGER',
          active: true,
          user: { active: true },
          restaurant: { status: 'ACTIVE' },
          branches: {
            some: { branchId: scope.branchId, branch: { active: true } },
          },
        },
      });
      if (!membership) throw new PermanentFailure('AI_ACCESS_REVOKED');
      const { tenantId, branchId } = scope;
      if (plan.tool === 'UNSUPPORTED')
        return {
          ...result,
          title: 'این پرسش پشتیبانی نمی‌شود',
          explanation:
            'درباره فروش، پیشنهاد منو، تقاضای آینده، تأخیر آشپزخانه یا لغوها در بازه‌های پشتیبانی‌شده بپرسید.',
        };
      if (
        [
          'SALES_TRENDS',
          'MENU_SUGGESTIONS',
          'DEMAND_FORECAST',
          'KITCHEN_DELAYS',
        ].includes(plan.tool)
      )
        return operationalReport(tx, scope, plan, window, result, anchor);
      if (plan.tool === 'TOP_SELLERS') {
        const rows = await tx.$queryRaw<
          { name: string; quantity: string; valueRial: string }[]
        >`SELECT i.name,SUM(i.quantity)::text AS quantity,SUM(i."priceRial"::bigint*i.quantity)::text AS "valueRial" FROM "OrderItem" i JOIN "Order" o ON o.id=i."orderId" AND o."tenantId"=i."tenantId" AND o."branchId"=i."branchId" WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND i.status<>'CANCELLED' AND o."completedAt">=${window.start} AND o."completedAt"<${window.end} GROUP BY i."menuItemId",i.name ORDER BY SUM(i.quantity) DESC,i.name ASC,i."menuItemId" ASC LIMIT 10`;
        result.title = 'پرفروش‌ترین اقلام سفارش‌های تکمیل‌شده';
        result.items = rows.map((r) => ({
          ...r,
          quantity: Number(r.quantity),
        }));
        result.limitations.push(
          'حداکثر ده ردیف بر اساس تعداد؛ نام‌های متفاوت تاریخی یک قلم جدا نمایش داده می‌شوند.',
        );
      } else if (plan.tool === 'SALES_SUMMARY') {
        const totals = async (start: Date, end: Date) =>
          (
            await tx.$queryRaw<
              { orders: string; value: string }[]
            >`SELECT COUNT(DISTINCT o.id)::text AS orders,COALESCE(SUM(CASE WHEN i.status<>'CANCELLED' THEN i."priceRial"::bigint*i.quantity ELSE 0 END),0)::text AS value FROM "Order" o LEFT JOIN "OrderItem" i ON i."orderId"=o.id AND i."tenantId"=o."tenantId" AND i."branchId"=o."branchId" WHERE o."tenantId"=${tenantId}::uuid AND o."branchId"=${branchId}::uuid AND o.status='COMPLETED' AND o."completedAt">=${start} AND o."completedAt"<${end}`
          )[0];
        const current = await totals(window.start, window.end),
          previous = await totals(window.previousStart, window.previousEnd);
        result.title = 'مقایسه ارزش سفارش‌های تکمیل‌شده';
        result.facts = [
          {
            label: 'تعداد سفارش تکمیل‌شده',
            value: current.orders,
            unit: 'COUNT',
          },
          {
            label: 'ارزش سفارش‌های تکمیل‌شده',
            value: current.value,
            unit: 'IRR',
          },
          {
            label: 'تعداد در بازه مقایسه',
            value: previous.orders,
            unit: 'COUNT',
          },
          { label: 'ارزش در بازه مقایسه', value: previous.value, unit: 'IRR' },
        ];
        result.limitations.push(
          `بازه مقایسه هم‌طول: ${new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(window.previousStart)} تا ${new Intl.DateTimeFormat('fa-IR', { timeZone: 'Asia/Tehran', dateStyle: 'short', timeStyle: 'short' }).format(window.previousEnd)}. مقایسه درصدی یا ادعای رشد با داده کم ارائه نمی‌شود.`,
        );
      } else {
        result.title = 'لغوهای ثبت‌شده';
        const orders = await tx.order.count({
          where: {
            tenantId,
            branchId,
            status: 'CANCELLED',
            cancelledAt: { gte: window.start, lt: window.end },
          },
        });
        const items = await tx.orderItem.aggregate({
          where: {
            tenantId,
            branchId,
            status: 'CANCELLED',
            cancelledAt: { gte: window.start, lt: window.end },
          },
          _sum: { quantity: true },
          _count: { _all: true },
        });
        result.facts = [
          { label: 'سفارش لغوشده', value: String(orders), unit: 'COUNT' },
          {
            label: 'ردیف لغوشده',
            value: String(items._count._all),
            unit: 'COUNT',
          },
          {
            label: 'تعداد اقلام لغوشده',
            value: String(items._sum.quantity || 0),
            unit: 'COUNT',
          },
        ];
        result.limitations.push(
          'اقلام لغوشده شامل اقلام سفارش‌های کاملاً لغوشده هم هستند؛ دو شمارش را با هم جمع نکنید.',
        );
      }
      if (
        !result.items.length &&
        (!result.facts.length || result.facts.every((f) => f.value === '0'))
      )
        result.explanation =
          'داده‌ای در این بازه ثبت نشده است؛ از این نتیجه نمی‌توان درباره عملکرد یا تقاضا قضاوت کرد.';
      return result;
    },
    { isolationLevel: 'RepeatableRead', timeout: 8000 },
  );
}
