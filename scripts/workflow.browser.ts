import { test, expect, Page } from '@playwright/test';
import { io } from 'socket.io-client';
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
test.beforeAll(async () => {
  const email = 'platform-' + suffix + '@browser.test';
  accounts.PLATFORM = email;
  await db.user.create({
    data: {
      email,
      name: 'Platform browser',
      passwordHash: await hashPassword(password),
      platformAdmin: { create: {} },
    },
  });
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
    await expect(w.locator('[data-realtime-state=connected]')).toBeVisible();
    await expect(k.locator('[data-realtime-state=connected]')).toBeVisible();
    const relayOrigin = new URL(w.url()).origin;
    const relayCookie = (await waiter.cookies())
      .map((c) => c.name + '=' + c.value)
      .join('; ');
    const relay = io(relayOrigin, {
      transports: ['polling'],
      reconnection: false,
      forceNew: true,
      timeout: 5000,
      extraHeaders: { Cookie: relayCookie, Origin: relayOrigin },
    });
    try {
      await new Promise<void>((resolve, reject) => {
        relay.once('connect', () => resolve());
        relay.once('connect_error', reject);
      });
    } finally {
      relay.disconnect();
    }

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
    await food
      .getByLabel('توضیح آشپزخانه برای لیموناد آزمون')
      .fill('بدون یخ؛ با سالن هماهنگ شود');
    await food.getByRole('button').click();
    await expect(
      k.getByText('توضیح آشپزخانه: بدون یخ؛ با سالن هماهنگ شود'),
    ).toBeVisible();
    await expect(k.getByRole('heading', { name: /لیموناد آزمون/ })).toBeVisible(
      { timeout: 2500 },
    );
    await k
      .getByRole('button', { name: 'شروع آماده‌سازی', exact: true })
      .click();
    await k.getByRole('button', { name: 'آماده سرو است', exact: true }).click();
    await w
      .getByRole('button', { name: 'تحویل به مهمان', exact: true })
      .click({ timeout: 2500 });
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

test('reconnection refetches missed state and socket failure leaves REST commands usable', async ({
  page,
  context,
}) => {
  const table = await db.restaurantTable.create({
    data: { tenantId, branchId, number: 9 },
  });
  await login(page, 'WAITER');
  await expect(page.locator('[data-realtime-state=connected]')).toBeVisible();
  await context.setOffline(true);
  await expect(page.locator('[data-realtime-state=disconnected]')).toBeVisible({
    timeout: 15000,
  });
  const order = await db.order.create({
    data: { tenantId, branchId, tableId: table.id },
  });
  await context.setOffline(false);
  await expect(page.locator('[data-realtime-state=connected]')).toBeVisible({
    timeout: 15000,
  });
  const card = page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: 'میز ۹', exact: true }) });
  await expect(card).toContainText('در حال سرویس');
  await context.route('**/socket.io/**', (route) => route.abort());
  await page.reload();
  await expect(
    page.locator('[data-realtime-state=disconnected]'),
  ).toBeVisible();
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: 'میز ۹', exact: true }) })
    .click();
  await page.getByRole('button', { name: 'لغو سفارش و آزاد کردن میز' }).click();
  await page.getByLabel('دلیل لغو').fill('REST fallback');
  await page.getByRole('button', { name: 'تأیید لغو', exact: true }).click();
  await expect(page.getByText('لغو ثبت شد؛', { exact: false })).toBeVisible();
  expect(
    (await db.order.findUniqueOrThrow({ where: { id: order.id } })).status,
  ).toBe('CANCELLED');
});

