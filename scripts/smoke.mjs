import { smokeAiPolicy } from './smoke-ai-policy.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const base = process.env.SMOKE_URL || 'http://localhost:3000';
async function call(path, method = 'GET', body, cookie) {
  const response = await fetch(base + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Protection': '1',
      Origin: process.env.WEB_ORIGIN || base,
      'Idempotency-Key': randomUUID(),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await response.json();
  assert.ok(
    response.ok,
    `${method} ${path} returned ${response.status}: ${json.error?.code}`,
  );
  return { json, response };
}
async function login(role) {
  const { response } = await call('/auth/login', 'POST', {
    email: `${role}@demo.restaurantos.test`,
    password: process.env.SEED_DEMO_PASSWORD,
  });
  const cookie = response.headers.get('set-cookie');
  assert.ok(cookie?.includes('HttpOnly'));
  assert.ok(cookie?.includes('SameSite=Strict'));
  return cookie.split(';')[0];
}
const htmlResponse = await fetch(base);
assert.equal(htmlResponse.status, 200);
const html = await htmlResponse.text();
assert.match(html, /lang="fa"/);
assert.match(html, /dir="rtl"/);
assert.equal((await call('/health')).json.status, 'ok');
assert.equal((await call('/health/ready')).json.database, 'ready');
const waiter = await login('waiter');
const kitchen = await login('kitchen');
const manager = await login('manager');
const me = (await call('/auth/me', 'GET', undefined, waiter)).json;
assert.equal(me.role, 'WAITER');
const tables = (await call('/tables', 'GET', undefined, waiter)).json;
const table = tables.find((t) => t.orders.length === 0);
assert.ok(table, 'A free demo table is required');
const menu = (await call('/menu/items', 'GET', undefined, waiter)).json;
const item = menu.find((m) => m.active && m.available);
assert.ok(item);
const order = (await call('/orders', 'POST', { tableId: table.id }, waiter))
  .json;
const added = (
  await call(
    `/orders/${order.id}/items`,
    'POST',
    { menuItemId: item.id, quantity: 1 },
    waiter,
  )
).json;
const ordered = added.items[0];
let cursor = null,
  found = false;
do {
  const board = (
    await call(
      '/kitchen/orders?limit=100' + (cursor ? '&cursor=' + cursor : ''),
      'GET',
      undefined,
      kitchen,
    )
  ).json;
  found ||= board.items.some((o) => o.id === order.id);
  cursor = board.nextCursor;
} while (cursor && !found);
assert.ok(found);
await call(
  `/kitchen/items/${ordered.id}/status`,
  'PATCH',
  { version: 1, status: 'PREPARING' },
  kitchen,
);
await call(
  `/kitchen/items/${ordered.id}/status`,
  'PATCH',
  { version: 2, status: 'READY' },
  kitchen,
);
const served = (
  await call(
    `/orders/${order.id}/items/${ordered.id}`,
    'PATCH',
    { version: 3, status: 'SERVED' },
    waiter,
  )
).json;
const closed = (
  await call(
    `/orders/${order.id}/complete`,
    'POST',
    { version: served.version },
    waiter,
  )
).json;
assert.equal(closed.status, 'COMPLETED');
let providerVerified = false;
if (process.env.SMOKE_SKIP_AI !== '1') {
  const draft = (
    await call(
      '/ai/menu-drafts',
      'POST',
      { input: 'چیزبرگر مخصوص با گوشت، قیمت ۴۵۰ هزار تومان' },
      manager,
    )
  ).json;
  const policy = smokeAiPolicy();
  let state;
  for (let i = 0; i < 150; i++) {
    state = (
      await call(`/ai/menu-drafts/${draft.id}`, 'GET', undefined, manager)
    ).json;
    if (['READY', 'FAILED'].includes(state.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  assert.equal(
    state.status,
    policy.expected,
    'Provider outcome did not match explicit configuration',
  );
  if (policy.errorCode) assert.equal(state.errorCode, policy.errorCode);
  providerVerified = state.status === 'READY';
  assert.equal((await call('/health/ready')).json.database, 'ready');
}
console.log(
  JSON.stringify({
    status: 'passed',
    checks: [
      'Persian RTL HTML',
      'runtime API proxy',
      'HttpOnly strict cookies',
      'role sessions',
      'table order',
      'kitchen preparation',
      'served completion',
      ...(process.env.SMOKE_SKIP_AI === '1'
        ? []
        : ['AI request and explicit provider outcome']),
    ],
    uiBrowserVerified: false,
    liveProviderVerified: providerVerified,
  }),
);
