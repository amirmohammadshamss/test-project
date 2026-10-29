import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { spawnSync } from 'node:child_process';
const base = process.env.FAULT_API_URL || 'http://127.0.0.1:4000';
const origin = process.env.WEB_ORIGIN || 'http://localhost:3000';
const headers = (cookie, key = randomUUID()) => ({
  'Content-Type': 'application/json',
  'X-CSRF-Protection': '1',
  Origin: origin,
  'Idempotency-Key': key,
  ...(cookie ? { Cookie: cookie } : {}),
});
async function call(path, method = 'GET', body, cookie, key, host = base) {
  const response = await fetch(host + '/api/v1' + path, {
    method,
    headers: headers(cookie, key),
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  assert.ok(
    response.ok,
    `${method} ${path}: ${response.status} ${json.error?.code}`,
  );
  return { json, response };
}
async function login(role) {
  const { response } = await call('/auth/login', 'POST', {
    email: `${role}@demo.restaurantos.test`,
    password: process.env.SEED_DEMO_PASSWORD,
  });
  return response.headers.get('set-cookie').split(';')[0];
}
let cuts = 0;
let upstreamCommits = 0;
const proxy = createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const upstream = await fetch(base + request.url, {
      method: request.method,
      headers: { ...request.headers, host: new URL(base).host },
      body: Buffer.concat(chunks),
      signal: AbortSignal.timeout(20000),
    });
    await upstream.arrayBuffer();
    if (!upstream.ok) {
      response.writeHead(upstream.status);
      response.end(JSON.stringify({ error: { code: 'UPSTREAM_ERROR' } }));
      return;
    }
    upstreamCommits++;
    // The real API has committed and returned success. The client never sees it.
    cuts++;
    response.destroy();
  } catch {
    response.destroy();
  }
});
await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
const address = proxy.address();
const faultHost = `http://127.0.0.1:${address.port}`;
let databaseRestarted = false;
try {
  const waiter = await login('waiter');
  const kitchen = await login('kitchen');
  const tables = (await call('/tables', 'GET', undefined, waiter)).json;
  const table = tables.find((value) => !value.orders.length);
  assert.ok(table, 'A free demo table is needed');
  const menu = (await call('/menu/items', 'GET', undefined, waiter)).json.find(
    (value) => value.active && value.available,
  );
  assert.ok(menu);
  const createKey = randomUUID();
  const createBody = { tableId: table.id };
  await assert.rejects(
    call('/orders', 'POST', createBody, waiter, createKey, faultHost),
  );
  const created = (await call('/orders', 'POST', createBody, waiter, createKey))
    .json;
  const again = (await call('/orders', 'POST', createBody, waiter, createKey))
    .json;
  assert.deepEqual(again, created);
  const addKey = randomUUID();
  const addBody = { menuItemId: menu.id, quantity: 1 };
  const addPath = `/orders/${created.id}/items`;
  await assert.rejects(
    call(addPath, 'POST', addBody, waiter, addKey, faultHost),
  );
  if (process.env.FAULT_PG_CTL && process.env.FAULT_PG_DATA) {
    assert.ok(
      ['/tmp/restaurantos-pg', '/private/tmp/restaurantos-pg'].includes(
        process.env.FAULT_PG_DATA,
      ),
      'Only the isolated RestaurantOS cluster may be restarted',
    );
    const restarted = spawnSync(
      process.env.FAULT_PG_CTL,
      [
        '-D',
        process.env.FAULT_PG_DATA,
        '-l',
        '/tmp/restaurantos-pg.log',
        '-m',
        'fast',
        'restart',
      ],
      { encoding: 'utf8', timeout: 30000 },
    );
    assert.equal(restarted.status, 0, 'Isolated PostgreSQL restart failed');
    databaseRestarted = true;
  }
  if (process.env.FAULT_RESTART_COMPOSE_POSTGRES === '1') {
    const restarted = spawnSync('docker', ['compose', 'restart', 'postgres'], {
      encoding: 'utf8',
      timeout: 60000,
    });
    assert.equal(
      restarted.status,
      0,
      'Disposable Compose PostgreSQL restart failed',
    );
    databaseRestarted = true;
  }
  // Old pooled connections may fail once after the restart; retries retain identity.
  let replay;
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      replay = (await call(addPath, 'POST', addBody, waiter, addKey)).json;
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
  assert.ok(replay, 'Committed result was not recoverable');
  assert.equal(replay.items.length, 1);
  const current = (
    await call(`/orders/${created.id}`, 'GET', undefined, waiter)
  ).json;
  assert.equal(current.items.length, 1);
  assert.equal(current.items[0].quantity, 1);
  const orders = (await call('/orders', 'GET', undefined, waiter)).json;
  assert.equal(
    orders.filter(
      (value) => value.tableId === table.id && value.status === 'OPEN',
    ).length,
    1,
  );
  const item = current.items[0];
  await call(
    `/kitchen/items/${item.id}/status`,
    'PATCH',
    { version: 1, status: 'PREPARING' },
    kitchen,
  );
  await call(
    `/kitchen/items/${item.id}/status`,
    'PATCH',
    { version: 2, status: 'READY' },
    kitchen,
  );
  const served = (
    await call(
      `/orders/${created.id}/items/${item.id}`,
      'PATCH',
      { version: 3, status: 'SERVED' },
      waiter,
    )
  ).json;
  await call(
    `/orders/${created.id}/complete`,
    'POST',
    { version: served.version },
    waiter,
  );
  assert.equal(cuts, 2);
  assert.equal(upstreamCommits, 2);
  console.log(
    JSON.stringify({
      status: 'passed',
      responsesLostAfterCommit: cuts,
      databaseRestarted,
      duplicateOrders: 0,
      duplicateItems: 0,
      completedOrder: true,
    }),
  );
} finally {
  await new Promise((resolve) => proxy.close(resolve));
}
