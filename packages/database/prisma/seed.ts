import { PrismaClient } from '@prisma/client';
import { seedDemoHistory } from './demo-history';
import { hashPassword } from '../src/password';
const db = new PrismaClient();
export const ids = {
  tenantA: '10000000-0000-4000-8000-000000000001',
  tenantB: '10000000-0000-4000-8000-000000000002',
  branchA: '20000000-0000-4000-8000-000000000001',
  branchA2: '20000000-0000-4000-8000-000000000002',
  branchB: '20000000-0000-4000-8000-000000000003',
};
async function seed() {
  const password = process.env.SEED_DEMO_PASSWORD;
  if (!password || password.length < 12)
    throw new Error('Set SEED_DEMO_PASSWORD (12+ characters)');
  const passwordHash = await hashPassword(password);
  for (const [id, name] of [
    [ids.tenantA, 'کافه نارنج'],
    [ids.tenantB, 'رستوران زیتون'],
  ])
    await db.restaurant.upsert({
      where: { id },
      create: { id, name },
      update: { name },
    });
  for (const [id, tenantId, name] of [
    [ids.branchA, ids.tenantA, 'شعبه ولیعصر'],
    [ids.branchA2, ids.tenantA, 'شعبه تجریش'],
    [ids.branchB, ids.tenantB, 'شعبه مرکزی'],
  ]) {
    await db.branch.upsert({
      where: { id },
      create: { id, tenantId, name },
      update: {},
    });
    for (let number = 1; number <= 8; number++)
      await db.restaurantTable.upsert({
        where: { branchId_number: { branchId: id, number } },
        create: {
          tenantId,
          branchId: id,
          number,
          seats: number % 3 === 0 ? 6 : 4,
        },
        update: {},
      });
  }
  const accounts = [
    ['manager', ids.tenantA, ids.branchA, 'MANAGER', 'مدیر نارنج'],
    ['waiter', ids.tenantA, ids.branchA, 'WAITER', 'سارا احمدی'],
    ['kitchen', ids.tenantA, ids.branchA, 'KITCHEN', 'آشپزخانه نارنج'],
    ['other', ids.tenantB, ids.branchB, 'MANAGER', 'مدیر زیتون'],
    ['branch', ids.tenantA, ids.branchA2, 'WAITER', 'پرسنل تجریش'],
  ] as const;
  for (const [email, tenantId, branchId, role, name] of accounts) {
    const user = await db.user.upsert({
      where: { email: `${email}@demo.restaurantos.test` },
      create: { email: `${email}@demo.restaurantos.test`, name, passwordHash },
      update: { passwordHash },
    });
    const membership = await db.membership.upsert({
      where: { tenantId_userId: { tenantId, userId: user.id } },
      create: { tenantId, userId: user.id, role },
      update: { role },
    });
    await db.branchMembership.upsert({
      where: {
        membershipId_branchId: { membershipId: membership.id, branchId },
      },
      create: { tenantId, membershipId: membership.id, branchId },
      update: {},
    });
  }
  for (const tenantId of [ids.tenantA, ids.tenantB]) {
    for (const category of [
      'برگر',
      'پیتزا',
      'نوشیدنی',
      'پیش‌غذا',
      'دسر',
      'غذاهای ایرانی',
    ])
      await db.category.upsert({
        where: { tenantId_name: { tenantId, name: category } },
        create: { tenantId, name: category },
        update: {},
      });
    const entries = [
      [
        'چیزبرگر مخصوص',
        'گوشت گوساله، پنیر گودا، نان تازه و سیب‌زمینی',
        450000,
        'برگر',
      ],
      ['برگر قارچ و پنیر', 'قارچ تفت‌داده، پنیر و سس مخصوص', 390000, 'برگر'],
      ['پیتزا پپرونی', 'پپرونی، موزارلا و سس گوجه', 520000, 'پیتزا'],
      ['پیتزا سبزیجات', 'قارچ، فلفل دلمه‌ای، زیتون و پنیر', 410000, 'پیتزا'],
      ['لیموناد تازه', 'آب‌لیمو، نعنا و یخ', 95000, 'نوشیدنی'],
      ['آیس لاته', 'اسپرسو، شیر سرد و یخ', 125000, 'نوشیدنی'],
      ['سیب‌زمینی تنوری', 'سیب‌زمینی، رزماری و سس سیر', 165000, 'پیش‌غذا'],
      ['کیک شکلاتی', 'کیک شکلاتی با سس گرم', 145000, 'دسر'],
    ] as const;
    for (let index = 0; index < entries.length; index++) {
      const entry =
        tenantId === ids.tenantB
          ? (
              [
                [
                  'چلوکباب کوبیده',
                  'برنج ایرانی، گوجه کبابی و دو سیخ کوبیده',
                  380000,
                  'غذاهای ایرانی',
                ],
                [
                  'زرشک پلو با مرغ',
                  'مرغ و برنج زعفرانی',
                  295000,
                  'غذاهای ایرانی',
                ],
                ['قورمه‌سبزی', 'خورش با برنج', 265000, 'غذاهای ایرانی'],
                ['جوجه کباب', 'جوجه زعفرانی با برنج', 345000, 'غذاهای ایرانی'],
                ['دوغ بطری', 'نوشیدنی سرد', 45000, 'نوشیدنی'],
                ['چای ایرانی', 'چای دم‌شده', 55000, 'نوشیدنی'],
                ['سالاد شیرازی', 'خیار، گوجه و آب‌لیمو', 65000, 'پیش‌غذا'],
                ['شله‌زرد', 'دسر زعفرانی', 75000, 'دسر'],
              ] as const
            )[index]
          : entries[index];
      const [name, description, priceToman, categoryName] = entry;
      const category = await db.category.findUniqueOrThrow({
        where: { tenantId_name: { tenantId, name: categoryName } },
      });
      const id = `30000000-0000-4000-8000-${String((tenantId === ids.tenantA ? 0 : 100) + index + 1).padStart(12, '0')}`;
      await db.menuItem.upsert({
        where: { id },
        create: {
          id,
          tenantId,
          categoryId: category.id,
          name,
          description,
          priceRial: priceToman * 10,
        },
        update: {},
      });
    }
  }
  // Fixed identifiers make seed reruns safe and preserve reviewer mutations.
  for (const [number, status] of [
    [3, 'OPEN'],
    [8, 'COMPLETED'],
  ] as const) {
    const table = await db.restaurantTable.findUniqueOrThrow({
      where: { branchId_number: { branchId: ids.branchA, number } },
    });
    const id = `40000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
    await db.order.upsert({
      where: { id },
      update: {},
      create: {
        id,
        tenantId: ids.tenantA,
        branchId: ids.branchA,
        tableId: table.id,
        status,
        ...(status === 'COMPLETED' ? { completedAt: new Date() } : {}),
        items: {
          create: {
            menuItemId: '30000000-0000-4000-8000-000000000001',
            name: 'چیزبرگر مخصوص',
            quantity: 2,
            priceRial: 4500000,
            status: status === 'OPEN' ? 'PREPARING' : 'SERVED',
          },
        },
      },
    });
  }
  await seedDemoHistory(
    db,
    [ids.tenantA, ids.tenantB],
    [ids.branchA, ids.branchB],
  );
  console.log(
    'Demo seed ready: 2 restaurants, 3 branches, 5 staff, distinct Persian menus, thirty days of fictional shift history and labeled fixtures.',
  );
}
seed().finally(() => db.$disconnect());