test('manager dashboard refetches immediately when another staff session opens a table', async ({
  browser,
}) => {
  await db.restaurantTable.create({ data: { tenantId, branchId, number: 10 } });
  const expected =
    (await db.order.count({ where: { tenantId, branchId, status: 'OPEN' } })) +
    1;
  const manager = await browser.newContext(),
    waiter = await browser.newContext();
  try {
    const m = await manager.newPage(),
      w = await waiter.newPage();
    await login(m, 'MANAGER');
    await m.goto('/dashboard');
    await expect(
      m.getByText('ارتباط زنده برقرار است', { exact: true }),
    ).toBeVisible();
    await login(w, 'WAITER');
    await expect(w.locator('[data-realtime-state=connected]')).toBeVisible();
    await w
      .getByRole('button')
      .filter({ has: w.getByRole('heading', { name: 'میز ۱۰', exact: true }) })
      .click();
    await expect(
      m
        .getByText('سفارش‌های باز', { exact: true })
        .locator('..')
        .locator('strong'),
    ).toHaveText(new Intl.NumberFormat('fa-IR').format(expected), {
      timeout: 2500,
    });
  } finally {
    await manager.close();
    await waiter.close();
  }
});

test('persistent notification center receives personal hints, distinguishes acknowledgment, and survives reload', async ({
  browser,
}, testInfo) => {
  await db.restaurantTable.create({
    data: { tenantId, branchId, number: 200 },
  });
  const wc = await browser.newContext(),
    kc = await browser.newContext();
  try {
    const w = await wc.newPage(),
      k = await kc.newPage();
    await login(w, 'WAITER');
    await login(k, 'KITCHEN');
    await expect(k.locator('[data-realtime-state=connected]')).toBeVisible();
    await k.request.post('/api/v1/notifications/read-all', {
      headers: { 'X-CSRF-Protection': '1' },
    });
    const permission = await k.evaluate(() => Notification.permission);
    await k.getByRole('button', { name: 'اعلان‌ها', exact: true }).click();
    await expect(
      k.getByRole('dialog', { name: 'مرکز اعلان‌ها' }),
    ).toBeVisible();
    await w
      .getByRole('button')
      .filter({ has: w.getByRole('heading', { name: 'میز ۲۰۰', exact: true }) })
      .click();
    await w
      .locator('[data-ui="food-card"]')
      .filter({ hasText: 'لیموناد آزمون' })
      .getByRole('button')
      .click();
    const order = await db.order.findFirstOrThrow({
      where: { tenantId, table: { number: 200 } },
      orderBy: { createdAt: 'desc' },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email: accounts.KITCHEN },
    });
    await expect
      .poll(
        () =>
          db.notification.count({
            where: {
              entityId: order.id,
              recipientId: user.id,
              type: 'NEW_ORDER',
            },
          }),
        { timeout: 20000 },
      )
      .toBe(1);
    const n = await db.notification.findFirstOrThrow({
        where: { entityId: order.id, recipientId: user.id, type: 'NEW_ORDER' },
      }),
      card = k.locator(`[data-notification-id="${n.id}"]`);
    await expect(card).toBeVisible({ timeout: 2500 });
    await card.getByRole('button', { name: 'دریافت را تأیید می‌کنم' }).click();
    await expect(card.getByText('دریافت تأیید شده است')).toBeVisible();
    expect(
      (await db.notification.findUniqueOrThrow({ where: { id: n.id } })).readAt,
    ).toBeNull();
    await card.getByRole('button', { name: 'خواندم', exact: true }).click();
    await expect(
      card.getByRole('button', { name: 'خواندم', exact: true }),
    ).toHaveCount(0);
    await k.goto('/?notifications=1');
    await expect(
      k
        .locator(`[data-notification-id="${n.id}"]`)
        .getByText('دریافت تأیید شده است'),
    ).toBeVisible();
    expect(await k.evaluate(() => Notification.permission)).toBe(permission);
    await k.setViewportSize({ width: 390, height: 844 });
    await k.screenshot({
      path: testInfo.outputPath('notification-center-mobile.png'),
      fullPage: false,
    });
    expect(
      await k.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await k.keyboard.press('Escape');
    await expect(k.getByRole('dialog', { name: 'مرکز اعلان‌ها' })).toHaveCount(
      0,
    );
  } finally {
    await wc.close();
    await kc.close();
  }
});
test('platform notification center uses its own origin and never exposes restaurant notices', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const p = await context.newPage();
    await p.goto('http://127.0.0.1:3003/login');
    await p.getByLabel('ایمیل', { exact: true }).fill(accounts.PLATFORM);
    await p.getByLabel('رمز عبور', { exact: true }).fill(password);
    await p.getByRole('button', { name: 'ورود', exact: true }).click();
    await expect(
      p.getByRole('heading', { name: 'مدیریت پلتفرم RestaurantOS' }),
    ).toBeVisible();
    const event = await db.notificationOutbox.create({
      data: {
        dedupeKey: 'browser-critical:' + randomUUID(),
        realm: 'PLATFORM',
        type: 'PLATFORM_ISSUE',
        entityId: randomUUID(),
        payload: { source: 'browser-test' },
      },
    });
    const user = await db.user.findUniqueOrThrow({
      where: { email: accounts.PLATFORM },
    });
    await expect
      .poll(
        () =>
          db.notification.count({
            where: { eventId: event.id, recipientId: user.id },
          }),
        { timeout: 20000 },
      )
      .toBe(1);
    await p.getByRole('button', { name: 'اعلان‌ها', exact: true }).click();
    await expect(
      p.getByRole('link', { name: 'سرویس سامانه نیاز به بررسی دارد' }).first(),
    ).toBeVisible();
    const response = await p.request.get(
      'http://127.0.0.1:3003/api/v1/platform/notifications',
    );
    expect(response.ok()).toBe(true);
    const notices = await response.json();
    expect(
      notices.items.every(
        (n: { realm: string; tenantId: string | null }) =>
          n.realm === 'PLATFORM' && n.tenantId === null,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('suspended manager sees only the restricted suspension notification center', async ({
  browser,
}) => {
  const mc = await browser.newContext(),
    pc = await browser.newContext();
  let version: number | undefined;
  try {
    const m = await mc.newPage(),
      p = await pc.newPage();
    await login(m, 'MANAGER');
    await p.goto('http://127.0.0.1:3003/login');
    await p.getByLabel('ایمیل', { exact: true }).fill(accounts.PLATFORM);
    await p.getByLabel('رمز عبور', { exact: true }).fill(password);
    await p.getByRole('button', { name: 'ورود', exact: true }).click();
    await expect(
      p.getByRole('heading', { name: 'مدیریت پلتفرم RestaurantOS' }),
    ).toBeVisible();
    const tenant = await db.restaurant.findUniqueOrThrow({
      where: { id: tenantId },
    });
    const suspended = await p.request.post(
      'http://127.0.0.1:3003/api/v1/platform/restaurants/' +
        tenantId +
        '/suspend',
      {
        headers: {
          'X-CSRF-Protection': '1',
          'Idempotency-Key': randomUUID(),
          Origin: 'http://127.0.0.1:3003',
        },
        data: { version: tenant.version, reason: 'Browser suspension notice' },
      },
    );
    expect(suspended.ok()).toBe(true);
    version = (await suspended.json()).version;
    await m.reload();
    await expect(
      m.getByRole('heading', { name: 'دسترسی رستوران تعلیق شده است' }),
    ).toBeVisible();
    await m.getByRole('button', { name: 'اعلان‌ها', exact: true }).click();
    await expect(
      m.getByRole('link', { name: 'دسترسی رستوران تعلیق شده است' }).first(),
    ).toBeVisible({ timeout: 15000 });
    expect((await m.request.get('/api/v1/orders')).status()).toBe(403);
    const notices = await (await m.request.get('/api/v1/notifications')).json();
    expect(
      notices.items.every(
        (n: { type: string }) => n.type === 'TENANT_SUSPENDED',
      ),
    ).toBe(true);
  } finally {
    if (version !== undefined)
      await db.restaurant.update({
        where: { id: tenantId },
        data: { status: 'ACTIVE', version: { increment: 1 } },
      });
    await mc.close();
    await pc.close();
  }
});

test('menu assistant is absent and old links lead to manual menu', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, 'MANAGER');
    await page.goto('/dashboard/menu');
    await expect(
      page.getByRole('link', { name: 'دستیار منو', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'دستیار منو', exact: true }),
    ).toHaveCount(0);
    await page.goto('/dashboard/menu/ai-drafts?draft=legacy');
    await expect(page).toHaveURL(/\/dashboard\/menu$/);
    await expect(
      page.getByRole('button', { name: 'غذای تازه', exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

test('manager assistant saves a question, shows scoped facts and reopens after reload', async ({
  browser,
}) => {
  // This report test owns its completed sale instead of relying on an earlier browser test.
  const table = await db.restaurantTable.findFirstOrThrow({
    where: { tenantId, branchId },
  });
  const menu = await db.menuItem.findUniqueOrThrow({ where: { id: menuId } });
  await db.order.create({
    data: {
      tenantId,
      branchId,
      tableId: table.id,
      status: 'COMPLETED',
      createdAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 1000),
      items: {
        create: {
          menuItemId: menuId,
          name: menu.name,
          priceRial: menu.priceRial,
          quantity: 1,
          status: 'SERVED',
        },
      },
    },
  });
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, 'MANAGER');
    await page.goto('/dashboard/ai-assistant');
    await page
      .getByLabel('پرسش درباره شعبه جاری')
      .fill('پرفروش‌ترین غذاهای هفت روز اخیر کدام‌اند؟');
    await page.getByRole('button', { name: 'ثبت پرسش', exact: true }).click();
    await expect(
      page
        .locator('article')
        .getByRole('heading', { name: 'در صف', exact: true }),
    ).toBeVisible();
    const row = await db.aiAnalysis.findFirstOrThrow({
      where: { tenantId, branchId },
      orderBy: { createdAt: 'desc' },
    });
    const { processAnalysis } = await import('../apps/worker/src/analysis');
    await processAnalysis(
      db,
      { plan: async () => ({ tool: 'TOP_SELLERS', period: 'LAST_7_DAYS' }) },
      { tenantId, analysisId: row.id },
    );
    await expect(
      page.getByRole('heading', {
        name: 'پرفروش‌ترین اقلام سفارش‌های تکمیل‌شده',
      }),
    ).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText('لیموناد آزمون', { exact: true }),
    ).toBeVisible();
    await page
      .getByText('نکات و محدودیت‌های این گزارش', { exact: false })
      .click();
    await expect(
      page.getByText(
        'ارزش سفارش تکمیل‌شده، دریافت وجه یا سود نیست. اطلاعات پرداخت و هزینه مواد در این سامانه موجود نیست.',
      ),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByRole('heading', {
        name: 'پرفروش‌ترین اقلام سفارش‌های تکمیل‌شده',
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  } finally {
    await context.close();
  }
});

test('manager opens four operational reports without a model and sees honest insufficient-data states on mobile', async ({
  browser,
}) => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    await login(page, 'MANAGER');
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto('/dashboard/ai-assistant');
    await expect(
      page.getByRole('heading', { name: 'گزارش‌های آماده' }),
    ).toBeVisible();
    await page.screenshot({
      path: 'test-results/manager-assistant-desktop.png',
      fullPage: true,
    });
    await page.getByLabel('بازه گزارش').selectOption('LAST_7_DAYS');
    for (const [button, title] of [
      ['تحلیل فروش و روندها', 'روند فروش و تغییر غذاهای پرفروش'],
      ['پیشنهاد منو و ترکیب غذاها', 'پیشنهادهای قابل بررسی برای منو'],
      ['پیش‌بینی تقاضا', 'پیش‌بینی تقاضای ثبت‌شده'],
      ['تحلیل تأخیر آشپزخانه', 'گلوگاه‌های ثبت‌شده آشپزخانه'],
    ]) {
      await page.getByRole('button', { name: button, exact: true }).click();
      await expect(
        page.getByRole('heading', { name: title, exact: true }),
      ).toBeVisible();
      if (button === 'تحلیل فروش و روندها')
        await page.screenshot({
          path: 'test-results/manager-assistant-result.png',
          fullPage: true,
        });
      if (button === 'پیش‌بینی تقاضا')
        await expect(
          page.getByText('برای پیش‌بینی حداقل ۵۶ روز سابقه', { exact: false }),
        ).toBeVisible();
    }
    await expect(
      page.getByRole('table', {
        name: 'عقب‌ماندگی فعلی — مستقل از بازه گزارش',
      }),
    ).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: 'test-results/operations-analytics-mobile.png',
      fullPage: true,
    });
  } finally {
    await context.close();
  }
});
