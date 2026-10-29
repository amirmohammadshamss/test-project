import { OpenAiMenuParser } from './provider';
const result = {
  name: 'برگر',
  description: 'گوشت و پنیر',
  priceToman: 450000,
  category: 'برگر',
};
const previousKey = process.env.OPENAI_API_KEY;
afterEach(() => {
  jest.restoreAllMocks();
  if (previousKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousKey;
});
test('provider uses strict schema and returns validated draft without publishing', async () => {
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [{ type: 'output_text', text: JSON.stringify(result) }],
        },
      ],
    }),
  );
  expect(await new OpenAiMenuParser().parse('برگر ۴۵۰ هزار تومان')).toEqual(
    result,
  );
  const request = JSON.parse(String(mock.mock.calls[0][1]?.body));
  expect(request.store).toBe(false);
  expect(request.text.format.strict).toBe(true);
  expect(request.text.format.schema.additionalProperties).toBe(false);
  expect(request.max_output_tokens).toBeLessThanOrEqual(600);
});
test('missing provider configuration fails clearly without a request', async () => {
  delete process.env.OPENAI_API_KEY;
  const mock = jest.spyOn(globalThis, 'fetch');
  await expect(new OpenAiMenuParser().parse('برگر تست')).rejects.toThrow(
    'AI_NOT_CONFIGURED',
  );
  expect(mock).not.toHaveBeenCalled();
});
test('temporary and permanent HTTP failures are distinguishable', async () => {
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('', { status: 429 }));
  await expect(new OpenAiMenuParser().parse('برگر تست')).rejects.toThrow(
    'AI_PROVIDER_TEMPORARY',
  );
  mock.mockResolvedValue(new Response('', { status: 401 }));
  await expect(new OpenAiMenuParser().parse('برگر تست')).rejects.toThrow(
    'AI_PROVIDER_REJECTED',
  );
});
test('refusals and invalid monetary output cannot become a valid draft', async () => {
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      status: 'completed',
      output: [
        { type: 'message', content: [{ type: 'refusal', refusal: 'No' }] },
      ],
    }),
  );
  await expect(new OpenAiMenuParser().parse('برگر تست')).rejects.toThrow(
    'AI_REFUSED',
  );
  mock.mockResolvedValue(
    Response.json({
      status: 'completed',
      output: [
        {
          type: 'message',
          content: [
            {
              type: 'output_text',
              text: JSON.stringify({ ...result, priceToman: 0 }),
            },
          ],
        },
      ],
    }),
  );
  await expect(new OpenAiMenuParser().parse('برگر تست')).rejects.toThrow(
    'AI_INVALID_OUTPUT',
  );
});

test('Ollama uses schema-constrained local inference and reports provider token counts', async () => {
  const { OllamaMenuParser } = await import('./provider');
  process.env.OLLAMA_MODEL = 'test-model';
  const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
    Response.json({
      done: true,
      message: {
        content: JSON.stringify({ ...result, category: 'غذاهای ایرانی' }),
      },
      prompt_eval_count: 45,
      eval_count: 20,
    }),
  );
  const usage = jest.fn();
  try {
    expect(
      (await new OllamaMenuParser().parse('کباب ۴۵۰ هزار تومان', usage))
        .category,
    ).toBe('غذاهای ایرانی');
    expect(usage).toHaveBeenCalledWith({
      provider: 'ollama',
      model: 'test-model',
      inputTokens: 45,
      outputTokens: 20,
    });
    const body = JSON.parse(String(mock.mock.calls[0][1]?.body));
    expect(body.stream).toBe(false);
    expect(body.format.additionalProperties).toBe(false);
    expect(body.options.num_predict).toBe(600);
  } finally {
    delete process.env.OLLAMA_MODEL;
  }
});
test('provider selection fails closed and oversized output is rejected', async () => {
  const { configuredMenuParser } = await import('./provider');
  const old = process.env.AI_PROVIDER;
  const eligibility = process.env.AI_PROVIDER_ELIGIBILITY_CONFIRMED;
  try {
    process.env.AI_PROVIDER = 'openai';
    delete process.env.AI_PROVIDER_ELIGIBILITY_CONFIRMED;
    await expect(
      configuredMenuParser().parse('کباب ۳۸۰ هزار تومان'),
    ).rejects.toThrow('AI_PROVIDER_NOT_ELIGIBLE');
    process.env.OPENAI_API_KEY = 'test';
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('a'.repeat(65537)));
    await expect(
      new OpenAiMenuParser().parse('کباب ۳۸۰ هزار تومان'),
    ).rejects.toThrow('AI_OUTPUT_TOO_LARGE');
  } finally {
    if (old === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = old;
    if (eligibility === undefined)
      delete process.env.AI_PROVIDER_ELIGIBILITY_CONFIRMED;
    else process.env.AI_PROVIDER_ELIGIBILITY_CONFIRMED = eligibility;
  }
});

test('AvalAI uses its fixed origin and credential, validates output and tracks provider usage', async () => {
  const old = process.env.AVALAI_API_KEY;
  const oldProvider = process.env.AI_PROVIDER;
  try {
    process.env.AVALAI_API_KEY = 'avalai-test-only';
    process.env.AI_PROVIDER = 'avalai';
    const mock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        status: 'completed',
        usage: { input_tokens: 12, output_tokens: 25 },
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(result) }],
          },
        ],
      }),
    );
    const { configuredMenuParser } = await import('./provider');
    const usage = jest.fn();
    expect(
      await configuredMenuParser().parse('برگر ۴۵۰ هزار تومان', usage),
    ).toEqual(result);
    expect(mock.mock.calls[0][0]).toBe('https://api.avalai.ir/v1/responses');
    expect(mock.mock.calls[0][1]?.headers).toMatchObject({
      Authorization: 'Bearer avalai-test-only',
    });
    expect(usage).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'avalai', inputTokens: 12 }),
    );
    delete process.env.AVALAI_API_KEY;
    await expect(configuredMenuParser().parse('برگر تست')).rejects.toThrow(
      'AI_NOT_CONFIGURED',
    );
    expect(mock).toHaveBeenCalledTimes(1);
  } finally {
    if (old === undefined) delete process.env.AVALAI_API_KEY;
    else process.env.AVALAI_API_KEY = old;
    if (oldProvider === undefined) delete process.env.AI_PROVIDER;
    else process.env.AI_PROVIDER = oldProvider;
  }
});
