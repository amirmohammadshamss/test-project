import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
type Event = {
  data: { json: () => unknown };
  notification: { close: () => void };
  waitUntil: (promise: Promise<unknown>) => void;
};
test('service worker ignores private payload text and external navigation targets', async () => {
  const handlers: Record<string, (event: Event) => void> = {},
    promises: Promise<unknown>[] = [];
  const show = jest.fn().mockResolvedValue(undefined),
    open = jest.fn().mockResolvedValue(undefined);
  const source = readFileSync('apps/web/public/sw.js', 'utf8');
  runInNewContext(source, {
    URL,
    self: {
      location: { origin: 'https://restaurant.example.com' },
      registration: {
        scope: 'https://restaurant.example.com/',
        showNotification: show,
      },
      clients: { matchAll: async () => [], openWindow: open },
      addEventListener: (name: string, handler: (event: Event) => void) => {
        handlers[name] = handler;
      },
    },
  });
  const event = {
    data: {
      json: () => ({
        title: 'private customer',
        body: 'secret order details',
        url: 'https://attacker.test',
        notificationId: '10000000-0000-4000-8000-000000000001',
      }),
    },
    notification: { close: jest.fn() },
    waitUntil: (promise: Promise<unknown>) => {
      promises.push(promise);
    },
  };
  handlers.push(event);
  await Promise.all(promises);
  expect(show).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(show.mock.calls)).not.toMatch(
    /private customer|secret order details|attacker/,
  );
  handlers.notificationclick(event);
  await Promise.all(promises);
  expect(open).toHaveBeenCalledWith(
    'https://restaurant.example.com/?notifications=1',
  );
});
