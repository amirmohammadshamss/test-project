import { test, expect, Page } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { hashPassword } from '../packages/database/src/password';
const db = new PrismaClient();
const suffix = randomUUID(),
  password = 'Browser-Test-2026!';
let tenantId: string, branchId: string, menuId: string;
const accounts: Record<string, string> = {};
async function login(page: Page, role: string) {
  await page.goto('/');
  await page.getByLabel('ایمیل کاری').fill(accounts[role]);
  await page.getByLabel('رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ورود به محیط کار' }).click();
  await expect(
    page.getByRole('button', { name: 'خروج', exact: true }),
  ).toBeVisible();
}
test.beforeAll(async () => {
  const tenant = await db.restaurant.create({
    data: { name: 'Browser ' + suffix },
  });
  tenantId = tenant.id;
  const branch = await db.branch.create({
    data: { tenantId, name: 'Browser main' },
  });
  branchId = branch.id;
  const category = await db.category.create({
    data: { tenantId, name: 'نوشیدنی' },
  });
  const menu = await db.menuItem.create({
    data: {
      tenantId,
      categoryId: category.id,
      name: 'لیموناد آزمون',
      description: 'نمونه آزمون',
      priceRial: 100000,
    },
  });
  menuId = menu.id;
  await db.restaurantTable.create({ data: { tenantId, branchId, number: 7 } });
  for (const role of ['WAITER', 'KITCHEN', 'MANAGER'] as const) {
    const email = role.toLowerCase() + '-' + suffix + '@browser.test';
    accounts[role] = email;
    const user = await db.user.create({
      data: { email, name: role, passwordHash: await hashPassword(password) },
    });
    const membership = await db.membership.create({
      data: { tenantId, userId: user.id, role },
    });
    await db.branchMembership.create({
      data: { tenantId, membershipId: membership.id, branchId },
    });
  }
});
test.afterAll(async () => {
  await db.$disconnect();
});
test('independent waiter/kitchen sessions recover an accidental table and finish a real order', async ({
  browser,
}) => {
  const waiter = await browser.newContext(),
    kitchen = await browser.newContext();
  try {
    const w = await waiter.newPage(),
      k = await kitchen.newPage();
    await login(w, 'WAITER');
    await login(k, 'KITCHEN');
    expect((await w.request.get('/api/v1/PLATFORM/auth/me')).status()).toBe(
      404,
    );
    await w
      .getByRole('button')
      .filter({ has: w.getByRole('heading', { name: 'میز ۷', exact: true }) })
      .click();
    await w.getByRole('button', { name: 'لغو سفارش و آزاد کردن میز' }).click();
    await w.getByLabel('دلیل لغو').fill('میز اشتباه');
    await w.getByRole('button', { name: 'تأیید لغو', exact: true }).click();
    await expect(w.getByText('لغو ثبت شد؛', { exact: false })).toBeVisible();
    await w.goto('/');
    await w
      .getByRole('button')
      .filter({ has: w.getByRole('heading', { name: 'میز ۷', exact: true }) })
      .click();
    const food = w
      .locator('[data-ui="food-card"]')
      .filter({ hasText: 'لیموناد آزمون' });
    await food.getByRole('button').click();
    await expect(
      k.getByRole('heading', { name: /لیموناد آزمون/ }),
    ).toBeVisible();
    await k
      .getByRole('button', { name: 'شروع آماده‌سازی', exact: true })
      .click();
    await k.getByRole('button', { name: 'آماده سرو است', exact: true }).click();
    await w
      .getByRole('button', { name: 'تحویل به مهمان', exact: true })
      .click();
    await w
      .getByRole('button', { name: 'تکمیل سفارش و آزاد کردن میز' })
      .click();
    await expect(
      w.getByText('سفارش با موفقیت بسته شد و میز آزاد است.'),
    ).toBeVisible();
    const cookie = (await waiter.cookies()).find((c) => c.name === 'session')!;
    await w.getByRole('button', { name: 'خروج', exact: true }).click();
    const copied = await w.request.get('/api/v1/auth/me', {
      headers: { Cookie: 'session=' + cookie.value },
    });
    expect(copied.status()).toBe(401);
    const other = await k.request.get('/api/v1/auth/me');
    expect(other.status()).toBe(200);
  } finally {
    await waiter.close();
    await kitchen.close();
  }
});
test('kitchen work beyond 100 stays reachable and polling preserves navigation', async ({
  page,
}, testInfo) => {
  for (let n = 11; n <= 115; n++) {
    const table = await db.restaurantTable.create({
      data: { tenantId, branchId, number: n },
    });
    await db.order.create({
      data: {
        tenantId,
        branchId,
        tableId: table.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, n)),
        items: {
          create: {
            menuItemId: menuId,
            name: 'صف ' + n,
            quantity: 1,
            priceRial: 100000,
          },
        },
      },
    });
  }
  await login(page, 'KITCHEN');
  await expect(page.getByText(/۱۰۵ سفارش فعال/)).toBeVisible();
  await page.getByRole('button', { name: 'ادامه صف' }).click();
  await expect(page.getByRole('heading', { name: /صف 110/ })).toBeVisible();
  await page.waitForResponse(
    (r) => r.url().includes('/api/v1/kitchen/orders') && r.status() === 200,
  );
  await expect(page.getByRole('heading', { name: /صف 110/ })).toBeVisible();
  await page.getByRole('button', { name: 'ادامه صف' }).click();
  await expect(page.getByRole('heading', { name: /صف 115/ })).toBeVisible();
  for (const width of [390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath('kitchen-' + width + '.png'),
      fullPage: true,
    });
  }
});

test('offline kitchen preserves last work and clearly marks it stale', async ({
  page,
  context,
}) => {
  const table = await db.restaurantTable.create({
    data: { tenantId, branchId, number: 8 },
  });
  await db.order.create({
    data: {
      tenantId,
      branchId,
      tableId: table.id,
      createdAt: new Date('2000-01-01'),
      items: {
        create: {
          menuItemId: menuId,
          name: 'آزمون قطع ارتباط',
          quantity: 1,
          priceRial: 100000,
        },
      },
    },
  });
  await login(page, 'KITCHEN');
  await expect(
    page.getByRole('heading', { name: /آزمون قطع ارتباط/ }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(
    page.getByText('اطلاعات قدیمی است؛ ارتباط قطع شده', { exact: false }),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole('heading', { name: /آزمون قطع ارتباط/ }),
  ).toBeVisible();
  await context.setOffline(false);
  await expect(
    page.getByText('اطلاعات قدیمی است؛ ارتباط قطع شده', { exact: false }),
  ).not.toBeVisible({ timeout: 15000 });
});
