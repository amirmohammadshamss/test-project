export function smokeAiPolicy(env = process.env) {
  const provider = env.AI_PROVIDER || 'disabled';
  if (provider === 'disabled')
    return { expected: 'FAILED', errorCode: 'AI_NOT_CONFIGURED' };
  if (
    provider === 'openai' &&
    env.AI_PROVIDER_ELIGIBILITY_CONFIRMED === 'true' &&
    env.OPENAI_API_KEY
  )
    return { expected: 'READY' };
  if (provider === 'avalai')
    return env.AVALAI_API_KEY
      ? { expected: 'READY' }
      : { expected: 'FAILED', errorCode: 'AI_NOT_CONFIGURED' };
  if (provider === 'ollama' && env.OLLAMA_MODEL) return { expected: 'READY' };
  if (
    (provider === 'openai' &&
      env.AI_PROVIDER_ELIGIBILITY_CONFIRMED === 'true') ||
    provider === 'ollama'
  )
    return { expected: 'FAILED', errorCode: 'AI_NOT_CONFIGURED' };
  return { expected: 'FAILED', errorCode: 'AI_PROVIDER_NOT_ELIGIBLE' };
}
