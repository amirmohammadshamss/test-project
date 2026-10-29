import { api } from './api';
const values = new Map<string, string>();
beforeEach(() => {
  values.clear();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) || null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  });
});
afterEach(() => jest.restoreAllMocks());
function sentKey(mock: jest.SpyInstance, index: number) {
  return (mock.mock.calls[index][1]?.headers as Record<string, string>)[
    'Idempotency-Key'
  ];
}
test('uncertain network failure retains the original mutation key; a confirmed new action gets a fresh key', async () => {
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValueOnce(new Error('network'))
    .mockResolvedValueOnce(Response.json({ id: 'saved' }))
    .mockResolvedValueOnce(Response.json({ id: 'new' }));
  await expect(
    api('/orders/o/items', 'POST', { menuItemId: 'm', quantity: 1 }),
  ).rejects.toThrow('NETWORK_UNCERTAIN');
  await api('/orders/o/items', 'POST', { menuItemId: 'm', quantity: 1 });
  await api('/orders/o/items', 'POST', { menuItemId: 'm', quantity: 1 });
  expect(sentKey(mock, 0)).toBe(sentKey(mock, 1));
  expect(sentKey(mock, 2)).not.toBe(sentKey(mock, 1));
  expect(values.size).toBe(0);
});
test('5xx retains retry key while a definitive 409 allows a corrected action', async () => {
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce(
      Response.json(
        { error: { code: 'BACKEND_UNAVAILABLE' } },
        { status: 503 },
      ),
    )
    .mockResolvedValueOnce(
      Response.json({ error: { code: 'VERSION_CONFLICT' } }, { status: 409 }),
    )
    .mockResolvedValueOnce(Response.json({ ok: true }));
  const call = () =>
    api('/orders/o/items/i', 'PATCH', { version: 1, quantity: 2 });
  await expect(call()).rejects.toThrow('BACKEND_UNAVAILABLE');
  await expect(call()).rejects.toThrow('VERSION_CONFLICT');
  await call();
  expect(sentKey(mock, 0)).toBe(sentKey(mock, 1));
  expect(sentKey(mock, 2)).not.toBe(sentKey(mock, 1));
});
test('login credentials are never written into pending retry storage', async () => {
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('offline'));
  await expect(
    api('/auth/login', 'POST', {
      email: 'demo@example.com',
      password: 'private-password',
    }),
  ).rejects.toThrow('NETWORK_UNCERTAIN');
  expect(values.size).toBe(0);
  expect(sentKey(mock, 0)).toBeUndefined();
});
test('different actors never reuse the same pending request identity', async () => {
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockRejectedValue(new Error('offline'));
  values.set('restaurantos-actor', 'actor-a');
  await expect(api('/orders', 'POST', { tableId: 't' })).rejects.toThrow();
  values.set('restaurantos-actor', 'actor-b');
  await expect(api('/orders', 'POST', { tableId: 't' })).rejects.toThrow();
  expect(sentKey(mock, 0)).not.toBe(sentKey(mock, 1));
  expect([...values.keys()].some((key) => key.includes('tableId'))).toBe(false);
});
