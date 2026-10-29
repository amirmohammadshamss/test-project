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
  await expect(new OpenAiMenuParser().parse('برگر')).rejects.toThrow(
    'AI_NOT_CONFIGURED',
  );
  expect(mock).not.toHaveBeenCalled();
});
test('temporary and permanent HTTP failures are distinguishable', async () => {
  process.env.OPENAI_API_KEY = 'test-only-placeholder';
  const mock = jest
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response('', { status: 429 }));
  await expect(new OpenAiMenuParser().parse('برگر')).rejects.toThrow(
    'AI_PROVIDER_TEMPORARY',
  );
  mock.mockResolvedValue(new Response('', { status: 401 }));
  await expect(new OpenAiMenuParser().parse('برگر')).rejects.toThrow(
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
  await expect(new OpenAiMenuParser().parse('برگر')).rejects.toThrow(
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
  await expect(new OpenAiMenuParser().parse('برگر')).rejects.toThrow(
    'AI_INVALID_OUTPUT',
  );
});
