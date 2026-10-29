import { managerPlanSchema } from '../../../packages/shared/src/manager-analysis';
import { reportWindow } from '../../../packages/insights/src/report';
import { configuredManagerPlanner } from './provider';
afterEach(() => jest.restoreAllMocks());
test('tool schema rejects SQL, ownership arguments, unsupported tools and arbitrary dates', () => {
  const valid = { tool: 'TOP_SELLERS', period: 'TODAY' };
  expect(managerPlanSchema.safeParse(valid).success).toBe(true);
  for (const extra of [
    { tenantId: 'other' },
    { branchId: 'other' },
    { sql: 'SELECT * FROM orders' },
    { startDate: '2026-01-01' },
  ])
    expect(managerPlanSchema.safeParse({ ...valid, ...extra }).success).toBe(
      false,
    );
  expect(
    managerPlanSchema.safeParse({ ...valid, tool: 'CHANGE_PRICE' }).success,
  ).toBe(false);
});
test('Tehran day boundaries and Saturday week starts are explicit', () => {
  const anchor = new Date('2026-10-30T21:00:00Z');
  expect(reportWindow('TODAY', anchor).start.toISOString()).toBe(
    '2026-10-30T20:30:00.000Z',
  );
  expect(reportWindow('THIS_WEEK', anchor).start.toISOString()).toBe(
    '2026-10-30T20:30:00.000Z',
  );
  expect(reportWindow('LAST_WEEK', anchor).start.toISOString()).toBe(
    '2026-10-23T20:30:00.000Z',
  );
  expect(reportWindow('LAST_WEEK', anchor).end.toISOString()).toBe(
    '2026-10-30T20:30:00.000Z',
  );
});
test('Ollama planner receives only question and schema, never restaurant metrics or identity', async () => {
  const old = process.env.AI_PROVIDER,
    model = process.env.OLLAMA_MODEL;
  try {
    process.env.AI_PROVIDER = 'ollama';
    process.env.OLLAMA_MODEL = 'fixture';
    const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        done: true,
        message: {
          content: JSON.stringify({
            tool: 'SALES_SUMMARY',
            period: 'THIS_WEEK',
          }),
        },
      }),
    );
    expect(
      await configuredManagerPlanner().plan('فروش این هفته چقدر است؟'),
    ).toEqual({ tool: 'SALES_SUMMARY', period: 'THIS_WEEK' });
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.format.additionalProperties).toBe(false);
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toBe('فروش این هفته چقدر است؟');
  } finally {
    if (old === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = old;
    if (model === undefined) delete process.env.OLLAMA_MODEL;
    else process.env.OLLAMA_MODEL = model;
  }
});
