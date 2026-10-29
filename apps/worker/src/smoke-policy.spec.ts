import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const policy = runInNewContext(
  readFileSync('scripts/smoke-ai-policy.mjs', 'utf8').replace(
    'export function',
    'function',
  ) + '\nsmokeAiPolicy',
  { process: { env: {} } },
) as (env: Record<string, string>) => { expected: string; errorCode?: string };
test('smoke follows provider selection rather than unrelated OpenAI key presence', () => {
  expect(
    policy({ AI_PROVIDER: 'disabled', OPENAI_API_KEY: 'not-used' }),
  ).toEqual({ expected: 'FAILED', errorCode: 'AI_NOT_CONFIGURED' });
  expect(policy({ AI_PROVIDER: 'ollama', OLLAMA_MODEL: 'fixture' })).toEqual({
    expected: 'READY',
  });
  expect(policy({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'fixture' })).toEqual({
    expected: 'FAILED',
    errorCode: 'AI_PROVIDER_NOT_ELIGIBLE',
  });
});
