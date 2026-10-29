import { readFileSync } from 'node:fs';
import { configuredMenuParser } from '../apps/worker/src/provider';
import type { AiUsage } from '../packages/shared/src/ai';
async function main() {
  if (
    process.env.AI_EVAL_CONFIRM !== '1' ||
    !['ollama', 'openai'].includes(process.env.AI_PROVIDER || '')
  )
    throw new Error(
      'Select an eligible AI_PROVIDER and explicitly set AI_EVAL_CONFIRM=1. Evaluation invokes the model and may incur costs.',
    );
  const corpus = JSON.parse(
    readFileSync('scripts/fixtures/persian-menu-evaluation.json', 'utf8'),
  ) as {
    input: string;
    expected?: { name: string; priceToman: number; category: string };
    reject?: boolean;
  }[];
  const parser = configuredMenuParser();
  let exact = 0,
    prices = 0,
    rejected = 0,
    errors = 0,
    tokensIn = 0,
    tokensOut = 0,
    samples = 0;
  const started = Date.now();
  for (const fixture of corpus) {
    try {
      const result = await parser.parse(fixture.input, (usage: AiUsage) => {
        samples++;
        tokensIn += usage.inputTokens || 0;
        tokensOut += usage.outputTokens || 0;
      });
      if (fixture.expected) {
        if (result.priceToman === fixture.expected.priceToman) prices++;
        if (
          Object.entries(fixture.expected).every(
            ([k, v]) => result[k as keyof typeof result] === v,
          )
        )
          exact++;
      }
    } catch (e) {
      if (
        fixture.reject &&
        e instanceof Error &&
        e.message === 'AI_INVALID_OUTPUT'
      )
        rejected++;
      else errors++;
    }
  }
  console.log(
    JSON.stringify(
      {
        cases: corpus.length,
        positiveCases: corpus.filter((f) => f.expected).length,
        exactMatches: exact,
        correctPrices: prices,
        correctRejections: rejected,
        providerErrors: errors,
        elapsedMs: Date.now() - started,
        reportedInputTokens: tokensIn,
        reportedOutputTokens: tokensOut,
        usageSamples: samples,
        billedCost: null,
      },
      null,
      2,
    ),
  );
  if (
    exact !== corpus.filter((f) => f.expected).length ||
    rejected !== corpus.filter((f) => f.reject).length ||
    errors
  )
    process.exitCode = 1;
}
void main().catch(() => {
  console.error(
    'AI_EVALUATION_NOT_COMPLETED: check provider selection, eligibility and explicit AI_EVAL_CONFIRM=1; no secrets logged.',
  );
  process.exitCode = 1;
});
